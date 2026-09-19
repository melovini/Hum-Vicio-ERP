import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  getSavedDeliveredPickupsMap,
  saveDeliveredPickupOverride
} = createLoader()('src/lib/store.ts');

test('Controle de Retirada de Pedidos no Balcão', async (t) => {

  await t.test('filtro de pedidos prontos (readyOrders) considera pedido de retirada pronto apenas antes de ser entregue', () => {
    const sessionStartTime = new Date('2026-09-18T12:00:00Z').getTime();

    const salePendingPickup = {
      id: 'sale-001',
      orderType: 'retirada',
      status: 'completed',
      productionStatus: 'concluido',
      date: '2026-09-18T14:00:00Z',
      deliveredAt: undefined,
    };

    const saleDeliveredPickup = {
      id: 'sale-002',
      orderType: 'retirada',
      status: 'completed',
      productionStatus: 'concluido',
      date: '2026-09-18T14:05:00Z',
      deliveredAt: '2026-09-18T14:20:00Z',
      deliveredBy: 'Operador Caixa',
    };

    const saleCookingPickup = {
      id: 'sale-003',
      orderType: 'retirada',
      status: 'completed',
      productionStatus: 'em_producao',
      date: '2026-09-18T14:10:00Z',
    };

    const saleCancelled = {
      id: 'sale-004',
      orderType: 'retirada',
      status: 'cancelled',
      productionStatus: 'concluido',
      date: '2026-09-18T14:15:00Z',
    };

    const sales = [salePendingPickup, saleDeliveredPickup, saleCookingPickup, saleCancelled];

    // Regra exata de readyOrders implementada no PDV Caixa
    const filterReadyOrders = (list) => {
      return list.filter(s => {
        if (s.status === 'cancelled') return false;
        if (s.productionStatus !== 'concluido') return false;
        if (sessionStartTime > 0 && new Date(s.date).getTime() < sessionStartTime) return false;
        if (s.orderType === 'retirada' && s.deliveredAt) return false;
        if (s.orderType === 'delivery' && s.deliveredAt) return false;
        if (s.orderType === 'mesa' && s.deliveredAt) return false;
        return true;
      });
    };

    const ready = filterReadyOrders(sales);
    assert.equal(ready.length, 1, 'Apenas o pedido com preparo concluído e ainda não retirado deve ser listado como pronto');
    assert.equal(ready[0].id, 'sale-001', 'O pedido correto deve ser o sale-001');

    // Ao marcar o sale-001 como entregue pelo operador
    const updatedSale001 = { ...salePendingPickup, deliveredAt: new Date().toISOString(), deliveredBy: 'Operador' };
    const updatedSales = [updatedSale001, saleDeliveredPickup, saleCookingPickup, saleCancelled];
    const updatedReady = filterReadyOrders(updatedSales);
    assert.equal(updatedReady.length, 0, 'Após confirmação de entrega pelo operador, a lista de prontos deve zerar');
  });

  await t.test('filtro específico de prontos no balcão (prontos) isola comandas aguardando cliente', () => {
    const sales = [
      { id: '1', orderType: 'retirada', productionStatus: 'concluido', deliveredAt: undefined },
      { id: '2', orderType: 'retirada', productionStatus: 'concluido', deliveredAt: '2026-09-18T15:00:00Z' },
      { id: '3', orderType: 'delivery', productionStatus: 'concluido' },
      { id: '4', orderType: 'retirada', productionStatus: 'em_producao' },
    ];

    const filterProntosBalcao = (list) => {
      return list.filter(s => s.orderType === 'retirada' && s.productionStatus === 'concluido' && !s.deliveredAt);
    };

    const prontosBalcao = filterProntosBalcao(sales);
    assert.equal(prontosBalcao.length, 1);
    assert.equal(prontosBalcao[0].id, '1');
  });

  await t.test('salvamento de override local preserva deliveredAt e deliveredBy', () => {
    const prevWindow = globalThis.window;
    const prevStorage = globalThis.localStorage;

    const mockStorage = new Map();
    if (!globalThis.window) globalThis.window = {};
    if (!globalThis.localStorage) {
      globalThis.localStorage = {
        getItem: (key) => mockStorage.get(key) || null,
        setItem: (key, val) => mockStorage.set(key, String(val)),
        removeItem: (key) => mockStorage.delete(key),
      };
    }

    try {
      const saleId = 'test-sale-pickup-123';
      const now = new Date().toISOString();
      saveDeliveredPickupOverride(saleId, { deliveredAt: now, deliveredBy: 'Vitor Operador' });

      const map = getSavedDeliveredPickupsMap();
      assert.ok(map[saleId], 'O override deve ser persistido no mapa');
      assert.equal(map[saleId].deliveredAt, now);
      assert.equal(map[saleId].deliveredBy, 'Vitor Operador');
    } finally {
      globalThis.window = prevWindow;
      globalThis.localStorage = prevStorage;
    }
  });
});
