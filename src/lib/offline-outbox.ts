import { Sale } from './store/types';

const DB_NAME = 'hum_vicio_db';
const DB_VERSION = 1;
const STORE_NAME = 'sales_outbox';
const LEGACY_STORAGE_KEY = 'hum_vicio_offline_sales_outbox';

// Cache síncrono em memória para leituras instantâneas sem bloquear a renderização
let memoryCache: Sale[] = [];
let isInitialized = false;
let initPromise: Promise<void> | null = null;
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('hum-vicio-outbox');
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'OUTBOX_UPDATED' && Array.isArray(event.data.queue)) {
        memoryCache = event.data.queue;
      }
    };
  } catch {}
}

function notifyTabs(): void {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'OUTBOX_UPDATED', queue: memoryCache });
    } catch {}
  }
}

export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB indisponível'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Erro ao abrir IndexedDB'));
  });
}

/**
 * Migra dados remanescentes do localStorage legado para o IndexedDB
 */
async function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;

    const legacyItems: Sale[] = JSON.parse(raw);
    if (Array.isArray(legacyItems) && legacyItems.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        for (const item of legacyItems) {
          if (item && item.id) {
            store.put({
              ...item,
              syncStatus: item.syncStatus || 'pending',
              isOfflineSynced: false,
            });
          }
        }

        tx.oncomplete = () => {
          try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          } catch {}
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    } else {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[Outbox Migration] Falha na migração do localStorage:', err);
  }
}

/**
 * Inicialização e carregamento da fila na memória
 */
export async function initOfflineOutbox(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!isIndexedDBAvailable()) {
      // Fallback em memória / localStorage para ambientes sem IndexedDB
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (raw) memoryCache = JSON.parse(raw);
        } catch {}
      }
      isInitialized = true;
      return;
    }

    try {
      const db = await openDb();
      await migrateFromLocalStorage(db);

      const items = await new Promise<Sale[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      memoryCache = items;
      isInitialized = true;
    } catch (err) {
      console.warn('[Outbox] Erro na inicialização do IndexedDB:', err);
      // Fallback gracioso
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (raw) memoryCache = JSON.parse(raw);
        } catch {}
      }
      isInitialized = true;
    }
  })();

  return initPromise;
}

/**
 * Retorna a fila em memória (leitura síncrona segura e rápida)
 */
export function getOfflineSalesQueueSync(): Sale[] {
  if (memoryCache.length === 0 && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) memoryCache = JSON.parse(raw);
    } catch {}
  }
  return [...memoryCache];
}

/**
 * Retorna a fila completa com garantia assíncrona do IndexedDB
 */
export async function getOfflineSalesQueue(): Promise<Sale[]> {
  await initOfflineOutbox();
  return getOfflineSalesQueueSync();
}

/**
 * Salva a lista completa (substituição total)
 */
export function saveOfflineSalesQueue(queue: Sale[]): void {
  memoryCache = [...queue];
  notifyTabs();

  // Em ambientes sem IndexedDB (ou com falha simulada), valida e grava no localStorage
  if (!isIndexedDBAvailable() && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('Erro ao salvar fila offline no localStorage:', err);
      throw new Error('Não foi possível salvar o pedido neste aparelho. Libere espaço ou use outro terminal; o pedido não foi confirmado.');
    }
    return;
  }

  if (isIndexedDBAvailable()) {
    openDb().then(db => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      for (const item of queue) {
        store.put(item);
      }
    }).catch(err => {
      console.error('[Outbox] Erro ao salvar lista no IndexedDB:', err);
    });
  }
}

/**
 * Enfileira uma venda na outbox offline
 */
export function enqueueOfflineSale(sale: Sale): void {
  const prepared: Sale = {
    ...sale,
    syncStatus: sale.syncStatus || 'pending',
    isOfflineSynced: false,
  };

  const existingIdx = memoryCache.findIndex(s => s.id === sale.id);
  if (existingIdx >= 0) {
    memoryCache[existingIdx] = prepared;
  } else {
    memoryCache.push(prepared);
  }

  notifyTabs();

  if (!isIndexedDBAvailable() && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(memoryCache));
    } catch (err) {
      console.error('Erro ao enfileirar venda no localStorage:', err);
      throw new Error('Não foi possível salvar o pedido neste aparelho. Libere espaço ou use outro terminal; o pedido não foi confirmado.');
    }
    return;
  }

  if (isIndexedDBAvailable()) {
    openDb().then(db => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(prepared);
    }).catch(err => {
      console.error('[Outbox] Erro ao gravar venda no IndexedDB:', err);
    });
  }
}

/**
 * Atualiza propriedades de uma venda na fila
 */
export function updateOfflineSaleInQueue(saleId: string, updates: Partial<Sale>): void {
  const existing = memoryCache.find(s => s.id === saleId);
  if (!existing) return;

  const updated: Sale = { ...existing, ...updates };
  memoryCache = memoryCache.map(s => s.id === saleId ? updated : s);
  notifyTabs();

  if (!isIndexedDBAvailable() && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(memoryCache));
    } catch {}
    return;
  }

  if (isIndexedDBAvailable()) {
    openDb().then(db => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(updated);
    }).catch(err => {
      console.error('[Outbox] Erro ao atualizar venda no IndexedDB:', err);
    });
  }
}

/**
 * Remove uma venda da fila (após sincronização bem-sucedida)
 */
export function removeOfflineSaleFromQueue(saleId: string): void {
  memoryCache = memoryCache.filter(s => s.id !== saleId);
  notifyTabs();

  if (!isIndexedDBAvailable() && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(memoryCache));
    } catch {}
    return;
  }

  if (isIndexedDBAvailable()) {
    openDb().then(db => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(saleId);
    }).catch(err => {
      console.error('[Outbox] Erro ao remover venda do IndexedDB:', err);
    });
  }
}
