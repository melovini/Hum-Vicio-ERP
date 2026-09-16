-- ====================================================================
-- HUM VÍCIO ERP: FECHAMENTO DE CAIXA, PAGAMENTOS E AUTORIZAÇÃO POR AÇÃO
-- Data: 18/09/2026
-- ====================================================================

BEGIN;

-- 1. ADAPTAÇÕES DE COLUNAS EM CASH_SESSIONS E CASH_MOVEMENTS
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS closing_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS operator TEXT;
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON public.cash_movements(session_id);

-- 2. TABELA DE EVENTOS DE PAGAMENTO (Rastreamento Imutável de Recebimentos & Quitações)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE RESTRICT,
  cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('pagamento_inicial', 'liquidacao_retirada', 'liquidacao_fiado', 'estorno_cancelamento')),
  operator_id text NOT NULL,
  operator_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_sale ON public.payment_events(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_session ON public.payment_events(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON public.payment_events(created_at);

-- 3. RPC: FECHAMENTO DE CAIXA CONCORRENTE E CONCILIAÇÃO DETALHADA
CREATE OR REPLACE FUNCTION public.close_cash_session_transaction(
  p_session_id uuid,
  p_final_amount numeric,
  p_expected_amount numeric,
  p_variance_amount numeric,
  p_operator_name text,
  p_closing_details jsonb,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session RECORD;
  v_audit_summary text;
  v_now timestamptz := now();
BEGIN
  -- 3.1 Lock pessimista para impedir fechamento concorrente da mesma sessão
  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão de caixa não encontrada.';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Esta sessão de caixa já foi encerrada por % em %.', v_session.closed_by, v_session.closed_at;
  END IF;

  -- 3.2 Atualização atômica do encerramento
  UPDATE public.cash_sessions
  SET status = 'closed',
      final_amount = p_final_amount,
      expected_amount = p_expected_amount,
      variance_amount = p_variance_amount,
      closed_by = p_operator_name,
      closed_at = v_now,
      closing_details = COALESCE(p_closing_details, '{}'::jsonb),
      notes = p_notes,
      updated_at = v_now
  WHERE id = p_session_id;

  -- 3.3 Auditoria atômica do fechamento
  v_audit_summary := 'Fechamento de Caixa efetuado por ' || p_operator_name ||
    '. Declarado: R$ ' || to_char(p_final_amount, 'FM999999990.00') ||
    ' | Esperado: R$ ' || to_char(COALESCE(p_expected_amount, 0), 'FM999999990.00') ||
    ' | Diferença: ' || CASE WHEN p_variance_amount >= 0 THEN '+' ELSE '' END || to_char(p_variance_amount, 'FM999999990.00') ||
    CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0 THEN ' (Obs: ' || trim(p_notes) || ')' ELSE '' END;

  INSERT INTO public.audit_logs (
    action, details, operator, previous_value, new_value, created_at
  ) VALUES (
    'FECHAMENTO_CAIXA',
    v_audit_summary,
    p_operator_name,
    'Esperado: R$ ' || to_char(COALESCE(p_expected_amount, 0), 'FM999999990.00'),
    'Declarado: R$ ' || to_char(p_final_amount, 'FM999999990.00'),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'sessionId', p_session_id,
    'closedAt', v_now,
    'finalAmount', p_final_amount,
    'varianceAmount', p_variance_amount
  );
END;
$$;

-- 4. RPC: REGISTRO DE MOVIMENTAÇÃO DE CAIXA (SANGRIA / SUPRIMENTO) COM VALIDAÇÃO
CREATE OR REPLACE FUNCTION public.record_cash_movement_transaction(
  p_session_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_operator_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mov_id uuid := gen_random_uuid();
  v_session RECORD;
  v_now timestamptz := now();
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor da movimentação deve ser maior que zero.';
  END IF;

  IF p_type NOT IN ('sangria', 'suprimento') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido. Use sangria ou suprimento.';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) < 3 THEN
    RAISE EXCEPTION 'Informe um motivo/descrição com pelo menos 3 caracteres.';
  END IF;

  -- Se fornecido ID da sessão, validar que está aberta
  IF p_session_id IS NOT NULL THEN
    SELECT * INTO v_session FROM public.cash_sessions WHERE id = p_session_id;
    IF FOUND AND v_session.status <> 'open' THEN
      RAISE EXCEPTION 'Não é possível lançar movimentação em um caixa já encerrado.';
    END IF;
  END IF;

  -- Insere a movimentação
  INSERT INTO public.cash_movements (
    id, session_id, type, amount, description, operator, created_at
  ) VALUES (
    v_mov_id, p_session_id, p_type, p_amount, trim(p_description), p_operator_name, v_now
  );

  -- Insere auditoria
  INSERT INTO public.audit_logs (
    action, details, operator, previous_value, new_value, created_at
  ) VALUES (
    CASE WHEN p_type = 'sangria' THEN 'SANGRIA' ELSE 'SUPRIMENTO' END,
    upper(p_type) || ': R$ ' || to_char(p_amount, 'FM999999990.00') || ' — ' || trim(p_description),
    p_operator_name,
    NULL,
    'R$ ' || to_char(p_amount, 'FM999999990.00'),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_mov_id,
    'type', p_type,
    'amount', p_amount,
    'createdAt', v_now
  );
END;
$$;

-- 5. RPC: QUITAÇÃO SEGURA DE PEDIDOS (RETIRADA / FIADO VIP) CONTRA DUPLICIDADE
CREATE OR REPLACE FUNCTION public.settle_order_payment_transaction(
  p_sale_id uuid,
  p_session_id uuid,
  p_payment_method text,
  p_operator_id text,
  p_operator_name text,
  p_settlement_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale RECORD;
  v_now timestamptz := now();
  v_event_type text;
BEGIN
  -- Lock pessimista na venda
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Não é possível quitar um pedido que já foi cancelado.';
  END IF;

  -- Se for fiado VIP ou consumo de colaborador
  IF p_settlement_type = 'fiado' THEN
    IF v_sale.credit_status = 'quitado' THEN
      RAISE EXCEPTION 'Esta conta a receber já se encontra quitada.';
    END IF;

    UPDATE public.sales
    SET credit_status = 'quitado',
        credit_paid_at = v_now,
        credit_paid_method = p_payment_method,
        updated_at = v_now
    WHERE id = p_sale_id;

    v_event_type := 'liquidacao_fiado';
  ELSE
    -- Quitação de retirada padrão
    IF v_sale.payment_status = 'pago' THEN
      RAISE EXCEPTION 'Este pedido para retirada já se encontra pago.';
    END IF;

    UPDATE public.sales
    SET payment_status = 'pago',
        paid_at = v_now,
        paid_method = p_payment_method,
        payment_method = p_payment_method,
        updated_at = v_now
    WHERE id = p_sale_id;

    v_event_type := 'liquidacao_retirada';
  END IF;

  -- Registra o evento de pagamento imutável vinculado ao turno ativo
  INSERT INTO public.payment_events (
    sale_id, cash_session_id, amount, payment_method, event_type,
    operator_id, operator_name, created_at
  ) VALUES (
    p_sale_id, p_session_id, v_sale.total, p_payment_method, v_event_type,
    p_operator_id, p_operator_name, v_now
  );

  -- Se foi quitado em dinheiro físico no balcão, gera suprimento automático na gaveta
  IF p_payment_method = 'dinheiro' AND p_session_id IS NOT NULL THEN
    INSERT INTO public.cash_movements (
      session_id, type, amount, description, operator, created_at
    ) VALUES (
      p_session_id, 'suprimento', v_sale.total,
      'Recebimento Quitação #' || substring(p_sale_id::text, 1, 6) || ' (' || COALESCE(v_sale.customer_name, 'Cliente') || ')',
      p_operator_name, v_now
    );
  END IF;

  -- Auditoria no servidor
  INSERT INTO public.audit_logs (
    action, details, operator, previous_value, new_value, created_at
  ) VALUES (
    CASE WHEN p_settlement_type = 'fiado' THEN 'LIQUIDACAO_FIADO' ELSE 'LIQUIDACAO_RETIRADA' END,
    'Quitação do pedido #' || substring(p_sale_id::text, 1, 6) || ' confirmada no valor de R$ ' ||
      to_char(v_sale.total, 'FM999999990.00') || ' via ' || upper(p_payment_method) || ' (' || COALESCE(v_sale.customer_name, 'Cliente') || ').',
    p_operator_name,
    'pendente',
    'pago',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'saleId', p_sale_id,
    'paidAt', v_now,
    'paidMethod', p_payment_method,
    'total', v_sale.total
  );
END;
$$;

-- 6. RPC: CANCELAMENTO ATÔMICO DE PEDIDO COM ESTORNO E AUDITORIA
CREATE OR REPLACE FUNCTION public.cancel_order_transaction(
  p_sale_id uuid,
  p_cancellation_reason text,
  p_cancellation_notes text,
  p_cancelled_by text,
  p_operator_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale RECORD;
  v_now timestamptz := now();
  v_reason text := COALESCE(nullif(trim(p_cancellation_reason), ''), 'Cancelamento manual pelo operador');
BEGIN
  -- Lock pessimista na venda
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado para cancelamento.';
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Este pedido já se encontra cancelado.';
  END IF;

  -- Atualiza status para cancelado (o trigger estornar_estoque_cancelamento() estorna e registra em inventory_movements)
  UPDATE public.sales
  SET status = 'cancelled',
      cancellation_reason = v_reason,
      cancelled_by = p_cancelled_by,
      cancelled_at = v_now,
      updated_at = v_now
  WHERE id = p_sale_id;

  -- Se o pedido possuía pagamento confirmado, registra evento de estorno em payment_events
  IF v_sale.payment_status = 'pago' THEN
    INSERT INTO public.payment_events (
      sale_id, cash_session_id, amount, payment_method, event_type,
      operator_id, operator_name, notes, created_at
    ) VALUES (
      p_sale_id, NULL, v_sale.total, COALESCE(v_sale.paid_method, v_sale.payment_method, 'dinheiro'),
      'estorno_cancelamento', p_operator_id, p_cancelled_by, v_reason, v_now
    );
  END IF;

  -- Auditoria no servidor
  INSERT INTO public.audit_logs (
    action, details, operator, previous_value, new_value, created_at
  ) VALUES (
    'CANCELAMENTO_VENDA',
    'Venda #' || substring(p_sale_id::text, 1, 8) || ' no valor de R$ ' || to_char(v_sale.total, 'FM999999990.00') ||
      ' cancelada por ' || p_cancelled_by || '. Motivo: ' || v_reason ||
      CASE WHEN p_cancellation_notes IS NOT NULL AND length(trim(p_cancellation_notes)) > 0 THEN ' (Obs: ' || trim(p_cancellation_notes) || ')' ELSE '' END,
    p_cancelled_by,
    'Concluída',
    'Cancelada',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'saleId', p_sale_id,
    'cancelledAt', v_now,
    'cancelledBy', p_cancelled_by,
    'cancellationReason', v_reason
  );
END;
$$;

-- 7. BLINDAGEM DE PRIVILÉGIOS (Somente service_role)
REVOKE ALL ON public.payment_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.payment_events TO service_role;

REVOKE EXECUTE ON FUNCTION public.close_cash_session_transaction FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_cash_session_transaction TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_cash_movement_transaction FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_cash_movement_transaction TO service_role;

REVOKE EXECUTE ON FUNCTION public.settle_order_payment_transaction FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_order_payment_transaction TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_order_transaction FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order_transaction TO service_role;

COMMIT;
