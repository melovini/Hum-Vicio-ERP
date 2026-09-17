import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  filterPricingProducts,
  applyPercentMarkup,
  calculateChannelComparison,
  calculatePricingSummaryMetrics,
} = createLoader()('src/lib/pricing-helpers.ts');

const mockProducts = [
  {
    id: 'p1',
    name: 'Burger Simples',
    category: 'lanche',
    priceBalcao: 30.0,
    priceIfood: 38.0,
    isActive: true,
  },
  {
    id: 'p2',
    name: 'Burger Duplo Cheddar',
    category: 'lanche',
    priceBalcao: 45.0,
    priceIfood: 56.0,
    isActive: true,
  },
  {
    id: 'p3',
    name: 'Combo Especial com Fritas',
    category: 'combo',
    priceBalcao: 55.0,
    priceIfood: 69.0,
    isActive: true,
  },
  {
    id: 'p4',
    name: 'Adicional: Queijo Extra',
    category: 'porcao',
    priceBalcao: 5.0,
    priceIfood: 7.0,
    isActive: true,
  },
];

test('filterPricingProducts ignora adicionais internos e filtra por categoria e busca', () => {
  // Ignora Adicional: Queijo Extra
  const todos = filterPricingProducts(mockProducts);
  assert.equal(todos.length, 3);
  assert.ok(!todos.some((p) => p.name.startsWith('Adicional:')));

  // Categoria 'duplo' filtra apenas itens com 'duplo' no nome
  const duplos = filterPricingProducts(mockProducts, { category: 'duplo' });
  assert.equal(duplos.length, 1);
  assert.equal(duplos[0].id, 'p2');

  // Categoria 'lanche' exclui os que são duplos
  const lanches = filterPricingProducts(mockProducts, { category: 'lanche' });
  assert.equal(lanches.length, 1);
  assert.equal(lanches[0].id, 'p1');

  // Busca textual
  const busca = filterPricingProducts(mockProducts, { search: 'fritas' });
  assert.equal(busca.length, 1);
  assert.equal(busca[0].id, 'p3');
});

test('applyPercentMarkup calcula aumento com ou sem terminação .90', () => {
  // +25% sobre 30.0 = 37.5
  const markupNormal = applyPercentMarkup(30.0, 25);
  assert.equal(markupNormal, 37.5);

  // +27% sobre 30.0 = 38.1 -> round90 = 38.90
  const markupRound90 = applyPercentMarkup(30.0, 27, { round90: true });
  assert.equal(markupRound90, 38.9);
});

test('calculateChannelComparison compara lucro e margem entre Balcão e iFood', () => {
  const comp = calculateChannelComparison(
    30.0, // Balcão
    39.0, // iFood
    10.0, // CMV
    { ifoodCommissionPct: 23, paymentFeePct: 3.2, balcaoFeePct: 3.0 },
  );

  // Balcão: gross=30, fees=0.90, netRev=29.10, profit=19.10, margin=63.7%
  assert.equal(comp.balcao.gross, 30.0);
  assert.equal(comp.balcao.fees, 0.9);
  assert.equal(comp.balcao.netRev, 29.1);
  assert.equal(comp.balcao.profit, 19.1);
  assert.equal(comp.balcao.margin, 63.7);

  // iFood: 26.2% taxa total = 10.22 fees
  // netRev = 39 - 10.218 = 28.78
  // profit = 28.78 - 10 = 18.78
  assert.equal(comp.ifood.gross, 39.0);
  assert.equal(comp.ifood.fees, 10.22);
  assert.equal(comp.ifood.profit, 18.78);
});

test('calculatePricingSummaryMetrics gera médias e contagem de itens em margem crítica', () => {
  const getCmv = () => 12.0;
  const getIfoodPrice = (p) => p.priceIfood;

  const summary = calculatePricingSummaryMetrics(mockProducts, getCmv, getIfoodPrice);

  // 3 produtos ativos válidos (excluindo adicional)
  assert.equal(summary.totalCount, 3);
  assert.ok(summary.avgBalcao > 0);
  assert.ok(summary.avgIfood > 0);
  assert.ok(summary.avgMargin > 0);
});
