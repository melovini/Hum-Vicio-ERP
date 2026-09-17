import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  calculateAuditAnalysis,
  filterAuditItems,
} = createLoader()('src/lib/inventory-audit-helpers.ts');

const sampleItems = [
  {
    id: 'item-1',
    name: 'Pão de Hambúrguer',
    category: 'Padaria',
    unit: 'un',
    costPerUnit: 1.5,
    currentStock: 100,
    isActive: true,
  },
  {
    id: 'item-2',
    name: 'Carne Bovina Moída',
    category: 'Carnes',
    unit: 'kg',
    costPerUnit: 30.0,
    currentStock: 20,
    isActive: true,
  },
  {
    id: 'item-3',
    name: 'Queijo Cheddar',
    category: 'Laticínios',
    unit: 'kg',
    costPerUnit: 40.0,
    currentStock: 5,
    isActive: true,
  },
  {
    id: 'item-4',
    name: 'Insumo Inativo Antigo',
    category: 'Geral',
    unit: 'un',
    costPerUnit: 10.0,
    currentStock: 0,
    isActive: false,
  },
];

test('calculateAuditAnalysis calcula progresso, faltas, sobras e divergências com precisão', () => {
  // Pão: contado 90 (falta de 10 un = -R$ 15,00)
  // Carne: contada 22 (sobra de 2 kg = +R$ 60,00)
  // Queijo: ainda não contado
  // Insumo inativo: ignorado da contagem ativa
  const counts = {
    'item-1': '90',
    'item-2': '22',
  };

  const analysis = calculateAuditAnalysis(sampleItems, counts);

  assert.equal(analysis.totalActiveCount, 3);
  assert.equal(analysis.countedItemsCount, 2);
  assert.equal(analysis.progressPercentage, 67); // 2 de 3 = ~67%
  assert.equal(analysis.divergentCount, 2);
  assert.equal(analysis.matchingCount, 0);

  assert.equal(analysis.totalMissingCost, 15.0);
  assert.equal(analysis.totalSurplusCost, 60.0);
  assert.equal(analysis.netVarianceCost, 45.0); // 60 - 15 = 45

  // Testa item que bate exatamente (matching)
  const countsWithMatch = {
    'item-1': '100', // 100 == 100 (diff 0)
    'item-2': '20',  // 20 == 20 (diff 0)
  };
  const analysisMatch = calculateAuditAnalysis(sampleItems, countsWithMatch);
  assert.equal(analysisMatch.divergentCount, 0);
  assert.equal(analysisMatch.matchingCount, 2);
  assert.equal(analysisMatch.netVarianceCost, 0);
});

test('filterAuditItems filtra por pendentes, divergentes, exatos e busca textual', () => {
  const counts = {
    'item-1': '90', // divergente (falta)
    'item-2': '20', // matching (sem desvio)
    // item-3 está pendente
  };

  const analysis = calculateAuditAnalysis(sampleItems, counts);

  // Modo 'all': todos os 3 ativos
  const all = filterAuditItems(analysis.auditedList, '', 'all', '');
  assert.equal(all.length, 3);

  // Modo 'pending': apenas item-3
  const pending = filterAuditItems(analysis.auditedList, '', 'pending', '');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, 'item-3');

  // Modo 'divergent': apenas item-1
  const divergent = filterAuditItems(analysis.auditedList, '', 'divergent', '');
  assert.equal(divergent.length, 1);
  assert.equal(divergent[0].id, 'item-1');

  // Modo 'matching': apenas item-2
  const matching = filterAuditItems(analysis.auditedList, '', 'matching', '');
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'item-2');

  // Busca textual ignorando acentos
  const searchPao = filterAuditItems(analysis.auditedList, 'pao', 'all', '');
  assert.equal(searchPao.length, 1);
  assert.equal(searchPao[0].id, 'item-1');
});
