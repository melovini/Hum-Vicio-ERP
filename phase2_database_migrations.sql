-- ====================================================================
-- HUM VÍCIO ERP - MIGRAÇÃO FASE 2 (PERDAS E CAIXA EM NUVEM)
-- Execute este script no SQL Editor do Supabase
-- ====================================================================

-- 1. TABELA DE REGISTRO DE PERDAS / DESPERDÍCIOS
CREATE TABLE IF NOT EXISTS waste_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit TEXT NOT NULL,
  cost_at_time DECIMAL(10,2) NOT NULL,
  total_loss DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  responsible_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE SESSÕES DE CAIXA (ABERTURA / FECHAMENTO)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'open', -- 'open' ou 'closed'
  initial_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_amount DECIMAL(10,2),
  opened_by TEXT NOT NULL,
  closed_by TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- 3. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waste_records_all" ON waste_records;
CREATE POLICY "waste_records_all" ON waste_records FOR ALL USING (true);

DROP POLICY IF EXISTS "cash_sessions_all" ON cash_sessions;
CREATE POLICY "cash_sessions_all" ON cash_sessions FOR ALL USING (true);
