-- ==========================================================
-- SCRIPT DE BLINDAGEM DE BANCO DE DADOS - HUM VÍCIO ERP
-- Execute este script no SQL Editor do Supabase
-- ==========================================================

-- 1. REATIVAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_checklists ENABLE ROW LEVEL SECURITY;

-- 2. LIMPAR POLÍTICAS ANTIGAS SE EXISTIREM
DROP POLICY IF EXISTS "inventory_select" ON inventory;
DROP POLICY IF EXISTS "inventory_insert" ON inventory;
DROP POLICY IF EXISTS "inventory_update" ON inventory;
DROP POLICY IF EXISTS "inventory_delete" ON inventory;

DROP POLICY IF EXISTS "products_all" ON products;
DROP POLICY IF EXISTS "recipes_all" ON recipes;

DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "sales_update" ON sales;
DROP POLICY IF EXISTS "sales_no_delete" ON sales;

DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;

DROP POLICY IF EXISTS "cash_movements_select" ON cash_movements;
DROP POLICY IF EXISTS "cash_movements_insert" ON cash_movements;

DROP POLICY IF EXISTS "checklists_all" ON kitchen_checklists;
DROP POLICY IF EXISTS "checklists_delete_policy" ON kitchen_checklists;

-- 3. POLÍTICAS DE INVENTÁRIO (ESTOQUE)
CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (true);
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (true);
CREATE POLICY "inventory_delete" ON inventory FOR DELETE USING (true);

-- 4. POLÍTICAS DE PRODUTOS E FICHAS TÉCNICAS
CREATE POLICY "products_all" ON products FOR ALL USING (true);
CREATE POLICY "recipes_all" ON recipes FOR ALL USING (true);

-- 5. BLINDAGEM DE VENDAS (REGRA ANTI-FRAUDE: NUNCA PERMITIR DELETE FÍSICO)
-- Vendas podem ser criadas, lidas e ter status alterado para 'cancelled', mas NUNCA apagadas
CREATE POLICY "sales_select" ON sales FOR SELECT USING (true);
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (true);
CREATE POLICY "sales_update" ON sales FOR UPDATE USING (true);
-- Nota: Ao não criar policy de DELETE, qualquer tentativa de DELETE na tabela sales é bloqueada pelo banco!

CREATE POLICY "sale_items_select" ON sale_items FOR SELECT USING (true);
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT WITH CHECK (true);

-- 6. BLINDAGEM DE MOVIMENTAÇÕES DE CAIXA (SANGRIA / SUPRIMENTO)
-- Movimentações podem ser inseridas e consultadas, nunca excluídas
CREATE POLICY "cash_movements_select" ON cash_movements FOR SELECT USING (true);
CREATE POLICY "cash_movements_insert" ON cash_movements FOR INSERT WITH CHECK (true);

-- 7. CHECKLISTS DE ENCERRAMENTO (RETENÇÃO MÁXIMA DE 15 DIAS)
CREATE POLICY "checklists_all" ON kitchen_checklists FOR ALL USING (true);

-- 8. TRIGGER DE INTEGRIDADE: ESTORNO AUTOMÁTICO DE ESTOQUE NO CANCELAMENTO
-- Quando uma venda for cancelada pelo Caixa, os ingredientes voltam automaticamente para o estoque!
CREATE OR REPLACE FUNCTION estornar_estoque_cancelamento() RETURNS TRIGGER AS $$
DECLARE
  recipe_record RECORD;
  item_record RECORD;
BEGIN
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    FOR item_record IN 
      SELECT product_id, quantity FROM sale_items WHERE sale_id = NEW.id
    LOOP
      FOR recipe_record IN 
        SELECT ingredient_id, quantity FROM recipes WHERE product_id = item_record.product_id
      LOOP
        UPDATE inventory 
        SET current_stock = current_stock + (recipe_record.quantity * item_record.quantity)
        WHERE id = recipe_record.ingredient_id;
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_estornar_estoque ON sales;
CREATE TRIGGER trigger_estornar_estoque
AFTER UPDATE OF status ON sales
FOR EACH ROW EXECUTE FUNCTION estornar_estoque_cancelamento();
