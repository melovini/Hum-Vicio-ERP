-- =========================================================================
-- MIGRAÇÃO: SALVAMENTO ATÔMICO DE PRODUTO, FICHA TÉCNICA E CONCORRÊNCIA
-- Data: 20/09/2026
-- =========================================================================

BEGIN;

-- 1. GARANTIR COLUNAS EM public.products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'validado',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. GARANTIR COLUNAS E RESTRIÇÕES EM public.recipes
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

-- 3. REPRODUZIR / ATUALIZAR FUNÇÃO TRANSACIONAL COM AUDITORIA CORRETA E CONCORRÊNCIA
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
  v_subcategory text;
  v_price_balcao numeric;
  v_price_ifood numeric;
  v_status text;
  v_is_active boolean;
  v_expected_version integer;
  v_current_version integer;
  v_new_version integer := 1;
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
  v_subcategory := NULLIF(trim(p_product->>'subcategory'), '');
  v_price_balcao := COALESCE((p_product->>'priceBalcao')::numeric, (p_product->>'price_balcao')::numeric, 0);
  v_price_ifood := COALESCE((p_product->>'priceIfood')::numeric, (p_product->>'price_ifood')::numeric, v_price_balcao);
  v_status := COALESCE(p_product->>'status', 'validado');
  v_is_active := COALESCE((p_product->>'isActive')::boolean, (p_product->>'is_active')::boolean, true);
  v_expected_version := (p_product->>'expectedVersion')::integer;

  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'O nome do produto é obrigatório.';
  END IF;
  IF v_price_balcao <= 0 THEN
    RAISE EXCEPTION 'Preço Balcão deve ser maior que zero.';
  END IF;
  IF v_price_ifood < 0 THEN
    RAISE EXCEPTION 'Preço iFood não pode ser negativo.';
  END IF;

  -- Controle de concorrência otimista (quando expectedVersion for fornecido)
  IF EXISTS (SELECT 1 FROM public.products WHERE id = v_prod_id) THEN
    SELECT COALESCE(version, 1) INTO v_current_version FROM public.products WHERE id = v_prod_id;
    IF v_expected_version IS NOT NULL AND v_current_version IS NOT NULL AND v_current_version <> v_expected_version THEN
      RAISE EXCEPTION 'CONFLITO_VERSAO: Outra pessoa atualizou esta ficha. Compare as versões antes de continuar.';
    END IF;
    v_new_version := COALESCE(v_current_version, 1) + 1;
  ELSE
    v_new_version := 1;
  END IF;

  INSERT INTO public.products (
    id, name, category, subcategory, price_balcao, price_ifood, is_active, status, version, updated_at
  ) VALUES (
    v_prod_id, v_name, v_category, v_subcategory, v_price_balcao, v_price_ifood, v_is_active, v_status, v_new_version, v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    price_balcao = EXCLUDED.price_balcao,
    price_ifood = EXCLUDED.price_ifood,
    is_active = EXCLUDED.is_active,
    status = EXCLUDED.status,
    version = v_new_version,
    updated_at = v_now;

  -- Exclui receitas anteriores atomicamente
  DELETE FROM public.recipes WHERE product_id = v_prod_id;

  -- Insere novas linhas da receita com validações
  IF p_recipe IS NOT NULL AND jsonb_array_length(p_recipe) > 0 THEN
    FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_recipe)
    LOOP
      v_ing_id := (v_ingredient->>'ingredientId')::uuid;
      v_ing_qty := (v_ingredient->>'quantity')::numeric;
      v_station := COALESCE(v_ingredient->>'productionStation', 'none');
      v_kind := COALESCE(v_ingredient->>'productionKind', 'none');

      IF v_ing_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.inventory WHERE id = v_ing_id) THEN
        RAISE EXCEPTION 'Insumo da receita inválido ou não encontrado no estoque.';
      END IF;
      IF v_ing_qty IS NULL OR v_ing_qty <= 0 THEN
        RAISE EXCEPTION 'A quantidade do insumo deve ser maior que zero.';
      END IF;
      IF v_station NOT IN ('none', 'grill', 'fryer', 'oven', 'cold', 'assembly', 'other') THEN
        RAISE EXCEPTION 'Destino de produção inválido (%s).', v_station;
      END IF;
      IF v_kind NOT IN ('none', 'beef_patty', 'egg', 'bacon', 'breaded_chicken', 'breaded_cheese', 'fries', 'onion_rings', 'other') THEN
        RAISE EXCEPTION 'Regra de contagem inválida (%s).', v_kind;
      END IF;

      -- Se não vai à cozinha, a regra de contagem deve ser obrigatoriamente 'none'
      IF v_station = 'none' AND v_kind <> 'none' THEN
        v_kind := 'none';
      END IF;

      INSERT INTO public.recipes (
        product_id, ingredient_id, quantity, production_station, production_kind
      ) VALUES (
        v_prod_id, v_ing_id, v_ing_qty, v_station, v_kind
      );
    END LOOP;
  END IF;

  -- Registra auditoria com a coluna old_value oficial
  INSERT INTO public.audit_logs (action, details, operator, old_value, new_value, created_at)
  VALUES (
    'GRAVACAO_PRODUTO_RECEITA',
    'Produto "' || v_name || '" gravado atomicamente (versão ' || v_new_version || ').',
    COALESCE(p_operator, 'Sistema'), NULL, v_prod_id::text, v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'productId', v_prod_id,
    'version', v_new_version,
    'savedAt', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_product_transaction FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_product_transaction TO service_role;

COMMIT;
