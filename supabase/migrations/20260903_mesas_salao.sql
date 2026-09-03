-- ====================================================================
-- HUM VÍCIO ERP: Módulo de Gestão e Mapa Visual Interativo de Mesas
-- Arquitetura: Layout Template vs. Floor Session State
-- ====================================================================

-- 1. Template mestre configurado pelo Admin
CREATE TABLE IF NOT EXISTS layout_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Itens / Mesas do Template Mestre
CREATE TABLE IF NOT EXISTS layout_template_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_template_id UUID REFERENCES layout_template(id) ON DELETE RESTRICT,
    numero_identificador VARCHAR(20) NOT NULL,
    pos_x FLOAT NOT NULL,
    pos_y FLOAT NOT NULL,
    largura FLOAT DEFAULT 90,
    altura FLOAT DEFAULT 90,
    capacidade INTEGER DEFAULT 4,
    formato VARCHAR(20) DEFAULT 'quadrada' -- 'quadrada', 'redonda', 'retangular'
);

-- 3. Instância de Salão vinculada à Sessão de Caixa (Floor Session State)
CREATE TABLE IF NOT EXISTS sessao_caixa_salao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_caixa_id VARCHAR(100) NOT NULL,
    layout_origem_id UUID REFERENCES layout_template(id),
    aberto_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fechado_em TIMESTAMP WITH TIME ZONE
);

-- 4. Instância Viva de Mesa no Turno de Caixa
CREATE TABLE IF NOT EXISTS salao_mesa_instancia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_caixa_salao_id UUID REFERENCES sessao_caixa_salao(id),
    numero_identificador VARCHAR(20) NOT NULL,
    pos_x FLOAT NOT NULL,
    pos_y FLOAT NOT NULL,
    largura FLOAT DEFAULT 90,
    altura FLOAT DEFAULT 90,
    formato VARCHAR(20) DEFAULT 'quadrada',
    status_visual VARCHAR(20) DEFAULT 'NO_SALAO', -- 'NO_SALAO', 'GUARDADA'
    status_consumo VARCHAR(30) DEFAULT 'LIVRE',   -- 'LIVRE', 'OCUPADA_ABERTA', 'PARCIALMENTE_PAGA', 'PAGA_AGUARDANDO'
    mesa_pai_id UUID REFERENCES salao_mesa_instancia(id), -- Auto-relacionamento para mesas agrupadas (Merge)
    total_consumo NUMERIC(10,2) DEFAULT 0.00,
    total_pago NUMERIC(10,2) DEFAULT 0.00,
    cliente_nome VARCHAR(100),
    aberta_em TIMESTAMP WITH TIME ZONE,
    fechada_em TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Trilha de Auditoria Imutável do Salão (Antifraude)
CREATE TABLE IF NOT EXISTS audit_log_salao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_caixa_salao_id UUID REFERENCES sessao_caixa_salao(id),
    operador_id VARCHAR(100) NOT NULL,
    mesa_id UUID REFERENCES salao_mesa_instancia(id),
    evento VARCHAR(50) NOT NULL, -- 'MESA_ABERTA', 'MESA_JUNTA', 'MESA_SEPARADA', 'MESA_EXTRA', 'MESA_GUARDADA', 'PAGAMENTO_PARCIAL', 'MESA_PAGA', 'MESA_LIBERADA', 'CANCELAMENTO'
    dados_contexto JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para Performance e Rastreabilidade
CREATE INDEX IF NOT EXISTS idx_layout_item_template ON layout_template_item(layout_template_id);
CREATE INDEX IF NOT EXISTS idx_salao_instancia_sessao ON salao_mesa_instancia(sessao_caixa_salao_id);
CREATE INDEX IF NOT EXISTS idx_salao_instancia_pai ON salao_mesa_instancia(mesa_pai_id);
CREATE INDEX IF NOT EXISTS idx_audit_salao_sessao ON audit_log_salao(sessao_caixa_salao_id);
CREATE INDEX IF NOT EXISTS idx_audit_salao_evento ON audit_log_salao(evento);
