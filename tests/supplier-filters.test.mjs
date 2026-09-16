import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { filterSuppliers } = createLoader()('src/lib/supplier-filters.ts');
const items = [
  { id: '1', name: 'Açougue São José', category: 'Carnes', contactName: 'André' },
  { id: '2', name: 'Pães do Bairro', category: 'Padaria', contactName: 'Ana' },
];
test('busca ignora acentos, caixa e espaços nas extremidades', () => {
  assert.equal(filterSuppliers(items, '  ACOUGUE  ', '')[0].id, '1');
  assert.equal(filterSuppliers(items, 'andre', '')[0].id, '1');
  assert.equal(filterSuppliers(items, 'padaria', '')[0].id, '2');
});
test('categoria e busca são combinadas sem alterar os dados originais', () => {
  assert.equal(filterSuppliers(items, 'ana', 'Carnes').length, 0);
  assert.equal(filterSuppliers(items, '', 'Padaria')[0].id, '2');
  assert.equal(filterSuppliers(items, '', '').length, 2);
  assert.equal(items[0].name, 'Açougue São José');
  assert.equal(filterSuppliers([], '', '').length, 0);
});
