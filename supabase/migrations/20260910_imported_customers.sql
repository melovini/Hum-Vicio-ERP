-- ====================================================================
-- HUM VÍCIO ERP - TABELA DE CLIENTES IMPORTADOS (CARDÁPIO WEB / CRM)
-- Execute no SQL Editor do Supabase para sincronização em nuvem multi-dispositivo
-- ====================================================================

CREATE TABLE IF NOT EXISTS imported_customers (
    id VARCHAR(120) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(40),
    address TEXT,
    number VARCHAR(30),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    complement VARCHAR(150),
    full_address TEXT,
    total_orders INTEGER DEFAULT 1 NOT NULL,
    last_order_date VARCHAR(50),
    source VARCHAR(50) DEFAULT 'cardapio_web' NOT NULL,
    imported_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices de alta performance para busca textual e autocomplete
CREATE INDEX IF NOT EXISTS idx_imported_customers_name ON imported_customers(name);
CREATE INDEX IF NOT EXISTS idx_imported_customers_phone ON imported_customers(phone);
CREATE INDEX IF NOT EXISTS idx_imported_customers_source ON imported_customers(source);

-- Habilitar RLS
ALTER TABLE imported_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imported_customers_all" ON imported_customers;
CREATE POLICY "imported_customers_all" ON imported_customers FOR ALL USING (true) WITH CHECK (true);
