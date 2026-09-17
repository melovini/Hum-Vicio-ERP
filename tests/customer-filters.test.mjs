import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  filterAndSortCustomers,
  formatPhone,
} = createLoader()('src/lib/customer-filters.ts');

const mockProfiles = [
  {
    id: 'c1',
    name: 'João da Silva',
    rawFullName: 'João da Silva - Rua das Acácias, 100',
    phone: '34999991111',
    address: 'Rua das Acácias, 100',
    totalOrders: 10,
    totalSpent: 850.0,
    totalCmv: 340.0,
    totalGrossProfit: 510.0,
    profitMargin: 60.0,
    averageTicket: 85.0,
    firstOrderDate: '2026-01-10T19:00:00Z',
    lastOrderDate: '2026-09-15T20:00:00Z',
    daysSinceLastOrder: 2,
    churnRisk: 'ativo',
    preferredOrderType: 'delivery',
    preferredChannel: 'balcao',
    offPeakOrdersCount: 1,
    peakOrdersCount: 9,
    offPeakRatio: 0.1,
    isOffPeakHero: false,
    preferredHourStr: '20h - 21h',
    preferredDayOfWeekStr: 'Sábado',
    topProducts: [],
    lastOrderSummary: '1x Combo Smash',
    frequentNotes: [],
    badges: ['vip_lucro', 'fiel'],
    orders: [],
  },
  {
    id: 'c2',
    name: 'Ana Maria Ferreira',
    rawFullName: 'Ana Maria Ferreira',
    phone: '34988882222',
    address: '',
    totalOrders: 1,
    totalSpent: 45.0,
    totalCmv: 25.0,
    totalGrossProfit: 20.0,
    profitMargin: 44.4,
    averageTicket: 45.0,
    firstOrderDate: '2026-07-01T15:00:00Z',
    lastOrderDate: '2026-07-01T15:00:00Z',
    daysSinceLastOrder: 78,
    churnRisk: 'em_risco',
    preferredOrderType: 'retirada',
    preferredChannel: 'ifood',
    offPeakOrdersCount: 1,
    peakOrdersCount: 0,
    offPeakRatio: 1.0,
    isOffPeakHero: true,
    preferredHourStr: '15h - 16h',
    preferredDayOfWeekStr: 'Quarta-feira',
    topProducts: [],
    lastOrderSummary: '1x Burger Clássico',
    frequentNotes: [],
    badges: ['horario_vazio', 'risco_churn'],
    orders: [],
  },
];

test('formatPhone formata números de 10 e 11 dígitos com DDD', () => {
  assert.equal(formatPhone('34999991111'), '(34) 99999-1111');
  assert.equal(formatPhone('1133334444'), '(11) 3333-4444');
  assert.equal(formatPhone(''), '');
  assert.equal(formatPhone('123'), '123');
});

test('filterAndSortCustomers busca com tolerância a acentos e partes do telefone', () => {
  // Busca 'joao' encontra 'João da Silva'
  const byName = filterAndSortCustomers(mockProfiles, 'joao');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, 'c1');

  // Busca por dígitos do telefone
  const byPhone = filterAndSortCustomers(mockProfiles, '8888');
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].id, 'c2');

  // Busca por rua do endereço
  const byAddr = filterAndSortCustomers(mockProfiles, 'acacias');
  assert.equal(byAddr.length, 1);
  assert.equal(byAddr[0].id, 'c1');
});

test('filterAndSortCustomers segmenta por lucrativos, ociosos e risco', () => {
  // Lucrativos: apenas João
  const vips = filterAndSortCustomers(mockProfiles, '', 'lucrativos');
  assert.equal(vips.length, 1);
  assert.equal(vips[0].id, 'c1');

  // Ociosos: Ana (isOffPeakHero = true)
  const ociosos = filterAndSortCustomers(mockProfiles, '', 'ociosos');
  assert.equal(ociosos.some(p => p.id === 'c2'), true);

  // Risco de churn: Ana
  const risco = filterAndSortCustomers(mockProfiles, '', 'risco');
  assert.equal(risco.length, 1);
  assert.equal(risco[0].id, 'c2');
});

test('filterAndSortCustomers ordena por lucro, margem, receita e recencia', () => {
  const sortedProfit = filterAndSortCustomers(mockProfiles, '', 'todos', 'todos', 'lucro_desc');
  assert.equal(sortedProfit[0].id, 'c1');

  const sortedRecency = filterAndSortCustomers(mockProfiles, '', 'todos', 'todos', 'recencia_desc');
  assert.equal(sortedRecency[0].id, 'c1'); // 2 dias atrás antes de 78 dias atrás
});
