-- ====================================================================
-- HUM VÍCIO ERP - MIGRAÇÃO FASE 3 (FORNECEDORES, COMPRAS E AUDITORIA)
-- Execute este script no SQL Editor do Supabase
-- ====================================================================

-- 1. TABELA DE FORNECEDORES
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  category TEXT DEFAULT 'Geral',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE HISTÓRICO DE COMPRAS POR FORNECEDOR
CREATE TABLE IF NOT EXISTS purchase_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  quantity DECIMAL(10,3) NOT NULL,
  unit TEXT NOT NULL,
  cost_per_unit DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA DE AUDITORIAS DE INVENTÁRIO FÍSICO
CREATE TABLE IF NOT EXISTS stock_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audited_by TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_variance_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_all" ON suppliers;
CREATE POLICY "suppliers_all" ON suppliers FOR ALL USING (true);

DROP POLICY IF EXISTS "purchase_records_all" ON purchase_records;
CREATE POLICY "purchase_records_all" ON purchase_records FOR ALL USING (true);

DROP POLICY IF EXISTS "stock_audits_all" ON stock_audits;
CREATE POLICY "stock_audits_all" ON stock_audits FOR ALL USING (true);

-- 5. INSERIR FORNECEDORES DE EXEMPLO (SE A TABELA ESTIVER VAZIA)
INSERT INTO suppliers (name, contact_name, phone, category, notes)
SELECT 'Distribuidora Carnes Sul', 'Marcos', '11999990001', 'Carnes', 'Blend bovino e bacon'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Distribuidora Carnes Sul');

INSERT INTO suppliers (name, contact_name, phone, category, notes)
SELECT 'Padaria Artesanal Pães & Cia', 'Juliana', '11999990002', 'Padaria', 'Pães brioche e australiano'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Padaria Artesanal Pães & Cia');

INSERT INTO suppliers (name, contact_name, phone, category, notes)
SELECT 'Embalagens Express', 'Atendimento', '11999990003', 'Embalagens', 'Embrulhos térmicos e sacolas kraft'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Embalagens Express');
