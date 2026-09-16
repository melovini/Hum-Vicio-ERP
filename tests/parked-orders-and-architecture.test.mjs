import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

// Mock de localStorage e window para execução em Node
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new LocalStorageMock();
globalThis.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

const load = createLoader();
const { 
  getParkedDrafts, saveParkedDraft, createNewParkedDraft, 
  deleteParkedDraft, getActiveDraftId, setActiveDraftId,
  createDefaultDraft 
} = load('src/lib/parked-orders.ts');

const { 
  isValidProductionTransition 
} = load('src/lib/store/production-rules.ts');

const { 
  calculateDenominationsTotal, computeCashClosingVariances 
} = load('src/lib/store/cash-operations.ts');

test('Múltiplos atendimentos (Parked Orders): preserva atendimento online e atende cliente presencial', () => {
  localStorage.clear();

  // 1. Atendente começa a registrar pedido online (WhatsApp / iFood)
  const onlineDraft = createDefaultDraft('ifood', 1);
  onlineDraft.customerName = 'Carlos WhatsApp';
  onlineDraft.cart = [
    { productId: 'burg_1', productName: 'Hum Vício Burger', quantity: 2, unitPrice: 34.0 }
  ];
  onlineDraft.deliveryFeeInput = '8.00';
  saveParkedDraft(onlineDraft);
  setActiveDraftId(onlineDraft.id);

  assert.equal(getParkedDrafts().length, 1);
  assert.equal(getActiveDraftId(), onlineDraft.id);

  // 2. Cliente presencial chega no balcão: atendente cria novo atendimento paralelo
  const counterDraft = createNewParkedDraft('balcao', 'Cliente Balcão');
  counterDraft.cart = [
    { productId: 'refri_1', productName: 'Refrigerante Lata', quantity: 1, unitPrice: 7.0 }
  ];
  saveParkedDraft(counterDraft);

  // Deve haver 2 atendimentos em aberto
  const openDrafts = getParkedDrafts();
  assert.equal(openDrafts.length, 2);
  assert.equal(getActiveDraftId(), counterDraft.id);

  // 3. Finaliza a venda presencial: exclui o counterDraft e recupera o onlineDraft
  const nextActiveId = deleteParkedDraft(counterDraft.id);
  assert.equal(nextActiveId, onlineDraft.id);

  const remaining = getParkedDrafts();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, onlineDraft.id);
  assert.equal(remaining[0].customerName, 'Carlos WhatsApp');
  assert.equal(remaining[0].cart.length, 1);
  assert.equal(remaining[0].cart[0].productName, 'Hum Vício Burger');
});

test('Transições de Produção KDS: bloqueia regressão de concluídos e pedidos cancelados', () => {
  // Transições válidas
  assert.equal(isValidProductionTransition('em_espera', 'em_producao', false), true);
  assert.equal(isValidProductionTransition('em_producao', 'concluido', false), true);
  assert.equal(isValidProductionTransition('em_espera', 'agendado', false), true);

  // Regressão bloqueada
  assert.equal(isValidProductionTransition('concluido', 'em_producao', false), false);
  assert.equal(isValidProductionTransition('concluido', 'em_espera', false), false);

  // Cancelados bloqueados
  assert.equal(isValidProductionTransition('em_espera', 'em_producao', true), false);
  assert.equal(isValidProductionTransition('em_producao', 'concluido', true), false);
});

test('Calculadora de Cédulas e Conferência Cega: calcula valores exatos e quebras', () => {
  const denominations = {
    bill100: 2, // 200
    bill50: 1,  // 50
    bill20: 3,  // 60
    bill10: 1,  // 10
    bill5: 2,   // 10
    bill2: 5,   // 10
    coin1: 10,  // 10
    coin050: 4, // 2
    coin025: 4, // 1
    coin010: 10,// 1
    coin005: 0
  };

  const total = calculateDenominationsTotal(denominations);
  assert.equal(total, 354.00);

  const closing = computeCashClosingVariances({
    countedCash: 354.00,
    expectedCash: 350.00,
    countedDebito: 120.00,
    expectedDebito: 120.00,
    countedCredito: 250.00,
    expectedCredito: 260.00,
    countedPix: 90.00,
    expectedPix: 90.00,
  });

  assert.equal(closing.varianceCash, 4.00); // Sobra de R$ 4 em dinheiro
  assert.equal(closing.varianceCredito, -10.00); // Falta de R$ 10 no cartão
  assert.equal(closing.varianceTotal, -6.00); // Diferença total líquida
});
