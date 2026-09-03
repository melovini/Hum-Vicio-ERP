-- ====================================================================
-- HUM VÍCIO BURGER - MIGRAÇÃO KDS DIGITAL, TEMPO DINÂMICO & ATRASOS
-- Execute no SQL Editor do Supabase (Opcional, o código possui fallback)
-- ====================================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS production_status TEXT DEFAULT 'em_producao';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sales ADD COLUMN IF NOT EXISTS production_completed_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS production_time_minutes NUMERIC;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS target_prep_minutes INTEGER DEFAULT 20;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delay_reason TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delay_notes TEXT;
