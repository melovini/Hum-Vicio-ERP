import { FixedExpensesConfig, DEFAULT_FIXED_EXPENSES, KitchenStation } from './store/types';
import { DEFAULT_SUBCATEGORIES_BY_CATEGORY, CustomSubcategoriesMap } from './subcategory-store';

export interface PrinterProfile {
  name: string;
  paperWidth: '80mm' | '58mm';
  printableWidthMm: number; // 72 for 80mm, 48 for 58mm
  feedLines: number; // Linhas de avanço antes do corte físico (padrão 4)
  fontSizeScale: 'compact' | 'normal' | 'large';
  autoCut: boolean; // Disparo automático de corte de papel ao final da impressão
  cutType: 'full' | 'partial'; // Corte total ou parcial
  columnsCount: 32 | 42 | 48; // Colunas de caracteres no papel
}

export interface ReceiptTemplateConfig {
  showMontagem: boolean;
  showCustomer: boolean;
  showOrderNumber: boolean;
  showOrderType: boolean;
  highlightRemovals: boolean;
  highlightNotes: boolean;
  showStationSummary: boolean;
  storeName: string;
  storeCnpj: string;
  autoPrintOnFinish: boolean;
  // Campos fiscais e de conferência do cliente
  showFiscalData: boolean;
  storeIe: string;
  showTaxDetails: boolean;
  showQrCodePlaceholder: boolean;
  receiptFooterMessage: string;
}

export interface TerminalPrintBinding {
  terminalId: string; // Identificador único (ex: 'caixa-01', 'balcao-01', 'tablet-01')
  terminalName: string; // Nome legível (ex: 'Caixa Balcão Principal')
  kitchenPrinterTarget: string; // Destino de impressão da cozinha (ex: 'padrao_sistema', 'rede_cozinha')
  clientPrinterTarget: string; // Destino de impressão do cupom do cliente (ex: 'padrao_sistema', 'usb_balcao')
  autoPrintKitchen: boolean; // Auto-impressão para a cozinha ao concluir pedido
  autoPrintClient: boolean; // Auto-impressão de comprovante para o cliente
  updatedAt: string;
}

export const DEFAULT_PRINTER_PROFILE: PrinterProfile = {
  name: 'Térmica 80mm Padrão',
  paperWidth: '80mm',
  printableWidthMm: 72,
  feedLines: 4,
  fontSizeScale: 'normal',
  autoCut: true,
  cutType: 'partial',
  columnsCount: 48,
};

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplateConfig = {
  showMontagem: false,
  showCustomer: true,
  showOrderNumber: true,
  showOrderType: true,
  highlightRemovals: true,
  highlightNotes: true,
  showStationSummary: true,
  storeName: 'Hum Vício Hamburgueria',
  storeCnpj: '32.588.610/0001-44',
  autoPrintOnFinish: false,
  showFiscalData: true,
  storeIe: '123.456.789.110',
  showTaxDetails: true,
  showQrCodePlaceholder: true,
  receiptFooterMessage: 'OBRIGADO PELA PREFERÊNCIA!\nVOLTE SEMPRE! 🍔',
};

export const DEFAULT_TERMINAL_BINDINGS: TerminalPrintBinding[] = [
  {
    terminalId: 'caixa-01',
    terminalName: 'Terminal Caixa Principal',
    kitchenPrinterTarget: 'padrao_sistema',
    clientPrinterTarget: 'padrao_sistema',
    autoPrintKitchen: false,
    autoPrintClient: false,
    updatedAt: '2026-09-26T00:00:00.000Z',
  }
];

export interface CentralStoreConfig {
  version: number;
  updatedAt: string;
  updatedBy: string;
  targetPrepMinutes: number;
  fixedExpenses: FixedExpensesConfig;
  subcategoriesByCategory: CustomSubcategoriesMap;
  ingredientStations: Record<string, KitchenStation>;
  printerProfile: PrinterProfile;
  receiptTemplate: ReceiptTemplateConfig;
  terminalBindings: TerminalPrintBinding[];
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
  printerProfile: DEFAULT_PRINTER_PROFILE,
  receiptTemplate: DEFAULT_RECEIPT_TEMPLATE,
  terminalBindings: DEFAULT_TERMINAL_BINDINGS,
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
        // Migração suave de template de impressão se ausente
        let template = parsed.receiptTemplate ? { ...DEFAULT_RECEIPT_TEMPLATE, ...parsed.receiptTemplate } : { ...DEFAULT_RECEIPT_TEMPLATE };
        const legacyShowMontagem = store.getItem('hum_vicio_print_show_montagem');
        if (legacyShowMontagem !== null && !parsed.receiptTemplate) {
          template.showMontagem = legacyShowMontagem === 'true';
        }

        const profile: PrinterProfile = parsed.printerProfile ? {
          ...DEFAULT_PRINTER_PROFILE,
          ...parsed.printerProfile,
          autoCut: parsed.printerProfile.autoCut !== undefined ? parsed.printerProfile.autoCut : DEFAULT_PRINTER_PROFILE.autoCut,
          cutType: parsed.printerProfile.cutType || DEFAULT_PRINTER_PROFILE.cutType,
          columnsCount: parsed.printerProfile.columnsCount || (parsed.printerProfile.paperWidth === '58mm' ? 32 : 48),
        } : { ...DEFAULT_PRINTER_PROFILE };

        const terminalBindings: TerminalPrintBinding[] = Array.isArray(parsed.terminalBindings) && parsed.terminalBindings.length > 0
          ? parsed.terminalBindings
          : DEFAULT_TERMINAL_BINDINGS;

        return {
          version: parsed.version || 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'Terminal Local',
          targetPrepMinutes: Number(parsed.targetPrepMinutes) || 20,
          fixedExpenses: parsed.fixedExpenses || DEFAULT_FIXED_EXPENSES,
          subcategoriesByCategory: parsed.subcategoriesByCategory || DEFAULT_SUBCATEGORIES_BY_CATEGORY,
          ingredientStations: parsed.ingredientStations || {},
          printerProfile: profile,
          receiptTemplate: template,
          terminalBindings,
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

    const legacyShowMontagem = store.getItem('hum_vicio_print_show_montagem');
    const legacyTemplate: ReceiptTemplateConfig = {
      ...DEFAULT_RECEIPT_TEMPLATE,
      showMontagem: legacyShowMontagem !== null ? legacyShowMontagem === 'true' : false,
    };

    const migrated: CentralStoreConfig = {
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Migração Automática de Terminal',
      targetPrepMinutes: legacyPrep,
      fixedExpenses: legacyExpenses,
      subcategoriesByCategory: legacySubcategories,
      ingredientStations: legacyStations,
      printerProfile: DEFAULT_PRINTER_PROFILE,
      receiptTemplate: legacyTemplate,
      terminalBindings: DEFAULT_TERMINAL_BINDINGS,
    };

    store.setItem(CENTRAL_CONFIG_STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (err) {
    console.warn('[CentralConfig] Falha ao migrar configurações legadas:', err);
    return { ...DEFAULT_CENTRAL_CONFIG };
  }
}

export const LOCAL_TERMINAL_ID_STORAGE_KEY = 'hum_vicio_terminal_id';

export function getCurrentTerminalId(): string {
  if (typeof window === 'undefined') return 'caixa-01';
  try {
    return localStorage.getItem(LOCAL_TERMINAL_ID_STORAGE_KEY) || 'caixa-01';
  } catch {
    return 'caixa-01';
  }
}

export function setCurrentTerminalId(terminalId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_TERMINAL_ID_STORAGE_KEY, terminalId);
    window.dispatchEvent(new CustomEvent('hum_vicio_terminal_changed', { detail: terminalId }));
  } catch {}
}

export function getTerminalBinding(config: CentralStoreConfig, terminalId?: string): TerminalPrintBinding {
  const activeId = terminalId || getCurrentTerminalId();
  const found = (config.terminalBindings || []).find(b => b.terminalId === activeId);
  if (found) return found;
  return {
    terminalId: activeId,
    terminalName: `Terminal (${activeId})`,
    kitchenPrinterTarget: 'padrao_sistema',
    clientPrinterTarget: 'padrao_sistema',
    autoPrintKitchen: Boolean(config.receiptTemplate?.autoPrintOnFinish),
    autoPrintClient: false,
    updatedAt: config.updatedAt || new Date().toISOString(),
  };
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

  let chosen: CentralStoreConfig;
  if (remote.version > local.version) {
    chosen = remote;
  } else if (local.version > remote.version) {
    chosen = local;
  } else {
    // Empate de versão: desempate por timestamp ISO
    const localTime = new Date(local.updatedAt).getTime() || 0;
    const remoteTime = new Date(remote.updatedAt).getTime() || 0;
    chosen = remoteTime >= localTime ? remote : local;
  }

  if (!chosen.terminalBindings || !Array.isArray(chosen.terminalBindings) || chosen.terminalBindings.length === 0) {
    return {
      ...chosen,
      terminalBindings: local.terminalBindings || DEFAULT_TERMINAL_BINDINGS,
    };
  }

  return chosen;
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
      if (nextConfig.receiptTemplate) {
        localStorage.setItem('hum_vicio_print_show_montagem', String(nextConfig.receiptTemplate.showMontagem));
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
