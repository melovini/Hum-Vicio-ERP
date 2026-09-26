import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  calculateOrderProductionRequirements,
  buildSaleItemKitchenSnapshot,
  DEFAULT_KITCHEN_COMPONENTS
} = createLoader()('src/lib/kitchen-calculator.ts');

const { buildKitchenTicket } = createLoader()('src/lib/kitchen-ticket.ts');

// Massa de dados de teste (Cardápio e Insumos)
const testInventory = [
  { id: 'inv-costela', name: 'Carne Costela 180g', unit: 'un', kitchenComponentId: 'cmp-costela-180' },
  { id: 'inv-bovino', name: 'Carne Bovina 180g', unit: 'un', kitchenComponentId: 'cmp-bovino-180' },
  { id: 'inv-smash', name: 'Carne Smash 90g', unit: 'un', kitchenComponentId: 'cmp-bovino-90' },
  { id: 'inv-frango', name: 'Frango Empanado', unit: 'un', kitchenComponentId: 'cmp-frango-emp' },
  { id: 'inv-ovo', name: 'Ovo', unit: 'un', kitchenComponentId: 'cmp-ovo' },
  { id: 'inv-batata', name: 'Batata Frita', unit: 'kg', portionWeight: 150, portionUnit: 'g' },
  { id: 'inv-onion', name: 'Anéis de Cebola', unit: 'kg', portionWeight: 150, portionUnit: 'g', kitchenComponentId: 'cmp-aneis-cebola' },
];

const testProducts = [
  {
    id: 'prod-arg-simples',
    name: 'Argentina Simples',
    category: 'lanche',
    recipe: [{ ingredientId: 'inv-costela', quantity: 1, kitchenComponentId: 'cmp-costela-180' }]
  },
  {
    id: 'prod-arg-duplo',
    name: 'Argentina Duplo',
    category: 'lanche',
    recipe: [{ ingredientId: 'inv-costela', quantity: 2, kitchenComponentId: 'cmp-costela-180' }]
  },
  {
    id: 'prod-bacon',
    name: 'Hum Bacon',
    category: 'lanche',
    recipe: [{ ingredientId: 'inv-bovino', quantity: 1, kitchenComponentId: 'cmp-bovino-180' }]
  },
  {
    id: 'prod-egg-burger',
    name: 'Hum Egg Burger',
    category: 'lanche',
    recipe: [
      { ingredientId: 'inv-bovino', quantity: 1, kitchenComponentId: 'cmp-bovino-180' },
      { ingredientId: 'inv-ovo', quantity: 1, kitchenComponentId: 'cmp-ovo' }
    ]
  },
  {
    id: 'prod-combo-batata',
    name: 'Combo Batata + Refrigerante',
    category: 'combo',
    recipe: [{ ingredientId: 'inv-batata', quantity: 0.15, kitchenComponentId: 'cmp-batata-peq' }]
  },
  {
    id: 'prod-combo-onion',
    name: 'Combo Onion Rings',
    category: 'combo',
    recipe: [{ ingredientId: 'inv-onion', quantity: 1, kitchenComponentId: 'cmp-aneis-cebola' }]
  },
  {
    id: 'add-frango',
    name: 'Adicional Frango Empanado',
    category: 'adicional',
    recipe: [{ ingredientId: 'inv-frango', quantity: 1, kitchenComponentId: 'cmp-frango-emp' }]
  }
];

test('KDS e Comanda Impressa produzem exatamente os mesmos números para lanches simples e duplos', () => {
  const saleItems = [
    {
      id: 'item-1',
      productId: 'prod-arg-duplo',
      productName: 'Argentina Duplo',
      quantity: 2, // 2x lanches com 2 carnes cada = 4 carnes costela 180g
      unitPrice: 42,
    },
    {
      id: 'item-2',
      productId: 'prod-bacon',
      productName: 'Hum Bacon',
      quantity: 1, // 1x carne bovina 180g
      unitPrice: 32,
    },
  ];

  // 1. Resumo KDS (calculateOrderProductionRequirements)
  const kdsSummary = calculateOrderProductionRequirements(saleItems, testProducts, testInventory, DEFAULT_KITCHEN_COMPONENTS);

  // 2. Resumo Comanda Impressa (buildKitchenTicket)
  const ticket = buildKitchenTicket({
    sale: {
      id: 'sale-test-1',
      customerName: 'Cliente Teste',
      date: new Date().toISOString(),
      items: saleItems,
      channel: 'balcao',
      total: 116,
    },
    products: testProducts,
    inventoryItems: testInventory,
    kitchenComponents: DEFAULT_KITCHEN_COMPONENTS,
  });

  // Ambos devem contabilizar 5 carnes totais na chapa
  assert.equal(kdsSummary.chapa.totalBurgers, 5);
  assert.equal(ticket.productionSummary.chapa.totalPatties, 5);

  // Devem diferenciar Costela 180g de Bovino 180g
  const kdsCostela = kdsSummary.chapa.burgersBreakdown.find(b => b.componentId === 'cmp-costela-180');
  const ticketCostela = ticket.productionSummary.chapa.pattiesBreakdown.find(p => p.label.includes('Costela 180 g'));

  assert.ok(kdsCostela);
  assert.ok(ticketCostela);
  assert.equal(kdsCostela.count, 4);
  assert.equal(ticketCostela.count, 4);

  const kdsBovino = kdsSummary.chapa.burgersBreakdown.find(b => b.componentId === 'cmp-bovino-180');
  const ticketBovino = ticket.productionSummary.chapa.pattiesBreakdown.find(p => p.label.includes('Bovino 180 g'));

  assert.ok(kdsBovino);
  assert.ok(ticketBovino);
  assert.equal(kdsBovino.count, 1);
  assert.equal(ticketBovino.count, 1);
});

test('Rótulos de estação já incluem o multiplicador e nunca devem sofrer prefixação dupla', () => {
  const saleItems = [
    {
      id: 'item-1',
      productId: 'prod-arg-simples',
      productName: 'Argentina Simples',
      quantity: 3,
      unitPrice: 35,
    },
    {
      id: 'item-2',
      productId: 'prod-egg-burger',
      productName: 'Hum Egg Burger',
      quantity: 2,
      unitPrice: 38,
    }
  ];

  const summary = calculateOrderProductionRequirements(saleItems, testProducts, testInventory, DEFAULT_KITCHEN_COMPONENTS);

  // burgersBreakdown labels
  for (const b of summary.chapa.burgersBreakdown) {
    // Formato canônico: "<count>x <nome>"
    assert.match(b.label, /^\d+x\s+.+/);
    // Não pode haver "2x 2x" ou "3x 3x"
    assert.doesNotMatch(b.label, /\d+x\s+\d+x/);
  }

  // otherItems (ovos)
  const eggItem = summary.chapa.otherItems.find(o => o.componentId === 'cmp-ovo');
  assert.ok(eggItem);
  assert.equal(eggItem.count, 2);
  assert.equal(eggItem.label, '2x Ovo');
  assert.doesNotMatch(eggItem.label, /\d+x\s+\d+x/);
});

test('Combos e adicionais de fritadeira batem perfeitamente entre KDS e Comanda', () => {
  const saleItems = [
    {
      id: 'item-combo',
      productId: 'prod-bacon',
      productName: 'Hum Bacon',
      quantity: 2,
      comboId: 'prod-combo-batata',
      combo: 'Combo Batata + Refrigerante',
      additionals: [
        { id: 'add-frango', name: 'Adicional Frango Empanado', quantity: 1 }
      ],
      unitPrice: 50,
    }
  ];

  const kdsSummary = calculateOrderProductionRequirements(saleItems, testProducts, testInventory, DEFAULT_KITCHEN_COMPONENTS);

  const ticket = buildKitchenTicket({
    sale: {
      id: 'sale-test-combo',
      customerName: 'Cliente Combo',
      date: new Date().toISOString(),
      items: saleItems,
      channel: 'balcao',
      total: 100,
    },
    products: testProducts,
    inventoryItems: testInventory,
    kitchenComponents: DEFAULT_KITCHEN_COMPONENTS,
  });

  // Fritadeira: 2 batatas pequenas + 2 frangos empanados = 4 preparos
  assert.equal(kdsSummary.fritadeira.totalPreparos, 4);
  assert.equal(ticket.productionSummary.fritadeira.totalPreparos, 4);

  const kdsFries = kdsSummary.fritadeira.items.find(i => i.componentId === 'cmp-batata-peq');
  assert.ok(kdsFries);
  assert.equal(kdsFries.count, 2);
  assert.equal(kdsFries.label, '2x Batata pequena');

  const kdsChicken = kdsSummary.fritadeira.items.find(i => i.componentId === 'cmp-frango-emp');
  assert.ok(kdsChicken);
  assert.equal(kdsChicken.count, 2);
  assert.equal(kdsChicken.label, '2x Frango empanado');
});

test('Snapshot imutável garante persistência de produção mesmo após alteração no cardápio', () => {
  const originalItem = {
    id: 'item-immutable',
    productId: 'prod-arg-simples',
    productName: 'Argentina Simples',
    quantity: 2,
    unitPrice: 35,
  };

  const snapshot = buildSaleItemKitchenSnapshot(originalItem, testProducts, testInventory, DEFAULT_KITCHEN_COMPONENTS);
  assert.equal(snapshot.version, 3);
  assert.equal(snapshot.components.length, 1);
  assert.equal(snapshot.components[0].componentId, 'cmp-costela-180');
  assert.equal(snapshot.components[0].quantity, 1); // por unidade vendida

  // Salva com snapshot
  const itemWithSnapshot = {
    ...originalItem,
    productionSnapshot: { structuredProduction: snapshot }
  };

  // Suponha que o cardápio no banco mude completamente a receita
  const alteredProducts = [
    {
      id: 'prod-arg-simples',
      name: 'Argentina Simples',
      category: 'lanche',
      recipe: [{ ingredientId: 'inv-bovino', quantity: 1, kitchenComponentId: 'cmp-bovino-180' }] // mudou para bovino
    }
  ];

  // Ao recalcular com snapshot salvo, DEVE preservar a receita original (Costela 180g)
  const result = calculateOrderProductionRequirements([itemWithSnapshot], alteredProducts, testInventory, DEFAULT_KITCHEN_COMPONENTS);
  assert.equal(result.chapa.totalBurgers, 2);
  assert.equal(result.chapa.burgersBreakdown[0].componentId, 'cmp-costela-180');
  assert.equal(result.chapa.burgersBreakdown[0].label, '2x Costela 180 g');
});
