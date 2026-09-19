BEGIN;

-- A regra operacional pertence à linha da ficha técnica, não ao nome do insumo.
-- Campos nulos identificam receitas legadas ainda não revisadas; o frontend mantém
-- a compatibilidade por inferência somente até o operador editar o produto.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS production_station text,
  ADD COLUMN IF NOT EXISTS production_kind text;

ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_production_station_check;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_production_station_check CHECK (
  production_station IS NULL OR production_station IN (
    'none', 'grill', 'fryer', 'oven', 'cold', 'assembly', 'other'
  )
);

ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_production_kind_check;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_production_kind_check CHECK (
  production_kind IS NULL OR production_kind IN (
    'none', 'beef_patty', 'egg', 'bacon', 'breaded_chicken',
    'breaded_cheese', 'fries', 'onion_rings', 'other'
  )
);

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
  v_station text;
  v_kind text;
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

  DELETE FROM public.recipes WHERE product_id = v_prod_id;

  IF p_recipe IS NOT NULL AND jsonb_array_length(p_recipe) > 0 THEN
    FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_recipe)
    LOOP
      v_ing_id := (v_ingredient->>'ingredientId')::uuid;
      v_ing_qty := (v_ingredient->>'quantity')::numeric;
      v_station := COALESCE(v_ingredient->>'productionStation', 'none');
      v_kind := COALESCE(v_ingredient->>'productionKind', 'none');

      IF v_ing_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.inventory WHERE id = v_ing_id) THEN
        RAISE EXCEPTION 'Insumo da receita inválido ou não encontrado.';
      END IF;
      IF v_ing_qty <= 0 THEN
        RAISE EXCEPTION 'A quantidade do insumo deve ser maior que zero.';
      END IF;
      IF v_station NOT IN ('none', 'grill', 'fryer', 'oven', 'cold', 'assembly', 'other') THEN
        RAISE EXCEPTION 'Destino de produção inválido para o insumo %.', v_ing_id;
      END IF;
      IF v_kind NOT IN ('none', 'beef_patty', 'egg', 'bacon', 'breaded_chicken', 'breaded_cheese', 'fries', 'onion_rings', 'other') THEN
        RAISE EXCEPTION 'Regra de contagem inválida para o insumo %.', v_ing_id;
      END IF;
      IF v_station <> 'none' AND v_kind = 'none' THEN
        RAISE EXCEPTION 'Itens enviados à produção precisam de uma regra de contagem.';
      END IF;

      INSERT INTO public.recipes (
        product_id, ingredient_id, quantity, production_station, production_kind
      ) VALUES (
        v_prod_id, v_ing_id, v_ing_qty, v_station, v_kind
      );
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (action, details, operator, previous_value, new_value, created_at)
  VALUES (
    'GRAVACAO_PRODUTO_RECEITA',
    'Produto "' || v_name || '" gravado atomicamente com classificação explícita de produção.',
    COALESCE(p_operator, 'Sistema'), NULL, v_prod_id::text, v_now
  );

  RETURN jsonb_build_object('success', true, 'productId', v_prod_id, 'savedAt', v_now);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_product_transaction FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_product_transaction TO service_role;

COMMIT;
