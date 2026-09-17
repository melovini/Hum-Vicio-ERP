import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { calculateItemProduction, createItemProductionSnapshot } = createLoader()('src/lib/production-calculator.ts');

const initialProducts = [
  {
    id: 'prod-burger-alemanha',
    name: 'Burger Alemanha',
    category: 'lanche',
    priceBalcao: 34.00,
    priceIfood: 40.00,
    recipe: [
      { ingredientId: 'inv-patty-180', quantity: 1 }, // 1 carne na versão 1
      { ingredientId: 'inv-bacon', quantity: 0.04 },
    ],
  },
  {
    id: 'prod-combo-batata',
    name: 'Combo: Batata + Bebida',
    category: 'combo',
    priceBalcao: 14.00,
    priceIfood: 16.50,
  },
];

const mockInventory = [
  { id: 'inv-patty-180', name: 'Hambúrguer Bovino 180g', category: 'Carnes', unit: 'un', costPerUnit: 8.5, station: 'chapa' },
  { id: 'inv-bacon', name: 'Bacon Fatiado Crocante', category: 'Carnes', unit: 'kg', costPerUnit: 48.0, station: 'chapa' },
  { id: 'inv-batata', name: 'Batata Palito Congelada', category: 'Porções', unit: 'kg', costPerUnit: 12.0, station: 'fritadeira_batata' },
];

// =========================================================================
// TESTES DE CONSISTÊNCIA DE PEDIDO & COMPOSIÇÃO CONFIRMADA (Etapa 4)
// =========================================================================

test('Consistência: Item com productionSnapshot mantém composição mesmo se a receita for alterada no cardápio', () => {
  const originalItem = {
    id: 'sale-item-1',
    productId: 'prod-burger-alemanha',
    productName: 'Burger Alemanha',
    quantity: 1,
    unitPrice: 48.00,
    comboId: 'prod-combo-batata',
    combo: 'Combo: Batata + Bebida',
    meatPoint: 'AO PONTO',
  };

  // 1. Gera o snapshot da venda no instante da confirmação (Versão 1 da receita = 1 carne)
  const snapshotV1 = createItemProductionSnapshot(originalItem, initialProducts, mockInventory);
  assert.equal(snapshotV1.chapaPatties, 1);
  assert.equal(snapshotV1.isDouble, false);
  assert.equal(snapshotV1.meatPoint, 'AO PONTO');
  assert.equal(snapshotV1.fryerBatatasCombo, 1);

  // Anexa o snapshot ao item da venda confirmada
  const confirmedSaleItem = {
    ...originalItem,
    productionSnapshot: snapshotV1,
  };

  // 2. O Gestor altera a receita do produto no cardápio para 2 carnes (Versão 2 da receita)
  const modifiedProducts = [
    {
      id: 'prod-burger-alemanha',
      name: 'Burger Alemanha',
      category: 'lanche',
      priceBalcao: 42.00,
      priceIfood: 48.00,
      recipe: [
        { ingredientId: 'inv-patty-180', quantity: 2 }, // Mudou para 2 carnes!
        { ingredientId: 'inv-bacon', quantity: 0.04 },
      ],
    },
    initialProducts[1],
  ];

  // 3. O KDS renderiza a comanda do pedido confirmado usando o catálogo atualizado (modifiedProducts)
  const kdsRenderResult = calculateItemProduction(confirmedSaleItem, modifiedProducts, mockInventory);

  // DEVE manter a composição original confirmada: 1 carne, NÃO 2!
  assert.equal(kdsRenderResult.chapaPatties, 1);
  assert.equal(kdsRenderResult.isDouble, false);
  assert.equal(kdsRenderResult.meatPoint, 'AO PONTO');
  assert.equal(kdsRenderResult.breakdown.totalPattiesPerBurger, 1);

  // 4. Um novo pedido (sem snapshot) preparado após a alteração deve refletir a nova receita (2 carnes)
  const newItem = {
    id: 'sale-item-2',
    productId: 'prod-burger-alemanha',
    productName: 'Burger Alemanha',
    quantity: 1,
    unitPrice: 42.00,
  };
  const newOrderResult = calculateItemProduction(newItem, modifiedProducts, mockInventory);
  assert.equal(newOrderResult.chapaPatties, 2);
  assert.equal(newOrderResult.isDouble, true);
});

test('Consistência: Pedidos legados sem productionSnapshot calculam sob demanda pela receita vigente (retrocompatibilidade)', () => {
  const legacyItem = {
    id: 'legacy-item',
    productId: 'prod-burger-alemanha',
    productName: 'Burger Alemanha',
    quantity: 2,
    unitPrice: 34.00,
    notes: 'AO PONTO P/ BEM',
  };

  // Sem snapshot anexado
  const legacyResult = calculateItemProduction(legacyItem, initialProducts, mockInventory);

  // Calcula com base na receita vigente
  assert.equal(legacyResult.chapaPatties, 2); // 1 carne por lanche x 2 lanches = 2
  assert.equal(legacyResult.meatPoint, 'Ao Ponto +');
  assert.equal(legacyResult.breakdown.resolvedFromRecipe, true);
});

test('Consistência: createItemProductionSnapshot ignora snapshot prévio e recalcula do zero com novos produtos', () => {
  const staleSnapshot = {
    chapaPatties: 99,
    isDouble: true,
    meatPoint: 'TESTE',
    eggsCount: 0,
    baconChapaCount: 0,
    fryerChicken: 0,
    fryerCheese: 0,
    fryerBatatasCombo: 0,
    fryerBatatasAvulsa: 0,
    fryerOnionsCombo: 0,
    fryerOnionsAvulsa: 0,
    breakdown: {
      basePattiesPerBurger: 99,
      additionalPattiesPerBurger: 0,
      totalPattiesPerBurger: 99,
      totalPattiesAllBurgers: 99,
      eggsPerBurger: 0,
      totalEggsAllBurgers: 0,
      chickenPerBurger: 0,
      totalChickenAllBurgers: 0,
      cheeseBreadedPerBurger: 0,
      totalCheeseBreadedAllBurgers: 0,
      resolvedFromRecipe: true,
      notesSummary: ''
    }
  };

  const itemWithStaleSnapshot = {
    id: 'item-stale',
    productId: 'prod-burger-alemanha',
    productName: 'Burger Alemanha',
    quantity: 1,
    unitPrice: 34.00,
    meatPoint: 'AO PONTO',
    productionSnapshot: staleSnapshot,
  };

  // calculateItemProduction respeita o snapshot existente
  const directResult = calculateItemProduction(itemWithStaleSnapshot, initialProducts, mockInventory);
  assert.equal(directResult.chapaPatties, 99);

  // createItemProductionSnapshot recalcula a partir da receita real
  const freshSnapshot = createItemProductionSnapshot(itemWithStaleSnapshot, initialProducts, mockInventory);
  assert.equal(freshSnapshot.chapaPatties, 1);
  assert.equal(freshSnapshot.meatPoint, 'AO PONTO');
});
