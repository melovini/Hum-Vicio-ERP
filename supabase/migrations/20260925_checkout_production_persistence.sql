-- Preserva a função de checkout instalada e corrige somente a gravação dos itens.
-- Não recalcula pedidos históricos nem altera fichas, estoque ou regras financeiras.
BEGIN;
ALTER TABLE public.sale_items
 ADD COLUMN IF NOT EXISTS production_snapshot jsonb,
 ADD COLUMN IF NOT EXISTS recipe_version integer DEFAULT 1,
 ADD COLUMN IF NOT EXISTS combo_id text,
 ADD COLUMN IF NOT EXISTS combo text,
 ADD COLUMN IF NOT EXISTS combo_price numeric(10,2),
 ADD COLUMN IF NOT EXISTS meat_point text,
 ADD COLUMN IF NOT EXISTS removals jsonb DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS notes text;

DO $upgrade$
DECLARE
 definition text;
 statement_pattern text := 'INSERT INTO (public\.)?sale_items\s*\([^;]*;';
 matches integer;
BEGIN
 SELECT pg_get_functiondef(to_regprocedure('public.process_sale_checkout(text,jsonb,text,text,text)')) INTO definition;
 IF definition IS NULL THEN
   RAISE EXCEPTION 'Função process_sale_checkout ausente. Nenhuma alteração aplicada.';
 END IF;
 SELECT count(*) INTO matches FROM regexp_matches(definition, statement_pattern, 'gi');
 IF matches <> 1 OR definition !~ 'v_sale_id' OR definition !~ 'v_item' THEN
   RAISE EXCEPTION 'Versão de checkout não reconhecida. Nenhuma alteração aplicada; revise a função antes de continuar.';
 END IF;
 definition := regexp_replace(definition, statement_pattern, $replacement$
 INSERT INTO public.sale_items (
   sale_id, product_id, product_name, quantity, unit_price,
   original_price, is_gift, gift_reason, gift_notes, additionals,
   production_snapshot, recipe_version, combo_id, combo, combo_price,
   meat_point, removals, notes
 ) VALUES (
   v_sale_id, NULLIF(v_item->>'productId', '')::uuid,
   COALESCE(v_item->>'productName', 'Item'),
   COALESCE((v_item->>'quantity')::integer, 1),
   COALESCE((v_item->>'unitPrice')::numeric, 0),
   (v_item->>'originalPrice')::numeric,
   COALESCE((v_item->>'isGift')::boolean, false),
   v_item->>'giftReason', v_item->>'giftNotes',
   COALESCE(v_item->'additionals', '[]'::jsonb),
   v_item->'productionSnapshot',
   COALESCE((v_item->>'recipeVersion')::integer, 1),
   v_item->>'comboId', v_item->>'combo', (v_item->>'comboPrice')::numeric,
   v_item->>'meatPoint', COALESCE(v_item->'removals', '[]'::jsonb), v_item->>'notes'
 );
 $replacement$, 'i');
 EXECUTE definition;
END;
$upgrade$;
NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sale_items'
AND column_name IN ('production_snapshot', 'combo_id', 'recipe_version', 'meat_point', 'removals')
ORDER BY column_name;
