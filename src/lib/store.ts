'use client';
import { useState, useEffect, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase';
import { 
  isTrainingModeActive, setTrainingModeActive, resetTrainingSandbox,
  getTrainingSales, saveTrainingSales, 
  getTrainingCashSession, saveTrainingCashSession, 
  getTrainingMovements, saveTrainingMovements 
} from '@/lib/training';


import { 
  StockStatus, KitchenStation, InventoryItem, RecipeIngredient, 
  RecipeProductionStation, RecipeProductionKind,
  SubRecipeItem, Product, GiftReason, SaleItem, ProductionStatus, 
  DelayReason, Sale, FixedExpensesConfig, DEFAULT_FIXED_EXPENSES, 
  CashMovement, CashClosingDetails, CashSession, AuditAction, 
  AuditLog, WasteRecord, ChecklistTask, DailyChecklist, Supplier, 
  PurchaseRecord, StockAuditItem, StockAudit, KitchenComponent 
} from './store/types';
import { DEFAULT_KITCHEN_COMPONENTS } from './kitchen-calculator';

export type { RecipeProductionStation, RecipeProductionKind };
import { 
  DEFAULT_INGREDIENT_STATIONS, getDefaultStationForIngredient, 
  getSavedStationMap, isValidProductionTransition 
} from './store/production-rules';
import { 
  DenominationCounts, INITIAL_DENOMINATIONS, calculateDenominationsTotal, 
  computeCashClosingVariances 
} from './store/cash-operations';
import { inferDefaultSubcategory } from './recipe-helpers';
import { getFallbackSubcategoryForCategory } from './subcategory-store';
import { prepareCheckoutItems } from './checkout-production';
import { getActiveCentralConfig, publishCentralConfig } from './central-config';
import {
  getOfflineSalesQueueSync,
  enqueueOfflineSale as idbEnqueueOfflineSale,
  updateOfflineSaleInQueue as idbUpdateOfflineSaleInQueue,
  removeOfflineSaleFromQueue as idbRemoveOfflineSaleFromQueue,
  saveOfflineSalesQueue as idbSaveOfflineSalesQueue,
  initOfflineOutbox,
} from './offline-outbox';

// === DOMÍNIO MODULARIZADO (Frente 5.1 - Separação de Responsabilidades) ===
export * from './store/types';
export * from './store/production-rules';
export * from './store/cash-operations';

/**
 * Mapper unificado e determinístico para itens de venda (V03).
 * Garante que carga inicial, polling periódico e edições compartilhem a mesma estrutura
 * preservando imutabilidade de snapshot, versão da receita, ponto, combo e retiradas.
 */
export function mapRemoteSaleItem(i: any): SaleItem {
  return {
    id: i.id,
    productId: i.product_id ?? i.productId,
    productName: i.product_name ?? i.productName,
    quantity: Number(i.quantity) || 0,
    unitPrice: Number(i.unit_price ?? i.unitPrice) || 0,
    originalPrice: (i.original_price ?? i.originalPrice) ? Number(i.original_price ?? i.originalPrice) : undefined,
    isGift: Boolean(i.is_gift ?? i.isGift),
    giftReason: i.gift_reason ?? i.giftReason ?? undefined,
    giftNotes: i.gift_notes ?? i.giftNotes ?? undefined,
    comboId: i.combo_id ?? i.comboId ?? undefined,
    combo: i.combo ?? undefined,
    comboPrice: (i.combo_price ?? i.comboPrice) ? Number(i.combo_price ?? i.comboPrice) : undefined,
    meatPoint: i.meat_point ?? i.meatPoint ?? undefined,
    removals: Array.isArray(i.removals) ? i.removals : undefined,
    additionals: Array.isArray(i.additionals) ? i.additionals : undefined,
    notes: i.notes ? i.notes.trim().toUpperCase() : undefined,
    recipeVersion: (i.recipe_version ?? i.recipeVersion) ? Number(i.recipe_version ?? i.recipeVersion) : undefined,
    productionSnapshot: i.production_snapshot ?? i.productionSnapshot ?? undefined
  };
}

const defaultChecklistTasks: ChecklistTask[] = [
  { id: '1', label: 'Verificar o conteúdo do freezer e geladeiras e ver o que será necessário', checked: false },
  { id: '2', label: 'Verificar os pães e a integridade deles', checked: false },
  { id: '3', label: 'Verificar a quantidade de carne', checked: false },
  { id: '4', label: 'Verificar a lista de compras', checked: false },
  { id: '5', label: 'Verificar o freezer de verduras e queijos', checked: false },
];

function getSavedProductionOverrides(): Record<string, { status: ProductionStatus; startedAt?: string }> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_prod_status_map') || '{}');
  } catch {
    return {};
  }
}

function saveProductionOverrides(updates: { id: string; status: ProductionStatus; startedAt?: string }[]) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedProductionOverrides();
    updates.forEach(u => {
      map[u.id] = { status: u.status, startedAt: u.startedAt };
    });
    localStorage.setItem('hum_vicio_prod_status_map', JSON.stringify(map));
  } catch {}
}

function removeProductionOverrides(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedProductionOverrides();
    let changed = false;
    ids.forEach(id => {
      if (map[id]) {
        delete map[id];
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('hum_vicio_prod_status_map', JSON.stringify(map));
    }
  } catch {}
}

function getSavedMinStockMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_min_stock_map') || '{}');
  } catch {
    return {};
  }
}

function saveMinStockItem(id: string, minStock: number) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedMinStockMap();
    map[id] = minStock;
    localStorage.setItem('hum_vicio_min_stock_map', JSON.stringify(map));
  } catch {}
}

export function saveStationItem(id: string, station: KitchenStation) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedStationMap();
    map[id] = station;
    localStorage.setItem('hum_vicio_ingredient_stations_map', JSON.stringify(map));
  } catch {}
}

export interface ItemProductionMeta {
  productionStation?: RecipeProductionStation;
  productionKind?: RecipeProductionKind;
  portionWeight?: number;
  portionUnit?: string;
  kitchenComponentId?: string;
}

export function getSavedItemProductionMetaMap(): Record<string, ItemProductionMeta> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_item_production_meta_map') || '{}');
  } catch {
    return {};
  }
}

export function saveItemProductionMeta(id: string, meta: Partial<ItemProductionMeta>) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedItemProductionMetaMap();
    map[id] = { ...map[id], ...meta };
    localStorage.setItem('hum_vicio_item_production_meta_map', JSON.stringify(map));
  } catch {}
}

export function getSavedProductSubcategoriesMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_product_subcategories_map') || '{}');
  } catch {
    return {};
  }
}

export function saveProductSubcategoryItem(id: string, subcategory: string) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedProductSubcategoriesMap();
    map[id] = subcategory;
    localStorage.setItem('hum_vicio_product_subcategories_map', JSON.stringify(map));
  } catch {}
}

export interface ProductAddonsConfig {
  acceptsAddons?: boolean;
  allowedAddonIds?: string[];
  isAddon?: boolean;
}

export function getSavedProductAddonsMap(): Record<string, ProductAddonsConfig> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_product_addons_map') || '{}');
  } catch {
    return {};
  }
}

export function saveProductAddonItem(id: string, config: ProductAddonsConfig) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedProductAddonsMap();
    map[id] = { ...map[id], ...config };
    localStorage.setItem('hum_vicio_product_addons_map', JSON.stringify(map));
  } catch {}
}

function getSavedCreditSalesMap(): Record<string, {
  collaboratorId?: string;
  collaboratorName?: string;
  creditCustomerName?: string;
  creditDueDate?: string;
  creditNotes?: string;
  creditStatus?: 'pendente' | 'quitado';
  creditPaidAt?: string;
  creditPaidMethod?: string;
}> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_credit_sales_map') || '{}');
  } catch {
    return {};
  }
}

function saveCreditSaleOverride(saleId: string, creditData: any) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedCreditSalesMap();
    map[saleId] = { ...(map[saleId] || {}), ...creditData };
    localStorage.setItem('hum_vicio_credit_sales_map', JSON.stringify(map));
  } catch {}
}

// === CONTROLE DE PAGAMENTO NA RETIRADA (PERSISTÊNCIA LOCAL) ===
const STORAGE_PICKUP_PENDING_KEY = 'hum_vicio_pickup_pending_map';

export function getSavedPickupPendingSalesMap(): Record<string, {
  paymentStatus?: 'pago' | 'pendente_retirada';
  paidAt?: string;
  paidMethod?: string;
}> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PICKUP_PENDING_KEY) || '{}');
  } catch {
    return {};
  }
}

export function savePickupPendingOverride(saleId: string, pickupData: any): void {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedPickupPendingSalesMap();
    map[saleId] = { ...(map[saleId] || {}), ...pickupData };
    localStorage.setItem(STORAGE_PICKUP_PENDING_KEY, JSON.stringify(map));
  } catch {}
}

// === CONTROLE DE RETIRADA CONCLUÍDA PELO CLIENTE (PERSISTÊNCIA LOCAL) ===
const STORAGE_DELIVERED_PICKUPS_KEY = 'hum_vicio_delivered_pickups';

export function getSavedDeliveredPickupsMap(): Record<string, {
  deliveredAt?: string;
  deliveredBy?: string;
}> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_DELIVERED_PICKUPS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveDeliveredPickupOverride(saleId: string, deliveryData: { deliveredAt?: string; deliveredBy?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedDeliveredPickupsMap();
    map[saleId] = { ...(map[saleId] || {}), ...deliveryData };
    localStorage.setItem(STORAGE_DELIVERED_PICKUPS_KEY, JSON.stringify(map));
  } catch {}
}

// === FILA DE SINCRONIZAÇÃO OFFLINE RESILIENTE (INDEXEDDB COM MIGRAÇÃO TRANSPARENTE) ===
export function getOfflineSalesQueue(): Sale[] {
  return getOfflineSalesQueueSync();
}

export function saveOfflineSalesQueue(queue: Sale[]): void {
  void idbSaveOfflineSalesQueue(queue);
}

export function enqueueOfflineSale(sale: Sale): void {
  void idbEnqueueOfflineSale(sale);
}

export function updateOfflineSaleInQueue(saleId: string, updates: Partial<Sale>): void {
  void idbUpdateOfflineSaleInQueue(saleId, updates);
}

export function removeOfflineSaleFromQueue(saleId: string): void {
  void idbRemoveOfflineSaleFromQueue(saleId);
}

// Drena e sincroniza as vendas offline para o Supabase quando a conexão estiver restabelecida
let activeQueueSync: Promise<{ syncedCount: number; errorsCount: number }> | null = null;
export function syncOfflineSalesQueue(supabaseClient?: any): Promise<{ syncedCount: number; errorsCount: number }> {
  if (activeQueueSync) return activeQueueSync;
  const run = () => drainOfflineSalesQueue(supabaseClient);
  const pending = (async () => typeof navigator !== 'undefined' && navigator.locks
    ? await navigator.locks.request('hum-vicio-sales-sync', run) : await run())();
  activeQueueSync = pending.finally(() => { activeQueueSync = null; });
  return activeQueueSync;
}
async function drainOfflineSalesQueue(supabaseClient?: any): Promise<{ syncedCount: number; errorsCount: number }> {
  const queue = getOfflineSalesQueue();
  if (!Array.isArray(queue) || queue.length === 0) return { syncedCount: 0, errorsCount: 0 };

  let syncedCount = 0;
  let errorsCount = 0;

  for (const sale of queue) {
    // Pula vendas marcadas com falha definitiva de validação para permitir que outras prossigam
    if (sale.syncStatus === 'failed') { errorsCount++; continue; }

    try {
      const idempotencyKey = (sale as any).idempotencyKey || `sale_checkout_${sale.id}`;
      const res = await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey, sale }),
      });

      if (res.ok) {
        removeOfflineSaleFromQueue(sale.id);
        syncedCount++;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Falha na sincronização transacional da venda offline:', sale.id, errJson);
        errorsCount++;
        updateOfflineSaleInQueue(sale.id, { syncError: errJson.message || (typeof errJson.error === 'string' ? errJson.error : 'O servidor não confirmou o pedido. Tente sincronizar novamente.') });
        // Se rejeitada por validação de negócio definitiva (ex: 400), marca como falha para inspeção do operador
        if (res.status === 400) {
          updateOfflineSaleInQueue(sale.id, {
            syncStatus: 'failed',
            syncError: errJson.message || errJson.error || 'Validação de pedido falhou no servidor'
          });
        } else {
          break; // Servidor temporariamente indisponível ou fora do ar
        }
      }
    } catch (err) {
      console.warn('Banco offline ou indisponível ao tentar drenar venda:', err);
      errorsCount++;
      break; // Interrompe para tentar na próxima rodada
    }
  }

  return { syncedCount, errorsCount };
}

function getSavedFixedExpensesConfig(): FixedExpensesConfig {
  if (typeof window === 'undefined') return DEFAULT_FIXED_EXPENSES;
  try {
    return getActiveCentralConfig().fixedExpenses || DEFAULT_FIXED_EXPENSES;
  } catch {
    return DEFAULT_FIXED_EXPENSES;
  }
}

export type ConnectionStatus = 'connected' | 'server_unreachable' | 'offline';

export interface GlobalStoreState {
  items: InventoryItem[];
  products: Product[];
  kitchenComponents: KitchenComponent[];
  isLoaded: boolean;
  fixedExpensesConfig: FixedExpensesConfig;
  isOpen: boolean;
  activeCashSession: CashSession | null;
  allCashSessions: CashSession[];
  targetPrepMinutes: number;
  sales: Sale[];
  movements: CashMovement[];
  isTrainingMode: boolean;
  offlineQueueCount: number;
  offlineSalesList: Sale[];
  isOnline: boolean;
  connectionStatus: ConnectionStatus;
  lastServerSync: string | null;
  wasteRecords: WasteRecord[];
  checklist: DailyChecklist | null;
  allChecklists: DailyChecklist[];
  suppliers: Supplier[];
  purchaseRecords: PurchaseRecord[];
  stockAudits: StockAudit[];
  subRecipes: SubRecipeItem[];
  auditLogs: AuditLog[];
  lastFetchedAt: number;
}

const serverInitialState: GlobalStoreState = {
  items: [],
  products: [],
  kitchenComponents: DEFAULT_KITCHEN_COMPONENTS,
  isLoaded: false,
  fixedExpensesConfig: DEFAULT_FIXED_EXPENSES,
  isOpen: false,
  activeCashSession: null,
  allCashSessions: [],
  targetPrepMinutes: 20,
  sales: [],
  movements: [],
  isTrainingMode: false,
  offlineQueueCount: 0,
  offlineSalesList: [],
  isOnline: true,
  connectionStatus: 'connected',
  lastServerSync: null,
  wasteRecords: [],
  checklist: null,
  allChecklists: [],
  suppliers: [],
  purchaseRecords: [],
  stockAudits: [],
  subRecipes: [],
  auditLogs: [],
  lastFetchedAt: 0
};

export function getInitialGlobalState(): GlobalStoreState {
  let cachedItems: InventoryItem[] = [];
  let cachedProducts: Product[] = [];
  let cachedSales: Sale[] = [];
  let cachedSessions: CashSession[] = [];
  let activeSession: CashSession | null = null;
  let cachedLogs: AuditLog[] = [];
  let lastSync: string | null = null;
  let cachedComponents: KitchenComponent[] = DEFAULT_KITCHEN_COMPONENTS;
  let hasCache = false;

  if (typeof window !== 'undefined') {
    try {
      const sComps = localStorage.getItem('hum_vicio_cached_kitchen_components');
      if (sComps) {
        const parsed = JSON.parse(sComps);
        if (Array.isArray(parsed) && parsed.length > 0) cachedComponents = parsed;
      }
    } catch {}
    try {
      const sItems = localStorage.getItem('hum_vicio_cached_inventory');
      if (sItems) {
        cachedItems = JSON.parse(sItems);
        if (Array.isArray(cachedItems) && cachedItems.length > 0) hasCache = true;
      }
    } catch {}
    try {
      const sProds = localStorage.getItem('hum_vicio_cached_products');
      if (sProds) {
        cachedProducts = JSON.parse(sProds);
        if (Array.isArray(cachedProducts) && cachedProducts.length > 0) hasCache = true;
      }
    } catch {}
    try {
      const sSales = localStorage.getItem('hum_vicio_cached_sales');
      if (sSales) {
        cachedSales = JSON.parse(sSales);
        if (Array.isArray(cachedSales) && cachedSales.length > 0) hasCache = true;
      }
    } catch {}
    try {
      const sSess = localStorage.getItem('hum_vicio_cached_sessions');
      if (sSess) cachedSessions = JSON.parse(sSess);
    } catch {}
    try {
      const sActive = localStorage.getItem('hum_vicio_active_session');
      if (sActive) {
        const parsed = JSON.parse(sActive);
        if (parsed && parsed.status === 'open') {
          activeSession = parsed;
          hasCache = true;
        }
      }
    } catch {}
    try {
      const sLogs = localStorage.getItem('hum_vicio_audit_logs');
      if (sLogs) cachedLogs = JSON.parse(sLogs);
    } catch {}
    try {
      lastSync = localStorage.getItem('hum_vicio_last_server_sync') || null;
    } catch {}
  }

  if (!activeSession && cachedSessions.length > 0) {
    activeSession = cachedSessions.find(s => s.status === 'open') || null;
  }

  return {
    items: cachedItems,
    products: cachedProducts,
    kitchenComponents: cachedComponents,
    isLoaded: hasCache,
    fixedExpensesConfig: getSavedFixedExpensesConfig(),
    isOpen: !!activeSession,
    activeCashSession: activeSession,
    allCashSessions: cachedSessions,
    targetPrepMinutes: typeof window !== 'undefined' ? (getActiveCentralConfig().targetPrepMinutes || 20) : 20,
    sales: cachedSales,
    movements: [],
    isTrainingMode: false,
    offlineQueueCount: 0,
    offlineSalesList: [],
    isOnline: true,
    connectionStatus: 'connected',
    lastServerSync: lastSync,
    wasteRecords: [],
    checklist: null,
    allChecklists: [],
    suppliers: [],
    purchaseRecords: [],
    stockAudits: [],
    subRecipes: [],
    auditLogs: cachedLogs,
    lastFetchedAt: 0
  };
}

let globalStore: GlobalStoreState = getInitialGlobalState();
const storeListeners = new Set<() => void>();

function notifyStoreUpdated() {
  storeListeners.forEach(listener => {
    try {
      listener();
    } catch {}
  });
}

function updateGlobalStore(partial: Partial<GlobalStoreState> | ((prev: GlobalStoreState) => Partial<GlobalStoreState>)) {
  const updates = typeof partial === 'function' ? partial(globalStore) : partial;
  globalStore = { ...globalStore, ...updates };
  notifyStoreUpdated();
}

let activeLoadPromise: Promise<void> | null = null;

export async function executeParallelLoadData(
  supabaseClient: any,
  scope: 'caixa' | 'cozinha' | 'admin' | 'all' = 'all'
): Promise<void> {
  if (activeLoadPromise) {
    return activeLoadPromise;
  }

  activeLoadPromise = (async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA');

      let invData: any = null;
      let prodData: any = null;
      let recData: any = null;
      let salesData: any = null;
      let saleItemsData: any = null;
      let allSessData: any = null;
      let movData: any = null;
      let wasteData: any = null;
      let allChecks: any = null;
      let supData: any = null;
      let purchData: any = null;
      let auditData: any = null;
      let subData: any = null;
      let logsData: any = null;
      let compsData: any = null;

      // 1. Tentar bootstrap unificado ultrarrápido com escopo específico por módulo
      let bootstrapLoaded = false;
      try {
        const bRes = await fetch(`/api/bootstrap?scope=${scope}`, { cache: 'no-store', credentials: 'include' });
        if (bRes.ok) {
          const bData = await bRes.json();
          invData = bData.inventory || [];
          prodData = bData.products || [];
          recData = bData.recipes || [];
          salesData = bData.sales || [];
          saleItemsData = bData.saleItems || [];
          allSessData = bData.cashSessions || [];
          movData = bData.cashMovements || [];
          wasteData = bData.wasteRecords || [];
          allChecks = bData.checklists || [];
          supData = bData.suppliers || [];
          purchData = bData.purchaseRecords || [];
          auditData = bData.stockAudits || [];
          subData = bData.subRecipes || [];
          logsData = bData.auditLogs || [];
          compsData = bData.kitchenComponents || [];
          bootstrapLoaded = true;
        }
      } catch {}

      // 2. Fallback resiliente caso o bootstrap falhe ou ambiente offline
      if (!bootstrapLoaded) {
        const [
          allSessRes,
          invRes,
          prodRes,
          recRes,
          salesRes,
          saleItemsRes,
          checksRes,
          compsRes
        ] = await Promise.all([
          supabaseClient.from('cash_sessions').select('*').is('deleted_at', null).order('opened_at', { ascending: false }).catch(() => ({ data: null })),
          supabaseClient.from('inventory').select('*').catch(() => ({ data: null })),
          supabaseClient.from('products').select('*').catch(() => ({ data: null })),
          supabaseClient.from('recipes').select('*').catch(() => ({ data: null })),
          supabaseClient.from('sales').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(80).catch(() => ({ data: null })),
          Promise.resolve({ data: [] }),
          supabaseClient.from('kitchen_checklists').select('*').order('date', { ascending: false }).catch(() => ({ data: null })),
          supabaseClient.from('kitchen_components').select('*').order('name', { ascending: true }).catch(() => ({ data: null }))
        ]);

        allSessData = allSessRes?.data;
        invData = invRes?.data;
        prodData = prodRes?.data;
        recData = recRes?.data;
        salesData = salesRes?.data;
        const visibleSaleIds = (salesRes?.data || []).map((sale: any) => sale.id);
        saleItemsData = visibleSaleIds.length ? (await supabaseClient.from('sale_items').select('*').in('sale_id', visibleSaleIds)).data : [];
        allChecks = checksRes?.data;
        compsData = compsRes?.data;
      }

      // 1. Processar Insumos
      let mappedItems = globalStore.items;
      if (invData) {
        const minStockMap = getSavedMinStockMap();
        const stationMap = getSavedStationMap();
        const metaMap = getSavedItemProductionMetaMap();
        mappedItems = (invData as any[]).map(i => {
          const customStation = (i.station || stationMap[i.id] || getDefaultStationForIngredient(i.name)) as KitchenStation;
          const meta = metaMap[i.id] || {};
          return {
            id: i.id, name: i.name, category: i.category, unit: i.unit, 
            costPerUnit: Number(i.cost_per_unit ?? i.costPerUnit) || 0, 
            currentStock: Number(i.current_stock ?? i.currentStock) || 0, 
            minStock: i.min_stock !== undefined && i.min_stock !== null 
              ? Number(i.min_stock) 
              : i.minStock !== undefined && i.minStock !== null 
                ? Number(i.minStock) 
                : minStockMap[i.id],
            status: i.status,
            isActive: i.is_active !== undefined ? i.is_active : (i.isActive !== undefined ? i.isActive : true),
            station: customStation,
            productionStation: i.production_station || meta.productionStation,
            productionKind: i.production_kind || meta.productionKind,
            portionWeight: i.portion_weight !== undefined ? Number(i.portion_weight) : meta.portionWeight,
            portionUnit: i.portion_unit || meta.portionUnit || 'g',
            kitchenComponentId: 'kitchen_component_id' in i ? (i.kitchen_component_id || undefined) : meta.kitchenComponentId,
          };
        });
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('hum_vicio_cached_inventory', JSON.stringify(mappedItems)); } catch {}
        }
      }

      // 2. Processar Produtos e Fichas Técnicas
      let mappedProducts = globalStore.products;
      if (prodData) {
        const recipesList = (recData as any[]) || [];
        const subcategoryMap = getSavedProductSubcategoriesMap();
        const addonsMap = getSavedProductAddonsMap();
        const serverProducts = (prodData as any[]).map(p => {
          const rawSub = p.subcategory || subcategoryMap[p.id] || undefined;
          const addonConf = addonsMap[p.id] || {};
          const prodObj: Product = {
            id: p.id,
            name: p.name,
            category: p.category,
            subcategory: rawSub,
            priceBalcao: Number(p.price_balcao) || 0, 
            priceIfood: Number(p.price_ifood) || 0,
            isActive: p.is_active !== undefined ? Boolean(p.is_active) : true,
            status: p.status || (p.is_active === false ? 'inativo' : (recipesList.some(r => r.product_id === p.id) ? 'validado' : 'rascunho')),
            acceptsAddons: p.accepts_addons ?? addonConf.acceptsAddons ?? (p.category === 'lanche'),
            allowedAddonIds: p.allowed_addon_ids ?? addonConf.allowedAddonIds,
            isAddon: p.is_addon ?? addonConf.isAddon ?? false,
            recipe: recipesList.filter(r => r.product_id === p.id).map(r => ({
              ingredientId: r.ingredient_id,
              quantity: Number(r.quantity) || 0,
              kitchenComponentId: r.kitchen_component_id || undefined,
              productionStation: r.production_station || undefined,
              productionKind: r.production_kind || undefined,
            }))
          };
          if (!prodObj.subcategory) {
            prodObj.subcategory = inferDefaultSubcategory(prodObj);
          }
          return prodObj;
        });

        // Preservar produtos criados localmente que ainda não foram confirmados no servidor
        const localOnlyProducts = globalStore.products.filter(
          p => p.id.startsWith('prod_') && !serverProducts.some(sp => sp.id === p.id)
        );
        mappedProducts = [...serverProducts, ...localOnlyProducts];

        if (typeof window !== 'undefined') {
          try { localStorage.setItem('hum_vicio_cached_products', JSON.stringify(mappedProducts)); } catch {}
        }
      }

      // 2.1 Processar Componentes de Preparo
      let mappedComponents = globalStore.kitchenComponents || DEFAULT_KITCHEN_COMPONENTS;
      if (compsData && Array.isArray(compsData) && compsData.length > 0) {
        mappedComponents = (compsData as any[]).map(c => ({
          id: c.id,
          name: c.name,
          componentType: c.component_type || c.componentType,
          station: c.station,
          productionUnit: c.production_unit || c.productionUnit || 'unidade',
          portionWeight: c.portion_weight !== undefined && c.portion_weight !== null ? Number(c.portion_weight) : c.portionWeight,
          portionUnit: c.portion_unit || c.portionUnit || 'g',
          showInSummary: c.show_in_summary !== undefined ? c.show_in_summary : (c.showInSummary !== false),
          isActive: c.is_active !== undefined ? c.is_active : (c.isActive !== false),
        }));
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('hum_vicio_cached_kitchen_components', JSON.stringify(mappedComponents)); } catch {}
        }
      }

      // 3. Processar Vendas
      let mappedSales = globalStore.sales;
      if (salesData && salesData.length > 0) {
        const overrides = getSavedProductionOverrides();
        const creditMap = getSavedCreditSalesMap();
        const pickupMap = getSavedPickupPendingSalesMap();
        const deliveredMap = getSavedDeliveredPickupsMap();
        let overridesCleaned = false;
        const saleItemsList = (saleItemsData as any[]) || [];
        const itemsBySale = new Map<string, any[]>();
        for (const item of saleItemsList) {
          if (!item.sale_id) continue;
          let list = itemsBySale.get(item.sale_id);
          if (!list) {
            list = [];
            itemsBySale.set(item.sale_id, list);
          }
          list.push(item);
        }

        const remoteSales: Sale[] = (salesData as any[]).map(s => {
          const override = overrides[s.id];
          const creditInfo = creditMap[s.id] || {};
          const pickupInfo = pickupMap[s.id] || {};
          let prodStatus: ProductionStatus;
          if (s.status === 'cancelled') {
            prodStatus = (s.production_status === 'concluido' ? 'em_espera' : (s.production_status || 'em_espera')) as ProductionStatus;
            if (override) {
              delete overrides[s.id];
              overridesCleaned = true;
            }
          } else if (override) {
            if (s.production_status === override.status || (override.status !== 'concluido' && s.production_status === 'concluido')) {
              prodStatus = (s.production_status || override.status) as ProductionStatus;
              delete overrides[s.id];
              overridesCleaned = true;
            } else {
              prodStatus = override.status;
            }
          } else {
            prodStatus = (s.production_status || 'em_producao') as ProductionStatus;
          }
          const prodStarted = override?.startedAt || s.production_started_at || s.created_at;

          let parsedDiff: any = undefined;
          let parsedIsModified = false;
          if (s.delay_notes && typeof s.delay_notes === 'string' && s.delay_notes.includes('KITCHEN_DIFF')) {
            try {
              const parsed = JSON.parse(s.delay_notes);
              if (parsed.tag === 'KITCHEN_DIFF') {
                parsedDiff = parsed.orderDiff;
                parsedIsModified = true;
              }
            } catch {}
          }

          const paymentStatus = pickupInfo.paymentStatus || s.payment_status || (s.payment_method === 'consumo_funcionario' || s.payment_method === 'fiado_vip' ? 'pendente_retirada' : 'pago');
          const sItems = itemsBySale.get(s.id) || [];

          return {
            id: s.id, 
            customerName: creditInfo.creditCustomerName || s.customer_name || 'Balcão',
            orderType: (s.order_type || (s.channel === 'ifood' ? 'delivery' : 'mesa')) as any,
            channel: s.channel, 
            total: Number(s.total) || 0, 
            paymentMethod: s.payment_method, 
            paymentStatus,
            paidAt: pickupInfo.paidAt || s.paid_at || undefined,
            paidMethod: pickupInfo.paidMethod || s.paid_method || undefined,
            deliveredAt: deliveredMap[s.id]?.deliveredAt || s.delivered_at || undefined,
            deliveredBy: deliveredMap[s.id]?.deliveredBy || s.delivered_by || undefined,
            isOfflineSynced: true,
            date: s.created_at, 
            status: s.status,
            productionStatus: prodStatus,
            productionStartedAt: prodStarted,
            productionCompletedAt: s.production_completed_at || undefined,
            productionTimeMinutes: s.production_time_minutes ? Number(s.production_time_minutes) : undefined,
            targetPrepMinutes: s.target_prep_minutes ? Number(s.target_prep_minutes) : 20,
            delayReason: s.delay_reason || undefined,
            delayNotes: s.delay_notes || undefined,
            orderDiff: parsedDiff,
            isModifiedInKitchen: parsedIsModified,
            collaboratorId: creditInfo.collaboratorId || s.collaborator_id || undefined,
            collaboratorName: creditInfo.collaboratorName || s.collaborator_name || undefined,
            creditCustomerName: creditInfo.creditCustomerName || s.credit_customer_name || undefined,
            creditDueDate: creditInfo.creditDueDate || s.credit_due_date || undefined,
            creditNotes: creditInfo.creditNotes || s.credit_notes || undefined,
            creditStatus: creditInfo.creditStatus || s.credit_status || (s.payment_method === 'consumo_funcionario' || s.payment_method === 'fiado_vip' ? 'pendente' : undefined),
            creditPaidAt: creditInfo.creditPaidAt || s.credit_paid_at || undefined,
            creditPaidMethod: creditInfo.creditPaidMethod || s.credit_paid_method || undefined,
            items: sItems.map(mapRemoteSaleItem)
          };
        });

        const offlineQueue = getOfflineSalesQueue();
        const unpersisted = offlineQueue.filter(oq => !remoteSales.some(ms => ms.id === oq.id));
        mappedSales = [...unpersisted, ...remoteSales];

        if (typeof window !== 'undefined') {
          try { 
            localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(remoteSales.slice(0, 100))); 
            if (overridesCleaned) {
              localStorage.setItem('hum_vicio_prod_status_map', JSON.stringify(overrides));
            }
          } catch {}
        }
      } else if (salesData && salesData.length === 0) {
        mappedSales = [];
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('hum_vicio_cached_sales');
            localStorage.removeItem('hum_vicio_prod_status_map');
          } catch {}
        }
      }

      // 4. Processar Sessões de Caixa
      let mappedSessions: CashSession[] = globalStore.allCashSessions;
      let openSession: CashSession | null = globalStore.activeCashSession;
      let isOpenNow = globalStore.isOpen;
      if (allSessData) {
        mappedSessions = (allSessData as any[]).map(s => ({
          id: s.id,
          status: s.status,
          initialAmount: Number(s.initial_amount) || 0,
          finalAmount: s.final_amount ? Number(s.final_amount) : undefined,
          expectedAmount: s.expected_amount ? Number(s.expected_amount) : undefined,
          varianceAmount: s.variance_amount ? Number(s.variance_amount) : undefined,
          openedBy: s.opened_by,
          closedBy: s.closed_by,
          openedAt: s.opened_at,
          closedAt: s.closed_at
        }));
        const remoteOpenSession = mappedSessions.find(s => s.status === 'open') || null;
        const currentRemoteSession = globalStore.activeCashSession
          ? mappedSessions.find(s => s.id === globalStore.activeCashSession?.id)
          : null;

        // Uma resposta vazia ou temporariamente incompleta do bootstrap não encerra um
        // turno localmente. O caixa só é removido quando o servidor confirma que a
        // mesma sessão foi fechada ou quando closeCaixa é acionado pelo operador.
        openSession = remoteOpenSession || (
          globalStore.activeCashSession?.status === 'open' && currentRemoteSession?.status !== 'closed'
            ? globalStore.activeCashSession
            : null
        );
        isOpenNow = !!openSession;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('hum_vicio_cached_sessions', JSON.stringify(mappedSessions));
            if (openSession) {
              localStorage.setItem('hum_vicio_active_session', JSON.stringify(openSession));
            } else {
              localStorage.removeItem('hum_vicio_active_session');
            }
          } catch {}
        }
      }

      // 5. Processar Movimentações
      let mappedMovements = globalStore.movements;
      if (movData) {
        mappedMovements = (movData as any[]).map(m => ({
          id: m.id,
          type: m.type,
          amount: Number(m.amount) || 0,
          description: m.description,
          date: m.created_at
        }));
      }

      // 6. Processar Perdas
      let mappedWaste = globalStore.wasteRecords;
      if (wasteData) {
        mappedWaste = (wasteData as any[]).map(w => ({
          id: w.id,
          ingredientId: w.ingredient_id,
          ingredientName: w.ingredient_name,
          quantity: Number(w.quantity) || 0,
          unit: w.unit,
          costAtTime: Number(w.cost_at_time) || 0,
          totalLoss: Number(w.total_loss) || 0,
          reason: w.reason,
          responsibleName: w.responsible_name,
          createdAt: w.created_at
        }));
      }

      // 7. Processar Checklists
      let mappedChecklists = globalStore.allChecklists;
      let activeChecklist = globalStore.checklist;
      if (allChecks) {
        mappedChecklists = (allChecks as any[]).map(c => ({
          id: c.id,
          date: c.date,
          tasks: c.tasks,
          signedBy: c.signed_by
        }));
        const todayCheck = mappedChecklists.find(c => c.date === today);
        activeChecklist = todayCheck || { id: '', date: today, tasks: defaultChecklistTasks };
      } else if (!activeChecklist) {
        activeChecklist = { id: '', date: today, tasks: defaultChecklistTasks };
      }

      // 8. Processar Fornecedores
      let mappedSuppliers = globalStore.suppliers;
      if (supData) {
        mappedSuppliers = (supData as any[]).map(s => ({
          id: s.id,
          name: s.name,
          contactName: s.contact_name || '',
          phone: s.phone || '',
          category: s.category || 'Geral',
          notes: s.notes || '',
          createdAt: s.created_at
        }));
      }

      // 9. Processar Histórico de Compras
      let mappedPurchases = globalStore.purchaseRecords;
      if (purchData) {
        mappedPurchases = (purchData as any[]).map(p => ({
          id: p.id,
          ingredientId: p.ingredient_id ?? p.ingredientId,
          ingredientName: p.ingredient_name ?? p.ingredientName,
          supplierId: p.supplier_id ?? p.supplierId,
          supplierName: p.supplier_name ?? p.supplierName ?? 'Diversos',
          quantity: Number(p.quantity) || 0,
          unit: p.unit,
          costPerUnit: Number(p.cost_per_unit ?? p.costPerUnit) || 0,
          totalCost: Number(p.total_cost ?? p.totalCost) || 0,
          createdAt: p.created_at ?? p.createdAt
        }));
      }

      // 10. Processar Auditorias de Estoque
      let mappedAudits = globalStore.stockAudits;
      if (auditData) {
        mappedAudits = (auditData as any[]).map(a => ({
          id: a.id,
          auditedBy: a.audited_by ?? a.auditedBy,
          items: a.items || [],
          totalVarianceCost: Number(a.total_variance_cost ?? a.totalVarianceCost) || 0,
          createdAt: a.created_at ?? a.createdAt
        }));
      }

      // 11. Processar Sub-Receitas
      let mappedSubRecipes = globalStore.subRecipes;
      if (subData) {
        mappedSubRecipes = (subData as any[]).map(s => ({
          id: s.id,
          parentIngredientId: s.parent_ingredient_id,
          childIngredientId: s.child_ingredient_id,
          quantity: Number(s.quantity) || 0
        }));
      }

      // 12. Processar Logs de Auditoria
      let mappedLogs = globalStore.auditLogs;
      if (logsData && logsData.length > 0) {
        mappedLogs = (logsData as any[]).map((l: any) => ({
          id: l.id,
          timestamp: l.created_at || l.timestamp,
          action: l.action,
          operator: l.operator || 'Sistema',
          details: l.details || '',
          oldValue: l.old_value,
          newValue: l.new_value
        }));
      }

      updateGlobalStore({
        items: mappedItems,
        products: mappedProducts,
        kitchenComponents: mappedComponents,
        sales: mappedSales,
        allCashSessions: mappedSessions,
        activeCashSession: openSession,
        isOpen: isOpenNow,
        movements: mappedMovements,
        wasteRecords: mappedWaste,
        allChecklists: mappedChecklists,
        checklist: activeChecklist,
        suppliers: mappedSuppliers,
        purchaseRecords: mappedPurchases,
        stockAudits: mappedAudits,
        subRecipes: mappedSubRecipes,
        auditLogs: mappedLogs,
        isLoaded: true,
        lastFetchedAt: Date.now()
      });
    } finally {
      activeLoadPromise = null;
    }
  })();

  return activeLoadPromise;
}

// Poller em segundo plano singleton com contagem de referências, mutex e prevenção de sobreposição
let pollerCount = 0;
let pollerTimer: any = null;
let isPollerBusy = false;

async function executePollCycle(supabaseClient: any) {
  if (isPollerBusy) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  isPollerBusy = true;
  try {
    const { data: latestSales } = await supabaseClient
      .from('sales')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(60);

    if (latestSales && latestSales.length > 0) {
      const saleIds = latestSales.map((s: any) => s.id);
      const { data: latestItems } = await supabaseClient
        .from('sale_items')
        .select('*')
        .in('sale_id', saleIds);

      const itemsBySale = new Map<string, any[]>();
      for (const item of (latestItems || [])) {
        if (!item.sale_id) continue;
        let list = itemsBySale.get(item.sale_id);
        if (!list) {
          list = [];
          itemsBySale.set(item.sale_id, list);
        }
        list.push(item);
      }

      const overrides = getSavedProductionOverrides();
      let overridesCleaned = false;
      const prev = globalStore.sales;
      const localOnly = prev.filter(p => p.id.startsWith('local_') && !latestSales.some((ls: any) => ls.id === p.id));
      const remoteMapped: Sale[] = (latestSales as any[]).map(s => {
        const existing = prev.find(p => p.id === s.id);
        const override = overrides[s.id];
        let prodStatus: ProductionStatus;
        if (s.status === 'cancelled') {
          prodStatus = (s.production_status === 'concluido' ? 'em_espera' : (s.production_status || existing?.productionStatus || 'em_espera')) as ProductionStatus;
          if (override) {
            delete overrides[s.id];
            overridesCleaned = true;
          }
        } else if (override) {
          if (s.production_status === override.status || (override.status !== 'concluido' && s.production_status === 'concluido')) {
            prodStatus = (s.production_status || override.status) as ProductionStatus;
            delete overrides[s.id];
            overridesCleaned = true;
          } else {
            prodStatus = override.status;
          }
        } else {
          prodStatus = (s.production_status || existing?.productionStatus || 'em_producao') as ProductionStatus;
        }
        const prodStarted = override?.startedAt || s.production_started_at || existing?.productionStartedAt || s.created_at;

        let parsedDiff = existing?.orderDiff;
        let parsedIsModified = existing?.isModifiedInKitchen || false;

        if (s.delay_notes && typeof s.delay_notes === 'string' && s.delay_notes.includes('KITCHEN_DIFF')) {
          try {
            const parsed = JSON.parse(s.delay_notes);
            if (parsed.tag === 'KITCHEN_DIFF') {
              parsedDiff = parsed.orderDiff;
              parsedIsModified = true;
            }
          } catch {}
        } else if (s.delay_notes === null && existing?.isModifiedInKitchen) {
          parsedIsModified = false;
        }

        const sItems = itemsBySale.get(s.id) || [];

        return {
          id: s.id,
          customerName: s.customer_name || 'Balcão',
          orderType: (s.order_type || (s.channel === 'ifood' ? 'delivery' : 'mesa')) as any,
          channel: s.channel,
          subtotal: Number(s.subtotal) || existing?.subtotal || 0,
          discount: Number(s.discount) || existing?.discount || 0,
          deliveryFee: Number(s.delivery_fee) || existing?.deliveryFee || 0,
          total: Number(s.total) || 0,
          paymentMethod: s.payment_method,
          date: s.created_at,
          status: s.status,
          productionStatus: prodStatus,
          productionStartedAt: prodStarted,
          productionCompletedAt: s.production_completed_at || undefined,
          productionTimeMinutes: s.production_time_minutes ? Number(s.production_time_minutes) : undefined,
          targetPrepMinutes: s.target_prep_minutes ? Number(s.target_prep_minutes) : 20,
          delayReason: s.delay_reason || undefined,
          delayNotes: s.delay_notes || undefined,
          orderDiff: parsedDiff,
          isModifiedInKitchen: parsedIsModified,
          items: sItems.map(mapRemoteSaleItem)
        };
      });

      const nextSales = [...localOnly, ...remoteMapped];

      // Reconciliação inteligente: notificar o store se houver qualquer alteração real (V03)
      const hasChanged = 
        prev.length !== nextSales.length ||
        nextSales.some((ns, idx) => {
          const ps = prev[idx];
          if (!ps) return true;
          if (
            ps.id !== ns.id || 
            ps.productionStatus !== ns.productionStatus || 
            ps.status !== ns.status ||
            ps.isModifiedInKitchen !== ns.isModifiedInKitchen ||
            ps.total !== ns.total ||
            ps.items.length !== ns.items.length
          ) {
            return true;
          }
          return JSON.stringify(ps.items) !== JSON.stringify(ns.items);
        });

      if (hasChanged) {
        updateGlobalStore({ sales: nextSales });
      }

      if (overridesCleaned && typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_prod_status_map', JSON.stringify(overrides)); } catch {}
      }
    } else if (Array.isArray(latestSales) && latestSales.length === 0) {
      const localOnly = globalStore.sales.filter(p => p.id.startsWith('local_'));
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('hum_vicio_cached_sales');
          localStorage.removeItem('hum_vicio_prod_status_map');
        } catch {}
      }
      updateGlobalStore({ sales: localOnly });
    }
  } catch {} finally {
    isPollerBusy = false;
  }
}

function scheduleNextPoller(supabaseClient: any, delayMs: number = 3500) {
  if (pollerCount <= 0) return;
  if (pollerTimer) clearTimeout(pollerTimer);
  pollerTimer = setTimeout(async () => {
    await executePollCycle(supabaseClient);
    scheduleNextPoller(supabaseClient, 3500);
  }, delayMs);
}

function startBackgroundPoller(supabaseClient: any) {
  pollerCount++;
  if (pollerCount === 1) {
    scheduleNextPoller(supabaseClient, 1500);
  }
}

function stopBackgroundPoller() {
  pollerCount = Math.max(0, pollerCount - 1);
  if (pollerCount === 0 && pollerTimer) {
    clearTimeout(pollerTimer);
    pollerTimer = null;
  }
}

const subscribeToStore = (callback: () => void) => {
  storeListeners.add(callback);
  return () => {
    storeListeners.delete(callback);
  };
};

const getStoreSnapshot = () => globalStore;
const getServerStoreSnapshot = () => serverInitialState;

export function useInventory(scope: 'caixa' | 'cozinha' | 'admin' | 'all' = 'all') {
  const store = useSyncExternalStore(subscribeToStore, getStoreSnapshot, getServerStoreSnapshot);
  const supabase = createClient();

  const {
    items,
    products,
    kitchenComponents,
    isLoaded,
    fixedExpensesConfig,
    isOpen,
    activeCashSession,
    allCashSessions,
    targetPrepMinutes,
    sales,
    movements,
    isTrainingMode,
    offlineQueueCount,
    offlineSalesList,
    isOnline,
    connectionStatus,
    lastServerSync,
    wasteRecords,
    checklist,
    allChecklists,
    suppliers,
    purchaseRecords,
    stockAudits,
    subRecipes,
    auditLogs
  } = store;

  // Setters com suporte transparente a valores diretos ou funções de callback
  const setItems = (value: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => {
    const next = typeof value === 'function' ? value(globalStore.items) : value;
    updateGlobalStore({ items: next });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hum_vicio_cached_inventory', JSON.stringify(next)); } catch {}
    }
  };

  const setProducts = (value: Product[] | ((prev: Product[]) => Product[])) => {
    const next = typeof value === 'function' ? value(globalStore.products) : value;
    updateGlobalStore({ products: next });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hum_vicio_cached_products', JSON.stringify(next)); } catch {}
    }
  };

  const setKitchenComponents = (value: KitchenComponent[] | ((prev: KitchenComponent[]) => KitchenComponent[])) => {
    const next = typeof value === 'function' ? value(globalStore.kitchenComponents) : value;
    updateGlobalStore({ kitchenComponents: next });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hum_vicio_cached_kitchen_components', JSON.stringify(next)); } catch {}
    }
  };

  const addKitchenComponent = async (comp: Omit<KitchenComponent, 'id'> & { id?: string }) => {
    const newId = comp.id || `cmp-${Date.now().toString(36)}`;
    const newComp: KitchenComponent = {
      ...comp,
      id: newId,
      showInSummary: comp.showInSummary !== false,
      isActive: comp.isActive !== false,
    };

    try {
      const { error } = await supabase.from('kitchen_components').insert({
        id: newComp.id,
        name: newComp.name,
        component_type: newComp.componentType,
        station: newComp.station,
        production_unit: newComp.productionUnit,
        portion_weight: newComp.portionWeight,
        portion_unit: newComp.portionUnit,
        show_in_summary: newComp.showInSummary,
        is_active: newComp.isActive,
      });
      if (error) throw new Error('Não foi possível salvar o componente. Seus ajustes foram mantidos.');
      setKitchenComponents(prev => [...prev.filter(c => c.id !== newId), newComp]);
    } catch (err) {
      throw err;
    }
    return newComp;
  };

  const updateKitchenComponent = async (id: string, updates: Partial<KitchenComponent>) => {

    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.componentType !== undefined) payload.component_type = updates.componentType;
      if (updates.station !== undefined) payload.station = updates.station;
      if (updates.productionUnit !== undefined) payload.production_unit = updates.productionUnit;
      if (updates.portionWeight !== undefined) payload.portion_weight = updates.portionWeight;
      if (updates.portionUnit !== undefined) payload.portion_unit = updates.portionUnit;
      if (updates.showInSummary !== undefined) payload.show_in_summary = updates.showInSummary;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;

      const { error } = await supabase.from('kitchen_components').update(payload).eq('id', id);
      if (error) throw new Error('Não foi possível atualizar o componente. Seus ajustes foram mantidos.');
      setKitchenComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } catch (err) {
      throw err;
    }
  };

  const linkInventoryKitchenComponent = async (id: string, componentId: string) => {
    const { error } = await supabase.from('inventory').update({ kitchen_component_id: componentId || null }).eq('id', id);
    if (error) throw new Error('Não foi possível salvar o vínculo do insumo.');
    setItems(prev => prev.map(item => item.id === id ? { ...item, kitchenComponentId: componentId || undefined } : item));
  };

  const removeKitchenComponent = async (id: string) => {
    setKitchenComponents(prev => prev.filter(c => c.id !== id));
    try {
      await supabase.from('kitchen_components').delete().eq('id', id);
    } catch (err) {
      console.warn('Erro ao remover componente de preparo:', err);
    }
  };

  const setSales = (value: Sale[] | ((prev: Sale[]) => Sale[])) => {
    const next = typeof value === 'function' ? value(globalStore.sales) : value;
    updateGlobalStore({ sales: next });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(next.slice(0, 100))); } catch {}
    }
  };

  const setAllCashSessions = (value: CashSession[] | ((prev: CashSession[]) => CashSession[])) => {
    const next = typeof value === 'function' ? value(globalStore.allCashSessions) : value;
    updateGlobalStore({ allCashSessions: next });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hum_vicio_cached_sessions', JSON.stringify(next)); } catch {}
    }
  };

  const setActiveCashSession = (value: CashSession | null | ((prev: CashSession | null) => CashSession | null)) => {
    const next = typeof value === 'function' ? value(globalStore.activeCashSession) : value;
    const isNowOpen = !!next && next.status === 'open';
    updateGlobalStore({ activeCashSession: next, isOpen: isNowOpen });
    if (typeof window !== 'undefined') {
      try {
        if (isNowOpen && next) {
          localStorage.setItem('hum_vicio_active_session', JSON.stringify(next));
        } else {
          localStorage.removeItem('hum_vicio_active_session');
        }
      } catch {}
    }
  };

  const setIsOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(globalStore.isOpen) : value;
    updateGlobalStore({ isOpen: next });
    if (!next && typeof window !== 'undefined') {
      try { localStorage.removeItem('hum_vicio_active_session'); } catch {}
    }
  };

  const setMovements = (value: CashMovement[] | ((prev: CashMovement[]) => CashMovement[])) => {
    const next = typeof value === 'function' ? value(globalStore.movements) : value;
    updateGlobalStore({ movements: next });
  };

  const setWasteRecords = (value: WasteRecord[] | ((prev: WasteRecord[]) => WasteRecord[])) => {
    const next = typeof value === 'function' ? value(globalStore.wasteRecords) : value;
    updateGlobalStore({ wasteRecords: next });
  };

  const setChecklist = (value: DailyChecklist | null | ((prev: DailyChecklist | null) => DailyChecklist | null)) => {
    const next = typeof value === 'function' ? value(globalStore.checklist) : value;
    updateGlobalStore({ checklist: next });
  };

  const setAllChecklists = (value: DailyChecklist[] | ((prev: DailyChecklist[]) => DailyChecklist[])) => {
    const next = typeof value === 'function' ? value(globalStore.allChecklists) : value;
    updateGlobalStore({ allChecklists: next });
  };

  const setSuppliers = (value: Supplier[] | ((prev: Supplier[]) => Supplier[])) => {
    const next = typeof value === 'function' ? value(globalStore.suppliers) : value;
    updateGlobalStore({ suppliers: next });
  };

  const setPurchaseRecords = (value: PurchaseRecord[] | ((prev: PurchaseRecord[]) => PurchaseRecord[])) => {
    const next = typeof value === 'function' ? value(globalStore.purchaseRecords) : value;
    updateGlobalStore({ purchaseRecords: next });
  };

  const setStockAudits = (value: StockAudit[] | ((prev: StockAudit[]) => StockAudit[])) => {
    const next = typeof value === 'function' ? value(globalStore.stockAudits) : value;
    updateGlobalStore({ stockAudits: next });
  };

  const setSubRecipes = (value: SubRecipeItem[] | ((prev: SubRecipeItem[]) => SubRecipeItem[])) => {
    const next = typeof value === 'function' ? value(globalStore.subRecipes) : value;
    updateGlobalStore({ subRecipes: next });
  };

  const setAuditLogs = (value: AuditLog[] | ((prev: AuditLog[]) => AuditLog[])) => {
    const next = typeof value === 'function' ? value(globalStore.auditLogs) : value;
    updateGlobalStore({ auditLogs: next });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hum_vicio_audit_logs', JSON.stringify(next.slice(0, 200))); } catch {}
    }
  };

  const setIsLoaded = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(globalStore.isLoaded) : value;
    updateGlobalStore({ isLoaded: next });
  };

  const setIsOnline = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(globalStore.isOnline) : value;
    updateGlobalStore({ isOnline: next });
  };

  const setOfflineQueueCount = (value: number | ((prev: number) => number)) => {
    const next = typeof value === 'function' ? value(globalStore.offlineQueueCount) : value;
    updateGlobalStore({ offlineQueueCount: next });
  };

  const setOfflineSalesList = (value: Sale[] | ((prev: Sale[]) => Sale[])) => {
    const next = typeof value === 'function' ? value(globalStore.offlineSalesList) : value;
    updateGlobalStore({ offlineSalesList: next });
  };

  const setConnectionStatus = (value: ConnectionStatus | ((prev: ConnectionStatus) => ConnectionStatus)) => {
    const next = typeof value === 'function' ? value(globalStore.connectionStatus) : value;
    updateGlobalStore({ connectionStatus: next });
  };

  const setLastServerSync = (value: string | null | ((prev: string | null) => string | null)) => {
    const next = typeof value === 'function' ? value(globalStore.lastServerSync) : value;
    updateGlobalStore({ lastServerSync: next });
    if (typeof window !== 'undefined' && next) {
      try { localStorage.setItem('hum_vicio_last_server_sync', next); } catch {}
    }
  };

  const addAuditLog = async (
    action: AuditAction, 
    details: string, 
    operator?: string, 
    oldValue?: string, 
    newValue?: string
  ) => {
    const newLog: AuditLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      operator: operator || 'Sistema',
      details,
      oldValue,
      newValue
    };

    const updated = [newLog, ...globalStore.auditLogs].slice(0, 500);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hum_vicio_audit_logs', JSON.stringify(updated.slice(0, 200))); } catch {}
    }
    updateGlobalStore({ auditLogs: updated });

    try {
      await supabase.from('audit_logs').insert({
        action: newLog.action,
        operator: newLog.operator,
        details: newLog.details,
        old_value: newLog.oldValue || null,
        new_value: newLog.newValue || null,
        created_at: newLog.timestamp
      });
    } catch (err) {
      console.warn('Registro de auditoria salvo localmente:', err);
    }
  };

  // Custos Fixos Mensais (DRE & Ponto de Equilíbrio)
  const saveFixedExpensesConfig = (config: FixedExpensesConfig) => {
    updateGlobalStore({ fixedExpensesConfig: config });
    publishCentralConfig({ fixedExpenses: config }, 'Gestor / Admin');
    const totalMonthly = config.rent + config.electricity + config.gas + config.water + config.internetSoftware + config.payroll + config.proLabore + config.otherExpenses;
    addAuditLog(
      'CUSTOS_FIXOS_CONFIG',
      `Custos Fixos Mensais atualizados. Total mensal: R$ ${totalMonthly.toFixed(2)} (${config.operatingDaysPerMonth} dias úteis).`,
      'Gestor / Admin'
    );
  };

  // Tempo Médio Dinâmico de Preparo (KDS / Balcão)
  const setTargetPrepMinutes = (mins: number) => {
    updateGlobalStore({ targetPrepMinutes: mins });
    publishCentralConfig({ targetPrepMinutes: mins }, 'Operação / Gestor');
  };

  // Verificação ativa de comunicação efetiva com o servidor
  const checkServerHealth = async (): Promise<ConnectionStatus> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      updateGlobalStore({ connectionStatus: 'offline', isOnline: false });
      return 'offline';
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const nowIso = new Date().toISOString();
        updateGlobalStore({
          connectionStatus: 'connected',
          isOnline: true,
          lastServerSync: nowIso
        });
        try { localStorage.setItem('hum_vicio_last_server_sync', nowIso); } catch {}
        return 'connected';
      } else {
        updateGlobalStore({ connectionStatus: 'server_unreachable', isOnline: false });
        return 'server_unreachable';
      }
    } catch {
      const status = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'server_unreachable';
      updateGlobalStore({ connectionStatus: status, isOnline: false });
      return status;
    }
  };

  // Monitor de Auto-Sincronização e Drenagem da Fila Offline
  const syncOfflineQueueNow = async () => {
    const res = await syncOfflineSalesQueue(supabase);
    const queue = getOfflineSalesQueue();
    updateGlobalStore({
      offlineQueueCount: queue.length,
      offlineSalesList: queue
    });

    if (res.syncedCount > 0 || res.errorsCount === 0) {
      const nowIso = new Date().toISOString();
      try { localStorage.setItem('hum_vicio_last_server_sync', nowIso); } catch {}

      const queuedIds = new Set(queue.map(q => q.id));
      const updated = globalStore.sales.map(s => {
        if (!queuedIds.has(s.id) && (s.syncStatus === 'pending' || !s.isOfflineSynced)) {
          return { ...s, syncStatus: 'synced' as const, isOfflineSynced: true };
        }
        return s;
      });

      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }

      updateGlobalStore({
        connectionStatus: 'connected',
        isOnline: true,
        lastServerSync: nowIso,
        sales: updated
      });
    } else if (res.errorsCount > 0) {
      await checkServerHealth();
    }
    return res;
  };

  useEffect(() => {
    // 1. Carga de dados rápida em paralelo com escopo: se não carregou ou dados com mais de 60s
    if (!globalStore.isLoaded || Date.now() - globalStore.lastFetchedAt > 60000) {
      void executeParallelLoadData(supabase, scope);
    }

    // 2. Inicia poller singleton em segundo plano (3.5s) com contagem de referências
    startBackgroundPoller(supabase);

    // 3. Sincronização offline inicial e verificação de saúde do servidor
    const initialQueue = getOfflineSalesQueue();
    updateGlobalStore({
      offlineQueueCount: initialQueue.length,
      offlineSalesList: initialQueue,
      isTrainingMode: isTrainingModeActive()
    });
    void checkServerHealth();

    // 4. Ouvinte de modo de treinamento
    const handleMode = (e: any) => {
      const active = Boolean(e.detail?.active);
      updateGlobalStore({ isTrainingMode: active });
      if (active) {
        const tSales = getTrainingSales();
        if (tSales.length > 0) {
          updateGlobalStore(prev => ({
            sales: [...tSales, ...prev.sales.filter(p => !tSales.some(t => t.id === p.id))]
          }));
        }
      }
    };
    window.addEventListener('hum_vicio_training_mode_changed', handleMode);

    // 5. Ouvinte de conexão de rede
    const handleOnline = () => {
      void checkServerHealth().then(status => {
        if (status === 'connected') {
          syncOfflineQueueNow();
        }
      });
    };
    const handleOffline = () => {
      updateGlobalStore({ connectionStatus: 'offline', isOnline: false });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 6. Ouvinte de storage para abas do navegador
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'hum_vicio_cached_sales' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            updateGlobalStore({ sales: parsed });
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 7. Heartbeat a cada 20 segundos para drenar a fila e manter conexão viva
    const heartbeatInterval = setInterval(() => {
      if (getOfflineSalesQueue().length > 0) {
        syncOfflineQueueNow();
      } else {
        void checkServerHealth();
      }
    }, 20000);

    return () => {
      stopBackgroundPoller();
      window.removeEventListener('hum_vicio_training_mode_changed', handleMode);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
      clearInterval(heartbeatInterval);
    };
  }, []);

  // --- INSUMOS ACTIONS ---
  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    try {
      let data: any = null;
      let error: any = null;
      const finalStation = item.station || 'nenhuma';

      try {
        const res = await supabase.from('inventory').insert({
          name: item.name, category: item.category, unit: item.unit, 
          cost_per_unit: item.costPerUnit, current_stock: item.currentStock, status: item.status,
          min_stock: item.minStock,
          ...('kitchenComponentId' in item ? { kitchen_component_id: item.kitchenComponentId || null } : {})
        }).select().single();
        data = res.data;
        error = res.error;
      } catch (insertErr) {
        error = insertErr;
      }
      
      if (error) {
        console.error('Erro ao salvar insumo no Supabase:', error);
        throw new Error(error.message || 'Não foi possível salvar o insumo no banco de dados.');
      }
      
      const newId = data ? data.id : ('inv_' + Date.now().toString(36));
      if (item.minStock !== undefined) {
        saveMinStockItem(newId, item.minStock);
      }
      saveStationItem(newId, finalStation);
      saveItemProductionMeta(newId, {
        productionStation: item.productionStation,
        productionKind: item.productionKind,
        portionWeight: item.portionWeight,
        portionUnit: item.portionUnit || 'g',
      });
      const createdItem = { 
        ...item, 
        id: newId, 
        station: finalStation,
        portionUnit: item.portionUnit || 'g',
      };
      setItems(prev => [...prev, createdItem]);
      return createdItem;
    } catch (err: any) {
      console.error('Falha ao adicionar insumo:', err);
      throw err;
    }
  };
  
  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    const dbUpdates: any = {};
    if ('kitchenComponentId' in updates) dbUpdates.kitchen_component_id = updates.kitchenComponentId || null;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.costPerUnit !== undefined) dbUpdates.cost_per_unit = updates.costPerUnit;
    if (updates.currentStock !== undefined) dbUpdates.current_stock = updates.currentStock;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.minStock !== undefined) {
      saveMinStockItem(id, updates.minStock);
      dbUpdates.min_stock = updates.minStock;
    }
    if (updates.station !== undefined) {
      saveStationItem(id, updates.station);
      dbUpdates.station = updates.station;
    }

    // Persistir metadados operacionais de preparo e porção
    saveItemProductionMeta(id, {
      productionStation: updates.productionStation,
      productionKind: updates.productionKind,
      portionWeight: updates.portionWeight,
      portionUnit: updates.portionUnit,
    });

    const { error } = await supabase.from('inventory').update(dbUpdates).eq('id', id);
    if (error) throw new Error('Não foi possível salvar o insumo. Confira a conexão e a atualização do banco.');
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeInventoryItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    try {
      await supabase.from('inventory').update({ is_active: false }).eq('id', id);
    } catch {
      await supabase.from('inventory').delete().eq('id', id);
    }
    setItems(items.map(i => i.id === id ? { ...i, isActive: false } : i));

    addAuditLog(
      'EXCLUSAO_ITEM',
      `Insumo "${item?.name || id}" desativado do inventário.`,
      'Admin'
    );
  };

  const updateStatus = async (id: string, newStatus: StockStatus, remainingQuantity?: number) => {
    const updates: Partial<InventoryItem> = { status: newStatus };
    if (remainingQuantity !== undefined) updates.currentStock = remainingQuantity;
    await updateInventoryItem(id, updates);
  };

  const registerPurchase = async (id: string, quantity: number, newCost: number) => {
    const item = items.find(i => i.id === id);
    if (item) {
      await updateInventoryItem(id, { currentStock: item.currentStock + quantity, costPerUnit: newCost, status: 'ok' });
    }
  };

  // --- REGISTRO DE COMPRA COM FORNECEDOR (FASE 3) ---
  const recordPurchaseWithSupplier = async (
    ingredientId: string, 
    quantity: number, 
    newCost: number,
    supplierId?: string,
    supplierName?: string
  ) => {
    const item = items.find(i => i.id === ingredientId);
    if (!item) return { success: false, error: 'Insumo não encontrado' };

    const totalCost = quantity * newCost;
    const finalSupplierName = supplierName || 'Diversos / Não Informado';

    try {
      // 1. Inserir histórico de compras
      const { data: pData } = await supabase.from('purchase_records').insert({
        ingredient_id: ingredientId,
        ingredient_name: item.name,
        supplier_id: supplierId || null,
        supplier_name: finalSupplierName,
        quantity,
        unit: item.unit,
        cost_per_unit: newCost,
        total_cost: totalCost
      }).select().single();

      // 2. Atualizar estoque e custo unitário
      await updateInventoryItem(ingredientId, {
        currentStock: item.currentStock + quantity,
        costPerUnit: newCost,
        status: 'ok'
      });

      if (pData) {
        const newRecord: PurchaseRecord = {
          id: pData.id,
          ingredientId: pData.ingredient_id,
          ingredientName: pData.ingredient_name,
          supplierId: pData.supplier_id,
          supplierName: pData.supplier_name,
          quantity: Number(pData.quantity),
          unit: pData.unit,
          costPerUnit: Number(pData.cost_per_unit),
          totalCost: Number(pData.total_cost),
          createdAt: pData.created_at
        };
        setPurchaseRecords([newRecord, ...purchaseRecords]);
      }

      return { success: true };
    } catch (err: any) {
      // Fallback
      await registerPurchase(ingredientId, quantity, newCost);
      return { success: true };
    }
  };

  // --- FORNECEDORES ACTIONS (FASE 3) ---
  const addSupplier = async (sup: Omit<Supplier, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase.from('suppliers').insert({
        name: sup.name,
        contact_name: sup.contactName,
        phone: sup.phone,
        category: sup.category,
        notes: sup.notes
      }).select().single();

      if (error) throw new Error('Não foi possível salvar o fornecedor.');

      if (!data) throw new Error('O fornecedor não foi retornado após o cadastro.');
      setSuppliers(current => [...current, {
          id: data.id,
          name: data.name,
          contactName: data.contact_name,
          phone: data.phone,
          category: data.category,
          notes: data.notes,
          createdAt: data.created_at
        }]);
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase.from('suppliers').update(dbUpdates).eq('id', id);
    setSuppliers(suppliers.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSupplier = async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw new Error('Não foi possível excluir o fornecedor.');
    setSuppliers(current => current.filter(s => s.id !== id));
  };

  // --- AUDITORIA DE INVENTÁRIO FÍSICO (FASE 3) ---
  const saveStockAudit = async (auditedBy: string, auditItems: StockAuditItem[], totalVarianceCost: number) => {
    try {
      // 1. Salvar relatório da auditoria
      const { data: aData, error: aErr } = await supabase.from('stock_audits').insert({
        audited_by: auditedBy,
        items: auditItems,
        total_variance_cost: totalVarianceCost
      }).select().single();

      if (aErr) {
        console.error('Erro ao salvar auditoria:', aErr);
      }

      // 2. Ajustar saldos de estoque no banco para cada insumo contado
      for (const ai of auditItems) {
        if (ai.diff !== 0) {
          await updateInventoryItem(ai.id, { currentStock: ai.countedStock });
        }
      }

      if (aData) {
        const newAudit: StockAudit = {
          id: aData.id,
          auditedBy: aData.audited_by,
          items: aData.items,
          totalVarianceCost: Number(aData.total_variance_cost),
          createdAt: aData.created_at
        };
        setStockAudits([newAudit, ...stockAudits]);
      }

      addAuditLog(
        'AJUSTE_ESTOQUE',
        `Auditoria física concluída por ${auditedBy}. Variação financeira apurada: R$ ${totalVarianceCost.toFixed(2)}`,
        auditedBy
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // --- PERDAS / DESPERDÍCIO (COZINHA) ---
  const registerWaste = async (ingredientId: string, quantity: number, reason: string, responsibleName: string) => {
    const ing = items.find(i => i.id === ingredientId);
    if (!ing) return { success: false, error: 'Insumo não encontrado no cadastro.' };

    const costAtTime = ing.costPerUnit;
    const totalLoss = costAtTime * quantity;

    try {
      const { data: wData, error: wErr } = await supabase.from('waste_records').insert({
        ingredient_id: ingredientId,
        ingredient_name: ing.name,
        quantity,
        unit: ing.unit,
        cost_at_time: costAtTime,
        total_loss: totalLoss,
        reason,
        responsible_name: responsibleName
      }).select().single();

      if (wErr) {
        console.error('Erro ao registrar perda:', wErr);
      }

      const newStock = Math.max(0, ing.currentStock - quantity);
      await updateInventoryItem(ingredientId, { currentStock: newStock });

      const newRecord: WasteRecord = {
        id: wData ? wData.id : Math.random().toString(36).substring(2, 9),
        ingredientId,
        ingredientName: ing.name,
        quantity,
        unit: ing.unit,
        costAtTime,
        totalLoss,
        reason,
        responsibleName,
        createdAt: wData ? wData.created_at : new Date().toISOString()
      };

      setWasteRecords([newRecord, ...wasteRecords]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getTotalWasteCost = () => {
    return wasteRecords.reduce((acc, w) => acc + (w.totalLoss || 0), 0);
  };

  // --- PRODUTOS ACTIONS ---
  const addProduct = async (prod: Omit<Product, 'id'>) => {
    const subcategoryToSave = prod.subcategory?.trim() || inferDefaultSubcategory({ ...prod, id: '' } as Product);
    const initialStatus = prod.status || (prod.recipe && prod.recipe.length > 0 ? 'validado' : 'rascunho');

    const payload = {
      product: {
        name: prod.name.trim(),
        category: prod.category,
        subcategory: subcategoryToSave,
        priceBalcao: prod.priceBalcao,
        priceIfood: prod.priceIfood ?? prod.priceBalcao,
        status: initialStatus,
        isActive: prod.isActive !== false,
      },
      recipe: prod.recipe || [],
      clientRequestId: `req_add_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };

    const res = await fetch('/api/products/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Não foi possível salvar o produto no banco de dados.');
    }

    const finalId = data.productId;

    if (subcategoryToSave) {
      saveProductSubcategoryItem(finalId, subcategoryToSave);
    }

    if (prod.acceptsAddons !== undefined || prod.allowedAddonIds || prod.isAddon) {
      saveProductAddonItem(finalId, {
        acceptsAddons: prod.acceptsAddons,
        allowedAddonIds: prod.allowedAddonIds,
        isAddon: prod.isAddon,
      });
    }

    const createdProduct: Product = {
      ...prod,
      id: finalId,
      subcategory: subcategoryToSave,
      status: initialStatus,
      isActive: prod.isActive !== false,
    };

    setProducts(prev => [...prev, createdProduct]);

    addAuditLog(
      'CADASTRO_PRODUTO',
      `Produto "${prod.name}" cadastrado na categoria "${prod.category}" (${subcategoryToSave}). Preço Balcão: R$ ${prod.priceBalcao.toFixed(2)}`,
      'Admin'
    );

    return createdProduct;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const existing = globalStore.products.find(p => p.id === id);
    if (!existing && !id) {
      throw new Error('Produto não encontrado para atualização.');
    }

    const subcategoryToSave = updates.subcategory !== undefined
      ? (updates.subcategory.trim() || undefined)
      : existing?.subcategory;

    const recipeToPersist = updates.recipe !== undefined
      ? updates.recipe
      : (existing?.recipe || []);

    const payload = {
      product: {
        id,
        name: updates.name ? updates.name.trim() : (existing?.name || ''),
        category: updates.category || existing?.category || 'lanche',
        subcategory: subcategoryToSave,
        priceBalcao: updates.priceBalcao ?? existing?.priceBalcao ?? 0,
        priceIfood: updates.priceIfood ?? existing?.priceIfood ?? existing?.priceBalcao ?? 0,
        status: updates.status || existing?.status || 'validado',
        isActive: updates.isActive !== undefined ? updates.isActive : (existing?.isActive !== false),
      },
      recipe: recipeToPersist,
      clientRequestId: `req_upd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };

    const res = await fetch('/api/products/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Não foi possível atualizar o produto no banco de dados.');
    }

    if (subcategoryToSave) {
      saveProductSubcategoryItem(id, subcategoryToSave);
    }

    if (updates.acceptsAddons !== undefined || updates.allowedAddonIds !== undefined || updates.isAddon !== undefined) {
      saveProductAddonItem(id, {
        acceptsAddons: updates.acceptsAddons ?? existing?.acceptsAddons,
        allowedAddonIds: updates.allowedAddonIds ?? existing?.allowedAddonIds,
        isAddon: updates.isAddon ?? existing?.isAddon,
      });
    }

    if (existing && (updates.priceBalcao !== undefined || updates.priceIfood !== undefined)) {
      if (updates.priceBalcao !== existing.priceBalcao || updates.priceIfood !== existing.priceIfood) {
        addAuditLog(
          'ALTERACAO_PRECO',
          `Preço do produto "${existing.name}" alterado. Balcão: R$ ${existing.priceBalcao.toFixed(2)} -> R$ ${(updates.priceBalcao ?? existing.priceBalcao).toFixed(2)} | iFood: R$ ${existing.priceIfood.toFixed(2)} -> R$ ${(updates.priceIfood ?? existing.priceIfood).toFixed(2)}`,
          'Admin'
        );
      }
    }

    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProduct = async (id: string) => {
    const prod = globalStore.products.find(p => p.id === id);
    try {
      await supabase.from('products').update({ is_active: false }).eq('id', id);
    } catch {
      await supabase.from('products').delete().eq('id', id);
    }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, isActive: false } : p));

    addAuditLog(
      'DESATIVACAO_PRODUTO',
      `Produto "${prod?.name || id}" desativado do cardápio.`,
      'Admin'
    );
  };

  const batchUpdateProductSubcategory = async (category: string | undefined, oldSub: string, newSub?: string) => {
    const trimmed = newSub?.trim();
    const matchCategory = (prodCat: string) => !category || category === 'todas' || prodCat === category;

    // 1. Atualização funcional atômica no estado
    setProducts(prev => prev.map(p => {
      if (matchCategory(p.category) && (p.subcategory === oldSub || inferDefaultSubcategory(p) === oldSub)) {
        const targetSub = trimmed || getFallbackSubcategoryForCategory(p.category);
        return { ...p, subcategory: targetSub };
      }
      return p;
    }));

    // 2. Atualizar mapa no localStorage
    const affected = globalStore.products.filter(p => matchCategory(p.category) && (p.subcategory === oldSub || inferDefaultSubcategory(p) === oldSub));
    if (affected.length > 0) {
      const subcatMap = getSavedProductSubcategoriesMap();
      affected.forEach(p => { 
        const targetSub = trimmed || getFallbackSubcategoryForCategory(p.category);
        subcatMap[p.id] = targetSub; 
      });
      try { localStorage.setItem('hum_vicio_product_subcategories_map', JSON.stringify(subcatMap)); } catch {}
    }

    // 3. Persistir no Supabase
    try {
      for (const p of affected) {
        const targetSub = trimmed || getFallbackSubcategoryForCategory(p.category);
        void supabase.from('products').update({ subcategory: targetSub }).eq('id', p.id);
      }
    } catch (err) {
      console.warn('Erro ao atualizar subcategoria em lote no banco:', err);
    }
  };

  // Vínculo em lote de um insumo/adicional à ficha técnica de múltiplos produtos (hambúrgueres)
  const batchAddIngredientToProducts = async (
    ingredientId: string,
    targets: { productId: string; quantity: number }[]
  ) => {
    if (!ingredientId || !targets || targets.length === 0) return { success: false, error: 'Dados insuficientes' };

    try {
      const targetProductIds = targets.map(t => t.productId);
      
      // 1. Remover registros anteriores desse ingrediente nos produtos selecionados no Supabase
      try {
        await supabase
          .from('recipes')
          .delete()
          .in('product_id', targetProductIds)
          .eq('ingredient_id', ingredientId);
      } catch (delErr) {
        console.warn('Aviso ao deletar linhas antigas de receitas:', delErr);
      }

      // 2. Inserir novas linhas com as quantidades atualizadas (apenas > 0)
      const rowsToInsert = targets
        .filter(t => t.quantity > 0)
        .map(t => ({
          product_id: t.productId,
          ingredient_id: ingredientId,
          quantity: t.quantity
        }));

      if (rowsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('recipes').insert(rowsToInsert);
        if (insErr) {
          console.error('Erro ao inserir novas receitas em lote no Supabase:', insErr);
        }
      }

      // 3. Atualizar o estado local dos produtos
      setProducts(prevProducts => prevProducts.map(p => {
        const target = targets.find(t => t.productId === p.id);
        if (!target) return p;

        const currentRecipe = Array.isArray(p.recipe) ? p.recipe : [];
        const existingIndex = currentRecipe.findIndex(r => r.ingredientId === ingredientId);
        let updatedRecipe: RecipeIngredient[];

        if (existingIndex >= 0) {
          if (target.quantity > 0) {
            updatedRecipe = currentRecipe.map((r, i) => i === existingIndex ? { ...r, quantity: target.quantity } : r);
          } else {
            updatedRecipe = currentRecipe.filter((_, i) => i !== existingIndex);
          }
        } else if (target.quantity > 0) {
          updatedRecipe = [...currentRecipe, { ingredientId, quantity: target.quantity }];
        } else {
          updatedRecipe = currentRecipe;
        }

        return { ...p, recipe: updatedRecipe };
      }));

      // 4. Log de auditoria
      const ing = items.find(i => i.id === ingredientId);
      const ingName = ing ? ing.name : 'Insumo';
      addAuditLog(
        'VINCULO_LOTE_RECEITAS',
        `Insumo "${ingName}" vinculado/atualizado na ficha técnica de ${targets.filter(t => t.quantity > 0).length} produto(s).`,
        'Admin'
      );

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao vincular ingredientes em lote:', err);
      return { success: false, error: err.message };
    }
  };

  // Cálculo de custo real do insumo (com suporte a sub-receitas de maioneses e molhos)
  const getIngredientTrueCost = (ingId: string, visited = new Set<string>()): number => {
    const ing = items.find(i => i.id === ingId);
    if (!ing) return 0;
    if (visited.has(ingId)) return ing.costPerUnit;
    visited.add(ingId);

    const children = subRecipes.filter(s => s.parentIngredientId === ingId);
    if (children.length === 0) return ing.costPerUnit;

    const calculated = children.reduce((acc, child) => {
      const childCost = getIngredientTrueCost(child.childIngredientId, new Set(visited));
      return acc + (childCost * child.quantity);
    }, 0);

    return calculated > 0 ? calculated : ing.costPerUnit;
  };

  const getProductCmv = (recipe: RecipeIngredient[]) => {
    return recipe.reduce((total, recipeItem) => {
      const unitCost = getIngredientTrueCost(recipeItem.ingredientId);
      return total + (unitCost * recipeItem.quantity);
    }, 0);
  };

  const saveSubRecipe = async (parentIngredientId: string, components: { childIngredientId: string; quantity: number }[]) => {
    try {
      await supabase.from('sub_recipes').delete().eq('parent_ingredient_id', parentIngredientId);
      if (components.length > 0) {
        const inserts = components.map(c => ({
          parent_ingredient_id: parentIngredientId,
          child_ingredient_id: c.childIngredientId,
          quantity: c.quantity
        }));
        await supabase.from('sub_recipes').insert(inserts);
      }

      const remaining = subRecipes.filter(s => s.parentIngredientId !== parentIngredientId);
      const newItems: SubRecipeItem[] = components.map(c => ({
        id: Math.random().toString(36).substring(2, 9),
        parentIngredientId,
        childIngredientId: c.childIngredientId,
        quantity: c.quantity
      }));
      setSubRecipes([...remaining, ...newItems]);

      // Atualizar o custo do insumo pai no banco com o novo valor somado
      const calculatedCost = components.reduce((acc, c) => {
        const childIng = items.find(i => i.id === c.childIngredientId);
        return acc + ((childIng?.costPerUnit || 0) * c.quantity);
      }, 0);

      if (calculatedCost > 0) {
        await updateInventoryItem(parentIngredientId, { costPerUnit: calculatedCost });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const removeSubRecipe = async (parentIngredientId: string) => {
    try {
      await supabase.from('sub_recipes').delete().eq('parent_ingredient_id', parentIngredientId);
      await removeInventoryItem(parentIngredientId);
      setSubRecipes(subRecipes.filter(s => s.parentIngredientId !== parentIngredientId));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getRealSalesCmv = (salesList?: Sale[]) => {
    const completedSales = (salesList || sales).filter(s => s.status === 'completed');
    let totalCmv = 0;
    
    completedSales.forEach(sale => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product && product.recipe && product.recipe.length > 0) {
            totalCmv += getProductCmv(product.recipe) * item.quantity;
          } else {
            totalCmv += (item.unitPrice * 0.30) * item.quantity;
          }
        });
      } else {
        totalCmv += sale.total * 0.30;
      }
    });

    return totalCmv;
  };

  // --- CAIXA ACTIONS (EM NUVEM / TREINAMENTO) ---
  const openCaixa = async (initialAmount: number, operatorName: string) => {
    // Se estiver em modo treinamento, opera estritamente no sandbox
    if (isTrainingModeActive()) {
      const trainingSession: CashSession = {
        id: `training-session-${Date.now()}`,
        status: 'open',
        initialAmount,
        openedBy: operatorName,
        openedAt: new Date().toISOString()
      };
      saveTrainingCashSession(trainingSession);
      setActiveCashSession(trainingSession);
      setAllCashSessions(prev => [trainingSession, ...prev.filter(s => s.id !== trainingSession.id)]);
      return;
    }

    // 1. Ao iniciar um novo turno de caixa, limpamos as rotas e estados de entrega e salão de turnos anteriores
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('hum_vicio_delivery_routes');
        localStorage.removeItem('hum_vicio_delivered_sales');
        localStorage.removeItem('hum_vicio_prod_status_map');
        localStorage.removeItem('hum_vicio_sessao_salao_ativa');
      } catch {}
    }

    // 2. Garantir que pedidos de turnos anteriores não fiquem pendentes na chapa
    try {
      await supabase
        .from('sales')
        .update({ production_status: 'concluido' })
        .in('production_status', ['em_espera', 'em_producao'])
        .lt('created_at', new Date().toISOString());
    } catch {}

    const response = await fetch('/api/cash/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialAmount, operatorName })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.session) {
      throw new Error(payload?.error || 'Não foi possível abrir o turno de caixa.');
    }

    const data = payload.session;
    const newSess: CashSession = {
      id: data.id,
      status: 'open',
      initialAmount: Number(data.initial_amount) || initialAmount,
      openedBy: data.opened_by || operatorName,
      openedAt: data.opened_at || new Date().toISOString()
    };
    setActiveCashSession(newSess);
    setAllCashSessions(prev => [newSess, ...prev.filter(s => s.id !== newSess.id)]);

    addAuditLog(
      'ABERTURA_CAIXA',
      `Caixa aberto por ${operatorName} com fundo de troco inicial de R$ ${initialAmount.toFixed(2)}`,
      operatorName,
      'Fechado',
      `Aberto com R$ ${initialAmount.toFixed(2)}`
    );
  };

  const closeCaixa = async (
    finalAmount: number, 
    operatorName: string, 
    expectedAmount?: number,
    closingDetails?: CashClosingDetails
  ) => {
    const variance = finalAmount - (expectedAmount || 0);
    const now = new Date().toISOString();

    // Se estiver em modo treinamento, encerra no sandbox sem chamar o servidor
    if (isTrainingModeActive()) {
      const trainingClosed: CashSession = {
        id: activeCashSession?.id || `training-session-${Date.now()}`,
        status: 'closed',
        initialAmount: activeCashSession?.initialAmount || 100,
        openedBy: activeCashSession?.openedBy || operatorName,
        openedAt: activeCashSession?.openedAt || now,
        finalAmount,
        expectedAmount,
        varianceAmount: variance,
        closedBy: operatorName,
        closedAt: now,
        closingDetails
      };
      saveTrainingCashSession(null);
      setActiveCashSession(null);
      setAllCashSessions(prev => [trainingClosed, ...prev.filter(s => s.id !== trainingClosed.id)]);
      return;
    }

    // Limpar rotas, estados de entrega e salão locais ao encerrar o caixa
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('hum_vicio_delivery_routes');
        localStorage.removeItem('hum_vicio_delivered_sales');
        localStorage.removeItem('hum_vicio_prod_status_map');
        localStorage.removeItem('hum_vicio_sessao_salao_ativa');
        if (closingDetails) {
          localStorage.setItem('hum_vicio_last_closing_summary', JSON.stringify({
            ...closingDetails,
            operator: operatorName,
            date: now,
            sessionId: activeCashSession?.id
          }));
        }
      } catch {}
    }

    if (activeCashSession) {
      try {
        const res = await fetch('/api/cash/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeCashSession.id,
            finalAmount,
            expectedAmount,
            varianceAmount: variance,
            closingDetails,
            notes: closingDetails?.notes
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('Erro ao fechar caixa no servidor:', errData);
        }
      } catch (err) {
        console.error('Erro de conexão ao fechar caixa no servidor:', err);
      }

      setAllCashSessions(prev => prev.map(s => {
        if (s.id === activeCashSession.id) {
          return {
            ...s,
            status: 'closed',
            finalAmount,
            expectedAmount,
            varianceAmount: variance,
            closedBy: operatorName,
            closedAt: now,
            closingDetails
          };
        }
        return s;
      }));
    }

    const auditSummary = closingDetails
      ? `Fechamento com Conferência de Maquininhas por ${operatorName}. Total Declarado: R$ ${(closingDetails.countedTotal ?? finalAmount).toFixed(2)} | Esperado: R$ ${(closingDetails.expectedTotal ?? expectedAmount ?? 0).toFixed(2)} | Dif Geral: ${((closingDetails.varianceTotal ?? variance) >= 0 ? '+' : '') + (closingDetails.varianceTotal ?? variance).toFixed(2)} | [Débito: R$ ${(closingDetails.countedDebito ?? 0).toFixed(2)} (esp ${(closingDetails.expectedDebito ?? 0).toFixed(2)}) | Crédito: R$ ${(closingDetails.countedCredito ?? 0).toFixed(2)} (esp ${(closingDetails.expectedCredito ?? 0).toFixed(2)}) | PIX: R$ ${(closingDetails.countedPix ?? 0).toFixed(2)} (esp ${(closingDetails.expectedPix ?? 0).toFixed(2)}) | Gaveta: R$ ${(closingDetails.countedCash ?? finalAmount).toFixed(2)} (esp ${(closingDetails.expectedCash ?? expectedAmount ?? 0).toFixed(2)})]${closingDetails.notes ? ` Obs: ${closingDetails.notes}` : ''}`
      : `Fechamento de Caixa efetuado por ${operatorName}. Contado: R$ ${finalAmount.toFixed(2)} | Esperado: R$ ${(expectedAmount || 0).toFixed(2)} | Diferença: ${variance >= 0 ? `+R$ ${variance.toFixed(2)} (Sobra)` : `-R$ ${Math.abs(variance).toFixed(2)} (Falta)`}`;

    addAuditLog(
      'FECHAMENTO_CAIXA',
      auditSummary,
      operatorName,
      `Esperado Geral: R$ ${(closingDetails?.expectedTotal ?? expectedAmount ?? 0).toFixed(2)}`,
      `Declarado Geral: R$ ${(closingDetails?.countedTotal ?? finalAmount).toFixed(2)} (Diferença: R$ ${(closingDetails?.varianceTotal ?? variance).toFixed(2)})`
    );

    setActiveCashSession(null);
    setIsOpen(false);
  };

  const toggleCaixa = (status: boolean) => {
    if (status) {
      openCaixa(0, 'Operador');
    } else {
      closeCaixa(0, 'Operador');
    }
  };

  // Exclusão de Sessão de Caixa & Expurgar Vendas de Teste (Exclusivo Master Admin)
  const deleteCashSession = async (sessionId: string, masterPassword: string): Promise<{ success: boolean; error?: string; count?: number }> => {
    // Validação autoritativa da senha mestre via Servidor (com fallback no cache blindado)
    let isPassValid = false;
    try {
      const { verifyMasterPasswordAction } = await import('@/app/(modules)/admin/colaboradores/actions');
      const authRes = await verifyMasterPasswordAction(masterPassword);
      isPassValid = authRes.valid;
      if (!authRes.valid && authRes.error) {
        return { success: false, error: authRes.error };
      }
    } catch {
      isPassValid = false; // Falha fechada: não validar credenciais no navegador.
    }

    if (!isPassValid) {
      return { success: false, error: 'Senha de Administrador Master incorreta.' };
    }

    const session = allCashSessions.find(s => s.id === sessionId);
    let openedAt = session ? new Date(session.openedAt).getTime() : 0;
    let closedAt = session?.closedAt ? new Date(session.closedAt).getTime() : Date.now();

    if (!session) {
      try {
        const { data: dbSess } = await supabase.from('cash_sessions').select('*').eq('id', sessionId).single();
        if (dbSess) {
          openedAt = new Date(dbSess.opened_at).getTime();
          closedAt = dbSess.closed_at ? new Date(dbSess.closed_at).getTime() : Date.now();
        }
      } catch {}
    }

    // Vendas locais que ocorreram no período da sessão
    const localSaleIds = sales
      .filter(s => {
        const saleTime = new Date(s.date).getTime();
        return saleTime >= (openedAt - 120000) && saleTime <= (closedAt + 120000);
      })
      .map(s => s.id);

    // Buscar também diretamente no Supabase vendas criadas no período da sessão
    let dbSaleIds: string[] = [];
    try {
      const { data: dbSales } = await supabase
        .from('sales')
        .select('id')
        .gte('created_at', new Date(openedAt - 120000).toISOString())
        .lte('created_at', new Date(closedAt + 120000).toISOString());
      if (dbSales) {
        dbSaleIds = dbSales.map(s => s.id);
      }
    } catch {}

    const allSaleIdsToDelete = Array.from(new Set([...localSaleIds, ...dbSaleIds]));

    try {
      if (allSaleIdsToDelete.length > 0) {
        // Desvincular itens para que nunca mais reapareçam
        await supabase.from('sale_items').update({ sale_id: null }).in('sale_id', allSaleIdsToDelete);
        // Soft delete nas vendas com cancelamento oficial
        await supabase.from('sales').update({ 
          deleted_at: new Date().toISOString(), 
          status: 'cancelled',
          cancellation_reason: 'Expurgado por exclusão de caixa de teste',
          cancelled_by: 'Administrador Master',
          cancelled_at: new Date().toISOString()
        }).in('id', allSaleIdsToDelete);
      }
      // Soft delete na sessão de caixa
      await supabase.from('cash_sessions').update({ 
        deleted_at: new Date().toISOString(),
        status: 'closed',
        closed_at: new Date().toISOString()
      }).eq('id', sessionId);
    } catch (err) {
      console.warn('Erro ao deletar sessão do banco:', err);
    }

    setAllCashSessions(prev => prev.filter(s => s.id !== sessionId));

    setSales(prev => {
      const remaining = prev.filter(s => !allSaleIdsToDelete.includes(s.id));
      if (typeof window !== 'undefined') {
        try {
          if (remaining.length === 0) {
            localStorage.removeItem('hum_vicio_cached_sales');
          } else {
            localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(remaining.slice(0, 100)));
          }
        } catch {}
      }
      return remaining;
    });

    // Limpar os pedidos expurgados de quaisquer rotas salvas localmente
    if (typeof window !== 'undefined') {
      try {
        const routesRaw = localStorage.getItem('hum_vicio_delivery_routes');
        if (routesRaw) {
          const routes = JSON.parse(routesRaw);
          const cleanedRoutes = routes.map((r: any) => ({
            ...r,
            saleIds: r.saleIds.filter((id: string) => !allSaleIdsToDelete.includes(id))
          }));
          localStorage.setItem('hum_vicio_delivery_routes', JSON.stringify(cleanedRoutes));
        }
      } catch {}
    }

    if (activeCashSession?.id === sessionId) {
      setActiveCashSession(null);
      setIsOpen(false);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('hum_vicio_delivery_routes');
          localStorage.removeItem('hum_vicio_delivered_sales');
          localStorage.removeItem('hum_vicio_prod_status_map');
          localStorage.removeItem('hum_vicio_cached_sales');
        } catch {}
      }
      setSales([]);
    }

    addAuditLog(
      'EXCLUSAO_CAIXA_TESTE',
      `Sessão de Caixa #${sessionId.slice(0, 6)} excluída pelo Administrador Master. ${allSaleIdsToDelete.length} vendas de teste expurgadas do faturamento e contabilidade.`,
      'Administrador Master'
    );

    return { success: true, count: allSaleIdsToDelete.length };
  };

  // Exclusão manual direta de vendas de teste selecionadas
  const deleteTestSales = async (saleIds: string[], masterPassword: string): Promise<{ success: boolean; error?: string }> => {
    // Validação autoritativa da senha mestre via Servidor (com fallback no cache blindado)
    let isPassValid = false;
    try {
      const { verifyMasterPasswordAction } = await import('@/app/(modules)/admin/colaboradores/actions');
      const authRes = await verifyMasterPasswordAction(masterPassword);
      isPassValid = authRes.valid;
      if (!authRes.valid && authRes.error) {
        return { success: false, error: authRes.error };
      }
    } catch {
      isPassValid = false; // Falha fechada: não validar credenciais no navegador.
    }

    if (!isPassValid) {
      return { success: false, error: 'Senha de Administrador Master incorreta.' };
    }

    if (!saleIds || saleIds.length === 0) return { success: true };

    try {
      await supabase.from('sale_items').update({ sale_id: null }).in('sale_id', saleIds);
      await supabase.from('sales').update({ 
        deleted_at: new Date().toISOString(), 
        status: 'cancelled',
        cancellation_reason: 'Expurgado manualmente pelo Administrador Master',
        cancelled_by: 'Administrador Master',
        cancelled_at: new Date().toISOString()
      }).in('id', saleIds);
    } catch (err) {
      console.warn('Erro ao deletar vendas de teste no banco:', err);
    }

    setSales(prev => {
      const remaining = prev.filter(s => !saleIds.includes(s.id));
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(remaining.slice(0, 100))); } catch {}
      }
      return remaining;
    });

    if (typeof window !== 'undefined') {
      try {
        const routesRaw = localStorage.getItem('hum_vicio_delivery_routes');
        if (routesRaw) {
          const routes = JSON.parse(routesRaw);
          const cleanedRoutes = routes.map((r: any) => ({
            ...r,
            saleIds: r.saleIds.filter((id: string) => !saleIds.includes(id))
          }));
          localStorage.setItem('hum_vicio_delivery_routes', JSON.stringify(cleanedRoutes));
        }
      } catch {}
    }

    addAuditLog(
      'EXPURGO_VENDAS_TESTE',
      `${saleIds.length} vendas de teste expurgadas do faturamento e contabilidade pelo Administrador Master.`,
      'Administrador Master'
    );

    return { success: true };
  };

  const addSale = async (rawSale: Omit<Sale, 'id' | 'date' | 'status'>) => {
    // Normalizar observações e gerar snapshot determinístico de produção (Etapa 4 - Composição Confirmada)
    const normalizedItems = prepareCheckoutItems(rawSale.items || [], products, items, kitchenComponents);
    const sale = { ...rawSale, items: normalizedItems };

    // Por padrão operacional da hamburgueria, pedidos entram em espera para montagem de rotas de entrega
    const initialProductionStatus = sale.productionStatus || 'em_espera';
    const initialProductionStarted = sale.productionStartedAt || new Date().toISOString();
    const initialTargetPrep = sale.targetPrepMinutes || targetPrepMinutes;

    // UUID nativo padrão gerado no cliente
    const clientGeneratedId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : ('00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0'));
    const idempotencyKey = `sale_checkout_${clientGeneratedId}`;

    // Configuração de Vendas a Prazo / Contas a Receber
    const isCreditSale = sale.paymentMethod === 'consumo_funcionario' || sale.paymentMethod === 'fiado_vip';
    const creditStatus = isCreditSale ? (sale.creditStatus || 'pendente') : undefined;

    // Status de pagamento da Retirada
    const paymentStatus: 'pago' | 'pendente_retirada' = sale.paymentStatus || (
      sale.orderType === 'retirada' && sale.paymentMethod === 'retirada' ? 'pendente_retirada' :
      isCreditSale ? 'pendente_retirada' : 'pago'
    );

    // Identificação de Brindes no Pedido
    const giftItems = (sale.items || []).filter(i => i.isGift);
    const hasGifts = giftItems.length > 0;
    const giftsTotalValue = giftItems.reduce((acc, i) => acc + ((i.originalPrice || 0) * i.quantity), 0);

    // Se estiver em modo treinamento, não aciona o servidor de produção nem baixa estoque real
    if (isTrainingModeActive()) {
      const trainingSale: Sale = {
        id: clientGeneratedId,
        date: new Date().toISOString(),
        status: 'completed',
        ...sale,
        productionStatus: initialProductionStatus,
        productionStartedAt: initialProductionStarted,
        targetPrepMinutes: initialTargetPrep,
        paymentStatus,
        creditStatus,
        hasGifts,
        giftsTotalValue: hasGifts ? giftsTotalValue : undefined,
        isOfflineSynced: true,
        syncStatus: 'synced'
      };
      const currentTrainingSales = getTrainingSales();
      saveTrainingSales([trainingSale, ...currentTrainingSales]);
      setSales(prev => [trainingSale, ...prev]);
      return trainingSale;
    }

    enqueueOfflineSale({
      ...sale, id: clientGeneratedId, idempotencyKey,
      date: new Date().toISOString(), status: 'completed',
      paymentStatus, creditStatus, productionStatus: initialProductionStatus,
      productionStartedAt: initialProductionStarted, targetPrepMinutes: initialTargetPrep,
    });

    let sData: any = null;
    let checkoutError: string | undefined;
    let checkoutResponded = false;
    let isOffline = false;

    // Execução atômica no servidor com timeout de 3.5s (tolerância para conexão lenta)
    try {
      const checkoutOnline = async () => {
        const res = await fetch('/api/sales/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey,
            sale: {
              ...sale,
              id: clientGeneratedId,
              channel: sale.channel,
              total: sale.total,
              subtotal: sale.subtotal !== undefined ? sale.subtotal : sale.total,
              discount: sale.discount || 0,
              deliveryFee: sale.deliveryFee || 0,
              storeCouponSubsidy: sale.storeCouponSubsidy || 0,
              paymentMethod: sale.paidMethod || sale.paymentMethod,
              paidMethod: paymentStatus === 'pago' ? (sale.paidMethod || sale.paymentMethod) : undefined,
              paymentStatus,
              paidAt: paymentStatus === 'pago' ? (sale.paidAt || new Date().toISOString()) : undefined,
              customerName: sale.customerName || (sale.paymentMethod === 'consumo_funcionario' ? sale.collaboratorName : sale.creditCustomerName) || 'Balcão',
              orderType: sale.orderType || 'mesa',
              productionStatus: initialProductionStatus,
              productionStartedAt: initialProductionStarted,
              targetPrepMinutes: initialTargetPrep,
              items: sale.items,
              date: new Date().toISOString(),
              collaboratorId: sale.collaboratorId,
              collaboratorName: sale.collaboratorName,
              creditCustomerName: sale.creditCustomerName,
              creditDueDate: sale.creditDueDate,
              creditNotes: sale.creditNotes,
              creditStatus,
            }
          })
        });

        checkoutResponded = true;
        if (res.ok) {
          return await res.json();
        }
        const failure = await res.json().catch(() => ({}));
        checkoutError = failure.message || (typeof failure.error === 'string' ? failure.error : 'O servidor não confirmou o pedido. Tente sincronizar novamente.');
        return null;
      };

      const timeoutRace = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      sData = await Promise.race([checkoutOnline(), timeoutRace]);
    } catch (e) {
      console.warn('Tentativa online de checkout falhou:', e);
      sData = null;
    }

    if (!sData) {
      isOffline = true;
      setIsOnline(false);
    } else {
      setIsOnline(true);
    }

    const saleId = sData?.saleId || sData?.sale?.id || clientGeneratedId;

    // Baixa local de estoque imediata para feedback instantâneo da interface
    const newItems = [...items];
    sale.items.forEach(si => {
      const prod = products.find(p => p.id === si.productId);
      if (prod) {
        prod.recipe.forEach(r => {
          const invIdx = newItems.findIndex(inv => inv.id === r.ingredientId);
          if (invIdx > -1) {
            const decr = r.quantity * si.quantity;
            const newStock = Number((newItems[invIdx].currentStock - decr).toFixed(3));
            newItems[invIdx] = { 
              ...newItems[invIdx], 
              currentStock: newStock,
              status: newStock <= 0 ? 'zerado' : (newItems[invIdx].minStock && newStock <= newItems[invIdx].minStock) ? 'acabando' : newItems[invIdx].status
            };
          }
        });
      }
    });

    setItems(newItems);

    // Auditoria de brindes concedidos pelo operador
    giftItems.forEach(g => {
      const reasonLabel = 
        g.giftReason === 'falta_pedido_anterior' ? 'Falta / Esquecimento no pedido anterior' :
        g.giftReason === 'fidelidade_cliente' ? 'Fidelidade / Excelente cliente' :
        g.giftReason === 'atraso_preparo' ? 'Atraso no preparo / Atendimento' :
        g.giftReason === 'cortesia_casa' ? 'Cortesia da casa' : 'Outro motivo';
      
      addAuditLog(
        'ITEM_BRINDE',
        `Item marcado como Brinde no pedido de "${sale.customerName || 'Balcão'}": ${g.quantity}x ${g.productName}. Motivo: ${reasonLabel}${g.giftNotes ? ` (Obs: ${g.giftNotes})` : ''}. Valor estornado: R$ ${((g.originalPrice || 0) * g.quantity).toFixed(2)}`,
        'Operador',
        `R$ ${((g.originalPrice || 0) * g.quantity).toFixed(2)}`,
        'R$ 0.00'
      );
    });

    // Auditoria de desconto concedido
    if (sale.discount && sale.discount > 0) {
      addAuditLog(
        'DESCONTO_CONCEDIDO',
        `Desconto de R$ ${sale.discount.toFixed(2)} concedido no pedido de "${sale.customerName || 'Balcão'}". Subtotal: R$ ${(sale.subtotal || sale.total).toFixed(2)} -> Total Final: R$ ${sale.total.toFixed(2)}`,
        'Operador',
        `R$ ${(sale.subtotal || sale.total).toFixed(2)}`,
        `R$ ${sale.total.toFixed(2)}`
      );
    }

    // Auditoria de cupom iFood custeado pela loja (Hits)
    if (sale.storeCouponSubsidy && sale.storeCouponSubsidy > 0) {
      addAuditLog(
        'CUPOM_HITS_IFOOD',
        `Pedido no iFood com cupom custeado pela loja no valor de R$ ${sale.storeCouponSubsidy.toFixed(2)} (${sale.customerName || 'Cliente iFood'}).`,
        'Operador',
        undefined,
        `Subsídio Loja: R$ ${sale.storeCouponSubsidy.toFixed(2)}`
      );
    }

    // O pedido É SEMPRE INCLUÍDO E NUNCA SE PERDE!
    const newSaleLocal: Sale = {
      ...sale,
      id: saleId,
      idempotencyKey,
      customerName: sale.customerName || (sale.paymentMethod === 'consumo_funcionario' ? sale.collaboratorName : sale.creditCustomerName) || 'Balcão',
      orderType: sale.orderType || 'mesa',
      subtotal: sale.subtotal !== undefined ? sale.subtotal : sale.total,
      discount: sale.discount || 0,
      deliveryFee: sale.deliveryFee || 0,
      storeCouponSubsidy: sale.storeCouponSubsidy || 0,
      hasGifts,
      giftsTotalValue,
      paymentStatus,
      paidAt: paymentStatus === 'pago' ? (sale.paidAt || new Date().toISOString()) : undefined,
      paidMethod: paymentStatus === 'pago' ? (sale.paidMethod || sale.paymentMethod) : undefined,
      deliveredAt: sale.deliveredAt || undefined,
      deliveredBy: sale.deliveredBy || undefined,
      isOfflineSynced: !isOffline,
      syncStatus: isOffline ? 'pending' : 'synced',
      syncError: isOffline ? checkoutError : undefined,
      productionStatus: initialProductionStatus,
      productionStartedAt: initialProductionStarted,
      targetPrepMinutes: initialTargetPrep,
      collaboratorId: sale.collaboratorId,
      collaboratorName: sale.collaboratorName,
      creditCustomerName: sale.creditCustomerName,
      creditDueDate: sale.creditDueDate,
      creditNotes: sale.creditNotes,
      creditStatus,
      creditPaidAt: sale.creditPaidAt,
      creditPaidMethod: sale.creditPaidMethod,
      date: sData?.sale?.date || new Date().toISOString(),
      status: 'completed'
    };

    // Se salvou offline (banco de dados caiu ou não respondeu em 3.5s), adiciona na fila outbox
    if (isOffline) {
      updateOfflineSaleInQueue(newSaleLocal.id, newSaleLocal);
      const q = getOfflineSalesQueue();
      setOfflineQueueCount(q.length);
      setOfflineSalesList(q);
      setConnectionStatus(checkoutResponded ? 'connected' : typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'server_unreachable');
    } else {
      try { removeOfflineSaleFromQueue(clientGeneratedId); } catch (error) { console.warn('Pedido confirmado; limpeza da fila pendente.', error); }
      const queue = getOfflineSalesQueue();
      setOfflineQueueCount(queue.length);
      setOfflineSalesList(queue);
      const nowIso = new Date().toISOString();
      setLastServerSync(nowIso);
      try { localStorage.setItem('hum_vicio_last_server_sync', nowIso); } catch {}
      setConnectionStatus('connected');
    }

    // Salvar override do pedido para persistir localmente e nunca voltar para espera
    saveProductionOverrides([{ id: saleId, status: initialProductionStatus, startedAt: initialProductionStarted }]);

    if (paymentStatus === 'pendente_retirada') {
      savePickupPendingOverride(saleId, {
        paymentStatus: 'pendente_retirada'
      });
    }

    if (isCreditSale) {
      saveCreditSaleOverride(saleId, {
        collaboratorId: sale.collaboratorId,
        collaboratorName: sale.collaboratorName,
        creditCustomerName: sale.creditCustomerName,
        creditDueDate: sale.creditDueDate,
        creditNotes: sale.creditNotes,
        creditStatus,
        creditPaidAt: sale.creditPaidAt,
        creditPaidMethod: sale.creditPaidMethod
      });
    }

    setSales(prev => {
      const updated = [newSaleLocal, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    return newSaleLocal;
  };

  // Liquidação de Pagamento na Retirada (Pagar ao Retirar Pedido)
  const settlePickupPayment = async (saleId: string, paymentMethod: string, operatorName: string) => {
    const target = sales.find(s => s.id === saleId);
    if (!target) return { success: false, message: 'Pedido não encontrado' };

    const paidAt = new Date().toISOString();
    const opName = operatorName || 'Operador';
    const updatedSale: Sale = {
      ...target,
      paymentStatus: 'pago',
      paidAt,
      paidMethod: paymentMethod,
      paymentMethod: paymentMethod,
      deliveredAt: target.deliveredAt || paidAt,
      deliveredBy: target.deliveredBy || opName
    };

    savePickupPendingOverride(saleId, {
      paymentStatus: 'pago',
      paidAt,
      paidMethod: paymentMethod
    });

    saveDeliveredPickupOverride(saleId, {
      deliveredAt: target.deliveredAt || paidAt,
      deliveredBy: target.deliveredBy || opName
    });

    // Se estiver na fila offline outbox, atualiza o item da fila
    const queue = getOfflineSalesQueue();
    const qIdx = queue.findIndex(s => s.id === saleId);
    if (qIdx > -1) {
      queue[qIdx] = updatedSale;
      saveOfflineSalesQueue(queue);
    }

    try {
      const res = await fetch('/api/sales/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId,
          sessionId: activeCashSession?.id,
          paymentMethod,
          settlementType: 'retirada'
        })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Erro na quitação transacional de retirada no servidor:', errJson);
      }
    } catch (err) {
      console.warn('Erro de conexão ao quitar retirada no servidor:', err);
    }

    setSales(prev => {
      const updated = prev.map(s => s.id === saleId ? updatedSale : s);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    return { success: true, sale: updatedSale };
  };

  // Ação do Balcão: confirmar que o cliente retirou o pedido
  const markPickupAsDelivered = async (saleId: string, operatorName?: string) => {
    const target = sales.find(s => s.id === saleId);
    if (!target) return { success: false, message: 'Pedido não encontrado' };

    const deliveredAt = new Date().toISOString();
    const opName = operatorName || 'Operador';
    const updatedSale: Sale = {
      ...target,
      deliveredAt,
      deliveredBy: opName
    };

    saveDeliveredPickupOverride(saleId, {
      deliveredAt,
      deliveredBy: opName
    });

    // Se estiver na fila offline outbox, atualiza o item da fila
    const queue = getOfflineSalesQueue();
    const qIdx = queue.findIndex(s => s.id === saleId);
    if (qIdx > -1) {
      queue[qIdx] = updatedSale;
      saveOfflineSalesQueue(queue);
    }

    addAuditLog(
      'RETIRADA_ENTREGUE',
      `Pedido #${saleId.slice(0, 6).toUpperCase()} retirado pelo cliente (${target.customerName || 'Balcão'}) confirmado por ${opName}.`,
      opName,
      'Pronto no Balcão',
      'Concluído / Retirado'
    );

    setSales(prev => {
      const updated = prev.map(s => s.id === saleId ? updatedSale : s);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    try {
      await supabase.from('sales').update({
        delivered_at: deliveredAt,
        delivered_by: opName,
        updated_at: deliveredAt
      }).eq('id', saleId);
    } catch (err) {
      console.warn('Erro ao atualizar status de retirada no Supabase:', err);
    }

    return { success: true, sale: updatedSale };
  };

  // Liquidação de Contas a Receber (Fiado VIP e Consumo de Funcionários)
  const settleCreditSale = async (saleId: string, paymentMethod: string, operatorName: string) => {
    const target = sales.find(s => s.id === saleId);
    if (!target) return { success: false, message: 'Venda não encontrada' };

    const paidAt = new Date().toISOString();
    const updatedSale: Sale = {
      ...target,
      creditStatus: 'quitado',
      creditPaidAt: paidAt,
      creditPaidMethod: paymentMethod
    };

    saveCreditSaleOverride(saleId, {
      creditStatus: 'quitado',
      creditPaidAt: paidAt,
      creditPaidMethod: paymentMethod
    });

    try {
      const res = await fetch('/api/sales/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId,
          sessionId: activeCashSession?.id,
          paymentMethod,
          settlementType: 'fiado'
        })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Erro na quitação transacional de fiado no servidor:', errJson);
      }
    } catch (err) {
      console.warn('Erro de conexão ao quitar fiado no servidor:', err);
    }

    setSales(prev => {
      const updated = prev.map(s => s.id === saleId ? updatedSale : s);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    return { success: true, sale: updatedSale };
  };

  // Validador estrito de transições de produção (Frente 4.2 - Usabilidade de Cozinha)
  const isValidProductionTransition = (currentStatus: ProductionStatus, newStatus: ProductionStatus, isCancelled: boolean): boolean => {
    if (isCancelled) return false;
    if (currentStatus === newStatus) return true;
    // Se já está concluído, impede regressão para em_producao, em_espera ou agendado
    if (currentStatus === 'concluido') return false;
    // Transições permitidas:
    // em_espera -> em_producao, agendado
    // agendado -> em_espera, em_producao
    // em_producao -> concluido, em_espera
    return true;
  };

  // Ação do Balcão: alterar status de produção (para chapa, em espera, agendado)
  const updateOrderProductionStatus = async (saleId: string, newStatus: ProductionStatus) => {
    const existing = sales.find(s => s.id === saleId);
    if (!existing || !isValidProductionTransition(existing.productionStatus || 'em_espera', newStatus, existing.status === 'cancelled')) {
      console.warn(`[KDS] Transição de produção incompatível ignorada para o pedido ${saleId}: de ${existing?.productionStatus} para ${newStatus} (cancelado=${existing?.status === 'cancelled'})`);
      return;
    }

    const startedAt = newStatus === 'em_producao' ? new Date().toISOString() : undefined;
    
    // 1. Salvar override no storage local para nunca ser sobrescrito pelo polling
    saveProductionOverrides([{ id: saleId, status: newStatus, startedAt: startedAt || new Date().toISOString() }]);

    // 2. Atualização otimista e reativa no store
    setSales(prev => {
      const updated = prev.map(s => {
        if (s.id === saleId) {
          return {
            ...s,
            productionStatus: newStatus,
            productionStartedAt: startedAt || s.productionStartedAt || s.date
          };
        }
        return s;
      });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    // 3. Suporte a modo treinamento ou persistência remota
    if (isTrainingModeActive()) {
      const currentTraining = getTrainingSales();
      const updatedTraining = currentTraining.map(ts => {
        if (ts.id === saleId) {
          return {
            ...ts,
            productionStatus: newStatus,
            productionStartedAt: startedAt || ts.productionStartedAt || ts.date
          };
        }
        return ts;
      });
      saveTrainingSales(updatedTraining);
      return;
    }

    try {
      const updateData: any = { production_status: newStatus };
      if (startedAt) updateData.production_started_at = startedAt;
      await supabase.from('sales').update(updateData).eq('id', saleId);
    } catch (err) {
      console.warn('Erro ao atualizar status de produção no Supabase:', err);
    }
  };

  // Ação do Balcão: Enviar múltiplos pedidos em lote para a Chapa de uma vez
  const updateBatchProductionStatus = async (saleIds: string[], newStatus: ProductionStatus) => {
    if (!saleIds || saleIds.length === 0) return;

    // Filtra apenas pedidos com transição compatível
    const validSaleIds = saleIds.filter(id => {
      const s = sales.find(sale => sale.id === id);
      if (!s) return false;
      return isValidProductionTransition(s.productionStatus || 'em_espera', newStatus, s.status === 'cancelled');
    });

    if (validSaleIds.length === 0) return;
    const startedAt = newStatus === 'em_producao' ? new Date().toISOString() : undefined;

    // 1. Salvar overrides de todos os pedidos selecionados
    saveProductionOverrides(validSaleIds.map(id => ({ 
      id, 
      status: newStatus, 
      startedAt: startedAt || new Date().toISOString() 
    })));

    // 2. Atualização otimista e reativa no store
    setSales(prev => {
      const updated = prev.map(s => {
        if (validSaleIds.includes(s.id)) {
          return {
            ...s,
            productionStatus: newStatus,
            productionStartedAt: startedAt || s.productionStartedAt || s.date
          };
        }
        return s;
      });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    // 3. Suporte a modo treinamento ou persistência remota em lote
    if (isTrainingModeActive()) {
      const currentTraining = getTrainingSales();
      const updatedTraining = currentTraining.map(ts => {
        if (validSaleIds.includes(ts.id)) {
          return {
            ...ts,
            productionStatus: newStatus,
            productionStartedAt: startedAt || ts.productionStartedAt || ts.date
          };
        }
        return ts;
      });
      saveTrainingSales(updatedTraining);
      return;
    }

    try {
      const updateData: any = { production_status: newStatus };
      if (startedAt) updateData.production_started_at = startedAt;
      await supabase.from('sales').update(updateData).in('id', validSaleIds);
    } catch (err) {
      console.warn('Erro ao atualizar lote de pedidos no Supabase:', err);
    }
  };

  // Ação da Cozinha: concluir pedido (com justificativa de atraso se aplicável)
  const completeOrderProduction = async (saleId: string, delayReason?: DelayReason, delayNotes?: string) => {
    const existing = sales.find(s => s.id === saleId);
    if (!existing || existing.status === 'cancelled' || existing.productionStatus === 'concluido') {
      console.warn(`[KDS] Não é possível concluir pedido ${saleId} (inexistente, cancelado ou já concluído)`);
      return;
    }

    const completedAt = new Date().toISOString();
    let timeMinutes = 0;
    if (existing?.productionStartedAt) {
      const startMs = new Date(existing.productionStartedAt).getTime();
      const endMs = new Date(completedAt).getTime();
      timeMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
    }

    // 1. Salvar override no storage local imediatamente para nunca ressuscitar na chapa
    saveProductionOverrides([{ id: saleId, status: 'concluido', startedAt: existing?.productionStartedAt }]);

    // 2. Atualização otimista e reativa imediata no store
    setSales(prev => {
      const updated = prev.map(s => {
        if (s.id === saleId) {
          return {
            ...s,
            productionStatus: 'concluido' as ProductionStatus,
            productionCompletedAt: completedAt,
            productionTimeMinutes: timeMinutes,
            delayReason: delayReason || s.delayReason,
            delayNotes: delayNotes || s.delayNotes
          };
        }
        return s;
      });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    // 3. Persistência em sandbox de treinamento ou no banco relacional remoto
    if (isTrainingModeActive()) {
      const currentTraining = getTrainingSales();
      const updatedTraining = currentTraining.map(ts => {
        if (ts.id === saleId) {
          return {
            ...ts,
            productionStatus: 'concluido' as ProductionStatus,
            productionCompletedAt: completedAt,
            productionTimeMinutes: timeMinutes,
            delayReason: delayReason || ts.delayReason,
            delayNotes: delayNotes || ts.delayNotes
          };
        }
        return ts;
      });
      saveTrainingSales(updatedTraining);
      return;
    }

    try {
      const updateData: any = {
        production_status: 'concluido',
        production_completed_at: completedAt
      };
      if (delayReason) {
        updateData.delay_reason = delayReason;
        updateData.delay_notes = delayNotes;
      }
      const { error } = await supabase.from('sales').update(updateData).eq('id', saleId);
      if (error) {
        console.warn('Erro ao atualizar status concluido no Supabase, tentando update simples:', error);
        await supabase.from('sales').update({ production_status: 'concluido' }).eq('id', saleId);
      }
    } catch (err) {
      console.warn('Erro ao concluir produção no Supabase:', err);
    }
  };

  const cancelSale = async (
    id: string, 
    reason?: string, 
    authorizedBy?: string, 
    notes?: string,
    supervisorPassword?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const existingSale = sales.find(s => s.id === id);
    const cancellationReason = reason || 'Desistência do cliente antes do preparo';
    const now = new Date().toISOString();

    // Se estiver em modo treinamento, cancela localmente no sandbox sem chamar o servidor
    if (isTrainingModeActive()) {
      removeProductionOverrides([id]);
      const safeProdStatus: ProductionStatus = existingSale?.productionStatus === 'concluido'
        ? 'em_espera'
        : (existingSale?.productionStatus || 'em_espera');
      const currentTrainingSales = getTrainingSales();
      const updated = currentTrainingSales.map(s => s.id === id ? { 
        ...s, 
        status: 'cancelled' as const, 
        productionStatus: safeProdStatus,
        cancellationReason,
        cancelledAt: now,
        cancelledBy: authorizedBy || 'Supervisor (Treino)'
      } : s);
      saveTrainingSales(updated);
      setSales(prev => prev.map(s => s.id === id ? { 
        ...s, 
        status: 'cancelled' as const, 
        productionStatus: safeProdStatus,
        cancellationReason,
        cancelledAt: now,
        cancelledBy: authorizedBy || 'Supervisor (Treino)'
      } : s));
      return { success: true };
    }

    try {
      const res = await fetch('/api/sales/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: id,
          reason: cancellationReason,
          notes,
          supervisorPassword
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: errJson.message || 'Falha ao cancelar pedido no servidor.' };
      }

      const resData = await res.json();
      const confirmedCancelledBy = resData.cancelledBy || authorizedBy || 'Supervisor / Admin';

      // Tratamento distinto de cancelamento antes do preparo vs perda após preparo (Seção 8 e 10)
      const saleToCancel = existingSale;
      const isAlreadyPrepared = saleToCancel && (
        saleToCancel.productionStatus === 'concluido' ||
        saleToCancel.productionStatus === 'em_producao'
      );

      if (saleToCancel && saleToCancel.items) {
        if (!isAlreadyPrepared) {
          // Cancelamento antes do preparo: devolve os insumos ao estoque utilizável
          const restoredItems = [...items];
          saleToCancel.items.forEach(si => {
            const prod = products.find(p => p.id === si.productId);
            if (prod) {
              prod.recipe.forEach(r => {
                const invIdx = restoredItems.findIndex(inv => inv.id === r.ingredientId);
                if (invIdx > -1) {
                  restoredItems[invIdx] = { 
                    ...restoredItems[invIdx], 
                    currentStock: restoredItems[invIdx].currentStock + (r.quantity * si.quantity) 
                  };
                }
              });
            }
          });
          setItems(restoredItems);
        } else {
          // Cancelamento após preparo: comida produzida NÃO volta ao estoque utilizável; registra perda formal
          const reasonText = `Cancelamento pós-preparo #${id.slice(0, 6).toUpperCase()}: ${cancellationReason}`;
          const newWasteRecords: WasteRecord[] = [];
          for (const si of saleToCancel.items) {
            const prod = products.find(p => p.id === si.productId);
            if (prod) {
              for (const r of prod.recipe) {
                const ing = items.find(i => i.id === r.ingredientId);
                if (ing) {
                  const qtyLost = r.quantity * si.quantity;
                  const totalLoss = ing.costPerUnit * qtyLost;
                  newWasteRecords.push({
                    id: Math.random().toString(36).substring(2, 9),
                    ingredientId: ing.id,
                    ingredientName: ing.name,
                    quantity: qtyLost,
                    unit: ing.unit,
                    costAtTime: ing.costPerUnit,
                    totalLoss,
                    reason: reasonText,
                    responsibleName: confirmedCancelledBy,
                    createdAt: now
                  });
                }
              }
            }
          }
          if (newWasteRecords.length > 0) {
            setWasteRecords(prev => [...newWasteRecords, ...prev]);
            try {
              await supabase.from('waste_records').insert(
                newWasteRecords.map(w => ({
                  ingredient_id: w.ingredientId,
                  ingredient_name: w.ingredientName,
                  quantity: w.quantity,
                  unit: w.unit,
                  cost_at_time: w.costAtTime,
                  total_loss: w.totalLoss,
                  reason: w.reason,
                  responsible_name: w.responsibleName,
                  created_at: w.createdAt
                }))
              );
            } catch (err) {
              console.error('Erro ao persistir perda de cancelamento:', err);
            }
          }
        }
      }

      removeProductionOverrides([id]);
      const safeProdStatus: ProductionStatus = existingSale?.productionStatus === 'concluido'
        ? 'em_espera'
        : (existingSale?.productionStatus || 'em_espera');
      setSales(prev => {
        const updated = prev.map(s => s.id === id ? { 
          ...s, 
          status: 'cancelled' as const,
          productionStatus: safeProdStatus,
          cancellationReason,
          cancelledBy: confirmedCancelledBy,
          cancelledAt: now,
          cancellationNotes: notes
        } : s);
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
        }
        return updated;
      });

      return { success: true };
    } catch (err: any) {
      console.warn('Erro de rede ao cancelar venda:', err);
      return { success: false, error: 'Falha de conexão com o servidor.' };
    }
  };

  // Reabertura de Pedido Fechado para Edição com Preservação de Identidade
  const reopenOrderForEdit = async (saleId: string, authorizedBy: string): Promise<Sale | null> => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return null;

    const snapshot: SaleItem[] = JSON.parse(JSON.stringify(sale.items));
    const updatedSale: Sale = {
      ...sale,
      isReopened: true,
      reopenedAt: new Date().toISOString(),
      reopenedBy: authorizedBy,
      originalItemsSnapshot: snapshot
    };

    setSales(prev => {
      const updated = prev.map(s => s.id === saleId ? updatedSale : s);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    try {
      await supabase.from('sales').update({
        production_status: 'em_espera'
      }).eq('id', saleId);
    } catch (e) {
      console.warn('Erro ao atualizar reabertura no banco:', e);
    }

    addAuditLog(
      'REABERTURA_PEDIDO',
      `Pedido #${saleId.slice(0, 6).toUpperCase()} (${sale.customerName || 'Cliente'}) reaberto para edição por ${authorizedBy}. Total antes da edição: R$ ${sale.total.toFixed(2)}.`,
      authorizedBy,
      `R$ ${sale.total.toFixed(2)}`,
      'Em Edição'
    );

    return updatedSale;
  };

  // Atualizar Pedido Reaberto e Calcular Delta / Diff de Itens
  const updateReopenedOrder = async (
    saleId: string, 
    updatedSaleData: Partial<Sale>
  ): Promise<{ success: boolean; sale?: Sale; diff?: { added: SaleItem[]; removed: SaleItem[]; modified: { item: SaleItem; oldNotes?: string; newNotes?: string }[] }; error?: string }> => {
    const existingSale = sales.find(s => s.id === saleId);
    if (!existingSale) return { success: false, error: 'Comanda não encontrada para edição.' };

    const oldItems: SaleItem[] = existingSale.originalItemsSnapshot || existingSale.items || [];
    const newItems: SaleItem[] = (updatedSaleData.items || []).map(i => ({
      ...i,
      notes: i.notes?.trim() ? i.notes.trim().toUpperCase() : undefined
    }));

    // Suporte a modo treinamento (100% isolado no navegador)
    if (isTrainingModeActive()) {
      // 1. Calcular Adicionados
      const added: SaleItem[] = [];
      newItems.forEach(newItem => {
        const matchingOld = oldItems.find(o => o.productId === newItem.productId && (o.notes || '') === (newItem.notes || ''));
        if (!matchingOld) {
          added.push(newItem);
        } else if (newItem.quantity > matchingOld.quantity) {
          added.push({ ...newItem, quantity: newItem.quantity - matchingOld.quantity });
        }
      });

      // 2. Calcular Removidos
      const removed: SaleItem[] = [];
      oldItems.forEach(oldItem => {
        const matchingNew = newItems.find(n => n.productId === oldItem.productId && (n.notes || '') === (oldItem.notes || ''));
        if (!matchingNew) {
          removed.push(oldItem);
        } else if (matchingNew.quantity < oldItem.quantity) {
          removed.push({ ...oldItem, quantity: oldItem.quantity - matchingNew.quantity });
        }
      });

      // 3. Calcular Modificados (ex: observação alterada no mesmo lanche)
      const modified: { item: SaleItem; oldNotes?: string; newNotes?: string }[] = [];
      newItems.forEach(newItem => {
        const sameProductOld = oldItems.find(o => o.productId === newItem.productId);
        if (sameProductOld && (sameProductOld.notes || '') !== (newItem.notes || '')) {
          modified.push({
            item: newItem,
            oldNotes: sameProductOld.notes,
            newNotes: newItem.notes
          });
        }
      });

      const orderDiff = { added, removed, modified };
      const finalizedStatus = updatedSaleData.productionStatus || existingSale.productionStatus || 'em_espera';
      const isCurrentlyCooking = existingSale.productionStatus === 'em_producao';
      const hasDiff = added.length > 0 || removed.length > 0 || modified.length > 0;

      const finalizedSale: Sale = {
        ...existingSale,
        ...updatedSaleData,
        items: newItems,
        orderDiff,
        originalItemsSnapshot: newItems.map(i => ({ ...i })),
        isModifiedInKitchen: isCurrentlyCooking && hasDiff,
        productionStatus: finalizedStatus
      };

      setSales(prev => {
        const updated = prev.map(s => s.id === saleId ? finalizedSale : s);
        return updated;
      });

      const currentTraining = getTrainingSales();
      const updatedTraining = currentTraining.map(ts => ts.id === saleId ? finalizedSale : ts);
      saveTrainingSales(updatedTraining);

      return { success: true, sale: finalizedSale, diff: orderDiff };
    }

    // Persistência Transacional Segura via Endpoint Autoritativo (/api/sales/edit)
    try {
      const response = await fetch('/api/sales/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          saleId,
          items: newItems.length > 0 ? newItems : existingSale.items,
          customerName: updatedSaleData.customerName ?? existingSale.customerName,
          orderType: updatedSaleData.orderType ?? existingSale.orderType,
          channel: updatedSaleData.channel ?? existingSale.channel,
          discount: updatedSaleData.discount ?? existingSale.discount ?? 0,
          discountReason: updatedSaleData.discountReason ?? existingSale.discountReason,
          deliveryFee: updatedSaleData.deliveryFee ?? existingSale.deliveryFee ?? 0,
          subtotal: updatedSaleData.subtotal ?? existingSale.subtotal,
          total: updatedSaleData.total ?? existingSale.total,
          editReason: updatedSaleData.editReason || 'Ajuste de comanda pelo operador no caixa',
          productionStatus: updatedSaleData.productionStatus ?? existingSale.productionStatus,
          notes: updatedSaleData.notes ?? existingSale.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Erro ao salvar alteração da comanda (${response.status})`);
      }

      const returnedSale = result.sale;
      const returnedDiff = result.diff;

      const finalizedSale: Sale = {
        ...existingSale,
        ...returnedSale,
        items: returnedSale.items || newItems,
        orderDiff: returnedDiff,
        originalItemsSnapshot: (returnedSale.items || newItems).map((i: any) => ({ ...i })),
        isModifiedInKitchen: returnedSale.isModifiedInKitchen,
      };

      setSales(prev => {
        const updated = prev.map(s => s.id === saleId ? finalizedSale : s);
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
        }
        return updated;
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hum_vicio_order_modified', { detail: { saleId, diff: returnedDiff } }));
      }

      return { success: true, sale: finalizedSale, diff: returnedDiff };
    } catch (err: any) {
      console.error('Falha ao atualizar pedido reaberto via API:', err);
      return { success: false, error: err.message || 'Falha na comunicação com o servidor ao editar comanda.' };
    }
  };

  const addMovement = async (mov: Omit<CashMovement, 'id' | 'date'>) => {
    // Se estiver em modo treinamento, registra localmente sem acionar o servidor
    if (isTrainingModeActive()) {
      const trainingMov: CashMovement = {
        id: `training-mov-${Date.now()}`,
        type: mov.type,
        amount: mov.amount,
        description: `[TREINAMENTO] ${mov.description}`,
        date: new Date().toISOString()
      };
      const currentTrainingMovs = getTrainingMovements();
      saveTrainingMovements([trainingMov, ...currentTrainingMovs]);
      setMovements(prev => [trainingMov, ...prev]);
      return trainingMov;
    }

    let createdMov: CashMovement | null = null;

    try {
      const res = await fetch('/api/cash/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeCashSession?.id,
          type: mov.type,
          amount: mov.amount,
          description: mov.description
        })
      });

      if (res.ok) {
        const data = await res.json();
        createdMov = {
          id: data.id,
          type: mov.type,
          amount: mov.amount,
          description: mov.description,
          date: data.createdAt || new Date().toISOString()
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('Erro ao registrar movimentação de caixa no servidor:', errData);
      }
    } catch (err) {
      console.warn('Falha de rede ao registrar movimentação de caixa:', err);
    }

    const fallbackMov: CashMovement = createdMov || {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
      type: mov.type,
      amount: mov.amount,
      description: mov.description,
      date: new Date().toISOString()
    };

    setMovements(prev => [fallbackMov, ...prev]);
    return fallbackMov;
  };

  // --- CHECKLIST ACTIONS (COM ATRIBUIÇÃO FLEXÍVEL E TOGGLE BIDIRECIONAL) ---
  const toggleChecklistTask = async (
    taskId: string, 
    executorName?: string, 
    executorId?: string, 
    registeredBy?: string
  ) => {
    if (!checklist) return;
    
    const targetTask = checklist.tasks.find(t => t.id === taskId);
    const isCurrentlyChecked = !!targetTask?.checked;

    const updatedTasks: ChecklistTask[] = checklist.tasks.map(t => {
      if (t.id === taskId) {
        if (isCurrentlyChecked) {
          // Desmarcar por engano (reverte para PENDENTE e limpa campos de execução)
          return {
            ...t,
            checked: false,
            checkedBy: undefined,
            registeredByUserId: undefined,
            executedByCollaboratorId: undefined,
            executedByName: undefined,
            completedAt: undefined
          };
        } else {
          // Marcar como concluída atribuindo o colaborador executor
          return {
            ...t,
            checked: true,
            checkedBy: executorName || registeredBy || 'Colaborador',
            registeredByUserId: registeredBy,
            executedByCollaboratorId: executorId,
            executedByName: executorName || 'Colaborador',
            completedAt: new Date().toISOString()
          };
        }
      }
      return t;
    });
    
    const newChecklist = { ...checklist, tasks: updatedTasks };
    setChecklist(newChecklist);

    try {
      if (checklist.id === '') {
        const { data, error } = await supabase.from('kitchen_checklists').insert({
          date: checklist.date,
          tasks: updatedTasks
        }).select().single();
        
        if (data) setChecklist({ ...newChecklist, id: data.id });
        if (error) console.error(error);
      } else {
        await supabase.from('kitchen_checklists').update({ tasks: updatedTasks }).eq('id', checklist.id);
      }
    } catch (e) {
      console.warn('Erro ao atualizar checklist:', e);
    }

    addAuditLog(
      'CHECKLIST_TAREFA',
      isCurrentlyChecked
        ? `Tarefa "${targetTask?.label}" revertida para PENDENTE por ${registeredBy || 'Operador'}.`
        : `Tarefa "${targetTask?.label}" marcada como CONCLUÍDA. Executou: ${executorName || 'Equipe'}. Registrou: ${registeredBy || 'Operador'}.`,
      registeredBy || 'Operador'
    );
  };

  const signChecklist = async (personName: string) => {
    if (!checklist || checklist.id === '') return;
    const newChecklist = { ...checklist, signedBy: personName };
    setChecklist(newChecklist);
    await supabase.from('kitchen_checklists').update({ signed_by: personName }).eq('id', checklist.id);
  };

  const acknowledgeOrderModification = async (saleId: string) => {
    setSales(prev => prev.map(s => s.id === saleId ? { ...s, isModifiedInKitchen: false } : s));
    try {
      await supabase.from('sales').update({ delay_notes: null }).eq('id', saleId);
    } catch (e) {
      console.warn('Erro ao atualizar ciente da modificação no Supabase:', e);
    }
  };

  return { 
    items, linkInventoryKitchenComponent, addInventoryItem, updateInventoryItem, removeInventoryItem, updateStatus, registerPurchase,
    products, addProduct, updateProduct, removeProduct, getProductCmv, getRealSalesCmv, setProducts,
    kitchenComponents, setKitchenComponents, addKitchenComponent, updateKitchenComponent, removeKitchenComponent,
    batchAddIngredientToProducts, batchUpdateProductSubcategory,
    isLoaded, isOpen, activeCashSession, allCashSessions, openCaixa, closeCaixa, toggleCaixa, deleteCashSession, deleteTestSales,
    sales, addSale, cancelSale, reopenOrderForEdit, updateReopenedOrder, acknowledgeOrderModification,
    movements, addMovement,
    wasteRecords, registerWaste, getTotalWasteCost,
    checklist, toggleChecklistTask, signChecklist, allChecklists,
    suppliers, addSupplier, updateSupplier, removeSupplier,
    purchaseRecords, recordPurchaseWithSupplier,
    stockAudits, saveStockAudit,
    subRecipes, saveSubRecipe, removeSubRecipe, getIngredientTrueCost,
    targetPrepMinutes, setTargetPrepMinutes, updateOrderProductionStatus, updateBatchProductionStatus, completeOrderProduction,
    auditLogs, addAuditLog,
    fixedExpensesConfig, saveFixedExpensesConfig, settleCreditSale,
    settlePickupPayment, markPickupAsDelivered, offlineQueueCount, isOnline, syncOfflineQueueNow,
    retryOfflineSale: async (saleId: string) => {
      updateOfflineSaleInQueue(saleId, { syncStatus: 'pending', syncError: undefined });
      return syncOfflineQueueNow();
    },
    connectionStatus, lastServerSync, offlineSalesList, checkServerHealth,
    isTrainingMode, setTrainingMode: setTrainingModeActive, resetTrainingSandbox
  };
}
