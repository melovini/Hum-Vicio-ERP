import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLoader } from './load-typescript.mjs';

process.env.AUTH_SECRET = 'test-only-secret-never-used-for-production-123456789';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-private-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
process.env.APP_ORIGIN = 'https://erp.test';
globalThis.crypto ??= webcrypto;

function sessionFixture(role = 'admin') {
  const state = {
    token: undefined,
    session: {
      id: 'test-session',
      collaborator_id: 'admin-user',
      collaborator_version: 'v1',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    person: {
      id: 'admin-user',
      name: 'Administrador Teste',
      role,
      is_active: true,
      updated_at: 'v1',
    },
  };

  const rpcCalls = [];
  let rpcHandler = async (name, params) => {
    rpcCalls.push({ name, params });
    return {
      data: {
        success: true,
        productId: params.p_product?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        version: 2,
        savedAt: new Date().toISOString(),
      },
      error: null,
    };
  };

  const db = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async single() {
          return { data: table === 'app_sessions' ? state.session : state.person, error: null };
        },
      };
    },
    rpc: (name, params) => rpcHandler(name, params),
  };

  const databaseModule = { createServerDatabase: () => db };
  const load = createLoader({
    'next/headers': { cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined }) },
    '../supabase-server': databaseModule,
    '@/lib/supabase-server': databaseModule,
  });

  return {
    state,
    rpcCalls,
    setRpcHandler(fn) { rpcHandler = fn; },
    load,
    async sign() {
      state.token = await load('src/lib/session.ts').signSessionToken(role, state.person.name, state.person.id, state.session.id);
    },
  };
}

test('POST /api/products/save: validação de autenticação e permissões operacionais', async () => {
  const fixture = sessionFixture('admin');
  const route = fixture.load('src/app/api/products/save/route.ts');

  const validPayload = {
    product: {
      name: 'Burger Teste Autenticação',
      category: 'lanche',
      priceBalcao: 32.5,
    },
    recipe: [],
  };

  const makeRequest = (payload, origin = 'https://erp.test') => new Request('https://erp.test/api/products/save', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // 1. Sem sessão -> 401
  const res1 = await route.POST(makeRequest(validPayload));
  assert.equal(res1.status, 401);

  // 2. Com perfil de caixa (sem permissão de cardápio) -> 403
  const cashierFixture = sessionFixture('caixa');
  await cashierFixture.sign();
  const cashierRoute = cashierFixture.load('src/app/api/products/save/route.ts');
  const res2 = await cashierRoute.POST(makeRequest(validPayload));
  assert.equal(res2.status, 403);

  // 3. Com perfil de cozinha -> 403
  const kitchenFixture = sessionFixture('cozinha');
  await kitchenFixture.sign();
  const kitchenRoute = kitchenFixture.load('src/app/api/products/save/route.ts');
  const res3 = await kitchenRoute.POST(makeRequest(validPayload));
  assert.equal(res3.status, 403);

  // 4. Com origem externa não autorizada -> 403
  await fixture.sign();
  const res4 = await route.POST(makeRequest(validPayload, 'https://hacker.test'));
  assert.equal(res4.status, 403);
});

test('POST /api/products/save: validações de integridade e regras de negócio', async () => {
  const fixture = sessionFixture('admin');
  await fixture.sign();
  const route = fixture.load('src/app/api/products/save/route.ts');

  const post = (payload) => new Request('https://erp.test/api/products/save', {
    method: 'POST',
    headers: { origin: 'https://erp.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // 1. Nome vazio -> 400
  const r1 = await route.POST(post({ product: { name: '  ', category: 'lanche', priceBalcao: 25 } }));
  assert.equal(r1.status, 400);
  const data1 = await r1.json();
  assert.match(data1.message, /nome do produto é obrigatório/i);

  // 2. Categoria inválida -> 400
  const r2 = await route.POST(post({ product: { name: 'Burger', category: 'categoria_invalida', priceBalcao: 25 } }));
  assert.equal(r2.status, 400);

  // 3. Preço balcão zerado ou negativo -> 400
  const r3 = await route.POST(post({ product: { name: 'Burger', category: 'lanche', priceBalcao: 0 } }));
  assert.equal(r3.status, 400);
  const data3 = await r3.json();
  assert.match(data3.message, /maior que zero/i);

  // 4. Preço iFood negativo -> 400
  const r4 = await route.POST(post({ product: { name: 'Burger', category: 'lanche', priceBalcao: 25, priceIfood: -5 } }));
  assert.equal(r4.status, 400);

  // 5. Insumo com quantidade zerada na receita -> 400
  const r5 = await route.POST(post({
    product: { name: 'Burger', category: 'lanche', priceBalcao: 25 },
    recipe: [
      { ingredientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quantity: 0, productionStation: 'grill', productionKind: 'beef_patty' }
    ]
  }));
  assert.equal(r5.status, 400);
  const data5 = await r5.json();
  assert.match(data5.message, /maior que zero/i);

  // 6. Insumo com destino inválido -> 400
  const r6 = await route.POST(post({
    product: { name: 'Burger', category: 'lanche', priceBalcao: 25 },
    recipe: [
      { ingredientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quantity: 1, productionStation: 'estacao_fantasma', productionKind: 'beef_patty' }
    ]
  }));
  assert.equal(r6.status, 400);
});

test('POST /api/products/save: aceita combinação legítima (queijo na chapa sem contar como carne, batata na fritadeira e embalagem)', async () => {
  const fixture = sessionFixture('admin');
  await fixture.sign();
  const route = fixture.load('src/app/api/products/save/route.ts');

  const post = (payload) => new Request('https://erp.test/api/products/save', {
    method: 'POST',
    headers: { origin: 'https://erp.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const payload = {
    product: {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      name: 'Hambúrguer Hum Vício Especial',
      category: 'lanche',
      subcategory: 'Artesanais',
      priceBalcao: 38.0,
      priceIfood: 44.0,
      expectedVersion: 1,
    },
    recipe: [
      // Carne na chapa contada como beef_patty
      { ingredientId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', quantity: 0.180, productionStation: 'grill', productionKind: 'beef_patty' },
      // Queijo na chapa sem ser carne (productionKind = 'none')
      { ingredientId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', quantity: 2, productionStation: 'grill', productionKind: 'none' },
      // Ovo na chapa
      { ingredientId: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', quantity: 1, productionStation: 'grill', productionKind: 'egg' },
      // Batata na fritadeira
      { ingredientId: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', quantity: 0.150, productionStation: 'fryer', productionKind: 'fries' },
      // Pão na montagem
      { ingredientId: 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', quantity: 1, productionStation: 'assembly', productionKind: 'none' },
      // Embalagem não vai à cozinha (station: 'none', kind: 'none')
      { ingredientId: 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a88', quantity: 1, productionStation: 'none', productionKind: 'none' },
    ],
  };

  const res = await route.POST(post(payload));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.productId, payload.product.id);

  assert.equal(fixture.rpcCalls.length, 1);
  assert.equal(fixture.rpcCalls[0].name, 'save_product_transaction');
  const passedProduct = fixture.rpcCalls[0].params.p_product;
  assert.equal(passedProduct.name, 'Hambúrguer Hum Vício Especial');
  assert.equal(passedProduct.expectedVersion, 1);
  assert.equal(passedProduct.subcategory, 'Artesanais');

  const passedRecipe = fixture.rpcCalls[0].params.p_recipe;
  assert.equal(passedRecipe.length, 6);
  // Queijo na chapa preserva station grill e kind none
  assert.equal(passedRecipe[1].productionStation, 'grill');
  assert.equal(passedRecipe[1].productionKind, 'none');
  // Embalagem normalizada
  assert.equal(passedRecipe[5].productionStation, 'none');
  assert.equal(passedRecipe[5].productionKind, 'none');
});

test('POST /api/products/save: detecção de conflito de concorrência (HTTP 409)', async () => {
  const fixture = sessionFixture('admin');
  await fixture.sign();

  fixture.setRpcHandler(async () => {
    return {
      data: null,
      error: { message: 'CONFLITO_VERSAO: Outra pessoa atualizou esta ficha. Compare as versões antes de continuar.' },
    };
  });

  const route = fixture.load('src/app/api/products/save/route.ts');
  const post = (payload) => new Request('https://erp.test/api/products/save', {
    method: 'POST',
    headers: { origin: 'https://erp.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const res = await route.POST(post({
    product: {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      name: 'Burger Concorrente',
      category: 'lanche',
      priceBalcao: 30,
      expectedVersion: 1,
    },
    recipe: [],
  }));

  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.message, /Outra pessoa atualizou esta ficha/i);
});

test('POST /api/products/save: erro do banco retorna mensagem limpa com código sem expor SQL interno', async () => {
  const fixture = sessionFixture('admin');
  await fixture.sign();

  fixture.setRpcHandler(async () => {
    return {
      data: null,
      error: { message: 'relation "unknown_table" does not exist at character 42' },
    };
  });

  const route = fixture.load('src/app/api/products/save/route.ts');
  const post = (payload) => new Request('https://erp.test/api/products/save', {
    method: 'POST',
    headers: { origin: 'https://erp.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const res = await route.POST(post({
    product: { name: 'Burger com Falha de Banco', category: 'lanche', priceBalcao: 30 },
    recipe: [],
  }));

  assert.equal(res.status, 500);
  const data = await res.json();
  assert.match(data.message, /Não foi possível salvar\. A ficha publicada não foi alterada/i);
  assert.match(data.message, /Código: ERR_PROD_/i);
  // Não expõe a query SQL interna
  assert.equal(data.message.includes('unknown_table'), false);
});
