import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  searchRecurringCustomers,
  getNormalizedCustomerIndex,
  normalizeSearchString,
  cleanCustomerName,
  extractCustomerProfiles,
} = createLoader()('src/lib/crm-clientes.ts');

const mockErpSales = [
  {
    id: 'sale-1',
    customerName: 'Carlos Silva - Rua das Palmeiras, 45',
    orderType: 'delivery',
    channel: 'balcao',
    total: 95.0,
    date: '2026-09-16T20:00:00Z',
    status: 'completed',
    items: [
      { productName: 'Smash Duplo', quantity: 2, unitPrice: 35, notes: 'SEM CEBOLA' },
      { productName: 'Batata Rústica', quantity: 1, unitPrice: 25 },
    ],
  },
  {
    id: 'sale-2',
    customerName: 'Carlos Silva',
    orderType: 'delivery',
    channel: 'balcao',
    total: 70.0,
    date: '2026-09-10T19:00:00Z',
    status: 'completed',
    items: [
      { productName: 'Smash Duplo', quantity: 2, unitPrice: 35, notes: 'SEM CEBOLA' },
    ],
  },
  {
    id: 'sale-3',
    customerName: 'Mariana Oliveira',
    orderType: 'retirada',
    channel: 'balcao',
    total: 45.0,
    date: '2026-09-12T18:00:00Z',
    status: 'completed',
    items: [
      { productName: 'Burger Clássico', quantity: 1, unitPrice: 45, notes: 'BEM PASSADO' },
    ],
  },
];

const mockImportedCustomers = [
  {
    id: 'imp-1',
    name: 'Vitor Fatureto',
    phone: '34991234567',
    address: 'Av. Brasil',
    number: '500',
    neighborhood: 'Centro',
    fullAddress: 'Av. Brasil, 500 - Centro',
    totalOrders: 12,
    source: 'cardapio_web',
    importedAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'imp-2',
    name: 'Beatriz Santos',
    phone: '11988776655',
    address: 'Rua Bela Cintra',
    number: '120',
    neighborhood: 'Consolação',
    fullAddress: 'Rua Bela Cintra, 120 - Consolação',
    totalOrders: 3,
    source: 'cardapio_web',
    importedAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'imp-3',
    name: 'Carlos Eduardo Souza',
    phone: '34999990000',
    address: 'Rua XV de Novembro',
    number: '80',
    neighborhood: 'Santa Mônica',
    fullAddress: 'Rua XV de Novembro, 80 - Santa Mônica',
    totalOrders: 1,
    source: 'planilha',
    importedAt: '2026-09-01T10:00:00Z',
  },
];

test('cleanCustomerName separa nome limpo e endereço', () => {
  const res1 = cleanCustomerName('Carlos Silva - Rua das Palmeiras, 45');
  assert.equal(res1.cleanName, 'Carlos Silva');
  assert.equal(res1.addressPart, 'Rua das Palmeiras, 45');

  const res2 = cleanCustomerName('Mesa 05 - João Pedro');
  assert.equal(res2.cleanName, 'João Pedro');

  const res3 = cleanCustomerName('Apenas Nome');
  assert.equal(res3.cleanName, 'Apenas Nome');
  assert.equal(res3.addressPart, undefined);
});

test('extractCustomerProfiles extrai histórico, notas frequentes e consolida pedidos', () => {
  const profiles = extractCustomerProfiles(mockErpSales);
  assert.equal(profiles.length, 2);

  const carlos = profiles.find(p => p.name === 'Carlos Silva');
  assert.ok(carlos);
  assert.equal(carlos.totalOrders, 2);
  assert.equal(carlos.totalSpent, 165.0);
  assert.deepEqual(carlos.frequentNotes, ['SEM CEBOLA']);

  const mariana = profiles.find(p => p.name === 'Mariana Oliveira');
  assert.ok(mariana);
  assert.equal(mariana.totalOrders, 1);
  assert.deepEqual(mariana.frequentNotes, ['BEM PASSADO']);
});

test('searchRecurringCustomers busca por prefixo de nome', () => {
  const profiles = extractCustomerProfiles(mockErpSales);
  const results = searchRecurringCustomers('car', profiles, mockImportedCustomers, 8);

  assert.ok(results.length >= 2);
  // Carlos Silva do ERP deve ter prioridade alta
  assert.equal(results[0].name, 'Carlos Silva');
  assert.equal(results[0].source, 'erp');
  assert.deepEqual(results[0].frequentNotes, ['SEM CEBOLA']);

  // Carlos Eduardo da base importada também aparece
  const carlosEduardo = results.find(r => r.name === 'Carlos Eduardo Souza');
  assert.ok(carlosEduardo);
  assert.equal(carlosEduardo.source, 'cardapio_web');
});

test('searchRecurringCustomers busca por palavras intermediárias do nome', () => {
  const profiles = extractCustomerProfiles(mockErpSales);
  // 'fat' encontra 'Vitor Fatureto'
  const byWord = searchRecurringCustomers('fat', profiles, mockImportedCustomers, 8);
  assert.ok(byWord.length >= 1);
  assert.equal(byWord[0].name, 'Vitor Fatureto');

  // 'santos' encontra 'Beatriz Santos'
  const byLastName = searchRecurringCustomers('santos', profiles, mockImportedCustomers, 8);
  assert.ok(byLastName.length >= 1);
  assert.equal(byLastName[0].name, 'Beatriz Santos');
});

test('searchRecurringCustomers busca por dígitos de telefone sem falsos positivos', () => {
  const profiles = extractCustomerProfiles(mockErpSales);

  // Busca por '1234' encontra Vitor (34991234567)
  const byPhone = searchRecurringCustomers('1234', profiles, mockImportedCustomers, 8);
  assert.ok(byPhone.length >= 1);
  assert.equal(byPhone[0].name, 'Vitor Fatureto');

  // Busca curta com 1 ou 2 dígitos NÃO deve ativar busca por telefone
  const shortDigits = searchRecurringCustomers('12', profiles, mockImportedCustomers, 8);
  // '12' não deve retornar tudo aleatoriamente por telefone
  for (const item of shortDigits) {
    // Se retornou, é porque o nome contém '12'
    assert.ok(normalizeSearchString(item.name).includes('12'));
  }
});

test('searchRecurringCustomers busca por endereço do cliente', () => {
  const profiles = extractCustomerProfiles(mockErpSales);
  // 'cintra' encontra 'Beatriz Santos' (Rua Bela Cintra)
  const byAddr = searchRecurringCustomers('cintra', profiles, mockImportedCustomers, 8);
  assert.ok(byAddr.length >= 1);
  assert.equal(byAddr[0].name, 'Beatriz Santos');
  assert.ok(byAddr[0].fullAddress.includes('Bela Cintra'));
});

test('getNormalizedCustomerIndex gera e reaproveita índice em memória', () => {
  const index1 = getNormalizedCustomerIndex(mockImportedCustomers);
  assert.equal(index1.length, mockImportedCustomers.length);
  assert.equal(index1[0].normName, 'vitor fatureto');
  assert.equal(index1[0].phoneDigits, '34991234567');

  // Segunda chamada com a mesma referência retorna o mesmo cache (reaproveitamento O(1))
  const index2 = getNormalizedCustomerIndex(mockImportedCustomers);
  assert.equal(index1, index2);
});

test('searchRecurringCustomers ignora termos menores que 2 caracteres para não sobrecarregar', () => {
  const profiles = extractCustomerProfiles(mockErpSales);
  assert.deepEqual(searchRecurringCustomers('', profiles, mockImportedCustomers), []);
  assert.deepEqual(searchRecurringCustomers('c', profiles, mockImportedCustomers), []);
  assert.deepEqual(searchRecurringCustomers('  ', profiles, mockImportedCustomers), []);
});
