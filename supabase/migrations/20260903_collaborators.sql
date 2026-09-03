-- ====================================================================
-- HUM VÍCIO ERP - TABELA DE COLABORADORES & CONTROLE DE ACESSO
-- Execute no SQL Editor do Supabase para suporte multi-usuário remoto
-- ====================================================================

CREATE TABLE IF NOT EXISTS collaborators (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'gerente', 'caixa', 'cozinha')),
    pin VARCHAR(50) NOT NULL,
    phone VARCHAR(30),
    shift VARCHAR(30) DEFAULT 'integral' CHECK (shift IN ('manha', 'tarde', 'noite', 'integral')),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Índices para busca rápida por PIN e cargo
CREATE INDEX IF NOT EXISTS idx_collaborators_pin ON collaborators(pin);
CREATE INDEX IF NOT EXISTS idx_collaborators_role ON collaborators(role);
CREATE INDEX IF NOT EXISTS idx_collaborators_active ON collaborators(id) WHERE is_active = TRUE AND deleted_at IS NULL;

-- Habilitar RLS
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collaborators_all" ON collaborators;
CREATE POLICY "collaborators_all" ON collaborators FOR ALL USING (true);

-- Carga inicial dos colaboradores mestres da casa
INSERT INTO collaborators (id, name, role, pin, phone, shift, is_active)
VALUES
    ('collab_admin_1', 'Administrador Master', 'admin', 'admin', '(11) 99999-0001', 'integral', TRUE),
    ('collab_gerente_1', 'Gerente Geral', 'gerente', '0000', '(11) 99999-0002', 'integral', TRUE),
    ('collab_caixa_1', 'Operador de Caixa', 'caixa', '5678', '(11) 99999-0003', 'tarde', TRUE),
    ('collab_cozinha_1', 'Chapeiro Principal', 'cozinha', '1234', '(11) 99999-0004', 'noite', TRUE)
ON CONFLICT (id) DO NOTHING;
