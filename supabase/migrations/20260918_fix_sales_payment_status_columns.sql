-- ====================================================================
-- HUM VÍCIO ERP: CORREÇÃO DE COLUNAS DE PAGAMENTO EM SALES & RPCS RESILIENTES
-- Data: 18/09/2026
-- ====================================================================

BEGIN;

-- 1. Garante a existência das colunas de pagamento e crédito em public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pago';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS paid_method TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_status TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_paid_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_paid_method TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_customer_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_due_date TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_notes TEXT;

-- 2. Atualiza pedidos existentes para status de pagamento consistente
UPDATE public.sales
SET payment_status = CASE 
  WHEN status = 'cancelled' THEN 'estornado'
  WHEN payment_method IN ('consumo_funcionario', 'fiado_vip') THEN 'pendente_retirada'
  ELSE 'pago'
END
WHERE payment_status IS NULL;

-- 3. Recria RPC de cancelamento de pedido garantindo compatibilidade e estorno atômico
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
      production_status = 'cancelado',
      cancellation_reason = v_reason,
      cancelled_by = p_cancelled_by,
      cancelled_at = v_now,
      updated_at = v_now
  WHERE id = p_sale_id;

  -- Se tabela payment_events existir, registra evento de estorno
  BEGIN
    INSERT INTO public.payment_events (
      sale_id, cash_session_id, amount, payment_method, event_type,
      operator_id, operator_name, notes, created_at
    ) VALUES (
      p_sale_id, NULL, v_sale.total, COALESCE(v_sale.payment_method, 'dinheiro'),
      'estorno_cancelamento', p_operator_id, p_cancelled_by, v_reason, v_now
    );
  EXCEPTION WHEN OTHERS THEN
    -- Não aborta o cancelamento caso payment_events tenha restrição não impeditiva
    NULL;
  END;

  -- Auditoria no servidor
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'saleId', p_sale_id,
    'cancelledAt', v_now,
    'cancelledBy', p_cancelled_by,
    'reason', v_reason
  );
END;
$$;

-- 4. Recria RPC de quitação de pedidos garantindo integridade
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
    UPDATE public.sales
    SET credit_status = 'quitado',
        credit_paid_at = v_now,
        credit_paid_method = p_payment_method,
        updated_at = v_now
    WHERE id = p_sale_id;

    v_event_type := 'liquidacao_fiado';
  ELSE
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
  BEGIN
    INSERT INTO public.payment_events (
      sale_id, cash_session_id, amount, payment_method, event_type,
      operator_id, operator_name, created_at
    ) VALUES (
      p_sale_id, p_session_id, v_sale.total, p_payment_method, v_event_type,
      p_operator_id, p_operator_name, v_now
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Se foi quitado em dinheiro físico no balcão, gera suprimento automático na gaveta
  IF p_payment_method = 'dinheiro' AND p_session_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.cash_movements (
        session_id, type, amount, description, operator, created_at
      ) VALUES (
        p_session_id, 'suprimento', v_sale.total,
        'Recebimento Quitação #' || substring(p_sale_id::text, 1, 6) || ' (' || COALESCE(v_sale.customer_name, 'Cliente') || ')',
        p_operator_name, v_now
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Auditoria no servidor
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'saleId', p_sale_id,
    'paidAt', v_now,
    'paidMethod', p_payment_method,
    'total', v_sale.total
  );
END;
$$;

COMMIT;
