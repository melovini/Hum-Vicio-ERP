-- ====================================================================
-- HUM VÍCIO ERP - PLANO DE CORREÇÃO & BLINDAGEM DO BANCO DE DADOS
-- AUDITORIA TÉCNICA, OPERACIONAL, ANTIFRAUDE E PERFORMANCE (POSTGRESQL)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. FUNÇÕES ESSENCIAIS DE SEGURANÇA E AUDITORIA
-- --------------------------------------------------------------------

-- Função 1.1: Atualização Automática de Timestamp (updated_at)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função 1.2: Bloqueio Estrito de Hard Delete (RN01 - Antifraude)
CREATE OR REPLACE FUNCTION trigger_block_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operação DELETE rejeitada: A tabela % é protegida contra exclusão física por políticas antifraude. Utilize Soft Delete (deleted_at).', TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Função 1.3: Imutabilidade Estrita de Logs de Auditoria (Append-Only)
CREATE OR REPLACE FUNCTION trigger_protect_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'Operação UPDATE rejeitada: Registros de auditoria na tabela % são estritamente imutáveis.', TG_TABLE_NAME;
  ELSIF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'Operação DELETE rejeitada: Registros de auditoria na tabela % não podem ser excluídos.', TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------
-- 2. CRIAÇÃO DAS TABELAS AUSENTES NO SUPABASE
-- --------------------------------------------------------------------

-- 2.1 Tabela de Auditoria Geral do ERP (audit_logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(60) NOT NULL,
    operator VARCHAR(100) NOT NULL DEFAULT 'Operador',
    details TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2.2 Tabelas de Salão & Mesas (Layout Template vs. Floor Session State)
CREATE TABLE IF NOT EXISTS layout_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS layout_template_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_template_id UUID NOT NULL REFERENCES layout_template(id) ON DELETE RESTRICT,
    numero_identificador VARCHAR(30) NOT NULL,
    pos_x NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    pos_y NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    largura NUMERIC(8,2) NOT NULL DEFAULT 100.00,
    altura NUMERIC(8,2) NOT NULL DEFAULT 100.00,
    capacidade INTEGER NOT NULL DEFAULT 4 CHECK (capacidade > 0),
    formato VARCHAR(20) NOT NULL DEFAULT 'quadrada' CHECK (formato IN ('quadrada', 'redonda', 'retangular')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS sessao_caixa_salao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_caixa_id VARCHAR(100) NOT NULL,
    layout_origem_id UUID REFERENCES layout_template(id) ON DELETE RESTRICT,
    layout_nome VARCHAR(100),
    aberto_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    fechado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS salao_mesa_instancia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_caixa_salao_id UUID NOT NULL REFERENCES sessao_caixa_salao(id) ON DELETE RESTRICT,
    numero_identificador VARCHAR(30) NOT NULL,
    pos_x NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    pos_y NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    largura NUMERIC(8,2) NOT NULL DEFAULT 100.00,
    altura NUMERIC(8,2) NOT NULL DEFAULT 100.00,
    formato VARCHAR(20) NOT NULL DEFAULT 'quadrada' CHECK (formato IN ('quadrada', 'redonda', 'retangular')),
    capacidade INTEGER NOT NULL DEFAULT 4 CHECK (capacidade > 0),
    status_visual VARCHAR(20) NOT NULL DEFAULT 'NO_SALAO' CHECK (status_visual IN ('NO_SALAO', 'GUARDADA')),
    status_consumo VARCHAR(30) NOT NULL DEFAULT 'LIVRE' CHECK (status_consumo IN ('LIVRE', 'OCUPADA_ABERTA', 'PARCIALMENTE_PAGA', 'PAGA_AGUARDANDO')),
    mesa_pai_id UUID REFERENCES salao_mesa_instancia(id) ON DELETE RESTRICT,
    total_consumo NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_consumo >= 0),
    total_pago NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_pago >= 0),
    cliente_nome VARCHAR(100),
    garcom VARCHAR(100),
    aberta_em TIMESTAMPTZ,
    fechada_em TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log_salao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_caixa_salao_id UUID NOT NULL REFERENCES sessao_caixa_salao(id) ON DELETE RESTRICT,
    operador_id VARCHAR(100) NOT NULL DEFAULT 'Operador',
    mesa_id UUID REFERENCES salao_mesa_instancia(id) ON DELETE RESTRICT,
    mesa_numero VARCHAR(30),
    evento VARCHAR(50) NOT NULL CHECK (evento IN ('MESA_ABERTA', 'MESA_JUNTA', 'MESA_SEPARADA', 'MESA_EXTRA', 'MESA_GUARDADA', 'MESA_REPOSICIONADA', 'PAGAMENTO_PARCIAL', 'MESA_PAGA', 'MESA_LIBERADA', 'CANCELAMENTO_MESA')),
    dados_contexto JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- --------------------------------------------------------------------
-- 3. ADEQUAÇÃO DE COLUNAS DE AUDITORIA & SOFT DELETE NAS TABELAS BASE
-- --------------------------------------------------------------------

-- 3.1 inventory (Insumos)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- 3.2 products (Cardápio)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- 3.3 sales (Vendas)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0.00 CHECK (subtotal >= 0);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0.00 CHECK (discount >= 0);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) DEFAULT 0.00 CHECK (delivery_fee >= 0);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_coupon_subsidy NUMERIC(12,2) DEFAULT 0.00 CHECK (store_coupon_subsidy >= 0);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100) DEFAULT 'Balcão';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'mesa' CHECK (order_type IN ('mesa', 'retirada', 'delivery'));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS production_status VARCHAR(30) DEFAULT 'em_espera' CHECK (production_status IN ('em_espera', 'agendado', 'em_producao', 'concluido'));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS production_completed_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS target_prep_minutes INTEGER DEFAULT 20 CHECK (target_prep_minutes > 0);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delay_reason VARCHAR(50);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delay_notes TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(100);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- 3.4 sale_items (Itens de Venda)
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS gift_reason VARCHAR(50);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS gift_notes TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- 3.5 cash_sessions (Sessões de Caixa)
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS variance_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- 3.6 suppliers (Fornecedores)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- --------------------------------------------------------------------
-- 4. CONSTRAINTS DE VALIDAÇÃO (CHECK) & REGRAS DE INTEGRIDADE
-- --------------------------------------------------------------------

-- Preços e Quantidades não negativos
DO $$ BEGIN
  ALTER TABLE inventory ADD CONSTRAINT chk_inventory_cost CHECK (cost_per_unit >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT chk_product_price_balcao CHECK (price_balcao >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT chk_product_price_ifood CHECK (price_ifood >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sales ADD CONSTRAINT chk_sales_total CHECK (total >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sale_items ADD CONSTRAINT chk_sale_items_qty CHECK (quantity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sale_items ADD CONSTRAINT chk_sale_items_price CHECK (unit_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE cash_movements ADD CONSTRAINT chk_cash_movement_amount CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE cash_movements ADD CONSTRAINT chk_cash_movement_type CHECK (type IN ('sangria', 'suprimento'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sales ADD CONSTRAINT chk_sales_channel CHECK (channel IN ('balcao', 'ifood'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sales ADD CONSTRAINT chk_sales_status CHECK (status IN ('completed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------
-- 5. BLINDAGEM DE FOREIGN KEYS COM ON DELETE RESTRICT
-- --------------------------------------------------------------------

-- Evita exclusão de produtos que estejam em receitas ou vendas
DO $$ BEGIN
  ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_product_id_fkey;
  ALTER TABLE recipes ADD CONSTRAINT recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_ingredient_id_fkey;
  ALTER TABLE recipes ADD CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES inventory(id) ON DELETE RESTRICT;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sub_recipes DROP CONSTRAINT IF EXISTS sub_recipes_parent_ingredient_id_fkey;
  ALTER TABLE sub_recipes ADD CONSTRAINT sub_recipes_parent_ingredient_id_fkey FOREIGN KEY (parent_ingredient_id) REFERENCES inventory(id) ON DELETE RESTRICT;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sub_recipes DROP CONSTRAINT IF EXISTS sub_recipes_child_ingredient_id_fkey;
  ALTER TABLE sub_recipes ADD CONSTRAINT sub_recipes_child_ingredient_id_fkey FOREIGN KEY (child_ingredient_id) REFERENCES inventory(id) ON DELETE RESTRICT;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- --------------------------------------------------------------------
-- 6. COBERTURA DE ÍNDICES PARA ALTA PERFORMANCE (B-TREE & GIN)
-- --------------------------------------------------------------------

-- Índices em Chaves Estrangeiras (FK Coverage)
CREATE INDEX IF NOT EXISTS idx_recipes_product_id ON recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient_id ON recipes(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sub_recipes_parent ON sub_recipes(parent_ingredient_id);
CREATE INDEX IF NOT EXISTS idx_sub_recipes_child ON sub_recipes(child_ingredient_id);
CREATE INDEX IF NOT EXISTS idx_template_items_tpl ON layout_template_item(layout_template_id);
CREATE INDEX IF NOT EXISTS idx_salao_mesas_sessao ON salao_mesa_instancia(sessao_caixa_salao_id);
CREATE INDEX IF NOT EXISTS idx_salao_mesas_pai ON salao_mesa_instancia(mesa_pai_id);
CREATE INDEX IF NOT EXISTS idx_audit_salao_sessao ON audit_log_salao(sessao_caixa_salao_id);
CREATE INDEX IF NOT EXISTS idx_audit_salao_mesa ON audit_log_salao(mesa_id);

-- Índices de Alta Frequência de Busca & Relatórios
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales(channel);
CREATE INDEX IF NOT EXISTS idx_sales_production ON sales(production_status);
CREATE INDEX IF NOT EXISTS idx_cash_movements_created ON cash_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Índices Parciais para Registros Ativos (Exclusão Lógica Rápida)
CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory(id) WHERE deleted_at IS NULL AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_active ON products(id) WHERE deleted_at IS NULL AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sales_active ON sales(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_salao_mesas_active ON salao_mesa_instancia(id) WHERE deleted_at IS NULL AND status_visual = 'NO_SALAO';

-- Índices GIN em Campos JSONB (Busca Estruturada Rápida)
CREATE INDEX IF NOT EXISTS idx_kitchen_checklists_tasks_gin ON kitchen_checklists USING gin (tasks);
CREATE INDEX IF NOT EXISTS idx_audit_salao_contexto_gin ON audit_log_salao USING gin (dados_contexto);

-- --------------------------------------------------------------------
-- 7. TRIGGERS DE SEGURANÇA ANTIFRAUDE E AUTO-ATUALIZAÇÃO
-- --------------------------------------------------------------------

-- 7.1 Triggers de Bloqueio de HARD DELETE em Tabelas Transacionais
DROP TRIGGER IF EXISTS trg_block_delete_sales ON sales;
CREATE TRIGGER trg_block_delete_sales
BEFORE DELETE ON sales
FOR EACH ROW EXECUTE FUNCTION trigger_block_hard_delete();

DROP TRIGGER IF EXISTS trg_block_delete_sale_items ON sale_items;
CREATE TRIGGER trg_block_delete_sale_items
BEFORE DELETE ON sale_items
FOR EACH ROW EXECUTE FUNCTION trigger_block_hard_delete();

DROP TRIGGER IF EXISTS trg_block_delete_cash_movements ON cash_movements;
CREATE TRIGGER trg_block_delete_cash_movements
BEFORE DELETE ON cash_movements
FOR EACH ROW EXECUTE FUNCTION trigger_block_hard_delete();

DROP TRIGGER IF EXISTS trg_block_delete_cash_sessions ON cash_sessions;
CREATE TRIGGER trg_block_delete_cash_sessions
BEFORE DELETE ON cash_sessions
FOR EACH ROW EXECUTE FUNCTION trigger_block_hard_delete();

DROP TRIGGER IF EXISTS trg_block_delete_salao_mesas ON salao_mesa_instancia;
CREATE TRIGGER trg_block_delete_salao_mesas
BEFORE DELETE ON salao_mesa_instancia
FOR EACH ROW EXECUTE FUNCTION trigger_block_hard_delete();

-- 7.2 Triggers de Imutabilidade Estrita em Logs de Auditoria
DROP TRIGGER IF EXISTS trg_protect_audit_logs ON audit_logs;
CREATE TRIGGER trg_protect_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION trigger_protect_audit_logs();

DROP TRIGGER IF EXISTS trg_protect_audit_log_salao ON audit_log_salao;
CREATE TRIGGER trg_protect_audit_log_salao
BEFORE UPDATE OR DELETE ON audit_log_salao
FOR EACH ROW EXECUTE FUNCTION trigger_protect_audit_logs();

-- 7.3 Triggers de Atualização Automática de updated_at
DROP TRIGGER IF EXISTS trg_set_updated_at_inventory ON inventory;
CREATE TRIGGER trg_set_updated_at_inventory
BEFORE UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_set_updated_at_products ON products;
CREATE TRIGGER trg_set_updated_at_products
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_set_updated_at_sales ON sales;
CREATE TRIGGER trg_set_updated_at_sales
BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_set_updated_at_suppliers ON suppliers;
CREATE TRIGGER trg_set_updated_at_suppliers
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_set_updated_at_layout_template ON layout_template;
CREATE TRIGGER trg_set_updated_at_layout_template
BEFORE UPDATE ON layout_template
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_set_updated_at_salao_mesas ON salao_mesa_instancia;
CREATE TRIGGER trg_set_updated_at_salao_mesas
BEFORE UPDATE ON salao_mesa_instancia
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- --------------------------------------------------------------------
-- 8. POLÍTICAS DE ROW LEVEL SECURITY (RLS) BLINDADAS
-- --------------------------------------------------------------------

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_template_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessao_caixa_salao ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_mesa_instancia ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_salao ENABLE ROW LEVEL SECURITY;

-- Audit Logs: Somente SELECT e INSERT permitidos para clientes (Imutabilidade Total)
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (true);

-- Mesas & Salão: Permissões de Leitura, Inserção e Atualização (DELETE bloqueado por Trigger)
DROP POLICY IF EXISTS "layout_template_all" ON layout_template;
CREATE POLICY "layout_template_all" ON layout_template FOR ALL USING (true);

DROP POLICY IF EXISTS "layout_template_item_all" ON layout_template_item;
CREATE POLICY "layout_template_item_all" ON layout_template_item FOR ALL USING (true);

DROP POLICY IF EXISTS "sessao_caixa_salao_all" ON sessao_caixa_salao;
CREATE POLICY "sessao_caixa_salao_all" ON sessao_caixa_salao FOR ALL USING (true);

DROP POLICY IF EXISTS "salao_mesa_instancia_all" ON salao_mesa_instancia;
CREATE POLICY "salao_mesa_instancia_all" ON salao_mesa_instancia FOR ALL USING (true);

DROP POLICY IF EXISTS "audit_log_salao_select" ON audit_log_salao;
CREATE POLICY "audit_log_salao_select" ON audit_log_salao FOR SELECT USING (true);

DROP POLICY IF EXISTS "audit_log_salao_insert" ON audit_log_salao;
CREATE POLICY "audit_log_salao_insert" ON audit_log_salao FOR INSERT WITH CHECK (true);
