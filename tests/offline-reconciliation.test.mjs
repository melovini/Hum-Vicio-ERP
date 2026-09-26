import test from 'node:test';
import assert from 'node:assert/strict';

test('Reconciliação Offline: detecção de divergência contra catálogo oficial', () => {
  const catalogProducts = [
    { id: 'prod-burger-1', name: 'Smash Burger', price: 32.0, active: true },
    { id: 'prod-fries-1', name: 'Batata Rústica', price: 18.0, active: true },
    { id: 'prod-soda-1', name: 'Refrigerante Lata', price: 8.0, active: false }, // inativo
  ];

  const rejectedSale = {
    id: 'sale-offline-rej-001',
    date: '2026-09-26T12:00:00Z',
    items: [
      { productId: 'prod-burger-1', productName: 'Smash Burger', quantity: 2, unitPrice: 28.0 }, // Divergência de preço: 28 vs 32
      { productId: 'prod-fries-1', productName: 'Batata Rústica', quantity: 1, unitPrice: 18.0 },  // Preço idêntico
      { productId: 'prod-soda-1', productName: 'Refrigerante Lata', quantity: 2, unitPrice: 7.0 },  // Produto inativo
      { productId: 'prod-unknown-9', productName: 'Sobremesa Antiga', quantity: 1, unitPrice: 15.0 }, // Produto inexistente
    ],
    subtotal: 96.0,
    discount: 0,
    total: 96.0,
    syncStatus: 'failed',
    syncError: 'Catálogo divergente ou item inativo detectado pelo servidor',
  };

  const productMap = new Map(catalogProducts.map(p => [p.id, p]));

  // Função pura que espelha a análise do modal OfflineReconciliationModal
  const analyzeItem = (item) => {
    const catalogItem = productMap.get(item.productId);
    const catalogPrice = catalogItem ? Number(catalogItem.price) : null;
    const isUnavailable = !catalogItem || catalogItem.active === false;
    const isPriceDivergent = catalogPrice !== null && Math.abs(catalogPrice - item.unitPrice) > 0.01;
    return {
      productId: item.productId,
      originalPrice: item.unitPrice,
      catalogPrice,
      isUnavailable,
      isPriceDivergent,
    };
  };

  const analyses = rejectedSale.items.map(analyzeItem);

  // Validações
  assert.equal(analyses[0].isPriceDivergent, true, 'Smash Burger deve apontar divergência de preço');
  assert.equal(analyses[0].catalogPrice, 32.0);
  assert.equal(analyses[0].isUnavailable, false);

  assert.equal(analyses[1].isPriceDivergent, false, 'Batata deve ter preço idêntico');
  assert.equal(analyses[1].isUnavailable, false);

  assert.equal(analyses[2].isUnavailable, true, 'Refrigerante Lata inativo deve ser marcado como indisponível');
  assert.equal(analyses[3].isUnavailable, true, 'Produto não cadastrado no catálogo deve ser marcado como indisponível');
});

test('Reconciliação Offline: atualização de preços pelo catálogo oficial preserva ID e recalcula totais', () => {
  const rejectedSale = {
    id: 'sale-offline-rej-002',
    date: '2026-09-26T12:00:00Z',
    items: [
      { productId: 'p1', productName: 'Smash Clássico', quantity: 2, unitPrice: 25.0 }, // Cobrado 25, catálogo é 30
      { productId: 'p2', productName: 'Milkshake', quantity: 1, unitPrice: 15.0 },     // Cobrado 15, catálogo é 20
    ],
    subtotal: 65.0,
    discount: 5.0,
    deliveryFee: 0,
    total: 60.0,
    syncStatus: 'failed',
  };

  const catalogPrices = {
    p1: 30.0,
    p2: 20.0,
  };

  // Aplica preço oficial
  const updatedItems = rejectedSale.items.map(it => ({
    ...it,
    unitPrice: catalogPrices[it.productId] ?? it.unitPrice,
  }));

  const newSubtotal = updatedItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
  const newTotal = Math.max(0, newSubtotal - rejectedSale.discount + (rejectedSale.deliveryFee || 0));

  const resolvedSale = {
    ...rejectedSale,
    items: updatedItems,
    subtotal: newSubtotal,
    total: newTotal,
    syncStatus: 'pending',
    syncError: undefined,
  };

  // Garante imutabilidade da identidade da venda
  assert.equal(resolvedSale.id, rejectedSale.id, 'O ID da venda deve permanecer estritamente idêntico');
  // Verifica novos totais
  assert.equal(newSubtotal, 80.0, '2*30 + 1*20 = 80');
  assert.equal(newTotal, 75.0, '80 - 5 = 75');
  assert.equal(resolvedSale.syncStatus, 'pending');
  assert.equal(resolvedSale.syncError, undefined);
});

test('Reconciliação Offline: manter valor cobrado gera desconto de contingência com justificativa auditável', () => {
  const rejectedSale = {
    id: 'sale-offline-rej-003',
    date: '2026-09-26T12:00:00Z',
    items: [
      { productId: 'p1', productName: 'Smash Duplo', quantity: 1, unitPrice: 30.0 }, // Cobrado 30, mas no catálogo subiu para 35
    ],
    subtotal: 30.0,
    discount: 0,
    deliveryFee: 5.0,
    total: 35.0, // Cliente pagou 35 no PDV offline
    syncStatus: 'failed',
  };

  const catalogPrice = 35.0; // Novo preço oficial

  // Atualiza para o preço oficial
  const updatedItems = [{ ...rejectedSale.items[0], unitPrice: catalogPrice }];
  const officialSubtotal = updatedItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0); // 35.0
  const expectedTotalBeforeDiscount = officialSubtotal + rejectedSale.deliveryFee; // 40.0

  // Operador opta por manter o total cobrado originalmente (35.0) para não lesar o cliente
  const originalChargedTotal = rejectedSale.total; // 35.0
  const contingencyDiscount = Math.max(0, expectedTotalBeforeDiscount - originalChargedTotal); // 40.0 - 35.0 = 5.0
  const justification = 'Ajuste de divergência de catálogo na contingência offline: cliente cobrado por preço anterior';

  const resolvedSale = {
    ...rejectedSale,
    items: updatedItems,
    subtotal: officialSubtotal,
    discount: contingencyDiscount,
    discountReason: justification,
    total: expectedTotalBeforeDiscount - contingencyDiscount,
    syncStatus: 'pending',
    syncError: undefined,
  };

  assert.equal(resolvedSale.id, rejectedSale.id);
  assert.equal(resolvedSale.total, 35.0, 'Total final deve ser idêntico ao cobrado do cliente');
  assert.equal(resolvedSale.discount, 5.0, 'Desconto de contingência deve absorver a diferença');
  assert.ok(resolvedSale.discountReason.includes('contingência offline'));
});

test('Reconciliação Offline: descarte de pedido rejeitado exige justificativa e gera ação de auditoria', () => {
  let offlineQueue = [
    { id: 'sale-rej-discard-1', total: 50.0, syncStatus: 'failed' },
    { id: 'sale-pending-2', total: 30.0, syncStatus: 'pending' },
  ];

  const auditLogs = [];

  const discardRejectedOfflineSale = (saleId, reason, operator = 'Caixa Central') => {
    if (!reason || !reason.trim()) {
      throw new Error('Motivo do descarte é obrigatório');
    }
    offlineQueue = offlineQueue.filter(s => s.id !== saleId);
    auditLogs.push({
      action: 'DESCARTE_VENDA_REJEITADA',
      details: `Pedido rejeitado #${saleId.slice(0, 8)} descartado da contingência offline. Motivo: ${reason}`,
      operator,
      timestamp: new Date().toISOString(),
    });
  };

  // Tentativa sem motivo deve falhar
  assert.throws(() => {
    discardRejectedOfflineSale('sale-rej-discard-1', '');
  }, /Motivo do descarte é obrigatório/);

  // Descarte com motivo válido
  discardRejectedOfflineSale('sale-rej-discard-1', 'Venda duplicada pelo operador no balcão', 'Operador João');

  assert.equal(offlineQueue.length, 1);
  assert.equal(offlineQueue[0].id, 'sale-pending-2');
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, 'DESCARTE_VENDA_REJEITADA');
  assert.equal(auditLogs[0].operator, 'Operador João');
  assert.ok(auditLogs[0].details.includes('Venda duplicada'));
});
