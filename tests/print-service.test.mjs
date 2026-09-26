import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const load = createLoader();
const {
  renderKitchenTicketHtml,
  renderClientReceiptHtml,
  enqueuePrintJob,
  requestReprint,
  generatePrintJobId,
} = load('src/lib/print-service.ts');

const {
  DEFAULT_PRINTER_PROFILE,
  DEFAULT_RECEIPT_TEMPLATE,
  migrateLegacyLocalConfig,
  CENTRAL_CONFIG_STORAGE_KEY,
} = load('src/lib/central-config.ts');

class MockStorage {
  constructor(initialData = {}) {
    this.data = new Map(Object.entries(initialData));
  }
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

const sampleSale = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  date: '2026-09-26T12:00:00.000Z',
  channel: 'balcao',
  orderType: 'retirada',
  customerName: 'MARCOS TESTE',
  paymentMethod: 'pix',
  total: 55.00,
  subtotal: 60.00,
  discount: 5.00,
  items: [
    {
      id: 'item-1',
      productId: 'p-1',
      productName: 'Duplo Burger Costela',
      quantity: 1,
      unitPrice: 38.00,
      meatPoint: 'ao ponto',
      additionals: [{ name: 'Bacon Crocante', quantity: 1, unitPrice: 4.00 }],
      removals: ['Picles'],
      notes: 'SEM CEBOLA',
    },
    {
      id: 'item-2',
      productId: 'p-2',
      productName: 'Batata Frita',
      quantity: 1,
      unitPrice: 17.00,
    }
  ]
};

// =========================================================================
// TESTES DO SERVIÇO DE IMPRESSÃO (Etapa 2 - Seções 4, 5 e 6)
// =========================================================================

test('PrintService: Gera ID UUID válido para jobs de impressão', () => {
  const id = generatePrintJobId();
  assert.ok(id && id.length > 10, 'Deve gerar identificador único');
});

test('PrintService: Deduplica cliques rápidos repetidos para mesma tupla de venda', async () => {
  const res1 = await enqueuePrintJob({
    sale: sampleSale,
    ticketType: 'cozinha',
    operator: 'Caixa 1',
  });

  assert.equal(res1.isDuplicate, false);
  assert.equal(res1.job.saleId, sampleSale.id);
  assert.equal(res1.job.ticketType, 'cozinha');

  // Segundo clique imediato deve ser detectado como duplicado
  const res2 = await enqueuePrintJob({
    sale: sampleSale,
    ticketType: 'cozinha',
    operator: 'Caixa 1',
  });

  assert.equal(res2.isDuplicate, true);
  assert.equal(res2.job.id, res1.job.id, 'Deve reutilizar o job já enfileirado');
});

test('PrintService: Reimpressão explícita bypassa deduplicação e incrementa número da cópia', async () => {
  const reprintRes = await requestReprint(sampleSale, 'cozinha', {
    reason: 'Papel embolou na impressora',
    operator: 'Supervisor',
  });

  assert.equal(reprintRes.isDuplicate, false);
  assert.equal(reprintRes.job.isReprint, true);
  assert.ok(reprintRes.job.copyNumber >= 2);
  assert.equal(reprintRes.job.reprintReason, 'Papel embolou na impressora');
});

test('PrintService: Renderização HTML da Cozinha respeita template e perfil 80mm vs 58mm', () => {
  const ticketData = {
    header: {
      customerName: 'JOÃO SILVA',
      orderIdShort: '#A0EEBC',
      time: '12:30',
      date: '26/09/2026',
      channel: 'BALCAO',
      orderType: 'retirada',
      isReprint: false,
    },
    items: [
      {
        quantity: 2,
        productName: 'ARGENTINA',
        pattiesComposition: '2x Costela 180g',
        meatPoint: 'bem passado',
        additionals: [{ label: 'ADICIONAR: Queijo Extra' }],
        removals: ['TOMATE'],
        notes: 'CAPRICHO',
        recipeIngredients: ['Pão Brioche', 'Maionese'],
      }
    ],
    productionSummary: {
      chapa: {
        totalPatties: 2,
        pattiesLabel: '2 HAMBÚRGUERES',
        pattiesBreakdown: [{ label: '2x Costela 180g', count: 2 }],
        otherItems: [],
        status: 'ok',
      },
      fritadeira: {
        totalPreparos: 0,
        preparosLabel: '0 PREPAROS',
        items: [],
        status: 'sem_itens',
      },
      isComplete: true,
    }
  };

  // 1. Template com montagem oculta
  const html80mm = renderKitchenTicketHtml(ticketData, {
    template: { ...DEFAULT_RECEIPT_TEMPLATE, showMontagem: false },
    profile: DEFAULT_PRINTER_PROFILE,
  });

  assert.match(html80mm, /JOÃO SILVA/);
  assert.match(html80mm, /2x ARGENTINA/);
  assert.match(html80mm, /Ponto: bem passado/);
  assert.match(html80mm, /RETIRAR: TOMATE/);
  assert.match(html80mm, /CHAPA — 2 HAMBÚRGUERES/);
  assert.doesNotMatch(html80mm, /Montagem: Pão Brioche/);

  // 2. Template com montagem exibida
  const htmlMontagem = renderKitchenTicketHtml(ticketData, {
    template: { ...DEFAULT_RECEIPT_TEMPLATE, showMontagem: true },
    profile: DEFAULT_PRINTER_PROFILE,
  });
  assert.match(htmlMontagem, /Montagem: Pão Brioche • Maionese/);

  // 3. Pedido pendente de sincronização
  const htmlOffline = renderKitchenTicketHtml(ticketData, {
    template: DEFAULT_RECEIPT_TEMPLATE,
    profile: DEFAULT_PRINTER_PROFILE,
    isPendingSync: true,
  });
  assert.match(htmlOffline, /AGUARDANDO SINCRONIZAÇÃO/);
});

test('PrintService: Renderização HTML do Cupom do Cliente utiliza Nome e CNPJ configurados', () => {
  const customTemplate = {
    ...DEFAULT_RECEIPT_TEMPLATE,
    storeName: 'HUM VÍCIO GOURMET BURGERS',
    storeCnpj: '99.888.777/0001-66',
  };

  const clientHtml = renderClientReceiptHtml(sampleSale, {
    template: customTemplate,
    profile: DEFAULT_PRINTER_PROFILE,
  });

  assert.match(clientHtml, /HUM VÍCIO GOURMET BURGERS/);
  assert.match(clientHtml, /99\.888\.777\/0001-66/);
  assert.match(clientHtml, /MARCOS TESTE/);
  assert.match(clientHtml, /R\$ 55\.00/);
  assert.match(clientHtml, /PIX/i);
});

test('PrintService: Renderização HTML do Cupom do Cliente inclui IE, Lei 12.741/12, QR Code e rodapé personalizado', () => {
  const customTemplate = {
    ...DEFAULT_RECEIPT_TEMPLATE,
    storeName: 'HUM VÍCIO HAMBURGUERIA',
    storeCnpj: '32.588.610/0001-44',
    showFiscalData: true,
    storeIe: '123.456.789.110',
    showTaxDetails: true,
    showQrCodePlaceholder: true,
    receiptFooterMessage: 'AGRADECEMOS A PREFERENCIA! VOLTE SEMPRE',
  };

  const clientHtml = renderClientReceiptHtml(sampleSale, {
    template: customTemplate,
    profile: DEFAULT_PRINTER_PROFILE,
  });

  assert.match(clientHtml, /IE: 123\.456\.789\.110/);
  assert.match(clientHtml, /Lei 12\.741\/12/);
  assert.match(clientHtml, /CONSULTA PELA CHAVE DE ACESSO/);
  assert.match(clientHtml, /AGRADECEMOS A PREFERENCIA! VOLTE SEMPRE/);
});

test('PrintService: Renderização HTML do Cupom do Cliente omite campos fiscais e QR Code quando desativados', () => {
  const minimalTemplate = {
    ...DEFAULT_RECEIPT_TEMPLATE,
    showFiscalData: false,
    showTaxDetails: false,
    showQrCodePlaceholder: false,
    receiptFooterMessage: '',
  };

  const clientHtml = renderClientReceiptHtml(sampleSale, {
    template: minimalTemplate,
    profile: DEFAULT_PRINTER_PROFILE,
  });

  assert.doesNotMatch(clientHtml, /IE:/);
  assert.doesNotMatch(clientHtml, /Lei 12\.741\/12/);
  assert.doesNotMatch(clientHtml, /CONSULTA PELA CHAVE DE ACESSO/);
});

test('PrintService: Via Cozinha garante estritamente a omissão de dados financeiros e forma de pagamento', () => {
  const kitchenHtml = renderKitchenTicketHtml({
    header: {
      customerName: 'MARCOS TESTE',
      orderIdShort: '#A0EEBC',
      time: '12:00',
      date: '26/09/2026',
      channel: 'BALCAO',
      orderType: 'retirada',
      isReprint: false,
    },
    items: [
      {
        quantity: 1,
        productName: 'Duplo Burger Costela',
        pattiesComposition: '2x Costela 180g',
        meatPoint: 'ao ponto',
        additionals: [{ label: 'ADICIONAR: Bacon Crocante' }],
        removals: ['Picles'],
        notes: 'SEM CEBOLA',
      }
    ],
    productionSummary: {
      chapa: {
        totalPatties: 2,
        pattiesLabel: '2 HAMBÚRGUERES',
        pattiesBreakdown: [],
        otherItems: [],
        status: 'ok',
      },
      fritadeira: {
        totalPreparos: 0,
        preparosLabel: '0 PREPAROS',
        items: [],
        status: 'sem_itens',
      },
      isComplete: true,
    }
  }, {
    template: DEFAULT_RECEIPT_TEMPLATE,
    profile: DEFAULT_PRINTER_PROFILE,
  });

  assert.doesNotMatch(kitchenHtml, /R\$/);
  assert.doesNotMatch(kitchenHtml, /PIX/i);
  assert.doesNotMatch(kitchenHtml, /Total/i);
  assert.doesNotMatch(kitchenHtml, /Desconto/i);
  assert.doesNotMatch(kitchenHtml, /Subtotal/i);
});

test('CentralConfig: Migra hum_vicio_print_show_montagem do localStorage para receiptTemplate', () => {
  const legacyStorage = new MockStorage({
    hum_vicio_print_show_montagem: 'true',
  });

  const migrated = migrateLegacyLocalConfig(legacyStorage);
  assert.equal(migrated.receiptTemplate.showMontagem, true);

  const raw = legacyStorage.getItem(CENTRAL_CONFIG_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.receiptTemplate.showMontagem, true);
  assert.equal(parsed.printerProfile.paperWidth, '80mm');
});

