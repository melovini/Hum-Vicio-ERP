import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  DEFAULT_CENTRAL_CONFIG,
  CENTRAL_CONFIG_STORAGE_KEY,
  migrateLegacyLocalConfig,
  resolveEffectiveConfig,
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
