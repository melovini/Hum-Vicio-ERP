import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHmac } from 'node:crypto';
import { credentialAllowed, hashCredential, verifyCredential } from '../src/lib/security/credentials.mjs';
import { canAccessData, safeSelection } from '../src/lib/security/data-policy.mjs';
import { validateCustomers } from '../src/lib/security/customer-validation.mjs';
import { createLoader } from './load-typescript.mjs';

process.env.AUTH_SECRET = 'test-only-secret-never-used-for-production-123456789';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-private-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
process.env.APP_ORIGIN = 'https://erp.test';
globalThis.crypto ??= webcrypto;

test('senhas são salgadas, verificadas e nunca aceitam texto puro', async () => {
  const first = await hashCredential('credencial-segura');
  const second = await hashCredential('credencial-segura');
  assert.notEqual(first, second);
  assert.equal(await verifyCredential('credencial-segura', first), true);
  assert.equal(await verifyCredential('senha-errada', first), false);
  assert.equal(await verifyCredential('admin', 'admin'), false);
  assert.equal(await verifyCredential('x', 'scrypt$invalid$hash'), false);
  for (const password of ['admin', '0000', '1234', '5678', '', 'abcdef']) assert.equal(credentialAllowed(password, 'admin'), false);
  assert.equal(credentialAllowed('827491', 'caixa'), true);
});

test('perfis operacionais não podem obter credenciais, auditoria ou alterar privilégios', () => {
  for (const role of ['admin', 'gerente', 'caixa', 'cozinha']) {
    for (const table of ['collaborators', 'app_sessions', 'auth_attempts', 'rpc']) {
      assert.equal(canAccessData(role, table, 'GET'), false);
      assert.equal(canAccessData(role, table, 'POST', [{ role: 'admin' }]), false);
    }
    assert.equal(canAccessData(role, 'sales', 'DELETE'), false);
    assert.equal(canAccessData(role, 'audit_logs', 'PATCH', [{ operator: 'outro' }]), false);
    assert.equal(canAccessData(role, 'imported_customers', 'POST', [{}]), false);
  }
  assert.equal(canAccessData('caixa', 'audit_logs', 'GET'), false);
  assert.equal(canAccessData('gerente', 'collaborator_diarias', 'GET'), false);
  assert.equal(canAccessData('cozinha', 'cash_movements', 'GET'), false);
  assert.equal(canAccessData('admin', 'audit_logs', 'GET'), true);
  assert.equal(canAccessData('cozinha', 'sales', 'PATCH', [{ production_status: 'concluido' }]), true);
  assert.equal(canAccessData('cozinha', 'sales', 'PATCH', [{ total: 0 }]), false);
  assert.equal(canAccessData('caixa', 'sales', 'PATCH', [{ deleted_at: new Date().toISOString() }]), false);
  assert.equal(canAccessData('gerente', 'sale_items', 'POST', [{ sale_id: null }]), false);
  assert.equal(canAccessData('caixa', 'inventory', 'PATCH', [{ current_stock: 4 }]), true);
  assert.equal(canAccessData('caixa', 'inventory', 'PATCH', [{ cost_per_unit: 0 }]), false);
  for (const value of ['*,collaborators(*)', 'secret:collaborators(pin)', '*,app_sessions!inner(*)']) assert.equal(safeSelection(value), false);
  assert.equal(safeSelection('*'), true);
  assert.equal(safeSelection('id,name'), true);
});

test('importação rejeita dados inválidos e remove campos não permitidos', () => {
  assert.throws(() => validateCustomers([]));
  assert.throws(() => validateCustomers([{ id: 'x', name: 'Cliente', totalOrders: -1 }]));
  assert.throws(() => validateCustomers([{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }]));
  assert.throws(() => validateCustomers([{ id: 'x', name: 'A', phone: 123 }]));
  const [customer] = validateCustomers([{ id: 'x', name: ' Cliente ', role: 'admin', pin: 'secret' }]);
  assert.equal(customer.name, 'Cliente');
  assert.equal('pin' in customer, false);
});

function sessionFixture(role = 'caixa') {
  const state = { token: undefined, unavailable: false,
    session: { id: 'test-session', collaborator_id: 'operator', collaborator_version: 'v1',
      expires_at: new Date(Date.now() + 3600_000).toISOString(), last_seen_at: new Date().toISOString(), revoked_at: null },
    person: { id: 'operator', name: 'Operador', role, is_active: true, updated_at: 'v1' },
  };
  const db = { from(table) {
    return { select() { return this; }, eq() { return this; }, async single() {
      return { data: table === 'app_sessions' ? state.session : state.person, error: state.unavailable ? new Error('offline') : null };
    } };
  } };
  const databaseModule = { createServerDatabase: () => db };
  const load = createLoader({
    'next/headers': { cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined }) },
    '../supabase-server': databaseModule,
    '@/lib/supabase-server': databaseModule,
  });
  return { state, load, async sign() { state.token = await load('src/lib/session.ts').signSessionToken(role, 'Operador', 'operator', 'test-session'); } };
}

test('assinatura rejeita tokens antigos, adulterados, expirados e configuração insegura', async () => {
  const { load } = sessionFixture();
  const tokens = load('src/lib/session.ts');
  const token = await tokens.signSessionToken('caixa', 'Operador', 'operator', 'test-session');
  assert.equal((await tokens.verifySessionToken(token)).valid, true);
  assert.equal((await tokens.verifySessionToken('x' + token)).valid, false);
  assert.equal((await tokens.verifySessionToken('invalid')).valid, false);
  for (const payload of [
    { role: 'admin', iat: 1, exp: 9999999999 },
    { version: 2, role: 'unknown', collaboratorId: 'operator', sessionId: 'test-session', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
    { version: 2, role: 'admin', collaboratorId: 'operator', sessionId: 'test-session', iat: Math.floor(Date.now() / 1000) },
  ]) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', process.env.AUTH_SECRET).update(encoded).digest('base64url');
    assert.equal((await tokens.verifySessionToken(encoded + '.' + signature)).valid, false);
  }
  const secret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'hum-vicio-erp-security-signature-key-prod-2026';
  assert.equal((await tokens.verifySessionToken(token)).valid, false);
  await assert.rejects(tokens.signSessionToken('admin', 'A', 'x', 'y'));
  process.env.AUTH_SECRET = secret;
  const realNow = Date.now;
  Date.now = () => realNow() + 9 * 3600_000;
  try { assert.equal((await tokens.verifySessionToken(token)).valid, false); } finally { Date.now = realNow; }
});

test('sessões desativadas, revogadas, alteradas, ociosas e sem banco falham fechadas', async () => {
  const { state, load, sign } = sessionFixture();
  const { requireSession } = load('src/lib/security/server-session.ts');
  await assert.rejects(requireSession(), error => error.status === 401);
  await sign();
  assert.equal((await requireSession(['caixa'])).role, 'caixa');
  await assert.rejects(requireSession(['admin']), error => error.status === 403);
  state.person.is_active = false;
  await assert.rejects(requireSession(), error => error.status === 401);
  state.person.is_active = true;
  state.person.updated_at = 'v2';
  await assert.rejects(requireSession(), error => error.status === 401);
  state.person.updated_at = 'v1';
  state.session.revoked_at = new Date().toISOString();
  await assert.rejects(requireSession(), error => error.status === 401);
  state.session.revoked_at = null;
  state.session.last_seen_at = new Date(Date.now() - 31 * 60_000).toISOString();
  await assert.rejects(requireSession(), error => error.status === 401);
  state.session.last_seen_at = new Date().toISOString();
  state.unavailable = true;
  await assert.rejects(requireSession(), error => error.status === 401);
});

test('API real bloqueia acesso anônimo, tabelas restritas, relações e origens externas', async () => {
  const { load, sign } = sessionFixture('cozinha');
  const route = load('src/app/api/data/[table]/route.ts');
  const context = table => ({ params: Promise.resolve({ table }) });
  const get = query => new Request('https://erp.test/api/data/sales' + query);
  assert.equal((await route.GET(get(''), context('sales'))).status, 401);
  await sign();
  assert.equal((await route.GET(get(''), context('collaborators'))).status, 403);
  assert.equal((await route.GET(get('?select=*,collaborators(*)'), context('sales'))).status, 400);
  assert.equal((await route.GET(get('?select=*&select=*,collaborators(*)'), context('sales'))).status, 400);
  const patch = (body, origin) => new Request('https://erp.test/api/data/sales?id=eq.sale1', {
    method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await route.PATCH(patch({ total: 0 }, 'https://erp.test'), context('sales'))).status, 403);
  assert.equal((await route.PATCH(patch({ production_status: 'concluido' }, 'https://evil.test'), context('sales'))).status, 403);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://test.invalid/rest/v1/sales?id=eq.sale1');
    assert.equal(options.headers.get('authorization'), 'Bearer test-private-key');
    return new Response(null, { status: 204 });
  };
  try { assert.equal((await route.PATCH(patch({ production_status: 'concluido' }, 'https://erp.test'), context('sales'))).status, 204); }
  finally { globalThis.fetch = originalFetch; }
});

test('API de clientes nega gravação ao caixa e acesso sem sessão', async () => {
  const { load, sign } = sessionFixture();
  const route = load('src/app/api/crm/customers/route.ts');
  assert.equal((await route.GET()).status, 401);
  await sign();
  const request = new Request('https://erp.test/api/crm/customers', { method: 'POST', headers: { origin: 'https://erp.test' }, body: '{}' });
  assert.equal((await route.POST(request)).status, 403);
  assert.equal((await route.DELETE(new Request(request.url, { method: 'DELETE', headers: { origin: 'https://erp.test' } }))).status, 403);
});

test('APIs limitam o corpo durante a leitura e rejeitam formatos inesperados', async () => {
  const { load } = sessionFixture();
  const { readJsonBody } = load('src/lib/security/server-session.ts');
  const request = body => new Request('https://erp.test/api/test', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body });
  await assert.rejects(readJsonBody(request('x'.repeat(100)), 10), error => error.status === 413);
  await assert.rejects(readJsonBody(request('invalid-json'), 100), error => error.status === 400);
  assert.deepEqual(await readJsonBody(request('{"name":"Cliente"}'), 100), { name: 'Cliente' });
});

test('simulação continua sem valor fiscal mesmo com token e ambiente de produção', () => {
  const fiscal = createLoader()('src/lib/fiscal.ts');
  const config = { cnpj: '00000000000191', uf: 'MG', codigoMunicipio: '3170206', ambiente: 'producao',
    apiToken: 'configured', serieNfce: 1, proximoNumeroNfce: 1, cscId: '1', cscToken: 'private' };
  const sale = { id: 'sale-test', total: 20, paymentMethod: 'dinheiro', items: [{ productName: 'Lanche', quantity: 1, unitPrice: 20 }] };
  const invoice = fiscal.simulateNfceIssue(sale, config, []);
  assert.equal(invoice.status, 'simulada');
  assert.equal(invoice.ambiente, 'homologacao');
  assert.equal(invoice.protocolo, undefined);
  assert.equal(invoice.qrCodeUrl, undefined);
  const receipt = fiscal.generateDanfeThermalHtml(invoice, config, sale);
  assert.match(receipt, /SEM VALOR FISCAL/);
  assert.doesNotMatch(receipt, /private/);
});

test('limitação usa buckets compartilhados sem armazenar a senha e falha fechada', async () => {
  const counters = new Map();
  let unavailable = false;
  const load = createLoader({ '../supabase-server': { createServerDatabase: () => ({
    async rpc(name, { bucket_key, attempt_limit }) {
      assert.equal(name, 'consume_auth_attempt');
      assert.equal(bucket_key.includes('my-private-password'), false);
      const hits = (counters.get(bucket_key) || 0) + 1;
      counters.set(bucket_key, hits);
      return { data: hits <= attempt_limit, error: unavailable ? new Error('offline') : null };
    },
  }) } });
  const { allowCredentialAttempt } = load('src/lib/security/rate-limit.ts');
  for (let i = 0; i < 8; i++) assert.equal(await allowCredentialAttempt('my-private-password'), true);
  assert.equal(await allowCredentialAttempt('my-private-password'), false);
  unavailable = true;
  assert.equal(await allowCredentialAttempt('another-password'), false);
});

test('credenciais padrão nunca autenticam, inclusive quando configuradas no ambiente', async () => {
  process.env.ADMIN_PASSWORD = 'admin';
  const database = { createServerDatabase: () => ({ from: () => ({
    select() { return this; }, async eq() { return { data: [{ id: 'a', role: 'admin', pin: 'admin' }], error: null }; },
  }) }) };
  const load = createLoader({ './supabase-server': database,
    './security/rate-limit': { allowCredentialAttempt: async () => true } });
  const { validateServerCredentialsAsync } = load('src/lib/auth.ts');
  for (const credential of ['admin', '0000', '1234', '5678']) {
    assert.equal((await validateServerCredentialsAsync(credential)).valid, false);
  }
});

test('listagem de colaboradores não consulta ou retorna os hashes', async () => {
  const load = createLoader({ './supabase-server': { createServerDatabase: () => ({ from: () => ({
    select(columns) { assert.equal(columns.split(',').includes('pin'), false); return this; },
    async order() { return { data: [{ id: 'x', name: 'Operador', role: 'caixa', pin: 'never-return-this', is_active: true }], error: null }; },
  }) }) } });
  const result = await load('src/lib/server-collaborators.ts').getServerCollaborators();
  assert.equal(result.collaborators[0].pin, '');
  assert.equal(JSON.stringify(result).includes('never-return-this'), false);
});

test('checkout transacional valida permissões, integridade matemática e idempotência', async () => {
  const rpcCalls = [];
  const fixture = sessionFixture('cozinha');
  const dbMock = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async single() {
          return {
            data: table === 'app_sessions' ? fixture.state.session : fixture.state.person,
            error: null
          };
        }
      };
    },
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      return { data: { success: true, saleId: params.p_sale.id }, error: null };
    }
  };

  const databaseModule = { createServerDatabase: () => dbMock };
  const load = createLoader({
    'next/headers': { cookies: async () => ({ get: () => fixture.state.token ? { value: fixture.state.token } : undefined }) },
    '../supabase-server': databaseModule,
    '@/lib/supabase-server': databaseModule,
  });

  const route = load('src/app/api/sales/checkout/route.ts');

  const validSale = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    channel: 'balcao',
    subtotal: 50,
    discount: 5,
    deliveryFee: 0,
    total: 45,
    paymentMethod: 'pix',
    items: [
      { productId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', productName: 'Brasil Burger', quantity: 1, unitPrice: 45 }
    ]
  };

  const post = (payload, origin = 'https://erp.test') => new Request('https://erp.test/api/sales/checkout', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // 1. Sem sessão -> 401
  assert.equal((await route.POST(post({ idempotencyKey: 'key-12345678', sale: validSale }))).status, 401);

  // 2. Com perfil cozinha -> 403
  await fixture.sign();
  assert.equal((await route.POST(post({ idempotencyKey: 'key-12345678', sale: validSale }))).status, 403);

  // 3. Com perfil caixa mas origem externa -> 403
  fixture.state.person.role = 'caixa';
  fixture.state.token = await load('src/lib/session.ts').signSessionToken('caixa', 'Operador', 'operator', 'test-session');
  assert.equal((await route.POST(post({ idempotencyKey: 'key-12345678', sale: validSale }, 'https://evil.test'))).status, 403);

  // 4. Com divergência matemática no total -> 400
  const tamperedSale = { ...validSale, total: 10 };
  assert.equal((await route.POST(post({ idempotencyKey: 'key-12345678', sale: tamperedSale }))).status, 400);

  // 5. Sem itens -> 400
  assert.equal((await route.POST(post({ idempotencyKey: 'key-12345678', sale: { ...validSale, items: [] } }))).status, 400);

  // 6. ID inválido (não UUID) -> 400
  assert.equal((await route.POST(post({ idempotencyKey: 'key-12345678', sale: { ...validSale, id: 'invalid-id' } }))).status, 400);

  // 7. Venda válida com perfil caixa -> 200 e dispara RPC transacional
  const res = await route.POST(post({ idempotencyKey: 'key-12345678', sale: validSale }));
  assert.equal(res.status, 200);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'process_sale_checkout');
  assert.equal(rpcCalls[0].params.p_idempotency_key, 'key-12345678');
  assert.equal(rpcCalls[0].params.p_sale.id, validSale.id);

  // 8. Reenvio com a mesma chave de idempotência -> 200
  const res2 = await route.POST(post({ idempotencyKey: 'key-12345678', sale: validSale }));
  assert.equal(res2.status, 200);
  assert.equal(rpcCalls.length, 2);
  assert.equal(rpcCalls[1].params.p_idempotency_key, 'key-12345678');
});

test('fechamento de caixa e movimentações validam dados e sessão', async () => {
  const rpcCalls = [];
  const fixture = sessionFixture('caixa');
  await fixture.sign();

  const dbMock = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async single() {
          return { data: table === 'app_sessions' ? fixture.state.session : fixture.state.person, error: null };
        }
      };
    },
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      return { data: { success: true }, error: null };
    }
  };

  const databaseModule = { createServerDatabase: () => dbMock };
  const load = createLoader({
    'next/headers': { cookies: async () => ({ get: () => fixture.state.token ? { value: fixture.state.token } : undefined }) },
    '../supabase-server': databaseModule,
    '@/lib/supabase-server': databaseModule,
  });

  const closeRoute = load('src/app/api/cash/close/route.ts');
  const movRoute = load('src/app/api/cash/movement/route.ts');

  const post = (url, body) => new Request(url, {
    method: 'POST',
    headers: { origin: 'https://erp.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  // Fechamento de caixa com ID inválido -> 400
  assert.equal((await closeRoute.POST(post('https://erp.test/api/cash/close', { sessionId: 'invalid', finalAmount: 100 }))).status, 400);

  // Fechamento de caixa com valor negativo -> 400
  assert.equal((await closeRoute.POST(post('https://erp.test/api/cash/close', { sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', finalAmount: -50 }))).status, 400);

  // Fechamento válido -> 200
  const closeRes = await closeRoute.POST(post('https://erp.test/api/cash/close', {
    sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    finalAmount: 150,
    expectedAmount: 150
  }));
  assert.equal(closeRes.status, 200);
  assert.equal(rpcCalls[0].name, 'close_cash_session_transaction');

  // Sangria com valor zero ou negativo -> 400
  assert.equal((await movRoute.POST(post('https://erp.test/api/cash/movement', { type: 'sangria', amount: 0, description: 'Sangria' }))).status, 400);

  // Sangria sem descrição -> 400
  assert.equal((await movRoute.POST(post('https://erp.test/api/cash/movement', { type: 'sangria', amount: 100, description: ' ' }))).status, 400);

  // Sangria válida -> 200
  const movRes = await movRoute.POST(post('https://erp.test/api/cash/movement', {
    type: 'sangria',
    amount: 100,
    description: 'Pagamento Fornecedor Pães'
  }));
  assert.equal(movRes.status, 200);
  assert.equal(rpcCalls[1].name, 'record_cash_movement_transaction');
});

test('cancelamento e quitação de pedidos validam supervisor e impedem fraudes', async () => {
  const rpcCalls = [];
  const fixture = sessionFixture('caixa');
  await fixture.sign();

  const hashedSupPin = await hashCredential('supervisor123456');

  const dbMock = {
    from(table) {
      const builder = {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        async single() {
          return { data: table === 'app_sessions' ? fixture.state.session : fixture.state.person, error: null };
        },
        then(resolve) {
          resolve({
            data: table === 'collaborators'
              ? [{ id: 'sup1', name: 'Gerente Carlos', role: 'gerente', pin: hashedSupPin, is_active: true }]
              : [],
            error: null
          });
        }
      };
      return builder;
    },
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      return { data: { success: true }, error: null };
    }
  };

  const databaseModule = { createServerDatabase: () => dbMock };
  const load = createLoader({
    'next/headers': { cookies: async () => ({ get: () => fixture.state.token ? { value: fixture.state.token } : undefined }) },
    '../supabase-server': databaseModule,
    '@/lib/supabase-server': databaseModule,
  });

  const cancelRoute = load('src/app/api/sales/cancel/route.ts');
  const settleRoute = load('src/app/api/sales/settle/route.ts');

  const post = (url, body) => new Request(url, {
    method: 'POST',
    headers: { origin: 'https://erp.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  // Cancelamento por caixa sem senha de supervisor -> 403
  assert.equal((await cancelRoute.POST(post('https://erp.test/api/sales/cancel', {
    saleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    reason: 'Erro'
  }))).status, 403);

  // Cancelamento por caixa com senha errada de supervisor -> 403
  assert.equal((await cancelRoute.POST(post('https://erp.test/api/sales/cancel', {
    saleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    reason: 'Erro',
    supervisorPassword: 'senha-incorreta'
  }))).status, 403);

  // Cancelamento por caixa com senha correta de supervisor -> 200 e chama RPC
  const cancelRes = await cancelRoute.POST(post('https://erp.test/api/sales/cancel', {
    saleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    reason: 'Desistência do cliente',
    supervisorPassword: 'supervisor123456'
  }));
  assert.equal(cancelRes.status, 200);
  assert.equal(rpcCalls[0].name, 'cancel_order_transaction');

  // Quitação de pedido com parâmetros válidos -> 200
  const settleRes = await settleRoute.POST(post('https://erp.test/api/sales/settle', {
    saleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    paymentMethod: 'pix',
    settlementType: 'retirada'
  }));
  assert.equal(settleRes.status, 200);
  assert.equal(rpcCalls[1].name, 'settle_order_payment_transaction');
});

