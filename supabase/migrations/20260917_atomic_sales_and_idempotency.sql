-- ====================================================================
-- HUM VÍCIO ERP: TRANSAÇÃO ATÔMICA DE VENDA, IDEMPOTÊNCIA & ESTOQUE
-- Data: 17/09/2026
-- ====================================================================

BEGIN;

-- 1. TABELA DE CHAVES DE IDEMPOTÊNCIA (Prevenção de Duplicidade por Reenvio / Oscilação de Rede)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key text PRIMARY KEY,
  scope text NOT NULL DEFAULT 'sale_checkout',
  sale_id uuid,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON public.idempotency_keys(created_at);

-- 2. TABELA DE MOVIMENTAÇÕES DE ESTOQUE (Ledger Imutável para Auditoria e Conciliação)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
  quantity_delta numeric(12,3) NOT NULL, -- Negativo para baixa, positivo para estorno/entrada
  previous_stock numeric(12,3),
  new_stock numeric(12,3),
  movement_type text NOT NULL CHECK (movement_type IN ('venda', 'estorno_cancelamento', 'ajuste_manual', 'perda_cozinha', 'compra_entrada')),
  reference_id text, -- ID da venda, perda ou compra vinculada
  operator text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_movements_ingredient ON public.inventory_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_ref ON public.inventory_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created ON public.inventory_movements(created_at);

-- 3. REMOÇÃO DO TRIGGER LEGADO DE BAIXA DUPLICADA
-- O trigger anterior disparava em cada inserção de sale_items e provocava concorrência
-- com a baixa do navegador. Agora a baixa é centralizada e atômica na RPC transacional.
DROP TRIGGER IF EXISTS trigger_baixar_estoque ON public.sale_items;

-- 4. ATUALIZAÇÃO DO TRIGGER DE ESTORNO DE ESTOQUE NO CANCELAMENTO COM AUDITORIA
CREATE OR REPLACE FUNCTION public.estornar_estoque_cancelamento() RETURNS TRIGGER AS $$
DECLARE
  recipe_record RECORD;
  item_record RECORD;
  v_prev numeric;
  v_new numeric;
BEGIN
  IF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
    FOR item_record IN SELECT product_id, quantity, additionals FROM public.sale_items WHERE sale_id = NEW.id
    LOOP
      -- Estorno dos insumos da receita básica do produto
      FOR recipe_record IN SELECT ingredient_id, quantity FROM public.recipes WHERE product_id = item_record.product_id
      LOOP
        UPDATE public.inventory 
        SET current_stock = current_stock + (recipe_record.quantity * item_record.quantity),
            status = CASE
              WHEN (current_stock + (recipe_record.quantity * item_record.quantity)) > COALESCE(min_stock, 0) THEN 'ok'
              ELSE status
            END
        WHERE id = recipe_record.ingredient_id
        RETURNING current_stock - (recipe_record.quantity * item_record.quantity), current_stock INTO v_prev, v_new;

        INSERT INTO public.inventory_movements (
          ingredient_id, quantity_delta, previous_stock, new_stock,
          movement_type, reference_id, operator, notes
        ) VALUES (
          recipe_record.ingredient_id, (recipe_record.quantity * item_record.quantity), v_prev, v_new,
          'estorno_cancelamento', NEW.id::text, COALESCE(NEW.cancelled_by, 'Sistema'),
          'Estorno automático por cancelamento de pedido'
        );
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. RPC TRANSACIONAL ATÔMICA DE CHECKOUT COM IDEMPOTÊNCIA
CREATE OR REPLACE FUNCTION public.process_sale_checkout(
  p_idempotency_key text,
  p_sale jsonb,
  p_operator_id text,
  p_operator_name text,
  p_operator_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key_record RECORD;
  v_sale_id uuid;
  v_item jsonb;
  v_item_product_id uuid;
  v_item_qty integer;
  v_item_price numeric;
  v_item_name text;
  v_recipe_rec RECORD;
  v_add_rec RECORD;
  v_required numeric;
  v_prev_stock numeric;
  v_new_stock numeric;
  v_response jsonb;
  v_additional jsonb;
  v_add_ingredient_id uuid;
  v_add_name text;
BEGIN
  -- 5.1 Bloqueio de concorrência por chave de idempotência
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));

  SELECT * INTO v_key_record FROM public.idempotency_keys WHERE key = p_idempotency_key;
  IF FOUND THEN
    IF v_key_record.status = 'completed' AND v_key_record.response IS NOT NULL THEN
      -- Retorna imediatamente a resposta da transação já finalizada sem reprocessar
      RETURN v_key_record.response;
    ELSIF v_key_record.status = 'in_progress' THEN
      RAISE EXCEPTION 'Esta transação já está sendo processada por outro terminal';
    END IF;
  END IF;

  -- Registra a chave em progresso
  INSERT INTO public.idempotency_keys (key, sale_id, status, created_at)
  VALUES (p_idempotency_key, (p_sale->>'id')::uuid, 'in_progress', now())
  ON CONFLICT (key) DO UPDATE SET status = 'in_progress', updated_at = now();

  -- 5.2 Validação e Inserção do Cabeçalho da Venda
  v_sale_id := (p_sale->>'id')::uuid;
  IF v_sale_id IS NULL THEN
    RAISE EXCEPTION 'ID da venda inválido ou ausente';
  END IF;

  INSERT INTO public.sales (
    id, channel, total, payment_method, status,
    customer_name, order_type, production_status, production_started_at,
    target_prep_minutes, subtotal, discount, delivery_fee, store_coupon_subsidy, created_at
  ) VALUES (
    v_sale_id,
    COALESCE(p_sale->>'channel', 'balcao'),
    (p_sale->>'total')::numeric,
    COALESCE(p_sale->>'paidMethod', p_sale->>'paymentMethod', 'dinheiro'),
    'completed',
    COALESCE(p_sale->>'customerName', 'Balcão'),
    COALESCE(p_sale->>'orderType', 'mesa'),
    COALESCE(p_sale->>'productionStatus', 'em_espera'),
    COALESCE((p_sale->>'productionStartedAt')::timestamptz, now()),
    COALESCE((p_sale->>'targetPrepMinutes')::integer, 20),
    COALESCE((p_sale->>'subtotal')::numeric, (p_sale->>'total')::numeric),
    COALESCE((p_sale->>'discount')::numeric, 0),
    COALESCE((p_sale->>'deliveryFee')::numeric, 0),
    COALESCE((p_sale->>'storeCouponSubsidy')::numeric, 0),
    COALESCE((p_sale->>'date')::timestamptz, now())
  );

  -- 5.3 Inserção dos Itens e Baixa Atômica de Estoque
  IF p_sale->'items' IS NOT NULL AND jsonb_array_length(p_sale->'items') > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_sale->'items')
    LOOP
      v_item_product_id := (v_item->>'productId')::uuid;
      v_item_qty := COALESCE((v_item->>'quantity')::integer, 1);
      v_item_price := COALESCE((v_item->>'unitPrice')::numeric, 0);
      v_item_name := COALESCE(v_item->>'productName', 'Item');

      -- Insere item da venda
      INSERT INTO public.sale_items (
        sale_id, product_id, product_name, quantity, unit_price,
        original_price, is_gift, gift_reason, gift_notes, additionals
      ) VALUES (
        v_sale_id, v_item_product_id, v_item_name, v_item_qty, v_item_price,
        (v_item->>'originalPrice')::numeric,
        COALESCE((v_item->>'isGift')::boolean, false),
        v_item->>'giftReason',
        v_item->>'giftNotes',
        COALESCE(v_item->'additionals', '[]'::jsonb)
      );

      -- Baixa dos insumos cadastrados na Ficha Técnica (Receita)
      IF v_item_product_id IS NOT NULL THEN
        FOR v_recipe_rec IN 
          SELECT ingredient_id, quantity 
          FROM public.recipes 
          WHERE product_id = v_item_product_id
        LOOP
          v_required := v_recipe_rec.quantity * v_item_qty;

          UPDATE public.inventory
          SET current_stock = current_stock - v_required,
              status = CASE
                WHEN (current_stock - v_required) <= 0 THEN 'zerado'
                WHEN min_stock IS NOT NULL AND (current_stock - v_required) <= min_stock THEN 'acabando'
                ELSE status
              END
          WHERE id = v_recipe_rec.ingredient_id
          RETURNING current_stock + v_required, current_stock INTO v_prev_stock, v_new_stock;

          INSERT INTO public.inventory_movements (
            ingredient_id, quantity_delta, previous_stock, new_stock,
            movement_type, reference_id, operator, notes
          ) VALUES (
            v_recipe_rec.ingredient_id, -v_required, v_prev_stock, v_new_stock,
            'venda', v_sale_id::text, p_operator_name,
            'Baixa atômica de receita: ' || v_item_name
          );
        END LOOP;
      END IF;

      -- Baixa atômica de insumos por adicionais extras selecionados
      IF v_item->'additionals' IS NOT NULL AND jsonb_array_length(v_item->'additionals') > 0 THEN
        FOR v_additional IN SELECT * FROM jsonb_array_elements(v_item->'additionals')
        LOOP
          v_add_name := v_additional->>'name';
          v_add_ingredient_id := NULL;

          -- 1º Procura receita de produto adicional correspondente
          SELECT r.ingredient_id, r.quantity INTO v_add_rec
          FROM public.products p
          JOIN public.recipes r ON r.product_id = p.id
          WHERE p.name = 'Adicional: ' || v_add_name OR p.name = v_add_name
          LIMIT 1;

          IF FOUND THEN
            v_required := v_add_rec.quantity * v_item_qty;
            v_add_ingredient_id := v_add_rec.ingredient_id;
          ELSE
            -- 2º Procura diretamente na tabela de insumos por similaridade exata
            SELECT id INTO v_add_ingredient_id
            FROM public.inventory
            WHERE lower(name) = lower(v_add_name)
               OR lower(name) = lower(v_add_name || ' (Pronto)')
               OR lower(name) = lower(v_add_name || ' (Pronta)')
            LIMIT 1;

            IF v_add_ingredient_id IS NOT NULL THEN
              v_required := 1 * v_item_qty;
            END IF;
          END IF;

          IF v_add_ingredient_id IS NOT NULL THEN
            UPDATE public.inventory
            SET current_stock = current_stock - v_required,
                status = CASE
                  WHEN (current_stock - v_required) <= 0 THEN 'zerado'
                  WHEN min_stock IS NOT NULL AND (current_stock - v_required) <= min_stock THEN 'acabando'
                  ELSE status
                END
            WHERE id = v_add_ingredient_id
            RETURNING current_stock + v_required, current_stock INTO v_prev_stock, v_new_stock;

            INSERT INTO public.inventory_movements (
              ingredient_id, quantity_delta, previous_stock, new_stock,
              movement_type, reference_id, operator, notes
            ) VALUES (
              v_add_ingredient_id, -v_required, v_prev_stock, v_new_stock,
              'venda', v_sale_id::text, p_operator_name,
              'Baixa atômica de adicional: ' || v_add_name
            );
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 5.4 Auditoria Automática no Servidor
  INSERT INTO public.audit_logs (
    action, details, operator, previous_value, new_value, created_at
  ) VALUES (
    'VENDA_CONCLUIDA',
    'Venda #' || substring(v_sale_id::text, 1, 8) || ' concluída no valor de R$ ' || (p_sale->>'total') || ' (' || COALESCE(p_sale->>'customerName', 'Balcão') || ') via ' || COALESCE(p_sale->>'paidMethod', p_sale->>'paymentMethod', 'dinheiro'),
    p_operator_name,
    NULL,
    p_sale->>'total',
    now()
  );

  -- 5.5 Montagem da resposta e finalização da chave de idempotência
  v_response := jsonb_build_object(
    'success', true,
    'saleId', v_sale_id,
    'sale', p_sale || jsonb_build_object(
      'id', v_sale_id,
      'status', 'completed',
      'date', now()
    )
  );

  UPDATE public.idempotency_keys
  SET status = 'completed',
      sale_id = v_sale_id,
      response = v_response,
      updated_at = now()
  WHERE key = p_idempotency_key;

  RETURN v_response;
END;
$$;

-- 6. BLINDAGEM DE PRIVILÉGIOS (Nenhum acesso para anon/authenticated; Acesso restrito a service_role)
REVOKE ALL ON public.idempotency_keys FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.inventory_movements FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_sale_checkout FROM anon, authenticated, PUBLIC;

GRANT ALL ON public.idempotency_keys TO service_role;
GRANT ALL ON public.inventory_movements TO service_role;
GRANT EXECUTE ON FUNCTION public.process_sale_checkout TO service_role;

COMMIT;
