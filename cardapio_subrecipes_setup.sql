-- ====================================================================
-- HUM VÍCIO BURGER - CARGA COMPLETA DO CARDÁPIO & SUB-RECEITAS
-- Execute este script no SQL Editor do Supabase
-- ====================================================================

-- 1. CRIAR TABELA DE SUB-RECEITAS (PRÉ-PREPAROS)
CREATE TABLE IF NOT EXISTS sub_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_ingredient_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  child_ingredient_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL, -- quantidade do ingrediente base para 1kg/un da sub-receita
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sub_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_recipes_all" ON sub_recipes;
CREATE POLICY "sub_recipes_all" ON sub_recipes FOR ALL USING (true);

-- 2. CADASTRO DE INSUMOS BRUTOS (MATÉRIAS-PRIMAS)
-- Pães
INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status) VALUES
  ('Pão Francês de Hambúrguer', 'Pães', 'un', 2.20, 100, 'ok'),
  ('Pão Brioche', 'Pães', 'un', 2.50, 100, 'ok'),
  ('Pão Tradicional', 'Pães', 'un', 2.00, 100, 'ok'),
  ('Pão Tradicional c/ Gergelim', 'Pães', 'un', 2.30, 100, 'ok')
ON CONFLICT DO NOTHING;

-- Carnes & Hambúrgueres
INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status) VALUES
  ('Hambúrguer Bovino 180g', 'Carnes', 'un', 8.50, 150, 'ok'),
  ('Hambúrguer de Linguiça 150g', 'Carnes', 'un', 6.50, 80, 'ok'),
  ('Hambúrguer Recheado Costela 180g', 'Carnes', 'un', 10.50, 80, 'ok'),
  ('Hamb. Frango Empanado c/ Cream Cheese 150g', 'Carnes', 'un', 7.50, 60, 'ok'),
  ('Hamb. Queijo Minas Empanado 120g', 'Carnes', 'un', 8.00, 50, 'ok'),
  ('Hamb. Bovino Recheado Mozarela 180g', 'Carnes', 'un', 10.00, 50, 'ok'),
  ('Carne Seca Desfiada Cozida', 'Carnes', 'kg', 55.00, 15, 'ok'),
  ('Bacon Fatiado Crocante', 'Carnes', 'kg', 48.00, 20, 'ok')
ON CONFLICT DO NOTHING;

-- Queijos
INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status) VALUES
  ('Queijo Mozarela Fatiado', 'Laticínios', 'kg', 42.00, 25, 'ok'),
  ('Queijo Cheddar Fatiado', 'Laticínios', 'kg', 45.00, 25, 'ok'),
  ('Queijo Minas Padrão Fatiado', 'Laticínios', 'kg', 46.00, 20, 'ok'),
  ('Queijo Coalho em Barra', 'Laticínios', 'kg', 50.00, 15, 'ok'),
  ('Queijo Prato Fatiado', 'Laticínios', 'kg', 44.00, 15, 'ok'),
  ('Cream Cheese Bisnaga', 'Laticínios', 'kg', 38.00, 15, 'ok'),
  ('Cheddar Cremoso Bisnaga', 'Laticínios', 'kg', 32.00, 20, 'ok'),
  ('Sour Cream', 'Laticínios', 'kg', 36.00, 10, 'ok')
ON CONFLICT DO NOTHING;

-- Matéria-prima de Molhos & Cozinha
INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status) VALUES
  ('Óleo de Girassol', 'Molhos & Condimentos', 'L', 8.50, 30, 'ok'),
  ('Leite Integral', 'Laticínios', 'L', 5.20, 25, 'ok'),
  ('Mostarda Dijon', 'Molhos & Condimentos', 'kg', 45.00, 5, 'ok'),
  ('Sal Refinado', 'Molhos & Condimentos', 'kg', 3.00, 20, 'ok'),
  ('Alho Poró', 'Hortifruti', 'kg', 16.00, 8, 'ok'),
  ('Ervas Finas Secas', 'Molhos & Condimentos', 'kg', 55.00, 3, 'ok'),
  ('Chimichurri em Flocos', 'Molhos & Condimentos', 'kg', 48.00, 5, 'ok'),
  ('Hortelã Fresca', 'Hortifruti', 'kg', 22.00, 3, 'ok'),
  ('Repolho Branco', 'Hortifruti', 'kg', 4.50, 15, 'ok'),
  ('Cenoura', 'Hortifruti', 'kg', 5.00, 15, 'ok'),
  ('Maçã Verde', 'Hortifruti', 'kg', 12.00, 8, 'ok'),
  ('Cebola Roxa', 'Hortifruti', 'kg', 6.50, 20, 'ok'),
  ('Cebola Branca', 'Hortifruti', 'kg', 5.50, 30, 'ok'),
  ('Alface Americana', 'Hortifruti', 'kg', 9.00, 15, 'ok'),
  ('Tomate Italiano', 'Hortifruti', 'kg', 8.50, 25, 'ok'),
  ('Rúcula Fresca', 'Hortifruti', 'kg', 14.00, 6, 'ok'),
  ('Tomate Seco em Azeite', 'Hortifruti', 'kg', 65.00, 5, 'ok'),
  ('Cogumelo Paris Fresco', 'Hortifruti', 'kg', 48.00, 6, 'ok'),
  ('Manteiga sem Sal', 'Laticínios', 'kg', 42.00, 10, 'ok'),
  ('Geleia de Pimenta', 'Molhos & Condimentos', 'kg', 38.00, 8, 'ok'),
  ('Melaço de Cana', 'Molhos & Condimentos', 'kg', 24.00, 8, 'ok'),
  ('Nachos de Milho', 'Secos', 'kg', 32.00, 15, 'ok')
ON CONFLICT DO NOTHING;

-- Porções & Bebidas
INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status) VALUES
  ('Batata Palito Congelada', 'Porções', 'kg', 12.00, 50, 'ok'),
  ('Anéis de Cebola Congelados', 'Porções', 'kg', 22.00, 30, 'ok'),
  ('Refrigerante Lata 310ml', 'Bebidas', 'un', 2.80, 120, 'ok'),
  ('Suco Del Valle Lata 310ml', 'Bebidas', 'un', 2.90, 80, 'ok'),
  ('Água com Gás 500ml', 'Bebidas', 'un', 1.20, 60, 'ok'),
  ('Água sem Gás 500ml', 'Bebidas', 'un', 1.00, 60, 'ok')
ON CONFLICT DO NOTHING;

-- 3. CADASTRO DAS SUB-RECEITAS / PRÉ-PREPAROS DA CASA (COMO INSUMOS PRONTOS)
INSERT INTO inventory (name, category, unit, cost_per_unit, current_stock, status) VALUES
  ('Maionese da Casa (Pronta)', 'Pré-preparos', 'kg', 14.50, 10, 'ok'),
  ('Maionese de Ervas (Pronta)', 'Pré-preparos', 'kg', 16.80, 8, 'ok'),
  ('Maionese de Chimichurri (Pronta)', 'Pré-preparos', 'kg', 17.50, 8, 'ok'),
  ('Maionese de Hortelã (Pronta)', 'Pré-preparos', 'kg', 16.50, 5, 'ok'),
  ('Coleslaw da Casa (Pronto)', 'Pré-preparos', 'kg', 12.00, 8, 'ok'),
  ('Cebola Caramelizada (Pronta)', 'Pré-preparos', 'kg', 18.00, 8, 'ok'),
  ('Farofa de Nachos e Bacon (Pronta)', 'Pré-preparos', 'kg', 38.00, 5, 'ok')
ON CONFLICT DO NOTHING;

-- 4. CADASTRO DE TODOS OS PRODUTOS DO CARDÁPIO OFICIAL
-- Hambúrgueres Tradicionais
INSERT INTO products (name, category, price_balcao, price_ifood) VALUES
  ('Alemanha', 'lanche', 31.00, 38.00),
  ('Argentina', 'lanche', 39.00, 47.00),
  ('Brasil', 'lanche', 38.00, 46.00),
  ('Estados Unidos', 'lanche', 27.00, 34.00),
  ('Israel (Vegetariano)', 'lanche', 37.00, 45.00),
  ('México', 'lanche', 43.00, 52.00),
  ('Kids', 'lanche', 29.00, 36.00),
  ('Wakanda (Edição Nordeste)', 'lanche', 43.00, 52.00)
ON CONFLICT DO NOTHING;

-- Mais Pedidos
INSERT INTO products (name, category, price_balcao, price_ifood) VALUES
  ('Alemanha Bovino', 'lanche', 37.00, 45.00),
  ('Argentina Empanado', 'lanche', 49.00, 59.00),
  ('Brasil Francês', 'lanche', 38.00, 46.00)
ON CONFLICT DO NOTHING;

-- Duplos
INSERT INTO products (name, category, price_balcao, price_ifood) VALUES
  ('Alemanha Duplo', 'lanche', 40.00, 49.00),
  ('Argentina Duplo', 'lanche', 49.00, 59.00),
  ('Brasil Duplo', 'lanche', 47.00, 57.00),
  ('EUA Duplo', 'lanche', 36.00, 44.00),
  ('Israel Duplo', 'lanche', 47.00, 57.00),
  ('México Duplo', 'lanche', 52.00, 62.00),
  ('Wakanda Duplo', 'lanche', 52.00, 62.00)
ON CONFLICT DO NOTHING;

-- Porções & Combos
INSERT INTO products (name, category, price_balcao, price_ifood) VALUES
  ('Batata Cheddar e Bacon 250g', 'porcao', 20.00, 26.00),
  ('Batata Frita Palito 180g', 'porcao', 12.00, 16.00),
  ('Anéis de Cebola 180g', 'porcao', 14.00, 18.00),
  ('Combo: Batata + Bebida', 'combo', 14.00, 18.00),
  ('Combo: Anéis de Cebola + Bebida', 'combo', 16.00, 20.00)
ON CONFLICT DO NOTHING;

-- Bebidas
INSERT INTO products (name, category, price_balcao, price_ifood) VALUES
  ('Refrigerante Lata 310ml', 'bebida', 6.00, 8.00),
  ('Suco Del Valle Lata 310ml', 'bebida', 6.00, 8.00),
  ('Água com Gás 500ml', 'bebida', 3.00, 5.00),
  ('Água sem Gás 500ml', 'bebida', 2.00, 4.00)
ON CONFLICT DO NOTHING;

-- Adicionais
INSERT INTO products (name, category, price_balcao, price_ifood) VALUES
  ('Adicional: Bacon Crocante', 'porcao', 5.00, 6.00),
  ('Adicional: Cebola Caramelizada', 'porcao', 5.00, 6.00),
  ('Adicional: Geleia de Pimenta', 'porcao', 5.00, 6.00),
  ('Adicional: Hambúrguer Bovino 180g', 'porcao', 13.00, 15.00),
  ('Adicional: Hambúrguer Costela 180g', 'porcao', 15.00, 18.00),
  ('Adicional: Hamb. Frango Empanado', 'porcao', 10.00, 12.00),
  ('Adicional: Hambúrguer Linguiça 150g', 'porcao', 10.00, 12.00),
  ('Adicional: Hamb. Queijo Minas Empanado', 'porcao', 13.00, 15.00),
  ('Adicional: Hamb. Bovino Recheado Mozarela', 'porcao', 15.00, 18.00),
  ('Pote Maionese da Casa 40g', 'porcao', 2.00, 3.00),
  ('Pote Maionese de Chimichurri 40g', 'porcao', 2.00, 3.00),
  ('Pote Maionese de Ervas 40g', 'porcao', 2.00, 3.00),
  ('Adicional: Onion Rings no Hambúrguer', 'porcao', 5.00, 6.00),
  ('Adicional: Queijo Cheddar', 'porcao', 5.00, 6.00),
  ('Adicional: Queijo Minas Padrão', 'porcao', 5.00, 6.00),
  ('Adicional: Queijo Mozarela', 'porcao', 5.00, 6.00),
  ('Adicional: Queijo Coalho', 'porcao', 10.00, 12.00),
  ('Adicional: Salada (Alface, Tomate, Cebola)', 'porcao', 3.00, 4.00),
  ('Adicional: Sour Cream', 'porcao', 5.00, 6.00)
ON CONFLICT DO NOTHING;

-- 5. CONECTAR AS SUB-RECEITAS (Ex: Maionese da Casa = Óleo + Leite + Mostarda + Sal)
DO $$
DECLARE
  v_maionese_casa UUID;
  v_maionese_ervas UUID;
  v_maionese_chimi UUID;
  v_maionese_hortela UUID;
  v_coleslaw UUID;
  v_cebola_caramelizada UUID;
  
  v_oleo UUID;
  v_leite UUID;
  v_mostarda UUID;
  v_sal UUID;
  v_alho_poro UUID;
  v_ervas UUID;
  v_chimi UUID;
  v_hortela UUID;
  v_repolho UUID;
  v_cenoura UUID;
  v_maca UUID;
  v_cebola_b UUID;
  v_manteiga UUID;
BEGIN
  SELECT id INTO v_maionese_casa FROM inventory WHERE name = 'Maionese da Casa (Pronta)' LIMIT 1;
  SELECT id INTO v_maionese_ervas FROM inventory WHERE name = 'Maionese de Ervas (Pronta)' LIMIT 1;
  SELECT id INTO v_maionese_chimi FROM inventory WHERE name = 'Maionese de Chimichurri (Pronta)' LIMIT 1;
  SELECT id INTO v_maionese_hortela FROM inventory WHERE name = 'Maionese de Hortelã (Pronta)' LIMIT 1;
  SELECT id INTO v_coleslaw FROM inventory WHERE name = 'Coleslaw da Casa (Pronto)' LIMIT 1;
  SELECT id INTO v_cebola_caramelizada FROM inventory WHERE name = 'Cebola Caramelizada (Pronta)' LIMIT 1;

  SELECT id INTO v_oleo FROM inventory WHERE name = 'Óleo de Girassol' LIMIT 1;
  SELECT id INTO v_leite FROM inventory WHERE name = 'Leite Integral' LIMIT 1;
  SELECT id INTO v_mostarda FROM inventory WHERE name = 'Mostarda Dijon' LIMIT 1;
  SELECT id INTO v_sal FROM inventory WHERE name = 'Sal Refinado' LIMIT 1;
  SELECT id INTO v_alho_poro FROM inventory WHERE name = 'Alho Poró' LIMIT 1;
  SELECT id INTO v_ervas FROM inventory WHERE name = 'Ervas Finas Secas' LIMIT 1;
  SELECT id INTO v_chimi FROM inventory WHERE name = 'Chimichurri em Flocos' LIMIT 1;
  SELECT id INTO v_hortela FROM inventory WHERE name = 'Hortelã Fresca' LIMIT 1;
  SELECT id INTO v_repolho FROM inventory WHERE name = 'Repolho Branco' LIMIT 1;
  SELECT id INTO v_cenoura FROM inventory WHERE name = 'Cenoura' LIMIT 1;
  SELECT id INTO v_maca FROM inventory WHERE name = 'Maçã Verde' LIMIT 1;
  SELECT id INTO v_cebola_b FROM inventory WHERE name = 'Cebola Branca' LIMIT 1;
  SELECT id INTO v_manteiga FROM inventory WHERE name = 'Manteiga sem Sal' LIMIT 1;

  -- 1kg de Maionese da Casa = 0.65L Óleo + 0.30L Leite + 0.04kg Mostarda + 0.01kg Sal
  IF v_maionese_casa IS NOT NULL THEN
    INSERT INTO sub_recipes (parent_ingredient_id, child_ingredient_id, quantity) VALUES
      (v_maionese_casa, v_oleo, 0.650),
      (v_maionese_casa, v_leite, 0.300),
      (v_maionese_casa, v_mostarda, 0.040),
      (v_maionese_casa, v_sal, 0.010)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 1kg Maionese de Ervas = 0.90kg Maionese Casa + 0.08kg Alho Poró + 0.02kg Ervas
  IF v_maionese_ervas IS NOT NULL AND v_maionese_casa IS NOT NULL THEN
    INSERT INTO sub_recipes (parent_ingredient_id, child_ingredient_id, quantity) VALUES
      (v_maionese_ervas, v_maionese_casa, 0.900),
      (v_maionese_ervas, v_alho_poro, 0.080),
      (v_maionese_ervas, v_ervas, 0.020)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 1kg Maionese Chimichurri = 0.92kg Maionese Casa + 0.08kg Chimichurri
  IF v_maionese_chimi IS NOT NULL AND v_maionese_casa IS NOT NULL THEN
    INSERT INTO sub_recipes (parent_ingredient_id, child_ingredient_id, quantity) VALUES
      (v_maionese_chimi, v_maionese_casa, 0.920),
      (v_maionese_chimi, v_chimi, 0.080)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 1kg Maionese Hortelã = 0.90kg Maionese Casa + 0.08kg Hortelã + 0.02kg Ervas
  IF v_maionese_hortela IS NOT NULL AND v_maionese_casa IS NOT NULL THEN
    INSERT INTO sub_recipes (parent_ingredient_id, child_ingredient_id, quantity) VALUES
      (v_maionese_hortela, v_maionese_casa, 0.900),
      (v_maionese_hortela, v_hortela, 0.080),
      (v_maionese_hortela, v_ervas, 0.020)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 1kg Coleslaw = 0.40kg Maionese Casa + 0.30kg Repolho + 0.15kg Cenoura + 0.15kg Maçã
  IF v_coleslaw IS NOT NULL AND v_maionese_casa IS NOT NULL THEN
    INSERT INTO sub_recipes (parent_ingredient_id, child_ingredient_id, quantity) VALUES
      (v_coleslaw, v_maionese_casa, 0.400),
      (v_coleslaw, v_repolho, 0.300),
      (v_coleslaw, v_cenoura, 0.150),
      (v_coleslaw, v_maca, 0.150)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 1kg Cebola Caramelizada = 1.3kg Cebola Branca + 0.1kg Manteiga
  IF v_cebola_caramelizada IS NOT NULL THEN
    INSERT INTO sub_recipes (parent_ingredient_id, child_ingredient_id, quantity) VALUES
      (v_cebola_caramelizada, v_cebola_b, 1.300),
      (v_cebola_caramelizada, v_manteiga, 0.100)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 6. VINCULAR FICHAS TÉCNICAS DOS LANCHES PRINCIPAIS (RECEITAS AUTOMÁTICAS)
DO $$
DECLARE
  v_prod_alemanha UUID;
  v_prod_argentina UUID;
  v_prod_brasil UUID;
  v_prod_eua UUID;
  v_prod_mexico UUID;
  v_prod_wakanda UUID;
  
  v_pao_frances UUID;
  v_pao_brioche UUID;
  v_pao_trad UUID;
  
  v_b_linguica UUID;
  v_b_costela UUID;
  v_b_bovino UUID;
  v_b_frango UUID;
  
  v_q_moza UUID;
  v_q_cheddar UUID;
  v_q_minas UUID;
  v_q_coalho UUID;
  
  v_m_casa UUID;
  v_m_chimi UUID;
  v_m_ervas UUID;
  v_m_hortela UUID;
  v_coleslaw UUID;
  v_cebola_caram UUID;
  v_bacon UUID;
  v_alface UUID;
  v_tomate UUID;
  v_cebola_r UUID;
  v_geleia UUID;
  v_sour UUID;
  v_nachos UUID;
  v_carne_seca UUID;
  v_melaco UUID;
BEGIN
  SELECT id INTO v_prod_alemanha FROM products WHERE name = 'Alemanha' LIMIT 1;
  SELECT id INTO v_prod_argentina FROM products WHERE name = 'Argentina' LIMIT 1;
  SELECT id INTO v_prod_brasil FROM products WHERE name = 'Brasil' LIMIT 1;
  SELECT id INTO v_prod_eua FROM products WHERE name = 'Estados Unidos' LIMIT 1;
  SELECT id INTO v_prod_mexico FROM products WHERE name = 'México' LIMIT 1;
  SELECT id INTO v_prod_wakanda FROM products WHERE name = 'Wakanda (Edição Nordeste)' LIMIT 1;

  SELECT id INTO v_pao_frances FROM inventory WHERE name = 'Pão Francês de Hambúrguer' LIMIT 1;
  SELECT id INTO v_pao_brioche FROM inventory WHERE name = 'Pão Brioche' LIMIT 1;
  SELECT id INTO v_pao_trad FROM inventory WHERE name = 'Pão Tradicional' LIMIT 1;

  SELECT id INTO v_b_linguica FROM inventory WHERE name = 'Hambúrguer de Linguiça 150g' LIMIT 1;
  SELECT id INTO v_b_costela FROM inventory WHERE name = 'Hambúrguer Recheado Costela 180g' LIMIT 1;
  SELECT id INTO v_b_bovino FROM inventory WHERE name = 'Hambúrguer Bovino 180g' LIMIT 1;
  SELECT id INTO v_b_frango FROM inventory WHERE name = 'Hamb. Frango Empanado c/ Cream Cheese 150g' LIMIT 1;

  SELECT id INTO v_q_moza FROM inventory WHERE name = 'Queijo Mozarela Fatiado' LIMIT 1;
  SELECT id INTO v_q_cheddar FROM inventory WHERE name = 'Queijo Cheddar Fatiado' LIMIT 1;
  SELECT id INTO v_q_minas FROM inventory WHERE name = 'Queijo Minas Padrão Fatiado' LIMIT 1;
  SELECT id INTO v_q_coalho FROM inventory WHERE name = 'Queijo Coalho em Barra' LIMIT 1;

  SELECT id INTO v_m_casa FROM inventory WHERE name = 'Maionese da Casa (Pronta)' LIMIT 1;
  SELECT id INTO v_m_chimi FROM inventory WHERE name = 'Maionese de Chimichurri (Pronta)' LIMIT 1;
  SELECT id INTO v_m_ervas FROM inventory WHERE name = 'Maionese de Ervas (Pronta)' LIMIT 1;
  SELECT id INTO v_m_hortela FROM inventory WHERE name = 'Maionese de Hortelã (Pronta)' LIMIT 1;
  SELECT id INTO v_coleslaw FROM inventory WHERE name = 'Coleslaw da Casa (Pronto)' LIMIT 1;
  SELECT id INTO v_cebola_caram FROM inventory WHERE name = 'Cebola Caramelizada (Pronta)' LIMIT 1;
  SELECT id INTO v_bacon FROM inventory WHERE name = 'Bacon Fatiado Crocante' LIMIT 1;
  SELECT id INTO v_alface FROM inventory WHERE name = 'Alface Americana' LIMIT 1;
  SELECT id INTO v_tomate FROM inventory WHERE name = 'Tomate Italiano' LIMIT 1;
  SELECT id INTO v_cebola_r FROM inventory WHERE name = 'Cebola Roxa' LIMIT 1;
  SELECT id INTO v_geleia FROM inventory WHERE name = 'Geleia de Pimenta' LIMIT 1;
  SELECT id INTO v_sour FROM inventory WHERE name = 'Sour Cream' LIMIT 1;
  SELECT id INTO v_nachos FROM inventory WHERE name = 'Nachos de Milho' LIMIT 1;
  SELECT id INTO v_carne_seca FROM inventory WHERE name = 'Carne Seca Desfiada Cozida' LIMIT 1;
  SELECT id INTO v_melaco FROM inventory WHERE name = 'Melaço de Cana' LIMIT 1;

  -- 1. ALEMANHA (Pão francês, maionese casa 30g, linguiça 150g, mozarela 30g, coleslaw 40g, bacon 30g)
  IF v_prod_alemanha IS NOT NULL THEN
    INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES
      (v_prod_alemanha, v_pao_frances, 1),
      (v_prod_alemanha, v_b_linguica, 1),
      (v_prod_alemanha, v_m_casa, 0.030),
      (v_prod_alemanha, v_q_moza, 0.030),
      (v_prod_alemanha, v_coleslaw, 0.040),
      (v_prod_alemanha, v_bacon, 0.030)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 2. ARGENTINA (Pão brioche, maionese chimi 35g, burguer costela 180g, cheddar 30g, cebola caramelizada 30g, bacon 30g)
  IF v_prod_argentina IS NOT NULL THEN
    INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES
      (v_prod_argentina, v_pao_brioche, 1),
      (v_prod_argentina, v_b_costela, 1),
      (v_prod_argentina, v_m_chimi, 0.035),
      (v_prod_argentina, v_q_cheddar, 0.030),
      (v_prod_argentina, v_cebola_caram, 0.030),
      (v_prod_argentina, v_bacon, 0.030)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3. BRASIL (Pão trad, maionese ervas 35g, burguer bovino 180g, queijo minas 30g, salada, bacon 30g)
  IF v_prod_brasil IS NOT NULL THEN
    INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES
      (v_prod_brasil, v_pao_trad, 1),
      (v_prod_brasil, v_b_bovino, 1),
      (v_prod_brasil, v_m_ervas, 0.035),
      (v_prod_brasil, v_q_minas, 0.030),
      (v_prod_brasil, v_bacon, 0.030),
      (v_prod_brasil, v_alface, 0.020),
      (v_prod_brasil, v_tomate, 0.030),
      (v_prod_brasil, v_cebola_r, 0.015)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 4. ESTADOS UNIDOS (Pão trad, maionese ervas 35g, burguer frango cream cheese 150g, alface, tomate)
  IF v_prod_eua IS NOT NULL THEN
    INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES
      (v_prod_eua, v_pao_trad, 1),
      (v_prod_eua, v_b_frango, 1),
      (v_prod_eua, v_m_ervas, 0.035),
      (v_prod_eua, v_alface, 0.020),
      (v_prod_eua, v_tomate, 0.030)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 5. MÉXICO (Pão brioche, geleia pimenta 25g, burguer bovino 180g, cheddar 30g, sour cream 30g, farofa nachos/bacon 25g)
  IF v_prod_mexico IS NOT NULL THEN
    INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES
      (v_prod_mexico, v_pao_brioche, 1),
      (v_prod_mexico, v_b_bovino, 1),
      (v_prod_mexico, v_geleia, 0.025),
      (v_prod_mexico, v_q_cheddar, 0.030),
      (v_prod_mexico, v_sour, 0.030),
      (v_prod_mexico, v_nachos, 0.025),
      (v_prod_mexico, v_bacon, 0.020)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 6. WAKANDA (Pão francês, burguer bovino 180g, queijo coalho 50g, melaco 15g, carne seca 40g, maionese hortelã 35g)
  IF v_prod_wakanda IS NOT NULL THEN
    INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES
      (v_prod_wakanda, v_pao_frances, 1),
      (v_prod_wakanda, v_b_bovino, 1),
      (v_prod_wakanda, v_q_coalho, 0.050),
      (v_prod_wakanda, v_melaco, 0.015),
      (v_prod_wakanda, v_carne_seca, 0.040),
      (v_prod_wakanda, v_m_hortela, 0.035)
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
