-- ====================================================================
-- HUM VÍCIO ERP - MIGRAÇÃO DE HIERARQUIAS & SUBCATEGORIAS DO CARDÁPIO
-- Execute este script no SQL Editor do Supabase se desejar persistência remota da coluna
-- ====================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Comentário explicativo na coluna
COMMENT ON COLUMN products.subcategory IS 'Subcategoria do produto para organização visual e filtros (ex: Smash Burgers, Duplos, Bebidas, etc.)';
