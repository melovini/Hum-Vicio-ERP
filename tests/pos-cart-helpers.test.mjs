import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  generateCartItemId,
  isProductRequiringMeatPoint,
  createCartItemFromProduct,
  computeCartItemSignature,
  addOrMergeCartItem,
  splitCartItem,
  updateCartItemInList,
  removeCartItemFromList,
} = createLoader()('src/lib/pos-cart-helpers.ts');

const mockProducts = {
  burgerBovino: {
    id: 'prod-burger-bovino',
    name: 'Burger Bovino 180g',
    category: 'lanche',
    priceBalcao: 30.00,
    priceIfood: 36.00,
    recipe: [],
    requiresMeatPoint: true,
    defaultMeatPoint: 'AO PONTO',
  },
  burgerFrango: {
    id: 'prod-burger-frango',
    name: 'Burger de Frango Crocante',
    category: 'lanche',
    priceBalcao: 28.00,
    priceIfood: 34.00,
    recipe: [],
    requiresMeatPoint: false,
  },
  comboBatata: {
    id: 'prod-combo-batata',
    name: 'Combo: Batata + Bebida',
    category: 'combo',
    priceBalcao: 14.00,
    priceIfood: 16.00,
    recipe: [],
  },
  batataPorcao: {
    id: 'prod-batata-media',
    name: 'Batata Frita Média',
    category: 'porcao',
    priceBalcao: 18.00,
    priceIfood: 22.00,
    recipe: [],
  },
};

test('pos-cart-helpers: createCartItemFromProduct cria item simples e combo com IDs estáveis e preços corretos', () => {
  // 1. Simples Balcão
  const simpleItem = createCartItemFromProduct(mockProducts.burgerBovino, 'balcao', { mode: 'simples' });
  assert.ok(simpleItem.id, 'Deve possuir ID estável');
  assert.equal(simpleItem.productId, 'prod-burger-bovino');
  assert.equal(simpleItem.unitPrice, 30.00);
  assert.equal(simpleItem.meatPoint, 'AO PONTO');
  assert.equal(simpleItem.comboId, undefined);

  // 2. Combo iFood
  const comboItem = createCartItemFromProduct(mockProducts.burgerBovino, 'ifood', {
    mode: 'combo',
    comboProduct: mockProducts.comboBatata,
  });
  assert.ok(comboItem.id);
  assert.equal(comboItem.productId, 'prod-burger-bovino');
  // 36 (burger iFood) + 16 (combo iFood) = 52.00
  assert.equal(comboItem.unitPrice, 52.00);
  assert.equal(comboItem.comboId, 'prod-combo-batata');
  assert.equal(comboItem.comboPrice, 16.00);

  // 3. Item que não requer ponto da carne (frango)
  const chickenItem = createCartItemFromProduct(mockProducts.burgerFrango, 'balcao');
  assert.equal(chickenItem.meatPoint, undefined);

  // 4. Porção avulsa não requer ponto
  const friesItem = createCartItemFromProduct(mockProducts.batataPorcao, 'balcao');
  assert.equal(friesItem.meatPoint, undefined);
  assert.equal(friesItem.unitPrice, 18.00);
});

test('pos-cart-helpers: computeCartItemSignature é determinística e insensível à ordem de adicionais e retiradas', () => {
  const itemA = {
    productId: 'prod-burger-bovino',
    productName: 'Burger Bovino 180g',
    quantity: 1,
    unitPrice: 35.00,
    meatPoint: 'AO PONTO',
    removals: ['SEM CEBOLA', 'SEM TOMATE'],
    additionals: [
      { id: 'add-bacon', name: 'Bacon', quantity: 1, unitPrice: 5.00 },
      { id: 'add-queijo', name: 'Queijo', quantity: 2, unitPrice: 4.00 },
    ],
  };

  const itemB = {
    productId: 'prod-burger-bovino',
    productName: 'Burger Bovino 180g',
    quantity: 1,
    unitPrice: 35.00,
    meatPoint: 'AO PONTO',
    removals: ['SEM TOMATE', 'SEM CEBOLA'], // Ordem invertida
    additionals: [
      { id: 'add-queijo', name: 'Queijo', quantity: 2, unitPrice: 4.00 }, // Ordem invertida
      { id: 'add-bacon', name: 'Bacon', quantity: 1, unitPrice: 5.00 },
    ],
  };

  assert.equal(computeCartItemSignature(itemA), computeCartItemSignature(itemB));

  // Modificação de ponto produz assinatura distinta
  const itemDifferentPoint = { ...itemA, meatPoint: 'BEM PASSADO' };
  assert.notEqual(computeCartItemSignature(itemA), computeCartItemSignature(itemDifferentPoint));

  // Item brinde produz assinatura distinta
  const itemGift = { ...itemA, isGift: true, giftReason: 'cortesia_casa' };
  assert.notEqual(computeCartItemSignature(itemA), computeCartItemSignature(itemGift));
});

test('pos-cart-helpers: addOrMergeCartItem agrupa múltiplos cliques idênticos sem misturar itens personalizados ou brindes', () => {
  let cart = [];

  const item1 = createCartItemFromProduct(mockProducts.burgerBovino, 'balcao', { mode: 'simples' });
  cart = addOrMergeCartItem(cart, item1);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 1);

  // Segundo clique idêntico soma quantidade
  const item2 = createCartItemFromProduct(mockProducts.burgerBovino, 'balcao', { mode: 'simples' });
  cart = addOrMergeCartItem(cart, item2);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 2);

  // Terceiro clique idêntico soma quantidade
  const item3 = createCartItemFromProduct(mockProducts.burgerBovino, 'balcao', { mode: 'simples' });
  cart = addOrMergeCartItem(cart, item3);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 3);

  // Item com ponto diferente cria uma nova linha
  const itemDifferentPoint = {
    ...createCartItemFromProduct(mockProducts.burgerBovino, 'balcao', { mode: 'simples' }),
    meatPoint: 'BEM PASSADO',
  };
  cart = addOrMergeCartItem(cart, itemDifferentPoint);
  assert.equal(cart.length, 2);
  assert.equal(cart[0].quantity, 3);
  assert.equal(cart[1].quantity, 1);
  assert.equal(cart[1].meatPoint, 'BEM PASSADO');

  // Item brinde nunca se agrupa com item comercial normal
  const itemGift = {
    ...createCartItemFromProduct(mockProducts.burgerBovino, 'balcao', { mode: 'simples' }),
    isGift: true,
    giftReason: 'cortesia_casa',
    unitPrice: 0,
    originalPrice: 30.00,
  };
  cart = addOrMergeCartItem(cart, itemGift);
  assert.equal(cart.length, 3);
  assert.equal(cart[2].isGift, true);
});

test('pos-cart-helpers: splitCartItem desmembra 1 unidade preservando as restantes e gerando novo ID', () => {
  const originalItem = {
    id: 'original-id-123',
    productId: 'prod-burger-bovino',
    productName: 'Burger Bovino 180g',
    quantity: 3,
    unitPrice: 30.00,
    meatPoint: 'AO PONTO',
  };

  const { remaining, extracted } = splitCartItem(originalItem, 1);

  assert.equal(remaining.id, 'original-id-123', 'Item restante preserva o ID original');
  assert.equal(remaining.quantity, 2, 'Item restante tem quantidade subtraída');

  assert.notEqual(extracted.id, 'original-id-123', 'Unidade extraída ganha novo ID estável');
  assert.equal(extracted.quantity, 1, 'Unidade extraída tem quantidade 1');
  assert.equal(extracted.productId, 'prod-burger-bovino');
  assert.equal(extracted.meatPoint, 'AO PONTO');
});

test('pos-cart-helpers: updateCartItemInList e removeCartItemFromList operam de forma pura pelo ID', () => {
  const initialCart = [
    { id: 'id-1', productName: 'Item 1', quantity: 2, unitPrice: 10 },
    { id: 'id-2', productName: 'Item 2', quantity: 1, unitPrice: 20 },
  ];

  const updatedCart = updateCartItemInList(initialCart, 'id-1', {
    ...initialCart[0],
    notes: 'OBS ATUALIZADA',
  });

  assert.equal(updatedCart.length, 2);
  assert.equal(updatedCart[0].notes, 'OBS ATUALIZADA');
  assert.equal(initialCart[0].notes, undefined, 'Não deve mutar o array original');

  const removedCart = removeCartItemFromList(updatedCart, 'id-2');
  assert.equal(removedCart.length, 1);
  assert.equal(removedCart[0].id, 'id-1');
});
