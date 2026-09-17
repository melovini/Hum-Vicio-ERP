import { FixedExpensesConfig, DEFAULT_FIXED_EXPENSES, KitchenStation } from './store/types';
import { DEFAULT_SUBCATEGORIES_BY_CATEGORY, CustomSubcategoriesMap } from './subcategory-store';

export interface CentralStoreConfig {
  version: number;
  updatedAt: string;
  updatedBy: string;
  targetPrepMinutes: number;
  fixedExpenses: FixedExpensesConfig;
  subcategoriesByCategory: CustomSubcategoriesMap;
  ingredientStations: Record<string, KitchenStation>;
}

export const CENTRAL_CONFIG_STORAGE_KEY = 'hum_vicio_central_store_config_v1';

export const DEFAULT_CENTRAL_CONFIG: CentralStoreConfig = {
  version: 1,
  updatedAt: '2026-09-17T00:00:00.000Z',
  updatedBy: 'Sistema Padrão',
  targetPrepMinutes: 20,
  fixedExpenses: DEFAULT_FIXED_EXPENSES,
  subcategoriesByCategory: DEFAULT_SUBCATEGORIES_BY_CATEGORY,
  ingredientStations: {},
};

/**
 * Migra de forma não-destrutiva as configurações legadas espalhadas em chaves avulsas do localStorage
 */
export function migrateLegacyLocalConfig(existingStorage?: Storage): CentralStoreConfig {
  const store = existingStorage || (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!store) return { ...DEFAULT_CENTRAL_CONFIG };

  try {
    // 1. Verificar se já existe configuração centralizada
    const centralRaw = store.getItem(CENTRAL_CONFIG_STORAGE_KEY);
    if (centralRaw) {
      const parsed = JSON.parse(centralRaw);
      if (parsed && typeof parsed.version === 'number') {
        return {
          version: parsed.version || 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'Terminal Local',
          targetPrepMinutes: Number(parsed.targetPrepMinutes) || 20,
          fixedExpenses: parsed.fixedExpenses || DEFAULT_FIXED_EXPENSES,
          subcategoriesByCategory: parsed.subcategoriesByCategory || DEFAULT_SUBCATEGORIES_BY_CATEGORY,
          ingredientStations: parsed.ingredientStations || {},
        };
      }
    }

    // 2. Coletar chaves legadas sem apagar dados pré-existentes
    let legacyPrep = 20;
    const rawPrep = store.getItem('hum_vicio_target_prep_minutes');
    if (rawPrep && !isNaN(Number(rawPrep))) {
      legacyPrep = Number(rawPrep);
    }

    let legacyExpenses = DEFAULT_FIXED_EXPENSES;
    const rawExpenses = store.getItem('hum_vicio_fixed_expenses_config');
    if (rawExpenses) {
      try {
        legacyExpenses = { ...DEFAULT_FIXED_EXPENSES, ...JSON.parse(rawExpenses) };
      } catch {}
    }

    let legacySubcategories = DEFAULT_SUBCATEGORIES_BY_CATEGORY;
    const rawSubcats = store.getItem('hum_vicio_custom_subcategories_by_category');
    if (rawSubcats) {
      try {
        legacySubcategories = { ...DEFAULT_SUBCATEGORIES_BY_CATEGORY, ...JSON.parse(rawSubcats) };
      } catch {}
    }

    let legacyStations: Record<string, KitchenStation> = {};
    const rawStations = store.getItem('hum_vicio_ingredient_stations_map');
    if (rawStations) {
      try {
        legacyStations = JSON.parse(rawStations);
      } catch {}
    }

    const migrated: CentralStoreConfig = {
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Migração Automática de Terminal',
      targetPrepMinutes: legacyPrep,
      fixedExpenses: legacyExpenses,
      subcategoriesByCategory: legacySubcategories,
      ingredientStations: legacyStations,
    };

    store.setItem(CENTRAL_CONFIG_STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (err) {
    console.warn('[CentralConfig] Falha ao migrar configurações legadas:', err);
    return { ...DEFAULT_CENTRAL_CONFIG };
  }
}

/**
 * Resolve conflito de configurações entre terminal local e servidor:
 * A versão com número de versão maior prevalece. Em caso de empate, prevalece a alteração mais recente.
 */
export function resolveEffectiveConfig(
  local: CentralStoreConfig,
  remote: CentralStoreConfig
): CentralStoreConfig {
  if (!remote || typeof remote.version !== 'number') return local;
  if (!local || typeof local.version !== 'number') return remote;

  if (remote.version > local.version) {
    return remote;
  }

  if (local.version > remote.version) {
    return local;
  }

  // Empate de versão: desempate por timestamp ISO
  const localTime = new Date(local.updatedAt).getTime() || 0;
  const remoteTime = new Date(remote.updatedAt).getTime() || 0;

  return remoteTime >= localTime ? remote : local;
}

/**
 * Obtém a configuração operacional atualmente ativa no terminal
 */
export function getActiveCentralConfig(): CentralStoreConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CENTRAL_CONFIG };
  return migrateLegacyLocalConfig();
}

/**
 * Salva e incrementa a versão da configuração operacional aprovada pela gestão
 */
export function publishCentralConfig(
  updates: Partial<Omit<CentralStoreConfig, 'version' | 'updatedAt'>>,
  authorName: string = 'Gestor'
): CentralStoreConfig {
  const current = getActiveCentralConfig();
  const nextConfig: CentralStoreConfig = {
    ...current,
    ...updates,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: authorName,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CENTRAL_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      // Sincroniza retrocompativelmente com chaves legadas para componentes externos
      if (nextConfig.targetPrepMinutes) {
        localStorage.setItem('hum_vicio_target_prep_minutes', String(nextConfig.targetPrepMinutes));
      }
      if (nextConfig.fixedExpenses) {
        localStorage.setItem('hum_vicio_fixed_expenses_config', JSON.stringify(nextConfig.fixedExpenses));
      }
      if (nextConfig.subcategoriesByCategory) {
        localStorage.setItem('hum_vicio_custom_subcategories_by_category', JSON.stringify(nextConfig.subcategoriesByCategory));
      }
      if (nextConfig.ingredientStations) {
        localStorage.setItem('hum_vicio_ingredient_stations_map', JSON.stringify(nextConfig.ingredientStations));
      }

      // Notifica abas e componentes locais
      window.dispatchEvent(new CustomEvent('hum_vicio_config_updated', { detail: nextConfig }));

      // Sincroniza de forma assíncrona com o servidor central (V06)
      fetch('/api/central-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig),
      }).catch(err => console.warn('[CentralConfig] Falha ao sincronizar publicação com servidor:', err));
    } catch {}
  }

  return nextConfig;
}

/**
 * Sincroniza a configuração central com o servidor (V06).
 * Busca a versão oficial do servidor e resolve com a local usando resolveEffectiveConfig.
 */
export async function syncCentralConfigWithServer(): Promise<CentralStoreConfig> {
  const local = getActiveCentralConfig();
  if (typeof window === 'undefined') return local;

  try {
    const res = await fetch('/api/central-config', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-store' },
    });
    if (res.ok) {
      const remote = (await res.json()) as CentralStoreConfig;
      if (remote && typeof remote.version === 'number') {
        const effective = resolveEffectiveConfig(local, remote);
        if (effective.version !== local.version || effective.updatedAt !== local.updatedAt) {
          localStorage.setItem(CENTRAL_CONFIG_STORAGE_KEY, JSON.stringify(effective));
          window.dispatchEvent(new CustomEvent('hum_vicio_config_updated', { detail: effective }));
        }
        return effective;
      }
    }
  } catch (err) {
    console.warn('[CentralConfig] Falha ao sincronizar com o servidor:', err);
  }

  return local;
}
