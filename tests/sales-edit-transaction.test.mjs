import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { canAccessData } from '../src/lib/security/data-policy.mjs';
import { createLoader } from './load-typescript.mjs';

process.env.AUTH_SECRET = 'test-only-secret-never-used-for-production-123456789';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-private-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
process.env.APP_ORIGIN = 'https://erp.test';
globalThis.crypto ??= webcrypto;

test('Data Policy bloqueia operador caixa de manipular totais via PATCH genérico ou gravar sale_items diretamente', () => {
  // 1. Caixa tentando alterar total diretamente via PATCH /api/data/sales -> BLOQUEADO
  assert.equal(canAccessData('caixa', 'sales', 'PATCH', [{ total: 10 }]), false);
  assert.equal(canAccessData('caixa', 'sales', 'PATCH', [{ subtotal: 10 }]), false);
  assert.equal(canAccessData('caixa', 'sales', 'PATCH', [{ discount: 50 }]), false);

  // 2. Caixa atualizando campos operacionais permitidos -> PERMITIDO
  assert.equal(canAccessData('caixa', 'sales', 'PATCH', [{ production_status: 'em_preparo' }]), true);
  assert.equal(canAccessData('caixa', 'sales', 'PATCH', [{ customer_name: 'Novo Nome' }]), true);
  assert.equal(canAccessData('caixa', 'sales', 'PATCH', [{ delay_notes: 'Cliente ligou' }]), true);

  // 3. Caixa gravando ou alterando itens de venda na API genérica -> BLOQUEADO (força uso do endpoint transacional)
  assert.equal(canAccessData('caixa', 'sale_items', 'POST', [{ product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }]), false);
  assert.equal(canAccessData('caixa', 'sale_items', 'PATCH', [{ unit_price: 1 }]), false);
  assert.equal(canAccessData('caixa', 'sale_items', 'DELETE'), false);
});

test('POST /api/sales/edit valida autenticação, catálogo autoritativo, auditoria e conciliação de estoque', async () => {
  const auditLogs = [];
  const inventoryMovements = [];
  const updatedSales = [];
  const updatedSaleItems = [];
  const insertedSaleItems = [];

  const state = {
    token: undefined,
    session: {
      id: 'test-session',
      collaborator_id: 'user-001',
      collaborator_version: 'v1',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    person: {
      id: 'user-001',
      name: 'Operador Teste',
      role: 'caixa',
      is_active: true,
      updated_at: 'v1',
    },
  };

  const existingSale = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    channel: 'balcao',
    subtotal: 50,
    total: 50,
    discount: 0,
    deliveryFee: 0,
    customerName: 'Cliente Original',
    orderType: 'retirada',
    status: 'completed',
    productionStatus: 'em_espera',
    sale_items: [
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        sale_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        product_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        product_name: 'Brasil Burger',
        quantity: 1,
        unit_price: 50,
      }
    ]
  };

  const catalogProducts = [
    {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      name: 'Brasil Burger',
      category: 'hamburgueres',
      price_balcao: 50,
      price_ifood: 55,
      is_active: true,
      status: 'ativo'
    }
  ];

  const dbMock = {
    from(table) {
      return {
        select(cols) {
          return {
            eq(col, val) {
              return {
                single: async () => {
                  if (table === 'app_sessions') return { data: state.session, error: null };
                  if (table === 'collaborators') return { data: state.person, error: null };
                  if (table === 'sales') return { data: existingSale, error: null };
                  return { data: null, error: null };
                },
                order: () => Promise.resolve({ data: existingSale.sale_items })
              };
            },
            in(col, vals) {
              return Promise.resolve({ data: catalogProducts, error: null });
            },
            then(resolve) {
              if (table === 'recipes') return resolve({ data: [], error: null });
              if (table === 'inventory') return resolve({ data: [], error: null });
              if (table === 'kitchen_components') return resolve({ data: [], error: null });
              if (table === 'products') return resolve({ data: catalogProducts, error: null });
              return resolve({ data: [], error: null });
            }
          };
        },
        update(payload) {
          return {
            eq(col, val) {
              if (table === 'sales') {
                updatedSales.push({ id: val, payload });
              } else if (table === 'sale_items') {
                updatedSaleItems.push({ id: val, payload });
              }
              return Promise.resolve({ data: null, error: null });
            }
          };
        },
        insert(payload) {
          if (table === 'audit_logs') {
            auditLogs.push(payload);
          } else if (table === 'inventory_movements') {
            if (Array.isArray(payload)) inventoryMovements.push(...payload);
            else inventoryMovements.push(payload);
          } else if (table === 'sale_items') {
            if (Array.isArray(payload)) insertedSaleItems.push(...payload);
            else insertedSaleItems.push(payload);
          }
          return Promise.resolve({ data: null, error: null });
        }
      };
    }
  };

  const databaseModule = { createServerDatabase: () => dbMock };
  const load = createLoader({
    'next/headers': { cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined }) },
    '../supabase-server': databaseModule,
    '@/lib/supabase-server': databaseModule,
  });

  const sessionService = load('src/lib/session.ts');
  const route = load('src/app/api/sales/edit/route.ts');

  const makeRequest = (payload, origin = 'https://erp.test') => new Request('https://erp.test/api/sales/edit', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const validPayload = {
    saleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    customerName: 'Cliente Alterado',
    items: [
      {
        productId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        productName: 'Brasil Burger',
        quantity: 2,
        unitPrice: 50,
      }
    ],
    subtotal: 100,
    total: 100,
    discount: 0,
    editReason: 'Adicionou mais um lanche a pedido do cliente'
  };

  // 1. Sem sessão autenticada -> 401
  assert.equal((await route.POST(makeRequest(validPayload))).status, 401);

  // 2. Perfil cozinha sem permissão -> 403
  state.person.role = 'cozinha';
  state.token = await sessionService.signSessionToken('cozinha', 'Operador Cozinha', 'user-001', 'test-session');
  assert.equal((await route.POST(makeRequest(validPayload))).status, 403);

  // 3. Perfil caixa com origem externa -> 403 (proteção CSRF)
  state.person.role = 'caixa';
  state.token = await sessionService.signSessionToken('caixa', 'Operador Teste', 'user-001', 'test-session');
  assert.equal((await route.POST(makeRequest(validPayload, 'https://evil-attacker.test'))).status, 403);

  // 4. Preço adulterado pelo cliente (unitPrice = 10 em vez de 50) -> 400
  const tamperedPricePayload = {
    ...validPayload,
    items: [{ ...validPayload.items[0], unitPrice: 10 }],
    subtotal: 20,
    total: 20
  };
  assert.equal((await route.POST(makeRequest(tamperedPricePayload))).status, 400);

  // 5. Desconto concedido sem justificativa obrigatória -> 400
  const discountWithoutReasonPayload = {
    ...validPayload,
    discount: 20,
    total: 80,
    discountReason: ''
  };
  assert.equal((await route.POST(makeRequest(discountWithoutReasonPayload))).status, 400);

  // 6. Edição válida com perfil caixa -> 200 e gera diff, atualização in-place e log de auditoria no servidor
  const res = await route.POST(makeRequest(validPayload));
  assert.equal(res.status, 200);

  const resJson = await res.json();
  assert.equal(resJson.success, true);
  assert.equal(resJson.sale.total, 100);
  assert.equal(resJson.diff.added.length, 1);
  assert.equal(resJson.diff.added[0].quantity, 1);

  // Conferir atualização da tabela sales
  assert.equal(updatedSales.length, 1);
  assert.equal(updatedSales[0].id, validPayload.saleId);
  assert.equal(updatedSales[0].payload.total, 100);
  assert.equal(updatedSales[0].payload.customer_name, 'Cliente Alterado');

  // Conferir atualização in-place na tabela sale_items
  assert.equal(updatedSaleItems.length, 1);
  assert.equal(updatedSaleItems[0].id, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');
  assert.equal(updatedSaleItems[0].payload.quantity, 2);

  // Conferir auditoria confiável gravada diretamente no servidor
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, 'EDICAO_PEDIDO');
  assert.equal(auditLogs[0].operator, 'Operador Teste');
  assert.match(auditLogs[0].details, /Comanda #A0EEBC editada por Operador Teste/);
  assert.equal(auditLogs[0].value_before, 'R$ 50.00');
  assert.equal(auditLogs[0].value_after, 'R$ 100.00');
});
