-- =========================================================================
-- MIGRAÇÃO: CADASTRO CENTRAL DE COMPONENTES DE PREPARO (COZINHA & IMPRESSÃO)
-- Revisado em 21/09/2026: sem classificação automática ou sobrescrita de cadastros.
-- Objetivo: Diferenciar componentes na mesma praça (ex: Bovino 180g, Costela 180g,
--           Linguiça na Chapa) mantendo total geral e detalhamento de gramaturas.
-- =========================================================================

BEGIN;

-- Compatibilidade com instalações que ainda não receberam as colunas da ficha.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'validado',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS production_station text,
  ADD COLUMN IF NOT EXISTS production_kind text;


-- 1. CRIAR TABELA public.kitchen_components
CREATE TABLE IF NOT EXISTS public.kitchen_components (
  id text PRIMARY KEY,
  name text NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('burger', 'egg', 'side', 'protein', 'other')),
  station text NOT NULL CHECK (station IN ('none', 'grill', 'fryer', 'oven', 'cold', 'assembly', 'other')),
  production_unit text NOT NULL DEFAULT 'unidade',
  portion_weight numeric,
  portion_unit text DEFAULT 'g',
  show_in_summary boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. SEED DE COMPONENTES INICIAIS
INSERT INTO public.kitchen_components (
  id, name, component_type, station, production_unit, portion_weight, portion_unit, show_in_summary, is_active
) VALUES
  ('cmp-bovino-180', 'Bovino 180 g', 'burger', 'grill', 'disco', 180, 'g', true, true),
  ('cmp-bovino-90', 'Bovino 90 g', 'burger', 'grill', 'disco', 90, 'g', true, true),
  ('cmp-costela-180', 'Costela 180 g', 'burger', 'grill', 'disco', 180, 'g', true, true),
  ('cmp-linguica', 'Linguiça', 'burger', 'grill', 'disco', 150, 'g', true, true),
  ('cmp-ovo', 'Ovo', 'egg', 'grill', 'unidade', 1, 'un', true, true),
  ('cmp-batata-peq', 'Batata pequena', 'side', 'fryer', 'porcao', 150, 'g', true, true),
  ('cmp-batata-gde', 'Batata grande', 'side', 'fryer', 'porcao', 300, 'g', true, true),
  ('cmp-aneis-cebola', 'Anéis de cebola', 'side', 'fryer', 'porcao', 150, 'g', true, true),
  ('cmp-frango-emp', 'Frango empanado', 'protein', 'fryer', 'unidade', 1, 'un', true, true),
  ('cmp-queijo-emp', 'Queijo empanado', 'side', 'fryer', 'unidade', 1, 'un', true, true)
ON CONFLICT (id) DO NOTHING;

-- 3. ADICIONAR COLUNA kitchen_component_id EM public.inventory E public.recipes
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS kitchen_component_id text REFERENCES public.kitchen_components(id) ON DELETE SET NULL;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS kitchen_component_id text REFERENCES public.kitchen_components(id) ON DELETE SET NULL;

-- 4. Nenhum insumo ou receita é classificado automaticamente.
-- Vínculos existentes são preservados. Configure os componentes no ERP.

-- 5. ATUALIZAR FUNÇÃO TRANSACIONAL save_product_transaction
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
  v_ingredient jsonb;
  v_ing_id uuid;
  v_ing_qty numeric;
  v_kitchen_comp_id text;
  v_station text;
  v_kind text;
  v_now timestamptz := now();
BEGIN
  v_prod_id := COALESCE((p_product->>'id')::uuid, gen_random_uuid());
  PERFORM pg_advisory_xact_lock(hashtextextended(v_prod_id::text, 0));
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
  IF v_price_balcao::text IN ('NaN', 'Infinity', '-Infinity') OR v_price_balcao <= 0 THEN
    RAISE EXCEPTION 'Preço Balcão deve ser maior que zero.';
  END IF;
  IF v_price_ifood::text IN ('NaN', 'Infinity', '-Infinity') OR v_price_ifood < 0 THEN
    RAISE EXCEPTION 'Preço iFood não pode ser negativo.';
  END IF;

  IF p_recipe IS NULL OR jsonb_typeof(p_recipe) <> 'array' THEN
    RAISE EXCEPTION 'A ficha técnica deve ser uma lista de insumos.';
  END IF;

  -- Controle de concorrência otimista
  IF EXISTS (SELECT 1 FROM public.products WHERE id = v_prod_id) THEN
    SELECT COALESCE(version, 1) INTO v_current_version FROM public.products WHERE id = v_prod_id FOR UPDATE;
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
    FOR v_ingredient IN SELECT value FROM jsonb_array_elements(p_recipe)
    LOOP
      v_ing_id := (v_ingredient->>'ingredientId')::uuid;
      v_ing_qty := (v_ingredient->>'quantity')::numeric;
      v_kitchen_comp_id := NULLIF(trim(COALESCE(v_ingredient->>'kitchenComponentId', v_ingredient->>'kitchen_component_id', '')), '');
      v_station := COALESCE(v_ingredient->>'productionStation', 'none');
      v_kind := COALESCE(v_ingredient->>'productionKind', 'none');

      IF v_ing_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.inventory WHERE id = v_ing_id) THEN
        RAISE EXCEPTION 'Insumo da receita inválido ou não encontrado no estoque.';
      END IF;
      IF v_ing_qty IS NULL OR v_ing_qty::text IN ('NaN', 'Infinity', '-Infinity') OR v_ing_qty <= 0 THEN
        RAISE EXCEPTION 'A quantidade do insumo deve ser maior que zero.';
      END IF;

      -- Validação do componente de preparo se fornecido
      IF v_kitchen_comp_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kitchen_components WHERE id = v_kitchen_comp_id) THEN
        RAISE EXCEPTION 'Componente de preparo inválido (%).', v_kitchen_comp_id;
      END IF;

      IF v_station NOT IN ('none', 'grill', 'fryer', 'oven', 'cold', 'assembly', 'other') THEN
        RAISE EXCEPTION 'Destino de produção inválido (%).', v_station;
      END IF;
      IF v_kind NOT IN ('none', 'beef_patty', 'egg', 'bacon', 'breaded_chicken', 'breaded_cheese', 'fries', 'onion_rings', 'other') THEN
        RAISE EXCEPTION 'Regra de contagem inválida (%).', v_kind;
      END IF;

      -- Se não vai à cozinha, a regra de contagem deve ser 'none'
      IF v_station = 'none' AND v_kind <> 'none' THEN
        v_kind := 'none';
      END IF;

      INSERT INTO public.recipes (
        product_id, ingredient_id, quantity, kitchen_component_id, production_station, production_kind
      ) VALUES (
        v_prod_id, v_ing_id, v_ing_qty, v_kitchen_comp_id, v_station, v_kind
      );
    END LOOP;
  END IF;

  -- Registra auditoria
  INSERT INTO public.audit_logs (action, details, operator, new_value, created_at)
  VALUES (
    'GRAVACAO_PRODUTO_RECEITA',
    'Produto "' || v_name || '" gravado atomicamente com componentes de preparo (versão ' || v_new_version || ').',
    COALESCE(p_operator, 'Sistema'), v_prod_id::text, v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'productId', v_prod_id,
    'version', v_new_version,
    'savedAt', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_product_transaction(jsonb, jsonb, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_product_transaction(jsonb, jsonb, text) TO service_role;

-- 6. O ERP autentica o operador no servidor; o banco aceita apenas service_role.
ALTER TABLE public.kitchen_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kitchen_components_read_all ON public.kitchen_components;
DROP POLICY IF EXISTS kitchen_components_write_admin ON public.kitchen_components;
REVOKE ALL ON TABLE public.kitchen_components FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kitchen_components TO service_role;

-- Atualiza o catálogo da API após a confirmação da transação.
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Conferência: deve retornar os componentes disponíveis, sem alterar fichas.
SELECT id, name, station, production_unit
FROM public.kitchen_components ORDER BY name;
