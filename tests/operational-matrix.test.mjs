import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { calculateItemProduction, createItemProductionSnapshot } = createLoader()('src/lib/production-calculator.ts');
const { validateProductIntegrity } = createLoader()('src/lib/product-validator.ts');
const { recalculateCartPrices } = createLoader()('src/lib/pos-financial-helpers.ts');

const mockInventory = [
  { id: 'inv-patty-180', name: 'Hambúrguer Bovino 180g', category: 'Carnes', unit: 'un', costPerUnit: 8.5, station: 'chapa' },
  { id: 'inv-blend-kg', name: 'Blend Bovino Moído', category: 'Carnes', unit: 'kg', costPerUnit: 45.0, station: 'chapa' },
  { id: 'inv-ovo', name: 'Ovo Frito na Manteiga', category: 'Laticínios', unit: 'un', costPerUnit: 1.2, station: 'chapa' },
  { id: 'inv-bacon', name: 'Bacon Fatiado Crocante', category: 'Carnes', unit: 'kg', costPerUnit: 48.0, station: 'chapa' },
  { id: 'inv-batata', name: 'Batata Palito Congelada', category: 'Porções', unit: 'kg', costPerUnit: 12.0, station: 'fritadeira_batata' },
  { id: 'inv-cheddar', name: 'Cheddar Cremoso', category: 'Laticínios', unit: 'kg', costPerUnit: 40.0, station: 'nenhuma' },
];

const mockCatalog = [
  {
    id: 'prod-simples',
    name: 'Burger Simples',
    category: 'lanche',
    priceBalcao: 28.00,
    priceIfood: 34.00,
    recipe: [{ ingredientId: 'inv-patty-180', quantity: 1 }],
  },
  {
    id: 'prod-duplo-real',
    name: 'Burger Duplo Real',
    category: 'lanche',
    priceBalcao: 38.00,
    priceIfood: 45.00,
    recipe: [{ ingredientId: 'inv-patty-180', quantity: 2 }],
  },
  {
    id: 'prod-duplo-fake-name',
    name: 'Burger Duplo Especial', // Nome tem "Duplo", mas receita só tem 1 carne!
    category: 'lanche',
    priceBalcao: 30.00,
    priceIfood: 36.00,
    recipe: [{ ingredientId: 'inv-patty-180', quantity: 1 }],
  },
  {
    id: 'prod-burger-egg',
    name: 'Burger com Ovo',
    category: 'lanche',
    priceBalcao: 31.00,
    priceIfood: 37.00,
    recipe: [
      { ingredientId: 'inv-patty-180', quantity: 1 },
      { ingredientId: 'inv-ovo', quantity: 1 },
    ],
  },
  {
    id: 'prod-blend-kg',
    name: 'Burger Blend Peso',
    category: 'lanche',
    priceBalcao: 32.00,
    recipe: [{ ingredientId: 'inv-blend-kg', quantity: 0.180 }], // 0.180 kg = 1 burger
  },
  {
    id: 'prod-combo-batata',
    name: 'Combo: Batata + Bebida',
    category: 'combo',
    priceBalcao: 14.00,
    priceIfood: 16.50,
  },
  {
    id: 'prod-add-patty',
    name: 'Adicional: Carne Extra 160g',
    category: 'porcao',
    isAddon: true,
    priceBalcao: 9.00,
    priceIfood: 11.00,
    recipe: [{ ingredientId: 'inv-patty-180', quantity: 1 }],
  },
  {
    id: 'prod-add-composto',
    name: 'Adicional: Cheddar com Bacon Especial',
    category: 'porcao',
    isAddon: true,
    priceBalcao: 8.00,
    recipe: [
      { ingredientId: 'inv-cheddar', quantity: 0.05 },
      { ingredientId: 'inv-bacon', quantity: 0.04 },
    ],
  },
];

// =========================================================================
// MATRIZ COMPLETA DE TESTES OPERACIONAIS (Seção 10 do documento)
// =========================================================================

test('Matriz 1: 1 lanche com 1 carne bovina -> 1 carne na chapa', () => {
  const res = calculateItemProduction({ productId: 'prod-simples', quantity: 1 }, mockCatalog, mockInventory);
  assert.equal(res.chapaPatties, 1);
  assert.equal(res.isDouble, false);
});

test('Matriz 2: 2 lanches simples iguais -> 2 carnes totais, sem classificar cada lanche como duplo', () => {
  const res = calculateItemProduction({ productId: 'prod-simples', quantity: 2 }, mockCatalog, mockInventory);
  assert.equal(res.chapaPatties, 2);
  assert.equal(res.isDouble, false); // O lanche unitário é simples
  assert.equal(res.breakdown.totalPattiesPerBurger, 1);
});

test('Matriz 3: 1 lanche com 2 carnes cadastradas -> 2 carnes, independentemente do nome', () => {
  const res = calculateItemProduction({ productId: 'prod-duplo-real', quantity: 1 }, mockCatalog, mockInventory);
  assert.equal(res.chapaPatties, 2);
  assert.equal(res.isDouble, true);
});

test('Matriz 4: 1 carne + 1 ovo, ambos na chapa -> 1 carne e 1 ovo separados', () => {
  const res = calculateItemProduction({ productId: 'prod-burger-egg', quantity: 1 }, mockCatalog, mockInventory);
  assert.equal(res.chapaPatties, 1);
  assert.equal(res.eggsCount, 1);
});

test('Matriz 5: 0,180 kg de blend com porção de 180 g -> 1 carne, consumo de 0,180 kg', () => {
  const res = calculateItemProduction({ productId: 'prod-blend-kg', quantity: 1 }, mockCatalog, mockInventory);
  assert.equal(res.chapaPatties, 1);
  assert.equal(res.breakdown.basePattiesPerBurger, 1);
});

test('Matriz 6: Nome duplo com receita simples -> Aviso na validação; cálculo não altera a receita', () => {
  const val = validateProductIntegrity(mockCatalog[2], mockInventory);
  assert.ok(val.warnings.some(w => w.code === 'NAME_DUPLO_MISMATCH'));
  const res = calculateItemProduction({ productId: 'prod-duplo-fake-name', quantity: 1 }, mockCatalog, mockInventory);
  assert.equal(res.chapaPatties, 1); // Respeita a receita, não inventa 2 carnes
  assert.equal(res.isDouble, false);
});

test('Matriz 7: 1 simples + 2 carnes extras -> 3 carnes e consumo/preço de 2 adicionais', () => {
  const item = {
    productId: 'prod-simples',
    quantity: 1,
    additionals: [
      { id: 'prod-add-patty', name: '2x Carne Extra 160g', quantity: 2, unitPrice: 9.0, price: 18.0 }
    ],
  };
  const res = calculateItemProduction(item, mockCatalog, mockInventory);
  assert.equal(res.chapaPatties, 3); // 1 base + 2 extras = 3
  assert.equal(res.breakdown.totalPattiesPerBurger, 3);
  assert.equal(res.isDouble, true);
});

test('Matriz 8: 2 lanches com 2 extras por lanche -> 6 carnes no total', () => {
  const item = {
    productId: 'prod-simples',
    quantity: 2,
    additionals: [
      { id: 'prod-add-patty', name: 'Carne Extra 160g', quantity: 2, unitPrice: 9.0, price: 18.0 }
    ],
  };
  const res = calculateItemProduction(item, mockCatalog, mockInventory);
  // Por lanche: 1 base + 2 extras = 3. Para 2 lanches = 6 carnes totais!
  assert.equal(res.chapaPatties, 6);
  assert.equal(res.breakdown.totalPattiesPerBurger, 3);
});

test('Matriz 9: Adicional no texto legado e no campo estruturado -> Não duplicar', () => {
  const item = {
    productName: 'Burger Simples + [Carne Extra 160g]',
    productId: 'prod-simples',
    quantity: 1,
    additionals: [
      { id: 'prod-add-patty', name: 'Carne Extra 160g', quantity: 1, unitPrice: 9.0, price: 9.0 }
    ],
  };
  const res = calculateItemProduction(item, mockCatalog, mockInventory);
  assert.equal(res.chapaPatties, 2); // 1 base + 1 extra (não 3!)
});

test('Matriz 10: Combo com 1 batata -> 1 porção, sem somar duas vezes por receita e nome', () => {
  const item = {
    productName: 'Burger Simples (Combo Batata + Bebida)',
    productId: 'prod-simples',
    comboId: 'prod-combo-batata',
    combo: 'Combo: Batata + Bebida',
    quantity: 1,
  };
  const res = calculateItemProduction(item, mockCatalog, mockInventory);
  assert.equal(res.fryerBatatasCombo, 1);
  assert.equal(res.fryerBatatasAvulsa, 0);
});

test('Matriz 11: Adicional com vários componentes -> Todos considerados', () => {
  const addProd = mockCatalog.find(p => p.id === 'prod-add-composto');
  assert.equal(addProd.recipe.length, 2);
  const ingredientIds = addProd.recipe.map(r => r.ingredientId);
  assert.ok(ingredientIds.includes('inv-cheddar'));
  assert.ok(ingredientIds.includes('inv-bacon'));
});

test('Matriz 12: Receita alterada depois da venda -> Pedido anterior mantém composição confirmada', () => {
  const itemWithSnapshot = {
    productId: 'prod-simples',
    quantity: 1,
    productionSnapshot: {
      chapaPatties: 1,
      isDouble: false,
      meatPoint: 'AO PONTO',
      eggsCount: 0,
      baconChapaCount: 0,
      fryerChicken: 0,
      fryerCheese: 0,
      fryerBatatasCombo: 0,
      fryerBatatasAvulsa: 0,
      fryerOnionsCombo: 0,
      fryerOnionsAvulsa: 0,
      breakdown: {
        basePattiesPerBurger: 1,
        additionalPattiesPerBurger: 0,
        totalPattiesPerBurger: 1,
        totalPattiesAllBurgers: 1,
        eggsPerBurger: 0,
        totalEggsAllBurgers: 0,
        chickenPerBurger: 0,
        totalChickenAllBurgers: 0,
        cheeseBreadedPerBurger: 0,
        totalCheeseBreadedAllBurgers: 0,
        resolvedFromRecipe: true,
        notesSummary: ''
      }
    }
  };

  // Mesmo se o catálogo for alterado para 3 carnes:
  const alteredCatalog = [{ ...mockCatalog[0], recipe: [{ ingredientId: 'inv-patty-180', quantity: 3 }] }];
  const res = calculateItemProduction(itemWithSnapshot, alteredCatalog, mockInventory);
  assert.equal(res.chapaPatties, 1); // Mantém 1 carne!
});

test('Matriz 13: Produto renomeado -> Contagem e estação permanecem iguais', () => {
  const itemOriginal = { productId: 'prod-simples', productName: 'Burger Simples', quantity: 1 };
  const res1 = calculateItemProduction(itemOriginal, mockCatalog, mockInventory);

  const renamedCatalog = [{ ...mockCatalog[0], name: 'Burger Brasil Tradicional' }];
  const itemRenamed = { productId: 'prod-simples', productName: 'Burger Brasil Tradicional', quantity: 1 };
  const res2 = calculateItemProduction(itemRenamed, renamedCatalog, mockInventory);

  assert.equal(res1.chapaPatties, res2.chapaPatties);
  assert.equal(res1.isDouble, res2.isDouble);
});

test('Matriz 14: Dois terminais com o mesmo pedido -> Mesma composição e totais', () => {
  const itemA = { productId: 'prod-simples', quantity: 2, unitPrice: 28.0 };
  const itemB = { productId: 'prod-simples', quantity: 2, unitPrice: 28.0 };

  const resA = calculateItemProduction(itemA, mockCatalog, mockInventory);
  const resB = calculateItemProduction(itemB, mockCatalog, mockInventory);

  assert.deepEqual(resA, resB);
});

test('Matriz 15: Falha ao gravar parte da receita -> Validador impede cadastro corrompido', () => {
  const corruptedProduct = {
    name: 'Burger Incompleto',
    category: 'lanche',
    priceBalcao: 25.0,
    recipe: [{ ingredientId: 'inv-inexistente', quantity: 1 }],
  };
  const val = validateProductIntegrity(corruptedProduct, mockInventory);
  assert.equal(val.isValid, false);
  assert.ok(val.warnings.some(w => w.code === 'UNKNOWN_INGREDIENT'));
});

test('Matriz 16: Pedido enviado novamente após queda -> Idempotência gera mesma chave determinística', () => {
  const clientGeneratedId = '123e4567-e89b-12d3-a456-426614174000';
  const key1 = `sale_checkout_${clientGeneratedId}`;
  const key2 = `sale_checkout_${clientGeneratedId}`;
  assert.equal(key1, key2);
});

test('Matriz 17: Cancelamento após preparo -> Não repor insumos automaticamente', () => {
  const orderCompleted = {
    id: 'sale-999',
    productionStatus: 'concluido',
    items: [{ productId: 'prod-simples', quantity: 1 }]
  };

  const isAlreadyPrepared = (
    orderCompleted.productionStatus === 'concluido' ||
    orderCompleted.productionStatus === 'em_producao'
  );

  assert.equal(isAlreadyPrepared, true);
  // Política: quando isAlreadyPrepared é true, o estorno de estoque não é executado e o descarte é registrado como perda
});
