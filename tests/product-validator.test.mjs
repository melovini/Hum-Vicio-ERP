import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { validateProductIntegrity } = createLoader()('src/lib/product-validator.ts');
const { findMatchingInventoryItem } = createLoader()('src/lib/recipe-helpers.ts');

// Insumos mockados representando o inventário real
const mockInventory = [
  { id: 'inv-pao', name: 'Pão Brioche', category: 'Padaria', unit: 'un', costPerUnit: 2.5, station: 'nenhuma' },
  { id: 'inv-patty-180', name: 'Hambúrguer Bovino 180g', category: 'Carnes', unit: 'un', costPerUnit: 8.5, station: 'chapa' },
  { id: 'inv-frango', name: 'Hamb. Frango Empanado 150g', category: 'Carnes', unit: 'un', costPerUnit: 7.5, station: 'fritadeira_frango' },
  { id: 'inv-queijo-emp', name: 'Hamb. Queijo Minas Empanado 120g', category: 'Laticínios', unit: 'un', costPerUnit: 8.0, station: 'fritadeira_queijo' },
  { id: 'inv-ovo', name: 'Ovo Frito na Manteiga', category: 'Laticínios', unit: 'un', costPerUnit: 1.2, station: 'chapa' },
  { id: 'inv-bacon', name: 'Bacon Fatiado Crocante', category: 'Carnes', unit: 'kg', costPerUnit: 48.0, station: 'chapa' },
  { id: 'inv-cheddar', name: 'Queijo Cheddar Fatiado', category: 'Laticínios', unit: 'kg', costPerUnit: 45.0, station: 'nenhuma' },
  { id: 'inv-batata', name: 'Batata Palito Congelada', category: 'Porções', unit: 'kg', costPerUnit: 12.0, station: 'fritadeira_batata' },
  { id: 'inv-onion', name: 'Anéis de Cebola Congelados', category: 'Porções', unit: 'kg', costPerUnit: 22.0, station: 'fritadeira_onion' },
  { id: 'inv-alface', name: 'Alface Americana', category: 'Hortifruti', unit: 'kg', costPerUnit: 9.0, station: 'nenhuma' },
  { id: 'inv-custo-zero', name: 'Molho Novo Sem Custo', category: 'Molhos', unit: 'kg', costPerUnit: 0.0, station: 'nenhuma' },
];

// =========================================================================
// TESTES DO VALIDADOR DE PRODUTOS E INTEGRIDADE DO CARDÁPIO (Etapa 2)
// =========================================================================

test('Validador: Rejeita produto sem nome ou com preço balcão zerado', () => {
  const res1 = validateProductIntegrity({ name: '', priceBalcao: 30 }, mockInventory);
  assert.equal(res1.isValid, false);
  assert.ok(res1.warnings.some(w => w.code === 'MISSING_NAME' && w.severity === 'danger'));

  const res2 = validateProductIntegrity({ name: 'Burger Teste', priceBalcao: 0 }, mockInventory);
  assert.equal(res2.isValid, false);
  assert.ok(res2.warnings.some(w => w.code === 'INVALID_PRICE_BALCAO' && w.severity === 'danger'));
});

test('Validador: Sinaliza lanche sem ficha técnica como rascunho', () => {
  const res = validateProductIntegrity({
    name: 'Burger Novo em Criação',
    category: 'lanche',
    priceBalcao: 35,
    priceIfood: 42,
    recipe: []
  }, mockInventory);

  assert.equal(res.status, 'rascunho');
  assert.ok(res.warnings.some(w => w.code === 'EMPTY_RECIPE_HOT'));
});

test('Validador: Detecta discrepância entre nome "Duplo" e receita com apenas 1 carne', () => {
  const res = validateProductIntegrity({
    name: 'Super Duplo Artesanal',
    category: 'lanche',
    priceBalcao: 45,
    priceIfood: 54,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 1 } // Apenas 1 carne!
    ]
  }, mockInventory);

  assert.equal(res.status, 'alerta');
  assert.equal(res.productionPreview.chapaPatties, 1);
  assert.equal(res.productionPreview.isDouble, false);
  assert.ok(res.warnings.some(w => w.code === 'NAME_DUPLO_MISMATCH' && w.severity === 'warning'));
});

test('Validador: Reconhece lanche duplo coerente (2 carnes e nome duplo)', () => {
  const res = validateProductIntegrity({
    name: 'Brasil Duplo',
    category: 'lanche',
    priceBalcao: 48,
    priceIfood: 58,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 2 }
    ]
  }, mockInventory);

  assert.equal(res.isValid, true);
  assert.equal(res.status, 'validado');
  assert.equal(res.productionPreview.chapaPatties, 2);
  assert.equal(res.productionPreview.isDouble, true);
  assert.equal(res.warnings.some(w => w.code === 'NAME_DUPLO_MISMATCH'), false);
});

test('Validador: Detecta ausência de proteína principal em lanche', () => {
  const res = validateProductIntegrity({
    name: 'Sanduíche Só Salada',
    category: 'lanche',
    priceBalcao: 20,
    priceIfood: 25,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-alface', quantity: 0.03 }
    ]
  }, mockInventory);

  assert.ok(res.warnings.some(w => w.code === 'NO_PROTEIN_IDENTIFIED' && w.severity === 'warning'));
});

test('Validador: Identifica e isola ovo na chapa informando o operador', () => {
  const res = validateProductIntegrity({
    name: 'Egg Burger',
    category: 'lanche',
    priceBalcao: 40,
    priceIfood: 48,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 1 },
      { ingredientId: 'inv-ovo', quantity: 1 }
    ]
  }, mockInventory);

  assert.equal(res.productionPreview.chapaPatties, 1, 'Exatamente 1 carne bovina');
  assert.equal(res.productionPreview.eggsCount, 1, 'Exatamente 1 ovo na chapa');
  assert.ok(res.warnings.some(w => w.code === 'EGG_ON_CHAPA_SEPARATED' && w.severity === 'info'));
});

test('Validador: Detecta anomalia de peso unitário em KG (ex: 180 kg em vez de 0.180 kg)', () => {
  const res = validateProductIntegrity({
    name: 'Burger Erro de Digitação',
    category: 'lanche',
    priceBalcao: 35,
    priceIfood: 42,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-bacon', quantity: 180 } // 180 KG de bacon!
    ]
  }, mockInventory);

  assert.equal(res.isValid, false);
  assert.ok(res.warnings.some(w => w.code === 'UNIT_WEIGHT_ANOMALY' && w.severity === 'danger'));
});

test('Validador: Sinaliza insumos com custo R$ 0,00 que distorcem o CMV', () => {
  const res = validateProductIntegrity({
    name: 'Burger c/ Molho Novo',
    category: 'lanche',
    priceBalcao: 38,
    priceIfood: 45,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 1 },
      { ingredientId: 'inv-custo-zero', quantity: 0.03 }
    ]
  }, mockInventory);

  assert.ok(res.warnings.some(w => w.code === 'ZERO_COST_INGREDIENT' && w.severity === 'warning'));
  assert.equal(res.recipeMetrics.hasZeroCostIngredient, true);
});

test('Validador: Sugestão de insumo com confirmação transparente', () => {
  // Testa que findMatchingInventoryItem sugere com base no nome
  const match = findMatchingInventoryItem('Batata Frita Porção', undefined, mockInventory);
  assert.ok(match);
  assert.equal(match.id, 'inv-batata');

  // Sugestão para anéis de cebola
  const matchOnion = findMatchingInventoryItem('Anéis de Cebola Adicional', undefined, mockInventory);
  assert.ok(matchOnion);
  assert.equal(matchOnion.id, 'inv-onion');
});
