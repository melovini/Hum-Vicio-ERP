import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  DEFAULT_CENTRAL_CONFIG,
  DEFAULT_PRINTER_PROFILE,
  DEFAULT_RECEIPT_TEMPLATE,
  DEFAULT_TERMINAL_BINDINGS,
  CENTRAL_CONFIG_STORAGE_KEY,
  migrateLegacyLocalConfig,
  resolveEffectiveConfig,
  getCurrentTerminalId,
  setCurrentTerminalId,
  getTerminalBinding,
} = createLoader()('src/lib/central-config.ts');

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

// =========================================================================
// TESTES DE CONFIGURAÇÃO CENTRALIZADA & SINCRONIZAÇÃO (Etapa 5)
// =========================================================================

test('CentralConfig: Possui estrutura padrão com versão inicial 1 e campos operacionais', () => {
  assert.equal(DEFAULT_CENTRAL_CONFIG.version, 1);
  assert.equal(DEFAULT_CENTRAL_CONFIG.targetPrepMinutes, 20);
  assert.ok(DEFAULT_CENTRAL_CONFIG.fixedExpenses);
  assert.ok(DEFAULT_CENTRAL_CONFIG.subcategoriesByCategory.lanche);
});

test('CentralConfig: Migra de forma não destrutiva configurações legadas espalhadas em chaves avulsas', () => {
  const legacyStorage = new MockStorage({
    hum_vicio_target_prep_minutes: '15',
    hum_vicio_custom_subcategories_by_category: JSON.stringify({
      lanche: ['Smash', 'Gourmet Exclusivo'],
    }),
    hum_vicio_ingredient_stations_map: JSON.stringify({
      'inv-picanha': 'chapa',
    }),
  });

  const migrated = migrateLegacyLocalConfig(legacyStorage);

  assert.equal(migrated.version, 1);
  assert.equal(migrated.targetPrepMinutes, 15);
  assert.deepEqual(migrated.subcategoriesByCategory.lanche, ['Smash', 'Gourmet Exclusivo']);
  assert.equal(migrated.ingredientStations['inv-picanha'], 'chapa');

  // Verifica que salvou na chave unificada central
  const rawSaved = legacyStorage.getItem(CENTRAL_CONFIG_STORAGE_KEY);
  assert.ok(rawSaved);
  const parsedSaved = JSON.parse(rawSaved);
  assert.equal(parsedSaved.targetPrepMinutes, 15);
});

test('CentralConfig: Resolução de conflito prioriza versão maior do servidor sobre cache local defasado', () => {
  const localConfig = {
    version: 2,
    updatedAt: '2026-09-17T10:00:00.000Z',
    updatedBy: 'Terminal Caixa',
    targetPrepMinutes: 20,
    fixedExpenses: DEFAULT_CENTRAL_CONFIG.fixedExpenses,
    subcategoriesByCategory: DEFAULT_CENTRAL_CONFIG.subcategoriesByCategory,
    ingredientStations: {},
  };

  const remoteConfig = {
    version: 3,
    updatedAt: '2026-09-17T12:00:00.000Z',
    updatedBy: 'Admin Escritório',
    targetPrepMinutes: 12, // Gestor reduziu a meta para 12 min
    fixedExpenses: DEFAULT_CENTRAL_CONFIG.fixedExpenses,
    subcategoriesByCategory: DEFAULT_CENTRAL_CONFIG.subcategoriesByCategory,
    ingredientStations: {},
  };

  const effective = resolveEffectiveConfig(localConfig, remoteConfig);

  // Remoto com versão 3 deve prevalecer sobre local com versão 2
  assert.equal(effective.version, 3);
  assert.equal(effective.targetPrepMinutes, 12);
  assert.equal(effective.updatedBy, 'Admin Escritório');
});

test('CentralConfig: Resolução de conflito desempata por timestamp mais recente quando as versões forem iguais', () => {
  const configA = {
    version: 2,
    updatedAt: '2026-09-17T10:00:00.000Z',
    updatedBy: 'Terminal 1',
    targetPrepMinutes: 18,
    fixedExpenses: DEFAULT_CENTRAL_CONFIG.fixedExpenses,
    subcategoriesByCategory: DEFAULT_CENTRAL_CONFIG.subcategoriesByCategory,
    ingredientStations: {},
  };

  const configB = {
    version: 2,
    updatedAt: '2026-09-17T11:30:00.000Z', // Mais recente
    updatedBy: 'Terminal 2',
    targetPrepMinutes: 14,
    fixedExpenses: DEFAULT_CENTRAL_CONFIG.fixedExpenses,
    subcategoriesByCategory: DEFAULT_CENTRAL_CONFIG.subcategoriesByCategory,
    ingredientStations: {},
  };

  const effective = resolveEffectiveConfig(configA, configB);

  // configB é mais recente, logo prevalece
  assert.equal(effective.targetPrepMinutes, 14);
  assert.equal(effective.updatedBy, 'Terminal 2');
});

test('CentralConfig: Perfil de impressora padrão inclui controle de guilhotina e colunas', () => {
  assert.equal(DEFAULT_PRINTER_PROFILE.autoCut, true);
  assert.equal(DEFAULT_PRINTER_PROFILE.cutType, 'partial');
  assert.equal(DEFAULT_PRINTER_PROFILE.columnsCount, 48);
  assert.equal(DEFAULT_PRINTER_PROFILE.paperWidth, '80mm');
});

test('CentralConfig: Template padrão de comprovante inclui dados fiscais e mensagem de rodapé', () => {
  assert.equal(DEFAULT_RECEIPT_TEMPLATE.showFiscalData, true);
  assert.equal(DEFAULT_RECEIPT_TEMPLATE.showTaxDetails, true);
  assert.equal(DEFAULT_RECEIPT_TEMPLATE.showQrCodePlaceholder, true);
  assert.ok(DEFAULT_RECEIPT_TEMPLATE.receiptFooterMessage.includes('OBRIGADO PELA PREFERÊNCIA'));
  assert.ok(DEFAULT_RECEIPT_TEMPLATE.storeCnpj);
});

test('CentralConfig: Gerenciamento e resolução de vínculos de terminais físicos', () => {
  assert.ok(Array.isArray(DEFAULT_TERMINAL_BINDINGS));
  assert.ok(DEFAULT_TERMINAL_BINDINGS.length > 0);
  assert.equal(DEFAULT_TERMINAL_BINDINGS[0].terminalId, 'caixa-01');

  const config = {
    ...DEFAULT_CENTRAL_CONFIG,
    terminalBindings: [
      {
        terminalId: 'balcao-02',
        terminalName: 'Balcão de Atendimento 2',
        kitchenPrinterTarget: 'rede_cozinha',
        clientPrinterTarget: 'usb_balcao',
        autoPrintKitchen: true,
        autoPrintClient: true,
        updatedAt: '2026-09-26T12:00:00.000Z',
      }
    ]
  };

  // Terminal explicitamente cadastrado
  const bindingFound = getTerminalBinding(config, 'balcao-02');
  assert.equal(bindingFound.terminalName, 'Balcão de Atendimento 2');
  assert.equal(bindingFound.kitchenPrinterTarget, 'rede_cozinha');
  assert.equal(bindingFound.autoPrintKitchen, true);

  // Terminal não cadastrado deve gerar fallback seguro
  const bindingFallback = getTerminalBinding(config, 'tablet-desconhecido');
  assert.equal(bindingFallback.terminalId, 'tablet-desconhecido');
  assert.equal(bindingFallback.kitchenPrinterTarget, 'padrao_sistema');
});

