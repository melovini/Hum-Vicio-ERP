-- =========================================================================
-- MIGRAÇÃO: COMPOSIÇÃO DE PEDIDO, POLÍTICA DE PERDAS E TRANSAÇÕES ATÔMICAS
-- Data: 19/09/2026
-- =========================================================================

BEGIN;

-- 1. ADICIONAR COLUNAS ESTRUTURADAS EM public.sale_items (V02)
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS production_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS recipe_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS combo_id text,
  ADD COLUMN IF NOT EXISTS combo_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS meat_point text,
  ADD COLUMN IF NOT EXISTS removals jsonb DEFAULT '[]'::jsonb;

-- 2. ATUALIZAR TRIGGER DE ESTORNO DE ESTOQUE NO CANCELAMENTO (V05)
CREATE OR REPLACE FUNCTION public.estornar_estoque_cancelamento() RETURNS TRIGGER AS $$
DECLARE
  recipe_record RECORD;
  item_record RECORD;
  v_prev numeric;
  v_new numeric;
  v_is_prepared boolean;
  v_ing RECORD;
  v_qty_lost numeric;
  v_total_loss numeric;
BEGIN
  IF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
    -- Determina se o pedido já começou a ser preparado ou foi finalizado
    v_is_prepared := (OLD.production_status IN ('em_producao', 'concluido'));

    FOR item_record IN SELECT product_id, quantity, additionals, production_snapshot FROM public.sale_items WHERE sale_id = NEW.id
    LOOP
      FOR recipe_record IN SELECT ingredient_id, quantity FROM public.recipes WHERE product_id = item_record.product_id
      LOOP
        v_qty_lost := recipe_record.quantity * item_record.quantity;

        IF NOT v_is_prepared THEN
          -- CANCELAMENTO ANTES DO PREPARO (em_espera / agendado):
          -- Matéria-prima bruta não foi preparada, estorna ao estoque utilizável
          UPDATE public.inventory 
          SET current_stock = current_stock + v_qty_lost,
              status = CASE
                WHEN (current_stock + v_qty_lost) > COALESCE(min_stock, 0) THEN 'ok'
                ELSE status
              END
          WHERE id = recipe_record.ingredient_id
          RETURNING current_stock - v_qty_lost, current_stock INTO v_prev, v_new;

          INSERT INTO public.inventory_movements (
            ingredient_id, quantity_delta, previous_stock, new_stock,
            movement_type, reference_id, operator, notes
          ) VALUES (
            recipe_record.ingredient_id, v_qty_lost, v_prev, v_new,
            'estorno_cancelamento', NEW.id::text, COALESCE(NEW.cancelled_by, 'Sistema'),
            'Estorno automático por cancelamento pré-preparo'
          );
        ELSE
          -- CANCELAMENTO APÓS INÍCIO DO PREPARO (em_producao / concluido):
          -- Comida produzida NÃO volta ao estoque de matéria-prima utilizável!
          -- Registra formalmente como perda (waste_records) sem provocar dupla baixa
          SELECT name, unit, cost_per_unit INTO v_ing FROM public.inventory WHERE id = recipe_record.ingredient_id;
          IF FOUND THEN
            v_total_loss := COALESCE(v_ing.cost_per_unit, 0) * v_qty_lost;
            INSERT INTO public.waste_records (
              ingredient_id, ingredient_name, quantity, unit, cost_at_time, total_loss,
              reason, responsible_name, created_at
            ) VALUES (
              recipe_record.ingredient_id, v_ing.name, v_qty_lost, v_ing.unit,
              COALESCE(v_ing.cost_per_unit, 0), v_total_loss,
              'Cancelamento pós-preparo #' || substring(NEW.id::text, 1, 8) || ': ' || COALESCE(NEW.cancellation_reason, 'Descarte'),
              COALESCE(NEW.cancelled_by, 'Supervisor / Gerente'),
              now()
            );

            INSERT INTO public.inventory_movements (
              ingredient_id, quantity_delta, previous_stock, new_stock,
              movement_type, reference_id, operator, notes
            ) VALUES (
              recipe_record.ingredient_id, 0, 0, 0,
              'perda_cancelamento', NEW.id::text, COALESCE(NEW.cancelled_by, 'Sistema'),
              'Perda formal registrada por cancelamento de pedido pós-preparo'
            );
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. ATUALIZAR RPC PROCESS_SALE_CHECKOUT COM COMPOSIÇÃO E EXPANSÃO DE ADICIONAIS (V02, V04)
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
  v_sale_id uuid;
  v_item jsonb;
  v_item_product_id uuid;
  v_item_qty integer;
  v_item_price numeric;
  v_item_name text;
  v_recipe_rec RECORD;
  v_add_rec RECORD;
  v_additional jsonb;
  v_add_name text;
  v_add_id text;
  v_add_qty integer;
  v_add_ingredient_id uuid;
  v_found_recipe boolean;
  v_required numeric;
  v_prev_stock numeric;
  v_new_stock numeric;
  v_response jsonb;
BEGIN
  -- 1. Idempotência
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT response_payload INTO v_response
    FROM public.idempotency_keys
    WHERE key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_response;
    END IF;
  END IF;

  v_sale_id := (p_sale->>'id')::uuid;
  IF v_sale_id IS NULL THEN
    RAISE EXCEPTION 'ID da venda é obrigatório.';
  END IF;

  -- 2. Inserção do Pedido
  INSERT INTO public.sales (
    id, channel, total, payment_method, status, customer_name,
    order_type, production_status, production_started_at, target_prep_minutes,
    subtotal, discount, delivery_fee, store_coupon_subsidy, created_at
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

  -- 3. Inserção dos Itens e Baixa Atômica de Estoque
  IF p_sale->'items' IS NOT NULL AND jsonb_array_length(p_sale->'items') > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_sale->'items')
    LOOP
      v_item_product_id := (v_item->>'productId')::uuid;
      v_item_qty := COALESCE((v_item->>'quantity')::integer, 1);
      v_item_price := COALESCE((v_item->>'unitPrice')::numeric, 0);
      v_item_name := COALESCE(v_item->>'productName', 'Item');

      -- Insere item da venda com persistência completa da composição (V02)
      INSERT INTO public.sale_items (
        sale_id, product_id, product_name, quantity, unit_price,
        original_price, is_gift, gift_reason, gift_notes, additionals,
        production_snapshot, recipe_version, combo_id, combo_price, meat_point, removals
      ) VALUES (
        v_sale_id, v_item_product_id, v_item_name, v_item_qty, v_item_price,
        (v_item->>'originalPrice')::numeric,
        COALESCE((v_item->>'isGift')::boolean, false),
        v_item->>'giftReason',
        v_item->>'giftNotes',
        COALESCE(v_item->'additionals', '[]'::jsonb),
        v_item->'productionSnapshot',
        COALESCE((v_item->>'recipeVersion')::integer, 1),
        v_item->>'comboId',
        (v_item->>'comboPrice')::numeric,
        v_item->>'meatPoint',
        COALESCE(v_item->'removals', '[]'::jsonb)
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

      -- Baixa atômica de insumos por adicionais extras selecionados (V04: expansão completa sem LIMIT 1)
      IF v_item->'additionals' IS NOT NULL AND jsonb_array_length(v_item->'additionals') > 0 THEN
        FOR v_additional IN SELECT * FROM jsonb_array_elements(v_item->'additionals')
        LOOP
          v_add_name := v_additional->>'name';
          v_add_id := v_additional->>'id';
          v_add_qty := COALESCE((v_additional->>'quantity')::integer, 1);
          v_found_recipe := false;

          -- 1º Procura receita de produto adicional por ID
          IF v_add_id IS NOT NULL THEN
            FOR v_add_rec IN
              SELECT r.ingredient_id, r.quantity
              FROM public.recipes r
              WHERE r.product_id = v_add_id::uuid
            LOOP
              v_found_recipe := true;
              v_required := v_add_rec.quantity * v_add_qty * v_item_qty;

              UPDATE public.inventory
              SET current_stock = current_stock - v_required,
                  status = CASE
                    WHEN (current_stock - v_required) <= 0 THEN 'zerado'
                    WHEN min_stock IS NOT NULL AND (current_stock - v_required) <= min_stock THEN 'acabando'
                    ELSE status
                  END
              WHERE id = v_add_rec.ingredient_id
              RETURNING current_stock + v_required, current_stock INTO v_prev_stock, v_new_stock;

              INSERT INTO public.inventory_movements (
                ingredient_id, quantity_delta, previous_stock, new_stock,
                movement_type, reference_id, operator, notes
              ) VALUES (
                v_add_rec.ingredient_id, -v_required, v_prev_stock, v_new_stock,
                'venda', v_sale_id::text, p_operator_name,
                'Baixa atômica de adicional por ID: ' || v_add_name
              );
            END LOOP;
          END IF;

          -- 2º Se não encontrou por ID, procura por nome do produto adicional
          IF NOT v_found_recipe THEN
            FOR v_add_rec IN
              SELECT r.ingredient_id, r.quantity
              FROM public.products p
              JOIN public.recipes r ON r.product_id = p.id
              WHERE p.name = 'Adicional: ' || v_add_name OR p.name = v_add_name
            LOOP
              v_found_recipe := true;
              v_required := v_add_rec.quantity * v_add_qty * v_item_qty;

              UPDATE public.inventory
              SET current_stock = current_stock - v_required,
                  status = CASE
                    WHEN (current_stock - v_required) <= 0 THEN 'zerado'
                    WHEN min_stock IS NOT NULL AND (current_stock - v_required) <= min_stock THEN 'acabando'
                    ELSE status
                  END
              WHERE id = v_add_rec.ingredient_id
              RETURNING current_stock + v_required, current_stock INTO v_prev_stock, v_new_stock;

              INSERT INTO public.inventory_movements (
                ingredient_id, quantity_delta, previous_stock, new_stock,
                movement_type, reference_id, operator, notes
              ) VALUES (
                v_add_rec.ingredient_id, -v_required, v_prev_stock, v_new_stock,
                'venda', v_sale_id::text, p_operator_name,
                'Baixa atômica de adicional: ' || v_add_name
              );
            END LOOP;
          END IF;

          -- 3º Se não possui receita em produtos, procura diretamente no inventário de insumos
          IF NOT v_found_recipe THEN
            SELECT id INTO v_add_ingredient_id
            FROM public.inventory
            WHERE (v_add_id IS NOT NULL AND id = v_add_id::uuid)
               OR lower(name) = lower(v_add_name)
               OR lower(name) = lower(v_add_name || ' (Pronto)')
               OR lower(name) = lower(v_add_name || ' (Pronta)')
            LIMIT 1;

            IF v_add_ingredient_id IS NOT NULL THEN
              v_required := v_add_qty * v_item_qty;

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
                'Baixa atômica de adicional direto: ' || v_add_name
              );
            END IF;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 4. Auditoria no Servidor
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

  -- 5. Gravação da Chave de Idempotência
  v_response := jsonb_build_object(
    'success', true,
    'saleId', v_sale_id,
    'sale', p_sale || jsonb_build_object(
      'id', v_sale_id,
      'status', 'completed',
      'date', now()
    )
  );

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    INSERT INTO public.idempotency_keys (key, response_payload, created_at)
    VALUES (p_idempotency_key, v_response, now())
    ON CONFLICT (key) DO NOTHING;
  END IF;

  RETURN v_response;
END;
$$;

-- 4. RPC TRANSACIONAL PARA GRAVAÇÃO ATÔMICA DE PRODUTO + RECEITA (V08)
CREATE OR REPLACE FUNCTION public.save_product_transaction(
  p_product jsonb,
  p_recipe jsonb,
  p_operator text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prod_id uuid;
  v_name text;
  v_category text;
  v_price_balcao numeric;
  v_price_ifood numeric;
  v_status text;
  v_is_active boolean;
  v_ingredient RECORD;
  v_ing_id uuid;
  v_ing_qty numeric;
  v_now timestamptz := now();
BEGIN
  v_prod_id := COALESCE((p_product->>'id')::uuid, gen_random_uuid());
  v_name := trim(p_product->>'name');
  v_category := COALESCE(p_product->>'category', 'lanche');
  v_price_balcao := COALESCE((p_product->>'priceBalcao')::numeric, (p_product->>'price_balcao')::numeric, 0);
  v_price_ifood := COALESCE((p_product->>'priceIfood')::numeric, (p_product->>'price_ifood')::numeric, v_price_balcao);
  v_status := COALESCE(p_product->>'status', 'validado');
  v_is_active := COALESCE((p_product->>'isActive')::boolean, (p_product->>'is_active')::boolean, true);

  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'O nome do produto é obrigatório.';
  END IF;

  IF v_price_balcao <= 0 THEN
    RAISE EXCEPTION 'Preço Balcão deve ser maior que zero.';
  END IF;

  -- Upsert do produto
  INSERT INTO public.products (
    id, name, category, price_balcao, price_ifood, is_active, status, updated_at
  ) VALUES (
    v_prod_id, v_name, v_category, v_price_balcao, v_price_ifood, v_is_active, v_status, v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    price_balcao = EXCLUDED.price_balcao,
    price_ifood = EXCLUDED.price_ifood,
    is_active = EXCLUDED.is_active,
    status = EXCLUDED.status,
    updated_at = v_now;

  -- Deleta receita anterior
  DELETE FROM public.recipes WHERE product_id = v_prod_id;

  -- Insere nova receita atomicamente
  IF p_recipe IS NOT NULL AND jsonb_array_length(p_recipe) > 0 THEN
    FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_recipe)
    LOOP
      v_ing_id := (v_ingredient->>'ingredientId')::uuid;
      v_ing_qty := (v_ingredient->>'quantity')::numeric;

      IF v_ing_id IS NULL THEN
        RAISE EXCEPTION 'ID do insumo da receita inválido.';
      END IF;
      IF v_ing_qty <= 0 THEN
        RAISE EXCEPTION 'A quantidade do insumo deve ser maior que zero.';
      END IF;

      IF NOT EXISTS (SELECT 1 FROM public.inventory WHERE id = v_ing_id) THEN
        RAISE EXCEPTION 'Insumo % não encontrado no cadastro de estoque.', v_ing_id;
      END IF;

      INSERT INTO public.recipes (product_id, ingredient_id, quantity)
      VALUES (v_prod_id, v_ing_id, v_ing_qty);
    END LOOP;
  END IF;

  -- Auditoria
  INSERT INTO public.audit_logs (
    action, details, operator, previous_value, new_value, created_at
  ) VALUES (
    'GRAVACAO_PRODUTO_RECEITA',
    'Produto "' || v_name || '" gravado atomicamente com ' || COALESCE(jsonb_array_length(p_recipe), 0) || ' insumo(s).',
    COALESCE(p_operator, 'Sistema'),
    NULL,
    v_prod_id::text,
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'productId', v_prod_id,
    'savedAt', v_now
  );
END;
$$;

-- 5. BLINDAGEM DE PRIVILÉGIOS (Somente service_role)
REVOKE EXECUTE ON FUNCTION public.save_product_transaction FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_product_transaction TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_sale_checkout FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_sale_checkout TO service_role;

COMMIT;
