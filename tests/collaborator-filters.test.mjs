import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  filterCollaborators,
  computeCollaboratorKpis,
  getRoleLabel,
  getRoleBadgeVariant,
} = createLoader()('src/lib/collaborator-filters.ts');

const mockCollaborators = [
  {
    id: 'c-1',
    name: 'Carlos Silva',
    role: 'caixa',
    pin: '',
    phone: '11999990001',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c-2',
    name: 'Ana Chapeira',
    role: 'cozinha',
    pin: '',
    phone: '11999990002',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c-3',
    name: 'Marcos Gerente',
    role: 'gerente',
    pin: '',
    phone: '11999990003',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c-4',
    name: 'Vinicius Admin',
    role: 'admin',
    pin: '',
    phone: '11999990004',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c-5',
    name: 'Lucas Ex-Funcionario',
    role: 'caixa',
    pin: '',
    phone: '11999990005',
    isActive: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

test('filterCollaborators filtra por papel, termo de busca e status ativo/inativo', () => {
  // Filtro por papel
  const caixas = filterCollaborators(mockCollaborators, { role: 'caixa' });
  assert.equal(caixas.length, 2);

  // Filtro textual por nome
  const porNome = filterCollaborators(mockCollaborators, { searchQuery: 'Ana' });
  assert.equal(porNome.length, 1);
  assert.equal(porNome[0].name, 'Ana Chapeira');

  // Filtro por telefone
  const porTel = filterCollaborators(mockCollaborators, { searchQuery: '0004' });
  assert.equal(porTel.length, 1);
  assert.equal(porTel[0].name, 'Vinicius Admin');

  // Filtro por status inativo
  const inativos = filterCollaborators(mockCollaborators, { status: 'inativos' });
  assert.equal(inativos.length, 1);
  assert.equal(inativos[0].name, 'Lucas Ex-Funcionario');
});

test('computeCollaboratorKpis calcula totais, ativos e contagens por setor com precisão', () => {
  const kpis = computeCollaboratorKpis(mockCollaborators);
  assert.equal(kpis.total, 5);
  assert.equal(kpis.ativos, 4);
  assert.equal(kpis.inativos, 1);
  assert.equal(kpis.caixas, 1); // Apenas ativos contam nas métricas operacionais
  assert.equal(kpis.cozinha, 1);
  assert.equal(kpis.gerentes, 2); // gerente (1) + admin (1)
});

test('getRoleLabel e getRoleBadgeVariant mapeiam cargos para textos e variantes visuais', () => {
  assert.equal(getRoleLabel('admin'), 'Administrador Master');
  assert.equal(getRoleBadgeVariant('admin'), 'danger');

  assert.equal(getRoleLabel('gerente'), 'Gerente Operacional');
  assert.equal(getRoleBadgeVariant('gerente'), 'warning');

  assert.equal(getRoleLabel('caixa'), 'Operador de Caixa');
  assert.equal(getRoleBadgeVariant('caixa'), 'info');

  assert.equal(getRoleLabel('cozinha'), 'Equipe Cozinha');
  assert.equal(getRoleBadgeVariant('cozinha'), 'success');
});
