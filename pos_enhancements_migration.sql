-- ====================================================================
-- HUM VÍCIO BURGER - MELHORIAS DE PDV: CLIENTE, MODALIDADE, COMBOS & OBS
-- Execute no SQL Editor do Supabase (Opcional, o sistema já possui fallback)
-- ====================================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT 'Balcão';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'mesa';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS combo TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS additionals JSONB DEFAULT '[]'::jsonb;
