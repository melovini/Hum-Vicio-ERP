import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  calculateCartSubtotal,
  calculateDeliveryFee,
  calculateDiscount,
  calculateCartTotal,
  calculateCashChange,
  normalizeCartItemNotes,
  calculateStoreCouponSubsidy,
  recalculateCartPrices,
} = createLoader()('src/lib/pos-financial-helpers.ts');

test('calculateCartSubtotal calcula a soma dos itens e adicionais respeitando brindes', () => {
  assert.equal(calculateCartSubtotal([]), 0);
  assert.equal(calculateCartSubtotal(null), 0);

  const items = [
    { productName: 'Burger Smash', unitPrice: 28.50, quantity: 2 },
    { productName: 'Refrigerante Lata', unitPrice: 6.00, quantity: 1 },
    { productName: 'Batata Rústica Cortesia', unitPrice: 0, quantity: 1, isGift: true, originalPrice: 15.00 },
  ];

  // 28.50 * 2 = 57.00 + 6.00 = 63.00
  assert.equal(calculateCartSubtotal(items), 63.00);
});

test('calculateDeliveryFee só aplica taxa para pedidos de delivery com sanitização', () => {
  assert.equal(calculateDeliveryFee('balcao', '10.00'), 0);
  assert.equal(calculateDeliveryFee('mesa', '10.00'), 0);
  assert.equal(calculateDeliveryFee('retirada', '10.00'), 0);

  assert.equal(calculateDeliveryFee('delivery', '7.50'), 7.50);
  assert.equal(calculateDeliveryFee('delivery', '8,90'), 8.90);
  assert.equal(calculateDeliveryFee('delivery', 12.00), 12.00);
  assert.equal(calculateDeliveryFee('delivery', '-5.00'), 0);
  assert.equal(calculateDeliveryFee('delivery', 'grátis'), 0);
  assert.equal(calculateDeliveryFee('delivery', ''), 0);
});

test('calculateDiscount lida com valores monetários e percentuais sem exceder o subtotal', () => {
  const subtotal = 100.00;

  // Valor fixo
  assert.equal(calculateDiscount('15.00', subtotal), 15.00);
  assert.equal(calculateDiscount('15,50', subtotal), 15.50);

  // Porcentagem
  assert.equal(calculateDiscount('10%', subtotal), 10.00);
  assert.equal(calculateDiscount('25%', subtotal), 25.00);
  assert.equal(calculateDiscount('12.5%', subtotal), 12.50);

  // Limite de teto (não pode exceder o subtotal)
  assert.equal(calculateDiscount('150.00', subtotal), 100.00);
  assert.equal(calculateDiscount('150%', subtotal), 100.00);

  // Casos de borda / inválidos
  assert.equal(calculateDiscount('', subtotal), 0);
  assert.equal(calculateDiscount('-10', subtotal), 0);
  assert.equal(calculateDiscount('invalido', subtotal), 0);
  assert.equal(calculateDiscount('10', 0), 0);
});

test('calculateCartTotal gera o total líquido da comanda respeitando teto zero', () => {
  // 100 subtotal - 10 desconto + 8 entrega = 98
  assert.equal(calculateCartTotal(100, 10, 8), 98.00);

  // Desconto igual ao subtotal com taxa = 8
  assert.equal(calculateCartTotal(50, 50, 8), 8.00);

  // Valores negativos ou nulos
  assert.equal(calculateCartTotal(0, 0, 0), 0);
  assert.equal(calculateCartTotal(-10, 0, 0), 0);
});

test('calculateCashChange calcula troco exato, sobra e quantia insuficiente', () => {
  const total = 42.50;

  // Valor exato
  const exact = calculateCashChange('42.50', total);
  assert.equal(exact.isEnough, true);
  assert.equal(exact.change, 0);
  assert.equal(exact.missing, 0);

  // Sobra para troco (recebeu R$ 50,00)
  const changeRes = calculateCashChange('50,00', total);
  assert.equal(changeRes.isEnough, true);
  assert.equal(changeRes.change, 7.50);
  assert.equal(changeRes.missing, 0);

  // Faltando dinheiro (recebeu R$ 40,00)
  const missingRes = calculateCashChange(40.00, total);
  assert.equal(missingRes.isEnough, false);
  assert.equal(missingRes.change, 0);
  assert.equal(missingRes.missing, 2.50);

  // Entrada inválida
  const invalidRes = calculateCashChange('abc', total);
  assert.equal(invalidRes.isEnough, false);
  assert.equal(invalidRes.missing, 42.50);
});

test('normalizeCartItemNotes converte observações para maiúsculas e remove espaços', () => {
  const cart = [
    { productName: 'Burger', unitPrice: 30, quantity: 1, notes: ' sem cebola, ponto mais passado ' },
    { productName: 'Refri', unitPrice: 8, quantity: 1 },
    { productName: 'Fritas', unitPrice: 12, quantity: 1, notes: '' },
  ];

  const normalized = normalizeCartItemNotes(cart);
  assert.equal(normalized[0].notes, 'SEM CEBOLA, PONTO MAIS PASSADO');
  assert.equal(normalized[1].notes, undefined);
  assert.equal(normalized[2].notes, undefined);
});

test('calculateStoreCouponSubsidy calcula subsídio exclusivo para canal iFood com cupom ativo', () => {
  // Não aplica se canal for balcão
  assert.equal(calculateStoreCouponSubsidy('balcao', true, '10.00'), 0);
  assert.equal(calculateStoreCouponSubsidy('balcao', true, 15), 0);

  // Não aplica se hasStoreCoupon for false
  assert.equal(calculateStoreCouponSubsidy('ifood', false, '10.00'), 0);
  assert.equal(calculateStoreCouponSubsidy('ifood', false, ''), 0);

  // Aplica corretamente no iFood
  assert.equal(calculateStoreCouponSubsidy('ifood', true, '10.00'), 10.00);
  assert.equal(calculateStoreCouponSubsidy('ifood', true, '12,50'), 12.50);
  assert.equal(calculateStoreCouponSubsidy('ifood', true, 15), 15.00);
  assert.equal(calculateStoreCouponSubsidy('ifood', true, '5'), 5.00);

  // Entradas inválidas retornam 0
  assert.equal(calculateStoreCouponSubsidy('ifood', true, ''), 0);
  assert.equal(calculateStoreCouponSubsidy('ifood', true, '-5.00'), 0);
  assert.equal(calculateStoreCouponSubsidy('ifood', true, 'invalido'), 0);
});

test('recalculateCartPrices atualiza preços de produtos, combos e adicionais entre balcão e ifood', () => {
  const products = [
    {
      id: 'prod-1',
      name: 'Smash Clássico',
      priceBalcao: 25.00,
      priceIfood: 32.00,
    },
    {
      id: 'prod-2',
      name: 'Adicional: Bacon Crispy',
      priceBalcao: 5.00,
      priceIfood: 7.00,
    },
    {
      id: 'combo-1',
      name: 'Combo: Batata + Bebida',
      category: 'combo',
      priceBalcao: 14.00,
      priceIfood: 16.00,
    },
  ];

  const cart = [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Smash Clássico',
      quantity: 1,
      unitPrice: 44.00, // 25 base + 14 combo batata + 5 bacon
      combo: 'Batata + Bebida',
      comboPrice: 14.00,
      additionals: [{ name: '1x Bacon Crispy', price: 5.00 }],
    },
    {
      id: 'item-2',
      productId: 'prod-1',
      productName: 'Smash Clássico',
      quantity: 1,
      unitPrice: 0,
      isGift: true,
      originalPrice: 25.00,
    },
  ];

  // Alternar para iFood
  const ifoodCart = recalculateCartPrices(cart, 'ifood', products);
  // Item 1: 32 base + 16 combo + 7 bacon = 55.00
  assert.equal(ifoodCart[0].unitPrice, 55.00);
  assert.equal(ifoodCart[0].comboPrice, 16.00);
  assert.equal(ifoodCart[0].additionals[0].price, 7.00);

  // Item 2 (brinde): deve permanecer 0
  assert.equal(ifoodCart[1].unitPrice, 0);

  // Alternar de volta para Balcão
  const balcaoCart = recalculateCartPrices(ifoodCart, 'balcao', products);
  assert.equal(balcaoCart[0].unitPrice, 44.00);
  assert.equal(balcaoCart[0].comboPrice, 14.00);
  assert.equal(balcaoCart[0].additionals[0].price, 5.00);
  assert.equal(balcaoCart[1].unitPrice, 0);
});
