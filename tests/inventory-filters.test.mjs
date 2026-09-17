import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { filterInventoryItems } = createLoader()('src/lib/inventory-filters.ts');

const items = [
  { id: '1', name: 'Pão Brioche', category: 'Padaria', unit: 'un', costPerUnit: 1.5, currentStock: 100, minStock: 20, isActive: true, station: 'chapa' },
  { id: '2', name: 'Carne Bovina 150g', category: 'Carnes', unit: 'un', costPerUnit: 4.5, currentStock: 15, minStock: 30, isActive: true, station: 'chapa' },
  { id: '3', name: 'Frango Empanado', category: 'Carnes', unit: 'un', costPerUnit: 3.8, currentStock: 5, minStock: 10, isActive: true, station: 'fritadeira_frango' },
  { id: '4', name: 'Óleo Vegetal', category: 'Geral', unit: 'L', costPerUnit: 8.0, currentStock: 50, minStock: 10, isActive: false, station: 'nenhuma' },
];

test('busca de insumos ignora acentos, caixa e espaços nas extremidades', () => {
  const result = filterInventoryItems(items, '  PAO  ', '', false, false);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');

  const resultCarne = filterInventoryItems(items, 'bovina', '', false, false);
  assert.equal(resultCarne.length, 1);
  assert.equal(resultCarne[0].id, '2');
});

test('filtra por categoria de insumos', () => {
  const carnes = filterInventoryItems(items, '', 'Carnes', false, false);
  assert.equal(carnes.length, 2);
  assert.equal(carnes.map(c => c.id).sort().join(','), '2,3');
});

test('filtra por ponto de reposição (estoque baixo ou crítico)', () => {
  const lowStock = filterInventoryItems(items, '', '', true, false);
  // Carne Bovina (15 <= 30) e Frango (5 <= 10)
  assert.equal(lowStock.length, 2);
  assert.equal(lowStock.map(c => c.id).sort().join(','), '2,3');
});

test('oculta itens inativos por padrão e os exibe quando solicitado', () => {
  const activeOnly = filterInventoryItems(items, '', '', false, false);
  assert.equal(activeOnly.length, 3);
  assert.equal(activeOnly.some(i => i.id === '4'), false);

  const withInactive = filterInventoryItems(items, '', '', false, true);
  assert.equal(withInactive.length, 4);
  assert.equal(withInactive.some(i => i.id === '4'), true);
});
