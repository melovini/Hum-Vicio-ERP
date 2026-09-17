import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { recalculateCartPrices, calculateCartSubtotal } = createLoader()('src/lib/pos-financial-helpers.ts');
const { calculateItemProduction } = createLoader()('src/lib/production-calculator.ts');

const mockProducts = [
  {
    id: 'prod-burger-brasil',
    name: 'Burger Brasil',
    category: 'lanche',
    priceBalcao: 32.00,
    priceIfood: 38.00,
    recipe: [
      { ingredientId: 'inv-patty-180', quantity: 1 },
      { ingredientId: 'inv-bacon', quantity: 0.04 },
      { ingredientId: 'inv-cebola', quantity: 0.03 },
    ],
  },
  {
    id: 'prod-combo-batata',
    name: 'Combo: Batata + Bebida',
    category: 'combo',
    priceBalcao: 14.00,
    priceIfood: 16.50,
  },
  {
    id: 'prod-add-bacon',
    name: 'Adicional: Bacon Fatiado',
    category: 'porcao',
    isAddon: true,
    priceBalcao: 5.00,
    priceIfood: 6.50,
  },
  {
    id: 'prod-add-patty',
    name: 'Adicional: Hambúrguer 160g Extra',
    category: 'porcao',
    isAddon: true,
    priceBalcao: 9.00,
    priceIfood: 11.00,
  },
  {
    id: 'prod-add-ovo',
    name: 'Adicional: Ovo Frito na Manteiga',
    category: 'porcao',
    isAddon: true,
    priceBalcao: 3.00,
    priceIfood: 4.00,
  },
];

const mockInventory = [
  { id: 'inv-patty-180', name: 'Hambúrguer Bovino 180g', category: 'Carnes', unit: 'un', costPerUnit: 8.5, station: 'chapa' },
  { id: 'inv-bacon', name: 'Bacon Fatiado Crocante', category: 'Carnes', unit: 'kg', costPerUnit: 48.0, station: 'chapa' },
  { id: 'inv-cebola', name: 'Cebola Roxa', category: 'Hortifruti', unit: 'kg', costPerUnit: 6.0, station: 'nenhuma' },
  { id: 'inv-ovo', name: 'Ovo Frito na Manteiga', category: 'Laticínios', unit: 'un', costPerUnit: 1.2, station: 'chapa' },
  { id: 'inv-batata', name: 'Batata Palito Congelada', category: 'Porções', unit: 'kg', costPerUnit: 12.0, station: 'fritadeira_batata' },
];

// =========================================================================
// TESTES DE CUSTOMIZAÇÃO DO PDV E RECALCULO POR CANAL (Etapa 3)
// =========================================================================

test('PDV: Recalcula preços preservando comboId e adicionais estruturados com multiplicador', () => {
  const initialCartItem = {
    id: 'item-1',
    productId: 'prod-burger-brasil',
    productName: 'Burger Brasil',
    quantity: 1,
    unitPrice: 51.00, // 32 (base) + 14 (combo) + 5 (1x bacon)
    comboId: 'prod-combo-batata',
    combo: 'Combo: Batata + Bebida',
    comboPrice: 14.00,
    meatPoint: 'AO PONTO +',
    removals: ['SEM CEBOLA'],
    additionals: [
      {
        id: 'prod-add-bacon',
        name: '2x Bacon Fatiado',
        quantity: 2,
        unitPrice: 5.00,
        price: 10.00,
      },
    ],
    notes: 'CORTAR AO MEIO',
  };

  // 1. Recalcula para iFood
  const ifoodCart = recalculateCartPrices([initialCartItem], 'ifood', mockProducts);
  assert.equal(ifoodCart.length, 1);
  const ifoodItem = ifoodCart[0];

  // Preço iFood: Base 38.00 + Combo 16.50 + 2x Bacon (6.50 * 2 = 13.00) = 67.50
  assert.equal(ifoodItem.comboPrice, 16.50);
  assert.equal(ifoodItem.additionals[0].id, 'prod-add-bacon');
  assert.equal(ifoodItem.additionals[0].quantity, 2);
  assert.equal(ifoodItem.additionals[0].unitPrice, 6.50);
  assert.equal(ifoodItem.additionals[0].price, 13.00);
  assert.equal(ifoodItem.unitPrice, 67.50);

  // Campos estruturados devem ser estritamente preservados
  assert.equal(ifoodItem.comboId, 'prod-combo-batata');
  assert.equal(ifoodItem.meatPoint, 'AO PONTO +');
  assert.deepEqual(ifoodItem.removals, ['SEM CEBOLA']);
  assert.equal(ifoodItem.notes, 'CORTAR AO MEIO');

  // 2. Recalcula de volta para Balcão
  const balcaoCart = recalculateCartPrices(ifoodCart, 'balcao', mockProducts);
  const balcaoItem = balcaoCart[0];

  // Preço Balcão: Base 32.00 + Combo 14.00 + 2x Bacon (5.00 * 2 = 10.00) = 56.00
  assert.equal(balcaoItem.comboPrice, 14.00);
  assert.equal(balcaoItem.additionals[0].quantity, 2);
  assert.equal(balcaoItem.additionals[0].unitPrice, 5.00);
  assert.equal(balcaoItem.additionals[0].price, 10.00);
  assert.equal(balcaoItem.unitPrice, 56.00);
});

test('PDV: Itens brinde mantêm unitPrice zero mesmo com adicionais e combos ao mudar de canal', () => {
  const giftItem = {
    id: 'item-gift',
    productId: 'prod-burger-brasil',
    productName: 'Burger Brasil',
    quantity: 1,
    unitPrice: 0,
    originalPrice: 32.00,
    isGift: true,
    giftReason: 'cortesia_casa',
    comboId: 'prod-combo-batata',
    combo: 'Combo: Batata + Bebida',
    comboPrice: 14.00,
  };

  const recalculated = recalculateCartPrices([giftItem], 'ifood', mockProducts);
  assert.equal(recalculated[0].unitPrice, 0);
  assert.equal(recalculated[0].isGift, true);
});

test('PDV -> KDS: Motor de produção lê meatPoint, removals e additionals estruturados sem depender de regex de notas', () => {
  const item = {
    id: 'item-kds-1',
    productId: 'prod-burger-brasil',
    productName: 'Burger Brasil',
    quantity: 2, // 2 lanches
    unitPrice: 56.00,
    comboId: 'prod-combo-batata',
    combo: 'Combo: Batata + Bebida',
    meatPoint: 'AO PONTO +',
    removals: ['SEM CEBOLA'],
    additionals: [
      {
        id: 'prod-add-patty',
        name: 'Hambúrguer 160g Extra',
        quantity: 1,
        unitPrice: 9.00,
        price: 9.00,
      },
    ],
    notes: 'CORTAR AO MEIO', // Nota livre pura!
  };

  const prod = calculateItemProduction(item, mockProducts, mockInventory);

  // Ponto da carne deve ser lido diretamente de meatPoint
  assert.equal(prod.meatPoint, 'AO PONTO +');

  // Cada lanche tem 1 carne base + 1 adicional = 2 carnes por lanche
  assert.equal(prod.breakdown.basePattiesPerBurger, 1);
  assert.equal(prod.breakdown.additionalPattiesPerBurger, 1);
  assert.equal(prod.breakdown.totalPattiesPerBurger, 2);
  // Total para 2 lanches = 4 carnes
  assert.equal(prod.chapaPatties, 4);

  // Combo de Batata aciona fritadeira para 2 lanches
  assert.equal(prod.fryerBatatasCombo, 2);
});

test('PDV -> KDS: Retirada de carne (SEM CARNE) em removals reduz o total de carnes para 0', () => {
  const veggieChoiceItem = {
    id: 'item-veggie',
    productId: 'prod-burger-brasil',
    productName: 'Burger Brasil',
    quantity: 1,
    unitPrice: 32.00,
    removals: ['SEM CARNE', 'SEM BACON'],
    notes: 'CLIENTE VEGETARIANO',
  };

  const prod = calculateItemProduction(veggieChoiceItem, mockProducts, mockInventory);
  assert.equal(prod.breakdown.totalPattiesPerBurger, 0);
  assert.equal(prod.chapaPatties, 0);
});
