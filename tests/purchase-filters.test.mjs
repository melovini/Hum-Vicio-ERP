import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  filterPurchaseItems,
  calculatePurchaseTotals,
  isItemUrgent,
  isItemPredictive,
} = createLoader()('src/lib/purchase-filters.ts');

const mockItems = [
  {
    id: 'item-1',
    name: 'Queijo Cheddar Fatiado',
    category: 'Queijos',
    unit: 'kg',
    costPerUnit: 40.0,
    currentStock: 1.5,
    minStock: 5.0,
    status: 'acabando',
    isActive: true,
  },
  {
    id: 'item-2',
    name: 'Pão de Brioche',
    category: 'Pães',
    unit: 'un',
    costPerUnit: 1.8,
    currentStock: 10,
    minStock: 5,
    status: 'ok',
    isActive: true,
  },
  {
    id: 'item-3',
    name: 'Bacon Especial',
    category: 'Carnes',
    unit: 'kg',
    costPerUnit: 32.0,
    currentStock: 0,
    minStock: 8.0,
    status: 'zerado',
    isActive: true,
  },
  {
    id: 'item-4',
    name: 'Insumo Antigo Desativado',
    category: 'Diversos',
    unit: 'un',
    costPerUnit: 10.0,
    currentStock: 0,
    minStock: 5.0,
    status: 'zerado',
    isActive: false,
  },
  {
    id: 'item-5',
    name: 'Molho Especial',
    category: 'Molhos',
    unit: 'L',
    costPerUnit: 25.0,
    currentStock: 50,
    minStock: 10,
    status: 'ok',
    isActive: true,
  },
];

test('isItemUrgent identifica status não-ok ou estoque abaixo do mínimo', () => {
  assert.equal(isItemUrgent(mockItems[0]), true); // acabando e estoque < minStock
  assert.equal(isItemUrgent(mockItems[1]), false); // ok e estoque > minStock
  assert.equal(isItemUrgent(mockItems[2]), true); // zerado
  assert.equal(isItemUrgent(mockItems[3]), false); // inativo
});

test('isItemPredictive identifica risco de ruptura baseado em ritmo de vendas', () => {
  // Pão de brioche: status ok, estoque 10 (< 15). Com 10 vendas (10 * 0.5 = 5 > 2):
  assert.equal(isItemPredictive(mockItems[1], 10), true);
  // Com 1 venda (0.5 não é > 2):
  assert.equal(isItemPredictive(mockItems[1], 1), false);
  // Molho especial tem estoque 50 (>= 15), não deve ser preditivo:
  assert.equal(isItemPredictive(mockItems[4], 100), false);
});

test('calculatePurchaseTotals calcula custo total, novo saldo e variacao percentual', () => {
  // Compra de 10 kg a R$ 44 (custo anterior: R$ 40, estoque atual: 1.5 kg)
  const result = calculatePurchaseTotals(10, 44, 40, 1.5);
  assert.equal(result.totalCost, 440);
  assert.equal(result.newStock, 11.5);
  assert.equal(result.costDiffPercentage, 10); // +10%

  // Redução de custo: R$ 36 (custo anterior R$ 40)
  const cheaper = calculatePurchaseTotals(5, 36, 40, 2);
  assert.equal(cheaper.totalCost, 180);
  assert.equal(cheaper.newStock, 7);
  assert.equal(cheaper.costDiffPercentage, -10); // -10%

  // Custo anterior zero
  const zeroPrev = calculatePurchaseTotals(2, 15, 0, 0);
  assert.equal(zeroPrev.totalCost, 30);
  assert.equal(zeroPrev.newStock, 2);
  assert.equal(zeroPrev.costDiffPercentage, 0);
});

test('filterPurchaseItems filtra por texto, modo e categoria ocultando inativos', () => {
  // Sem filtros: todos os 4 ativos
  const all = filterPurchaseItems(mockItems, '', 'all', '');
  assert.equal(all.length, 4);
  assert.equal(all.some(i => i.id === 'item-4'), false);

  // Filtro urgente: apenas Queijo Cheddar e Bacon
  const urgent = filterPurchaseItems(mockItems, '', 'urgent', '');
  assert.equal(urgent.length, 2);
  assert.deepEqual(urgent.map(i => i.id), ['item-1', 'item-3']);

  // Filtro preditivo com 10 vendas: apenas Pão de Brioche
  const pred = filterPurchaseItems(mockItems, '', 'predictive', '', 10);
  assert.equal(pred.length, 1);
  assert.equal(pred[0].id, 'item-2');

  // Busca textual tolerante a acentos
  const searchQueijo = filterPurchaseItems(mockItems, 'queijo', 'all', '');
  assert.equal(searchQueijo.length, 1);
  assert.equal(searchQueijo[0].id, 'item-1');

  // Busca por 'pao' encontra 'Pão de Brioche'
  const searchPao = filterPurchaseItems(mockItems, 'pao', 'all', '');
  assert.equal(searchPao.length, 1);
  assert.equal(searchPao[0].id, 'item-2');
});
