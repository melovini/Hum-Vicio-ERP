import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  calculateItemProduction,
  inferComponentType,
  inferStationForComponent,
  resolveRecipeUnitQuantity,
  parseAdditionalString,
  extractMeatPoint,
} = createLoader()('src/lib/production-calculator.ts');

// Insumos mockados representando o inventário real
const mockInventory = [
  { id: 'inv-blend-kg', name: 'Carne Bovina (Blend)', category: 'Carnes', unit: 'kg', station: 'chapa' },
  { id: 'inv-patty-180', name: 'Hambúrguer Bovino 180g', category: 'Carnes', unit: 'un', station: 'chapa' },
  { id: 'inv-patty-150', name: 'Hambúrguer Bovino 150g', category: 'Carnes', unit: 'un', station: 'chapa' },
  { id: 'inv-costela-180', name: 'Hambúrguer Recheado Costela 180g', category: 'Carnes', unit: 'un', station: 'chapa' },
  { id: 'inv-linguica-150', name: 'Hambúrguer de Linguiça 150g', category: 'Carnes', unit: 'un', station: 'chapa' },
  { id: 'inv-frango', name: 'Hamb. Frango Empanado c/ Cream Cheese 150g', category: 'Carnes', unit: 'un', station: 'fritadeira_frango' },
  { id: 'inv-queijo-emp', name: 'Hamb. Queijo Minas Empanado 120g', category: 'Laticínios', unit: 'un', station: 'fritadeira_queijo' },
  { id: 'inv-ovo', name: 'Ovo Frito na Manteiga', category: 'Laticínios', unit: 'un', station: 'chapa' },
  { id: 'inv-bacon', name: 'Bacon Fatiado Crocante', category: 'Carnes', unit: 'kg', station: 'chapa' },
  { id: 'inv-pao', name: 'Pão Brioche', category: 'Padaria', unit: 'un', station: 'nenhuma' },
  { id: 'inv-cheddar', name: 'Queijo Cheddar Fatiado', category: 'Laticínios', unit: 'kg', station: 'nenhuma' },
  { id: 'inv-batata', name: 'Batata Palito Congelada', category: 'Porções', unit: 'kg', station: 'fritadeira_batata' },
  { id: 'inv-onion', name: 'Anéis de Cebola Congelados', category: 'Porções', unit: 'kg', station: 'fritadeira_onion' },
  { id: 'inv-gas', name: 'Gás / Energia (por burger)', category: 'Diversos', unit: 'un', station: 'nenhuma' },
  { id: 'inv-papel', name: 'Embalagem / Papel', category: 'Embalagens', unit: 'un', station: 'nenhuma' },
];

// Produtos mockados
const mockProducts = [
  {
    id: 'prod-brasil',
    name: 'Brasil',
    category: 'lanche',
    priceBalcao: 35,
    priceIfood: 42,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 1 },
      { ingredientId: 'inv-cheddar', quantity: 0.03 },
      { ingredientId: 'inv-bacon', quantity: 0.025 },
      { ingredientId: 'inv-gas', quantity: 1 },
    ],
  },
  {
    id: 'prod-brasil-duplo',
    name: 'Brasil Duplo',
    category: 'lanche',
    priceBalcao: 46,
    priceIfood: 54,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 2 },
      { ingredientId: 'inv-cheddar', quantity: 0.06 },
      { ingredientId: 'inv-bacon', quantity: 0.025 },
      { ingredientId: 'inv-gas', quantity: 1 },
    ],
  },
  {
    id: 'prod-blend-kg',
    name: 'Burger Blend Granel',
    category: 'lanche',
    priceBalcao: 38,
    priceIfood: 45,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-blend-kg', quantity: 0.180 }, // 0.180 kg = 1 disco
      { ingredientId: 'inv-cheddar', quantity: 0.03 },
    ],
  },
  {
    id: 'prod-egg-burger',
    name: 'X-Egg Especial',
    category: 'lanche',
    priceBalcao: 40,
    priceIfood: 48,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 1 },
      { ingredientId: 'inv-ovo', quantity: 1 }, // Ovo preparado na chapa
      { ingredientId: 'inv-bacon', quantity: 0.025 },
    ],
  },
  {
    id: 'prod-nome-duplo-rec-simples',
    name: 'Super Duplo Fake',
    category: 'lanche',
    priceBalcao: 36,
    priceIfood: 42,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 1 }, // Apenas 1 carne na receita!
    ],
  },
  {
    id: 'prod-kids',
    name: 'Kids',
    category: 'lanche',
    priceBalcao: 25,
    priceIfood: 30,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-150', quantity: 1 }, // 150g
    ],
  },
  {
    id: 'prod-argentina-emp',
    name: 'Argentina Empanado',
    category: 'lanche',
    priceBalcao: 48,
    priceIfood: 56,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-costela-180', quantity: 1 },
      { ingredientId: 'inv-queijo-emp', quantity: 1 },
    ],
  },
  {
    id: 'prod-eua',
    name: 'Estados Unidos',
    category: 'lanche',
    priceBalcao: 36,
    priceIfood: 42,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-frango', quantity: 1 },
    ],
  },
  {
    id: 'prod-combo-batata',
    name: 'Combo: Burger com Batata',
    category: 'combo',
    priceBalcao: 50,
    priceIfood: 60,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 1 },
      { ingredientId: 'inv-batata', quantity: 0.15 },
    ],
  },
];

// =========================================================================
// TESTES DA MATRIZ OPERACIONAL (Seção 10 do documento de análise)
// =========================================================================

test('Caso 1: 1 lanche com 1 carne bovina -> exatamente 1 carne na chapa', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil',
    quantity: 1,
    unitPrice: 35,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 1);
  assert.equal(res.isDouble, false);
  assert.equal(res.eggsCount, 0);
  assert.equal(res.breakdown.basePattiesPerBurger, 1);
  assert.equal(res.breakdown.totalPattiesAllBurgers, 1);
});

test('Caso 2: 2 lanches simples iguais -> 2 carnes totais, sem classificar cada lanche como duplo', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil',
    quantity: 2,
    unitPrice: 35,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 2);
  // CRÍTICO: Cada lanche é simples (1 carne por lanche), portanto isDouble é FALSE!
  assert.equal(res.isDouble, false);
  assert.equal(res.breakdown.basePattiesPerBurger, 1);
  assert.equal(res.breakdown.totalPattiesPerBurger, 1);
  assert.equal(res.breakdown.totalPattiesAllBurgers, 2);
});

test('Caso 3: 1 lanche com 2 carnes cadastradas -> 2 carnes, independente do nome', () => {
  const item = {
    productId: 'prod-brasil-duplo',
    productName: 'Brasil Duplo',
    quantity: 1,
    unitPrice: 46,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 2);
  assert.equal(res.isDouble, true);
  assert.equal(res.breakdown.basePattiesPerBurger, 2);
});

test('Caso 4: 1 carne + 1 ovo, ambos na chapa -> 1 carne e 1 ovo separados (NUNCA 2 carnes)', () => {
  const item = {
    productId: 'prod-egg-burger',
    productName: 'X-Egg Especial',
    quantity: 1,
    unitPrice: 40,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  // CRÍTICO: O ovo NÃO PODE ser somado a chapaPatties!
  assert.equal(res.chapaPatties, 1, 'Deve ter exatamente 1 carne bovina na chapa');
  assert.equal(res.eggsCount, 1, 'Ovo deve ser contabilizado no contador de ovos separado');
  assert.equal(res.isDouble, false, 'Não é um lanche duplo');
});

test('Caso 5: 0,180 kg de blend com porção de 180g -> 1 carne e 0,180 kg de consumo', () => {
  const item = {
    productId: 'prod-blend-kg',
    productName: 'Burger Blend Granel',
    quantity: 1,
    unitPrice: 38,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 1, '0.180 kg deve ser convertido para 1 unidade de disco');
  assert.equal(res.isDouble, false);
});

test('Caso 6: Nome duplo com receita simples -> receita manda (1 carne), não adivinha pelo nome', () => {
  const item = {
    productId: 'prod-nome-duplo-rec-simples',
    productName: 'Super Duplo Fake',
    quantity: 1,
    unitPrice: 36,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  // CRÍTICO: A receita possui apenas 1 carne, logo o KDS orienta 1 carne, e não 2!
  assert.equal(res.chapaPatties, 1);
  assert.equal(res.isDouble, false);
});

test('Caso 7: 1 simples + 2 carnes extras -> 3 carnes e registro de 2 adicionais', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil',
    quantity: 1,
    unitPrice: 35,
    additionals: [
      { name: '2x Hambúrguer 160g Extra', price: 20 }
    ],
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 3, '1 base + 2 extras = 3 carnes');
  assert.equal(res.isDouble, true, 'Com 3 carnes na composição, torna-se duplo/triplo');
  assert.equal(res.breakdown.basePattiesPerBurger, 1);
  assert.equal(res.breakdown.additionalPattiesPerBurger, 2);
  assert.equal(res.breakdown.totalPattiesPerBurger, 3);
});

test('Caso 8: 2 lanches com 2 extras por lanche -> 6 carnes no total', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil',
    quantity: 2,
    unitPrice: 35,
    additionals: [
      { name: '2x Hambúrguer 160g Extra', price: 20 }
    ],
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  // (1 base + 2 extras) * 2 lanches = 6 carnes
  assert.equal(res.chapaPatties, 6);
  assert.equal(res.breakdown.totalPattiesPerBurger, 3);
  assert.equal(res.breakdown.totalPattiesAllBurgers, 6);
});

test('Caso 9: Adicional no texto legado e no campo estruturado -> não duplicar', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil + [Hambúrguer 160g Extra]', // Legado no título
    quantity: 1,
    unitPrice: 45,
    additionals: [
      { name: 'Hambúrguer 160g Extra', price: 10 } // Estruturado
    ],
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  // Não pode somar 1 base + 1 do título + 1 do estruturado (= 3). Deve deduplicar para 2!
  assert.equal(res.chapaPatties, 2);
  assert.equal(res.breakdown.additionalPattiesPerBurger, 1);
});

test('Caso 10: Adicional legado 2x Hambúrguer no título -> interpreta as 2 unidades', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil + [2x Hambúrguer 160g Extra]',
    quantity: 1,
    unitPrice: 55,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 3, '1 base + 2x do título = 3 carnes');
  assert.equal(res.breakdown.additionalPattiesPerBurger, 2);
});

test('Caso 11: Combo com 1 batata -> 1 porção, sem duplicar por receita e nome', () => {
  const item = {
    productId: 'prod-combo-batata',
    productName: 'Combo: Burger com Batata',
    combo: 'Combo Batata + Bebida',
    quantity: 1,
    unitPrice: 50,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 1);
  // O combo já contém a batata, não deve somar 2 batatas na fritadeira
  assert.equal(res.fryerBatatasCombo + res.fryerBatatasAvulsa, 1);
});

test('Caso 12: Argentina Empanado -> 1 carne bovina na chapa + 1 queijo empanado na fritadeira', () => {
  const item = {
    productId: 'prod-argentina-emp',
    productName: 'Argentina Empanado',
    quantity: 1,
    unitPrice: 48,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 1, '1 carne bovina de costela na chapa');
  assert.equal(res.fryerCheese, 1, '1 queijo minas empanado na fritadeira');
  assert.equal(res.fryerChicken, 0);
});

test('Caso 13: Estados Unidos / Frango Empanado -> 1 frango na fritadeira de frango', () => {
  const item = {
    productId: 'prod-eua',
    productName: 'Estados Unidos',
    quantity: 1,
    unitPrice: 36,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 0, 'Frango empanado não vai para a chapa');
  assert.equal(res.fryerChicken, 1, '1 frango na fritadeira de frango');
});

test('Caso 14: Lanche Kids (150g) -> 1 carne bovina na chapa', () => {
  const item = {
    productId: 'prod-kids',
    productName: 'Kids',
    quantity: 1,
    unitPrice: 25,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 1);
  assert.equal(res.isDouble, false);
});

test('Caso 15: Ponto da carne -> identificado com exatidão', () => {
  assert.equal(extractMeatPoint('Brasil *Obs: AO PONTO*'), 'Ao Ponto');
  assert.equal(extractMeatPoint('Brasil *Obs: BEM PASSADO*'), 'Bem Passado');
  assert.equal(extractMeatPoint('Brasil *Obs: MAL PASSADO*'), 'Mal Passado');
  assert.equal(extractMeatPoint('Brasil *Obs: AO PONTO P/ BEM*'), 'Ao Ponto +');
  assert.equal(extractMeatPoint('Brasil *Obs: AO PONTO P/ MENOS*'), 'Ao Ponto -');
});

test('Caso 16: Retiradas de carne (SEM CARNE) -> dedução sem valores negativos', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil',
    notes: 'SEM CARNE',
    quantity: 1,
    unitPrice: 35,
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 0);
  assert.equal(res.isDouble, false);
});

test('Caso 17: Determinismo e isolamento -> idêntico resultado em qualquer terminal', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil',
    quantity: 3,
    unitPrice: 35,
    additionals: [{ name: 'Ovo Frito na Manteiga', price: 4 }],
  };

  const run1 = calculateItemProduction(item, mockProducts, mockInventory);
  const run2 = calculateItemProduction(item, mockProducts, mockInventory);

  assert.deepEqual(run1, run2);
  assert.equal(run1.chapaPatties, 3);
  assert.equal(run1.eggsCount, 3);
});

test('Caso 18: Diagnóstico e breakdown expõe rastreabilidade completa', () => {
  const item = {
    productId: 'prod-brasil',
    productName: 'Brasil',
    quantity: 2,
    unitPrice: 35,
    additionals: [
      { name: 'Hambúrguer 160g Extra', price: 10 },
      { name: 'Ovo Frito na Manteiga', price: 4 }
    ],
    notes: 'AO PONTO',
  };
  const res = calculateItemProduction(item, mockProducts, mockInventory);

  assert.ok(res.breakdown);
  assert.equal(res.breakdown.basePattiesPerBurger, 1);
  assert.equal(res.breakdown.additionalPattiesPerBurger, 1);
  assert.equal(res.breakdown.totalPattiesPerBurger, 2);
  assert.equal(res.breakdown.totalPattiesAllBurgers, 4);
  assert.equal(res.breakdown.eggsPerBurger, 1);
  assert.equal(res.breakdown.totalEggsAllBurgers, 2);
  assert.equal(res.meatPoint, 'Ao Ponto');
});
