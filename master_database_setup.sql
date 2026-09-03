-- ====================================================================
-- HUM VÍCIO ERP - SCRIPT MESTRE DEFINITIVO (BANCO DE DADOS COMPLETO)
-- Copie e cole tudo no SQL Editor do Supabase e clique em RUN
-- ====================================================================

-- 1. TABELA DE INSUMOS (ESTOQUE)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  unit TEXT NOT NULL,
  cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'ok'
);

-- 2. TABELA DE PRODUTOS (CARDÁPIO)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'lanche',
  price_balcao DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_ifood DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- 3. TABELA DE FICHA TÉCNICA (RECEITAS)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1
);

-- 4. TABELA DE VENDAS
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ITENS DA VENDA (RECIBO)
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- 6. MOVIMENTAÇÕES DE CAIXA (SANGRIA E SUPRIMENTO)
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. CHECKLIST DIÁRIO DA COZINHA
CREATE TABLE IF NOT EXISTS kitchen_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  tasks JSONB NOT NULL DEFAULT '[]',
  signed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TRIGGER 1: BAIXA AUTOMÁTICA DE ESTOQUE NA VENDA
CREATE OR REPLACE FUNCTION baixar_estoque_venda() RETURNS TRIGGER AS $$
DECLARE
  recipe_record RECORD;
BEGIN
  FOR recipe_record IN 
    SELECT ingredient_id, quantity 
    FROM recipes WHERE product_id = NEW.product_id
  LOOP
    UPDATE inventory 
    SET current_stock = current_stock - (recipe_record.quantity * NEW.quantity)
    WHERE id = recipe_record.ingredient_id;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_baixar_estoque ON sale_items;
CREATE TRIGGER trigger_baixar_estoque
AFTER INSERT ON sale_items
FOR EACH ROW EXECUTE FUNCTION baixar_estoque_venda();

-- 9. TRIGGER 2: ESTORNO AUTOMÁTICO DE ESTOQUE NO CANCELAMENTO
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

-- 10. REATIVAR ROW LEVEL SECURITY (RLS) E CRIAR POLÍTICAS ANTI-FRAUDE
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_all" ON inventory;
CREATE POLICY "inventory_all" ON inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "products_all" ON products;
CREATE POLICY "products_all" ON products FOR ALL USING (true);

DROP POLICY IF EXISTS "recipes_all" ON recipes;
CREATE POLICY "recipes_all" ON recipes FOR ALL USING (true);

DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "sales_update" ON sales;
CREATE POLICY "sales_select" ON sales FOR SELECT USING (true);
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (true);
CREATE POLICY "sales_update" ON sales FOR UPDATE USING (true);
-- Nota: Sem política de DELETE para proteger contra fraude financeira!

DROP POLICY IF EXISTS "sale_items_all" ON sale_items;
CREATE POLICY "sale_items_all" ON sale_items FOR ALL USING (true);

DROP POLICY IF EXISTS "cash_movements_all" ON cash_movements;
CREATE POLICY "cash_movements_all" ON cash_movements FOR ALL USING (true);

DROP POLICY IF EXISTS "kitchen_checklists_all" ON kitchen_checklists;
CREATE POLICY "kitchen_checklists_all" ON kitchen_checklists FOR ALL USING (true);

-- 11. INSERIR INSUMOS INICIAIS (SE ESTIVER VAZIO) PARA A COZINHA NÃO FICAR BRANCA
INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status)
SELECT 'Carne Bovina (Blend)', 'Carnes', 'kg', 35.00, 15.0, 'ok'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE name = 'Carne Bovina (Blend)');

INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status)
SELECT 'Pão Brioche', 'Padaria', 'un', 1.80, 60.0, 'ok'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE name = 'Pão Brioche');

INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status)
SELECT 'Queijo Cheddar Fatiado', 'Laticínios', 'kg', 42.00, 5.0, 'ok'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE name = 'Queijo Cheddar Fatiado');

INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status)
SELECT 'Bacon em Tiras', 'Carnes', 'kg', 52.00, 4.0, 'ok'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE name = 'Bacon em Tiras');

INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status)
SELECT 'Embrulho Hamburguer', 'Embalagens', 'un', 0.25, 500.0, 'ok'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE name = 'Embrulho Hamburguer');

INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status)
SELECT 'Sacola Kraft Delivery', 'Embalagens', 'un', 1.20, 200.0, 'ok'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE name = 'Sacola Kraft Delivery');

-- 12. INSERIR PRODUTOS DE EXEMPLO NO CARDÁPIO
INSERT INTO products (name, category, price_balcao, price_ifood)
SELECT 'Smash Burger Clássico', 'lanche', 28.00, 34.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Smash Burger Clássico');

INSERT INTO products (name, category, price_balcao, price_ifood)
SELECT 'Double Cheddar Bacon', 'lanche', 36.00, 44.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Double Cheddar Bacon');
