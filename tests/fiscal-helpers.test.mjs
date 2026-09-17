import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  filterFiscalInvoices,
  calculateFiscalReadiness,
  filterAuditLogs,
  computeAuditStats,
} = createLoader()('src/lib/fiscal-helpers.ts');

const mockInvoices = [
  {
    id: 'inv-1',
    saleId: 'sale-1',
    numero: 101,
    serie: 1,
    chaveAcesso: '31260912345678000199650010000001011000001010',
    status: 'autorizada',
    dataEmissao: '2026-09-17T12:00:00Z',
    valorTotal: 58.90,
    destinatarioNome: 'Maria Santos',
    destinatarioCpfCnpj: '123.456.789-00',
    ambiente: 'producao',
    itemsSummary: '1x Burger Especial',
    formaPagamento: 'PIX',
  },
  {
    id: 'inv-2',
    saleId: 'sale-2',
    numero: 102,
    serie: 1,
    chaveAcesso: '31260912345678000199650010000001021000001020',
    status: 'simulada',
    dataEmissao: '2026-09-17T13:00:00Z',
    valorTotal: 34.00,
    destinatarioNome: 'Consumidor Final',
    ambiente: 'homologacao',
    itemsSummary: '1x Batata Frita',
    formaPagamento: 'Dinheiro',
  },
  {
    id: 'inv-3',
    saleId: 'sale-3',
    numero: 103,
    serie: 1,
    chaveAcesso: '31260912345678000199650010000001031000001030',
    status: 'cancelada',
    dataEmissao: '2026-09-17T14:00:00Z',
    valorTotal: 90.00,
    destinatarioNome: 'Lucas Souza',
    ambiente: 'producao',
    itemsSummary: '2x Duplo Cheddar',
    formaPagamento: 'Cartão',
  },
];

const mockAuditLogs = [
  {
    id: 'log-1',
    timestamp: '2026-09-17T10:00:00Z',
    operator: 'Carlos Caixa',
    action: 'ABERTURA_CAIXA',
    details: 'Abertura de caixa com fundo de R$ 100,00',
  },
  {
    id: 'log-2',
    timestamp: '2026-09-17T11:00:00Z',
    operator: 'Gerente Roberto',
    action: 'CANCELAMENTO_VENDA',
    details: 'Cancelamento do pedido #42 motivo cliente desistiu',
  },
  {
    id: 'log-3',
    timestamp: '2026-09-17T12:00:00Z',
    operator: 'Admin Vinicius',
    action: 'ALTERACAO_PRECO',
    details: 'Preço do Burger Duplo atualizado de 40 para 45',
  },
  {
    id: 'log-4',
    timestamp: '2026-09-17T13:00:00Z',
    operator: 'Carlos Caixa',
    action: 'SANGRIA',
    details: 'Sangria de R$ 300,00 para cofre',
  },
  {
    id: 'log-5',
    timestamp: '2026-09-17T14:00:00Z',
    operator: 'Carlos Caixa',
    action: 'ITEM_BRINDE',
    details: 'Item brinde adicionado: Brownie cortesia',
  },
];

test('filterFiscalInvoices filtra por status e busca textual', () => {
  // Filtro por status
  const autorizadas = filterFiscalInvoices(mockInvoices, { status: 'autorizada' });
  assert.equal(autorizadas.length, 1);
  assert.equal(autorizadas[0].numero, 101);

  // Filtro por termo de busca em nome
  const buscaMaria = filterFiscalInvoices(mockInvoices, { searchTerm: 'Maria' });
  assert.equal(buscaMaria.length, 1);
  assert.equal(buscaMaria[0].destinatarioNome, 'Maria Santos');

  // Filtro por número
  const buscaNum = filterFiscalInvoices(mockInvoices, { searchTerm: '102' });
  assert.equal(buscaNum.length, 1);
  assert.equal(buscaNum[0].numero, 102);

  // Filtro por chave
  const buscaChave = filterFiscalInvoices(mockInvoices, { searchTerm: '01031000001030' });
  assert.equal(buscaChave.length, 1);
  assert.equal(buscaChave[0].numero, 103);
});

test('calculateFiscalReadiness avalia prontidão fiscal para emissão', () => {
  // Configuração incompleta
  const incompleteConfig = {
    cnpj: '',
    inscricaoEstadual: '',
    logradouro: '',
    numero: '',
    municipio: '',
    cscId: '',
    cscToken: '',
    certificate: {},
    apiToken: '',
  };
  const resPendente = calculateFiscalReadiness(incompleteConfig);
  assert.equal(resPendente.level, 'pendente');
  assert.equal(resPendente.score, 0);

  // Configuração completa
  const completeConfig = {
    cnpj: '12.345.678/0001-99',
    inscricaoEstadual: '12345678',
    logradouro: 'Rua Principal',
    numero: '100',
    municipio: 'Uberlândia',
    cscId: '000001',
    cscToken: 'TOKEN_CSC_VALIDO_123',
    certificate: { fileName: 'cert.pfx' },
    apiToken: 'TOKEN_API_SECRET_999',
  };
  const resPronto = calculateFiscalReadiness(completeConfig);
  assert.equal(resPronto.level, 'pronto');
  assert.equal(resPronto.score, 6);
});

test('filterAuditLogs e computeAuditStats filtram e sumarizam ações sensíveis', () => {
  // Filtro por categoria
  const cancelamentos = filterAuditLogs(mockAuditLogs, { category: 'cancelamento' });
  assert.equal(cancelamentos.length, 1);
  assert.equal(cancelamentos[0].action, 'CANCELAMENTO_VENDA');

  // Filtro por operador
  const doCarlos = filterAuditLogs(mockAuditLogs, { searchTerm: 'Carlos' });
  assert.equal(doCarlos.length, 3);

  // Estatísticas
  const stats = computeAuditStats(mockAuditLogs);
  assert.equal(stats.total, 5);
  assert.equal(stats.cancelamentos, 1);
  assert.equal(stats.fechamentos, 0);
  assert.equal(stats.sangrias, 1);
  assert.equal(stats.alteracoesPreco, 1);
  assert.equal(stats.brindes, 1);
});
