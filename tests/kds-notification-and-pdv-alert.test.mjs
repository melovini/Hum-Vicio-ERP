import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { isValidProductionTransition } = createLoader()('src/lib/store/production-rules.ts');

// =========================================================================
// TESTES DE NOTIFICAÇÃO KDS (COZINHA) E EXPEDIÇÃO (PDV/CAIXA)
// =========================================================================

test('Transição de Produção: conclusão para concluido é válida e irreversível para chapa/espera', () => {
  // em_producao -> concluido é válido
  assert.equal(isValidProductionTransition('em_producao', 'concluido'), true);

  // concluido NÃO pode regredir para em_producao, em_espera ou agendado
  assert.equal(isValidProductionTransition('concluido', 'em_producao'), false);
  assert.equal(isValidProductionTransition('concluido', 'em_espera'), false);
  assert.equal(isValidProductionTransition('concluido', 'agendado'), false);
});

test('Precedência de Override: override local "concluido" sobrevive ao polling com status antigo "em_producao"', () => {
  // Simula o mecanismo exato implementado em executePollCycle / loadSales
  const overrides = {
    'sale_001': { status: 'concluido', startedAt: '2026-09-17T18:00:00.000Z' }
  };
  let overridesCleaned = false;

  // Servidor remoto ainda devolve 'em_producao' por latência/em voo
  const remoteSale = {
    id: 'sale_001',
    production_status: 'em_producao',
    production_started_at: '2026-09-17T18:00:00.000Z'
  };

  const override = overrides[remoteSale.id];
  let prodStatus;
  if (override) {
    if (remoteSale.production_status === override.status || (override.status !== 'concluido' && remoteSale.production_status === 'concluido')) {
      prodStatus = remoteSale.production_status || override.status;
      delete overrides[remoteSale.id];
      overridesCleaned = true;
    } else {
      prodStatus = override.status;
    }
  } else {
    prodStatus = remoteSale.production_status || 'em_producao';
  }

  // O status mapeado DEVE ser 'concluido' (o override local prevalece)
  assert.equal(prodStatus, 'concluido', 'Status deve permanecer concluído');
  // O override NÃO deve ter sido deletado prematuramente
  assert.equal(overridesCleaned, false, 'Override não deve ser limpo enquanto o servidor estiver desatualizado');
  assert.ok(overrides['sale_001'], 'Override permanece guardado para os próximos polls');
});

test('Limpeza de Override: override é removido apenas quando o servidor remoto confirmar "concluido"', () => {
  const overrides = {
    'sale_001': { status: 'concluido', startedAt: '2026-09-17T18:00:00.000Z' }
  };
  let overridesCleaned = false;

  // Servidor agora confirma que o status no banco é 'concluido'
  const remoteSale = {
    id: 'sale_001',
    production_status: 'concluido',
    production_completed_at: '2026-09-17T18:15:00.000Z'
  };

  const override = overrides[remoteSale.id];
  let prodStatus;
  if (override) {
    if (remoteSale.production_status === override.status || (override.status !== 'concluido' && remoteSale.production_status === 'concluido')) {
      prodStatus = remoteSale.production_status || override.status;
      delete overrides[remoteSale.id];
      overridesCleaned = true;
    } else {
      prodStatus = override.status;
    }
  } else {
    prodStatus = remoteSale.production_status || 'em_producao';
  }

  assert.equal(prodStatus, 'concluido');
  assert.equal(overridesCleaned, true, 'Override agora deve ser limpo');
  assert.equal(overrides['sale_001'], undefined, 'Chave de override removida com sucesso');
});

test('Filtro KDS: pedidos já concluídos (completedOrderIdsRef) nunca disparam alerta de "Nova Remessa na Chapa"', () => {
  const completedOrderIds = new Set(['sale_001', 'sale_002']);
  const prevProductionIds = new Set(['sale_003']);

  // Suponha que por qualquer oscilação ou re-render um pedido concluído seja inspecionado
  const currentProductionIds = new Set(['sale_001', 'sale_003', 'sale_004']);
  const sales = [
    { id: 'sale_001', customerName: 'João', productionStatus: 'concluido' },
    { id: 'sale_003', customerName: 'Maria', productionStatus: 'em_producao' },
    { id: 'sale_004', customerName: 'Carlos', productionStatus: 'em_producao' }
  ];

  const newlyAddedOrders = [];
  currentProductionIds.forEach(id => {
    // Algoritmo implementado na cozinha:
    if (!prevProductionIds.has(id) && !completedOrderIds.has(id)) {
      const found = sales.find(s => s.id === id);
      if (found) newlyAddedOrders.push(found);
    }
  });

  // sale_001 NÃO deve entrar em newlyAddedOrders porque está em completedOrderIds!
  assert.equal(newlyAddedOrders.length, 1, 'Apenas o pedido realmente novo deve ser notificado');
  assert.equal(newlyAddedOrders[0].id, 'sale_004', 'Apenas sale_004 é nova remessa');
  assert.equal(newlyAddedOrders.some(o => o.id === 'sale_001'), false, 'Pedido concluído jamais entra como nova remessa');
});

test('PDV Monitoramento: detecta transição para "concluido" e gera notificação de expedição/balcão', () => {
  // Estado anterior de pedidos concluídos conhecidos pelo PDV
  const prevCompletedOrderIds = new Set(['sale_old']);

  // Nova lista de vendas recebida após conclusão na cozinha
  const sales = [
    { id: 'sale_old', customerName: 'Cliente Antigo', orderType: 'mesa', productionStatus: 'concluido', date: '2026-09-17T18:00:00.000Z' },
    { id: 'sale_cook', customerName: 'Ana Souza', orderType: 'retirada', productionStatus: 'concluido', date: '2026-09-17T18:10:00.000Z' },
    { id: 'sale_delivery', customerName: 'Marcos Lima', orderType: 'delivery', productionStatus: 'concluido', date: '2026-09-17T18:12:00.000Z' },
    { id: 'sale_wait', customerName: 'Pedro', orderType: 'balcao', productionStatus: 'em_espera', date: '2026-09-17T18:14:00.000Z' }
  ];

  const currentCompletedIds = new Set(
    sales.filter(s => s.productionStatus === 'concluido').map(s => s.id)
  );

  const newlyReadyOrders = [];
  currentCompletedIds.forEach(id => {
    if (!prevCompletedOrderIds.has(id)) {
      const found = sales.find(s => s.id === id);
      if (found) newlyReadyOrders.push(found);
    }
  });

  assert.equal(newlyReadyOrders.length, 2, 'Dois novos pedidos foram concluídos pela cozinha');
  assert.equal(newlyReadyOrders[0].id, 'sale_cook');
  assert.equal(newlyReadyOrders[1].id, 'sale_delivery');

  // Verificar formatação das mensagens do PDV
  const formatLabel = order => 
    order.orderType === 'retirada' ? '🥡 BALCÃO / RETIRADA' :
    order.orderType === 'delivery' ? '🛵 EXPEDIÇÃO / DELIVERY' :
    '🍽️ SALÃO / MESA';

  assert.equal(formatLabel(newlyReadyOrders[0]), '🥡 BALCÃO / RETIRADA');
  assert.equal(formatLabel(newlyReadyOrders[1]), '🛵 EXPEDIÇÃO / DELIVERY');
});

test('PDV Montagem Inicial: pedidos preexistentes não disparam alertas falsos na carga do PDV', () => {
  const sales = [
    { id: 'sale_prev1', customerName: 'Cliente 1', productionStatus: 'concluido' },
    { id: 'sale_prev2', customerName: 'Cliente 2', productionStatus: 'concluido' }
  ];

  let isInitialReadyMount = true;
  let prevCompletedOrderIds = new Set();
  const alertEvents = [];

  // Simulação do efeito no PDV na primeira montagem
  const currentCompletedIds = new Set(
    sales.filter(s => s.productionStatus === 'concluido').map(s => s.id)
  );

  if (isInitialReadyMount) {
    isInitialReadyMount = false;
    prevCompletedOrderIds = currentCompletedIds;
  } else {
    currentCompletedIds.forEach(id => {
      if (!prevCompletedOrderIds.has(id)) {
        alertEvents.push(id);
      }
    });
  }

  assert.equal(alertEvents.length, 0, 'Montagem inicial não gera alertas falsos');
  assert.equal(prevCompletedOrderIds.size, 2, 'Pedidos preexistentes foram absorvidos na referência');
});
