-- ====================================================================
-- HUM VÍCIO BURGER - MELHORIAS DE PDV: CLIENTE, COMBOS & OBSERVAÇÕES
-- Execute no SQL Editor do Supabase (Opcional, pois o código já possui fallback)
-- ====================================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT 'Balcão';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS combo TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS additionals JSONB DEFAULT '[]'::jsonb;
