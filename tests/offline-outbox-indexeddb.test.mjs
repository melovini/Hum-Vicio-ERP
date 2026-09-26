import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

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

test('Offline Outbox: migração transparente do localStorage legado e expurgo seguro', async () => {
  const outbox = createLoader()('src/lib/offline-outbox.ts');

  const legacyKey = 'hum_vicio_offline_sales_outbox';
  const legacySales = [
    {
      id: 'legacy-sale-001',
      total: 75.5,
      items: [{ productId: 'prod-1', productName: 'Smash', quantity: 2, unitPrice: 37.75 }],
      syncStatus: 'pending',
    },
    {
      id: 'legacy-sale-002',
      total: 42.0,
      items: [{ productId: 'prod-2', productName: 'Batata', quantity: 2, unitPrice: 21.0 }],
      syncStatus: 'failed',
      syncError: 'Erro no pagamento',
    }
  ];

  localStorage.setItem(legacyKey, JSON.stringify(legacySales));

  // Inicializa outbox
  await outbox.initOfflineOutbox();

  const queue = outbox.getOfflineSalesQueueSync();
  assert.equal(queue.length, 2);
  assert.equal(queue[0].id, 'legacy-sale-001');
  assert.equal(queue[1].id, 'legacy-sale-002');
  assert.equal(queue[1].syncError, 'Erro no pagamento');

  // Limpeza
  outbox.saveOfflineSalesQueue([]);
});

test('Offline Outbox: operações síncronas em memória e atualização atômica de status', () => {
  const outbox = createLoader()('src/lib/offline-outbox.ts');
  outbox.saveOfflineSalesQueue([]);

  const testSale = {
    id: 'sale-sync-test-100',
    total: 89.9,
    items: [],
  };

  // 1. Enfileirar
  outbox.enqueueOfflineSale(testSale);
  const currentQueue = outbox.getOfflineSalesQueueSync();
  assert.equal(currentQueue.length, 1);
  assert.equal(currentQueue[0].id, 'sale-sync-test-100');
  assert.equal(currentQueue[0].syncStatus, 'pending');

  // 2. Atualizar em memória imediatamente (0ms)
  outbox.updateOfflineSaleInQueue('sale-sync-test-100', {
    syncStatus: 'failed',
    syncError: 'Desconto não autorizado pelo gestor'
  });

  const updatedQueue = outbox.getOfflineSalesQueueSync();
  assert.equal(updatedQueue[0].syncStatus, 'failed');
  assert.equal(updatedQueue[0].syncError, 'Desconto não autorizado pelo gestor');

  // 3. Reconciliação / ajuste e re-envio (volta para pending)
  outbox.updateOfflineSaleInQueue('sale-sync-test-100', {
    syncStatus: 'pending',
    syncError: undefined
  });
  assert.equal(outbox.getOfflineSalesQueueSync()[0].syncStatus, 'pending');
  assert.equal(outbox.getOfflineSalesQueueSync()[0].syncError, undefined);

  // 4. Remover da fila após confirmação
  outbox.removeOfflineSaleFromQueue('sale-sync-test-100');
  assert.equal(outbox.getOfflineSalesQueueSync().length, 0);
});

test('Offline Outbox: recusa confirmação quando o armazenamento falha (proteção contra perda silenciosa)', () => {
  const outbox = createLoader()('src/lib/offline-outbox.ts');
  const original = localStorage.setItem;

  localStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };

  try {
    assert.throws(
      () => outbox.saveOfflineSalesQueue([{ id: 'overflow-sale', total: 10, items: [] }]),
      /Não foi possível salvar o pedido/
    );

    assert.throws(
      () => outbox.enqueueOfflineSale({ id: 'overflow-sale-2', total: 20, items: [] }),
      /Não foi possível salvar o pedido/
    );
  } finally {
    localStorage.setItem = original;
    outbox.saveOfflineSalesQueue([]);
  }
});
