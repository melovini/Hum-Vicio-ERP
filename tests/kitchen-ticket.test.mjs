import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { buildKitchenTicket, formatKitchenTicketEscPos } = createLoader()('src/lib/kitchen-ticket.ts');

// Massa de Insumos mockados
const mockInventory = [
  { id: 'inv-pao', name: 'Pão de Brioche', category: 'Padaria', unit: 'un', station: 'nenhuma' },
  { id: 'inv-patty-180', name: 'Hambúrguer Bovino 180g', category: 'Carnes', unit: 'un', station: 'chapa', portionWeight: 180, portionUnit: 'g' },
  { id: 'inv-patty-90', name: 'Hambúrguer Bovino Smash 90g', category: 'Carnes', unit: 'un', station: 'chapa', portionWeight: 90, portionUnit: 'g' },
  { id: 'inv-frango', name: 'Filé de Frango Empanado', category: 'Carnes', unit: 'un', station: 'fritadeira_frango' },
  { id: 'inv-queijo-emp', name: 'Queijo Minas Empanado', category: 'Laticínios', unit: 'un', station: 'fritadeira_queijo' },
  { id: 'inv-ovo', name: 'Ovo', category: 'Laticínios', unit: 'un', station: 'chapa' },
  { id: 'inv-bacon', name: 'Bacon Fatiado', category: 'Carnes', unit: 'kg', station: 'chapa' },
  { id: 'inv-batata', name: 'Batata Palito Congelada', category: 'Porções', unit: 'kg', station: 'fritadeira_batata' },
  { id: 'inv-onion', name: 'Anéis de Cebola', category: 'Porções', unit: 'kg', station: 'fritadeira_onion' },
  { id: 'inv-cheddar', name: 'Queijo Cheddar Fatiado', category: 'Laticínios', unit: 'kg', station: 'nenhuma' },
];

// Massa de Produtos mockados
const mockProducts = [
  {
    id: 'prod-simples',
    name: 'Burger Simples',
    category: 'lanche',
    priceBalcao: 30,
    priceIfood: 36,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 1 },
      { ingredientId: 'inv-cheddar', quantity: 0.03 },
    ],
  },
  {
    id: 'prod-duplo',
    name: 'Burger Duplo',
    category: 'lanche',
    priceBalcao: 42,
    priceIfood: 49,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-180', quantity: 2 },
      { ingredientId: 'inv-cheddar', quantity: 0.06 },
    ],
  },
  {
    id: 'prod-smash-duplo',
    name: 'Smash Duplo',
    category: 'lanche',
    priceBalcao: 28,
    priceIfood: 34,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-patty-90', quantity: 2 },
    ],
  },
  {
    id: 'prod-frango',
    name: 'Burger de Frango',
    category: 'lanche',
    priceBalcao: 32,
    priceIfood: 38,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-frango', quantity: 1 },
    ],
  },
  {
    id: 'prod-queijo-emp',
    name: 'Burger Queijo Empanado',
    category: 'lanche',
    priceBalcao: 34,
    priceIfood: 40,
    recipe: [
      { ingredientId: 'inv-pao', quantity: 1 },
      { ingredientId: 'inv-queijo-emp', quantity: 1 },
    ],
  },
  {
    id: 'prod-batata-media',
    name: 'Batata Média',
    category: 'porcao',
    priceBalcao: 18,
    priceIfood: 22,
    recipe: [{ ingredientId: 'inv-batata', quantity: 0.2 }],
  },
  {
    id: 'prod-batata-grande',
    name: 'Batata Grande',
    category: 'porcao',
    priceBalcao: 25,
    priceIfood: 30,
    recipe: [{ ingredientId: 'inv-batata', quantity: 0.35 }],
  },
];

function makeBaseSale(items = [], overrides = {}) {
  return {
    id: 'a12b34-5678-9012',
    customerName: 'Maria',
    date: '2026-09-20T19:42:00.000Z',
    channel: 'balcao',
    orderType: 'retirada',
    total: 50,
    items,
    ...overrides,
  };
}

test('1. 1 simples com 1 ovo -> Chapa: 1 carne; outros: 1 ovo', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 1,
      unitPrice: 30,
      additionals: [{ name: 'Ovo', quantity: 1, price: 4 }],
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });

  assert.equal(ticket.productionSummary.chapa.totalPatties, 1);
  assert.equal(ticket.productionSummary.chapa.status, 'ok');
  assert.equal(ticket.items[0].additionals[0].label, 'ADICIONAR: 1 Ovo');

  const otherEggs = ticket.productionSummary.chapa.otherItems.find(o => o.label.includes('Ovo'));
  assert.ok(otherEggs, 'Deve registrar ovo na chapa em outros');
  assert.equal(otherEggs.count, 1);

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /CHAPA — 1 HAMBÚRGUER/);
  assert.match(text, /1x Bovino 180 g/);
  assert.match(text, /OUTROS NA CHAPA/);
  assert.match(text, /1x Ovo/);
  assert.match(text, /ADICIONAR: 1 Ovo/);
});

test('2. 2 simples -> Chapa: 2 carnes, sem multiplicação duplicada', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 2,
      unitPrice: 30,
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });

  assert.equal(ticket.productionSummary.chapa.totalPatties, 2);
  assert.equal(ticket.items[0].quantity, 2);
  assert.equal(ticket.items[0].pattiesComposition, '1 carne bovina de 180 g');

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /CHAPA — 2 HAMBÚRGUERES/);
  assert.match(text, /2x Bovino 180 g/);
  assert.match(text, /2x BURGER SIMPLES/);
});

test('3. 1 duplo + 1 simples -> Chapa: 3 carnes', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-duplo',
      productName: 'Burger Duplo',
      quantity: 1,
      unitPrice: 42,
    },
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 1,
      unitPrice: 30,
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });

  assert.equal(ticket.productionSummary.chapa.totalPatties, 3);
  assert.equal(ticket.items[0].pattiesComposition, '2 carnes bovinas de 180 g');
  assert.equal(ticket.items[1].pattiesComposition, '1 carne bovina de 180 g');

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /CHAPA — 3 HAMBÚRGUERES/);
  assert.match(text, /3x Bovino 180 g/);
});

test('4. 1 simples + 2 carnes extras -> Chapa: 3 carnes; adicional identifica 2 unidades', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 1,
      unitPrice: 30,
      additionals: [{ name: 'Hambúrguer 180g', quantity: 2, price: 16 }],
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });

  assert.equal(ticket.productionSummary.chapa.totalPatties, 3);
  assert.equal(ticket.items[0].additionals[0].label, 'ADICIONAR: 2 Hambúrguer 180g');

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /CHAPA — 3 HAMBÚRGUERES/);
  assert.match(text, /3x Bovino 180 g/);
  assert.match(text, /ADICIONAR: 2 Hambúrguer 180g/);
});

test('5. Combo com batata + porção avulsa -> Duas porções, sem duplicação', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 1,
      unitPrice: 45,
      combo: 'Combo: Batata + Bebida (Coca Zero)',
    },
    {
      productId: 'prod-batata-grande',
      productName: 'Batata Grande',
      quantity: 1,
      unitPrice: 25,
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });

  assert.equal(ticket.productionSummary.fritadeira.totalPreparos, 2);
  assert.equal(ticket.items[0].comboInfo?.label, 'Combo: 1 batata pequena + Coca Zero');

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /FRITADEIRA/);
  assert.match(text, /1x Batata pequena/);
  assert.match(text, /1x Batata grande/);
  assert.match(text, /Combo: 1 batata pequena \+ Coca Zero/);
});

test('6. Frango, queijo empanado e batata -> Cada tipo separado na fritadeira com unidade correta', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-frango',
      productName: 'Burger de Frango',
      quantity: 1,
      unitPrice: 32,
    },
    {
      productId: 'prod-queijo-emp',
      productName: 'Burger Queijo Empanado',
      quantity: 1,
      unitPrice: 34,
    },
    {
      productId: 'prod-batata-media',
      productName: 'Batata Média',
      quantity: 1,
      unitPrice: 18,
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });

  assert.equal(ticket.productionSummary.fritadeira.totalPreparos, 3);
  assert.equal(ticket.productionSummary.chapa.status, 'sem_carnes');

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /FRITADEIRA/);
  assert.match(text, /1x Frango empanado/);
  assert.match(text, /1x Queijo empanado/);
  assert.match(text, /1x Batata pequena/);
  assert.match(text, /CHAPA: SEM CARNES/);
});

test('7. Mesmo produto com pontos diferentes -> Blocos separados e resumo somado coerente', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 1,
      unitPrice: 30,
      meatPoint: 'Ao ponto',
      removals: ['cebola'],
    },
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 1,
      unitPrice: 30,
      meatPoint: 'Bem passado',
      notes: 'cortar ao meio',
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });

  assert.equal(ticket.items.length, 2);
  assert.equal(ticket.items[0].meatPoint, 'ao ponto');
  assert.equal(ticket.items[0].removals[0], 'cebola');
  assert.equal(ticket.items[1].meatPoint, 'bem passado');
  assert.equal(ticket.items[1].notes, 'cortar ao meio');
  assert.equal(ticket.productionSummary.chapa.totalPatties, 2);

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /Ponto: ao ponto/);
  assert.match(text, /RETIRAR: cebola/);
  assert.match(text, /Ponto: bem passado/);
  assert.match(text, /OBS: cortar ao meio/);
  assert.match(text, /CHAPA — 2 HAMBÚRGUERES/);
  assert.match(text, /2x Bovino 180 g/);
});

test('8. Receita alterada após a venda -> Reimpressão preserva a composição confirmada do snapshot', () => {
  const historicalSnapshot = {
    chapaPatties: 2,
    isDouble: true,
    eggsCount: 0,
    baconChapaCount: 0,
    fryerChicken: 0,
    fryerCheese: 0,
    fryerBatatasCombo: 0,
    fryerBatatasAvulsa: 0,
    fryerOnionsCombo: 0,
    fryerOnionsAvulsa: 0,
    breakdown: {
      basePattiesPerBurger: 2,
      additionalPattiesPerBurger: 0,
      totalPattiesPerBurger: 2,
      totalPattiesAllBurgers: 2,
      eggsPerBurger: 0,
      totalEggsAllBurgers: 0,
      chickenPerBurger: 0,
      totalChickenAllBurgers: 0,
      cheeseBreadedPerBurger: 0,
      totalCheeseBreadedAllBurgers: 0,
      resolvedFromRecipe: true,
      notesSummary: '',
    },
  };

  const sale = makeBaseSale([
    {
      productId: 'prod-simples', // Mesmo com produto atualmente cadastrado como 1 carne
      productName: 'Burger Simples Histórico',
      quantity: 1,
      unitPrice: 30,
      productionSnapshot: historicalSnapshot,
    },
  ]);

  const ticket = buildKitchenTicket({
    sale,
    products: mockProducts,
    inventoryItems: mockInventory,
    isReprint: true,
  });

  assert.equal(ticket.productionSummary.chapa.totalPatties, 2);
  assert.equal(ticket.header.isReprint, true);

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /\*\*\* REIMPRESSÃO — MESMO PEDIDO \*\*\*/);
  assert.match(text, /CHAPA — 2 HAMBÚRGUERES/);
});

test('9. Composição ausente -> "Quantidade a conferir", sem zero ou número falso', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-desconhecido-999',
      productName: 'Lanche Sem Cadastro',
      quantity: 1,
      unitPrice: 30,
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: [], inventoryItems: [] });

  assert.equal(ticket.productionSummary.chapa.status, 'a_conferir');
  assert.equal(ticket.productionSummary.isComplete, false);

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /CHAPA: QUANTIDADE A CONFERIR/);
});

test('10. Pedido com pagamento pendente -> Via de cozinha sem cobrança; sem mensagens de cobrança', () => {
  const sale = makeBaseSale(
    [
      {
        productId: 'prod-simples',
        productName: 'Burger Simples',
        quantity: 1,
        unitPrice: 30,
      },
    ],
    {
      paymentStatus: 'pendente_retirada',
      total: 30,
    }
  );

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });
  const text = formatKitchenTicketEscPos(ticket);

  assert.doesNotMatch(text, /COBRAR DO CLIENTE/i);
  assert.doesNotMatch(text, /PAGAR NA RETIRADA/i);
  assert.doesNotMatch(text, /R\$\s*30/i);
  assert.doesNotMatch(text, /CNPJ/i);
  assert.doesNotMatch(text, /AGILIDADE & QUALIDADE/i);
});

test('11. Nome longo, acentos e observações extensas -> Conteúdo completo preservado', () => {
  const sale = makeBaseSale(
    [
      {
        productId: 'prod-simples',
        productName: 'Hambúrguer Especial da Casa Super Crocante com Molho Secreto',
        quantity: 1,
        unitPrice: 30,
        notes: 'Cliente alérgico severo a gergelim, por favor limpar chapa e utensílios antes',
        removals: ['cebola roxa caramelizada'],
      },
    ],
    {
      customerName: 'João Carlos de Albuquerque Pereira da Silva',
    }
  );

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });
  const text = formatKitchenTicketEscPos(ticket);

  assert.match(text, /JOÃO CARLOS DE ALBUQUERQUE PEREIRA DA SILVA/);
  assert.match(text, /HAMBÚRGUER ESPECIAL DA CASA SUPER CROCANTE/);
  assert.match(text, /Cliente alérgico severo a gergelim/);
  assert.match(text, /RETIRAR: cebola roxa caramelizada/);
});

test('12. Reimpressão -> Identificada explicitamente sem criar novo pedido', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 1,
      unitPrice: 30,
    },
  ]);

  const ticket = buildKitchenTicket({
    sale,
    products: mockProducts,
    inventoryItems: mockInventory,
    isReprint: true,
  });

  assert.equal(ticket.header.isReprint, true);
  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /\*\*\* REIMPRESSÃO — MESMO PEDIDO \*\*\*/);
});

test('13. Via Diferencial -> Exibe adições e cancelamentos sem induzir preparo duplicado', () => {
  const sale = makeBaseSale();
  const diff = {
    added: [
      {
        productId: 'prod-simples',
        productName: 'Burger Adicional',
        quantity: 1,
        unitPrice: 30,
        meatPoint: 'Ao ponto',
      },
    ],
    removed: [
      {
        productId: 'prod-batata-grande',
        productName: 'Batata Grande',
        quantity: 1,
        unitPrice: 25,
      },
    ],
    modified: [
      {
        item: {
          productId: 'prod-simples',
          productName: 'Burger 1',
          quantity: 1,
          unitPrice: 30,
        },
        oldNotes: 'Sem cebola',
        newNotes: 'Sem cebola e sem molho',
      },
    ],
  };

  const ticket = buildKitchenTicket({
    sale,
    products: mockProducts,
    inventoryItems: mockInventory,
    diff,
  });

  assert.equal(ticket.header.isDifferential, true);
  assert.equal(ticket.diff?.added.length, 1);
  assert.equal(ticket.diff?.removed.length, 1);
  assert.equal(ticket.diff?.modified.length, 1);

  const text = formatKitchenTicketEscPos(ticket);
  assert.match(text, /\*\*\* ALTERAÇÃO DO PEDIDO \*\*\*/);
  assert.match(text, /ITENS ADICIONADOS \(\+\):/);
  assert.match(text, /\[\+\] 1x BURGER ADICIONAL/);
  assert.match(text, /ITENS CANCELADOS \(-\):/);
  assert.match(text, /\[-\] 1x BATATA GRANDE \(CANCELADO\)/);
  assert.match(text, /OBSERVAÇÕES MODIFICADAS \(\*\):/);
  assert.match(text, /DE: Sem cebola/);
  assert.match(text, /PARA: Sem cebola e sem molho/);
  assert.match(text, /\*\*\* NÃO REPETIR ITENS JÁ PREPARADOS \*\*\*/);
});

test('14. HTML e Texto -> Mesmos dados, quantidades e instruções', () => {
  const sale = makeBaseSale([
    {
      productId: 'prod-duplo',
      productName: 'Burger Duplo',
      quantity: 1,
      unitPrice: 42,
      meatPoint: 'Ao ponto',
      removals: ['cebola'],
    },
    {
      productId: 'prod-simples',
      productName: 'Burger Simples',
      quantity: 1,
      unitPrice: 30,
      additionals: [{ name: 'Ovo', quantity: 1, price: 4 }],
      notes: 'cortar ao meio',
    },
  ]);

  const ticket = buildKitchenTicket({ sale, products: mockProducts, inventoryItems: mockInventory });
  const text = formatKitchenTicketEscPos(ticket);

  // Cliente e Pedido
  assert.equal(ticket.header.customerName, 'MARIA');
  assert.match(text, /CLIENTE: MARIA/);
  assert.match(text, new RegExp(`Pedido #${ticket.header.orderIdShort.replace('#', '')} \\| ${ticket.header.time}`));

  // Totais
  assert.equal(ticket.productionSummary.chapa.totalPatties, 3);
  assert.match(text, /CHAPA — 3 HAMBÚRGUERES/);
  assert.match(text, /3x Bovino 180 g/);

  const eggs = ticket.productionSummary.chapa.otherItems.find(o => o.label.includes('Ovo'));
  assert.equal(eggs?.count, 1);
  assert.match(text, /OUTROS NA CHAPA/);
  assert.match(text, /1x Ovo/);
});

test('15. Exemplo exato do prompt: carnes com tipos e gramaturas diferentes, ovos e fritadeira', () => {
  const mockInventoryExtended = [
    ...mockInventory,
    { id: 'inv-patty-costela-180', name: 'Hambúrguer de Costela 180g', category: 'Carnes', unit: 'un', station: 'chapa', portionWeight: 180, portionUnit: 'g' },
    { id: 'inv-patty-linguica', name: 'Hambúrguer de Linguiça', category: 'Carnes', unit: 'un', station: 'chapa', portionWeight: 150, portionUnit: 'g' },
  ];

  const mockComponents = [
    { id: 'cmp-bovino-180', name: 'Bovino 180 g', componentType: 'burger', station: 'grill', productionUnit: 'disco', portionWeight: 180, portionUnit: 'g', showInSummary: true, isActive: true },
    { id: 'cmp-costela-180', name: 'Costela 180 g', componentType: 'burger', station: 'grill', productionUnit: 'disco', portionWeight: 180, portionUnit: 'g', showInSummary: true, isActive: true },
    { id: 'cmp-linguica', name: 'Linguiça', componentType: 'burger', station: 'grill', productionUnit: 'disco', portionWeight: 150, portionUnit: 'g', showInSummary: true, isActive: true },
    { id: 'cmp-ovo', name: 'Ovo', componentType: 'egg', station: 'grill', productionUnit: 'unidade', portionWeight: 1, portionUnit: 'un', showInSummary: true, isActive: true },
    { id: 'cmp-batata-peq', name: 'Batata pequena', componentType: 'side', station: 'fryer', productionUnit: 'porcao', portionWeight: 150, portionUnit: 'g', showInSummary: true, isActive: true },
    { id: 'cmp-aneis-cebola', name: 'Anéis de cebola', componentType: 'side', station: 'fryer', productionUnit: 'porcao', portionWeight: 150, portionUnit: 'g', showInSummary: true, isActive: true },
  ];

  const mockProductsExtended = [
    {
      id: 'prod-bovino-180',
      name: 'Burger Bovino 180g',
      category: 'lanche',
      recipe: [
        { ingredientId: 'inv-pao', quantity: 1 },
        { ingredientId: 'inv-patty-180', quantity: 1, kitchenComponentId: 'cmp-bovino-180' },
      ],
    },
    {
      id: 'prod-costela-180',
      name: 'Burger Costela 180g',
      category: 'lanche',
      recipe: [
        { ingredientId: 'inv-pao', quantity: 1 },
        { ingredientId: 'inv-patty-costela-180', quantity: 1, kitchenComponentId: 'cmp-costela-180' },
      ],
    },
    {
      id: 'prod-linguica',
      name: 'Burger Linguiça',
      category: 'lanche',
      recipe: [
        { ingredientId: 'inv-pao', quantity: 1 },
        { ingredientId: 'inv-patty-linguica', quantity: 1, kitchenComponentId: 'cmp-linguica' },
      ],
    },
    {
      id: 'prod-batata-peq',
      name: 'Batata Pequena',
      category: 'porcao',
      recipe: [
        { ingredientId: 'inv-batata', quantity: 0.15, kitchenComponentId: 'cmp-batata-peq' },
      ],
    },
    {
      id: 'prod-aneis-cebola',
      name: 'Anéis de Cebola',
      category: 'porcao',
      recipe: [
        { ingredientId: 'inv-onion', quantity: 0.15, kitchenComponentId: 'cmp-aneis-cebola' },
      ],
    },
  ];

  const sale = makeBaseSale([
    { productId: 'prod-bovino-180', productName: 'Burger Bovino 180g', quantity: 1, unitPrice: 35, additionals: [{ name: 'Ovo', quantity: 2, price: 6 }] },
    { productId: 'prod-bovino-180', productName: 'Burger Bovino 180g', quantity: 2, unitPrice: 35 },
    { productId: 'prod-costela-180', productName: 'Burger Costela 180g', quantity: 2, unitPrice: 38 },
    { productId: 'prod-linguica', productName: 'Burger Linguiça', quantity: 1, unitPrice: 32 },
    { productId: 'prod-batata-peq', productName: 'Batata Pequena', quantity: 2, unitPrice: 15 },
    { productId: 'prod-aneis-cebola', productName: 'Anéis de Cebola', quantity: 1, unitPrice: 18 },
  ]);

  const ticket = buildKitchenTicket({
    sale,
    products: mockProductsExtended,
    inventoryItems: mockInventoryExtended,
    kitchenComponents: mockComponents,
  });

  const text = formatKitchenTicketEscPos(ticket);

  assert.equal(ticket.productionSummary.chapa.totalPatties, 6);
  assert.equal(ticket.productionSummary.fritadeira.totalPreparos, 3);

  // Validação do rodapé exato:
  assert.match(text, /CHAPA — 6 HAMBÚRGUERES\n3x Bovino 180 g\n2x Costela 180 g\n1x Linguiça/);
  assert.match(text, /OUTROS NA CHAPA\n2x Ovo/);
  assert.match(text, /FRITADEIRA\n2x Batata pequena\n1x Anéis de cebola/);
});
