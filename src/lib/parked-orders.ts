import { SaleItem } from '@/lib/store';

export interface ParkedDraft {
  id: string;
  label: string;
  customerName: string;
  saleChannel: 'balcao' | 'ifood';
  orderType: 'mesa' | 'retirada' | 'delivery';
  pickupPaymentTiming: 'retirada' | 'imediato';
  cart: SaleItem[];
  deliveryFeeInput: string;
  discountInput: string;
  discountReason?: string;
  saleMethod: string;
  hasStoreCoupon?: boolean;
  storeCouponInput?: string;
  cartStep: 'produtos' | 'atendimento' | 'pagamento';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'hum_vicio_parked_drafts';
const ACTIVE_ID_KEY = 'hum_vicio_active_draft_id';
const LEGACY_DRAFT_KEY = 'hum_vicio_cart_draft';
const MAX_DRAFTS = 6;
const EXPIRATION_MS = 12 * 3600 * 1000; // 12 horas

function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function computeDraftLabel(draft: Partial<ParkedDraft>, index = 1): string {
  if (draft.customerName && draft.customerName.trim().length > 0) {
    const channelEmoji = draft.saleChannel === 'ifood' ? '🛵 ' : '';
    return `${channelEmoji}${draft.customerName.trim()}`;
  }
  const channelName = draft.saleChannel === 'ifood' ? 'iFood' : 'Balcão';
  return `Atendimento #${index} (${channelName})`;
}

export function createDefaultDraft(channel: 'balcao' | 'ifood' = 'balcao', index = 1): ParkedDraft {
  const now = Date.now();
  const id = generateDraftId();
  return {
    id,
    label: `Atendimento #${index} (${channel === 'ifood' ? 'iFood' : 'Balcão'})`,
    customerName: '',
    saleChannel: channel,
    orderType: channel === 'ifood' ? 'delivery' : 'retirada',
    pickupPaymentTiming: 'imediato',
    cart: [],
    deliveryFeeInput: '',
    discountInput: '',
    saleMethod: channel === 'ifood' ? 'ifood_online' : 'dinheiro',
    hasStoreCoupon: false,
    storeCouponInput: '10.00',
    cartStep: 'produtos',
    createdAt: now,
    updatedAt: now,
  };
}

function notifyDraftsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('hum_vicio_parked_drafts_changed'));
}

/**
 * Retorna todos os atendimentos/rascunhos válidos em aberto.
 * Realiza expiração automática de rascunhos com mais de 12 horas.
 */
export function getParkedDrafts(): ParkedDraft[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let drafts: ParkedDraft[] = [];

    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        drafts = parsed;
      }
    } else {
      // Migrar legado se existir
      const legacyRaw = localStorage.getItem(LEGACY_DRAFT_KEY);
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw);
          if (legacy && Array.isArray(legacy.cart) && legacy.cart.length > 0) {
            const migrated: ParkedDraft = {
              ...createDefaultDraft(legacy.saleChannel || 'balcao', 1),
              customerName: legacy.customerName || '',
              saleChannel: legacy.saleChannel || 'balcao',
              orderType: legacy.orderType || 'retirada',
              pickupPaymentTiming: legacy.pickupPaymentTiming || 'imediato',
              cart: legacy.cart || [],
              deliveryFeeInput: legacy.deliveryFeeInput || '',
              discountInput: legacy.discountInput || '',
              saleMethod: legacy.saleMethod || 'dinheiro',
              updatedAt: legacy.timestamp || Date.now(),
            };
            migrated.label = computeDraftLabel(migrated, 1);
            drafts = [migrated];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
            localStorage.setItem(ACTIVE_ID_KEY, migrated.id);
            localStorage.removeItem(LEGACY_DRAFT_KEY);
          }
        } catch {}
      }
    }

    const now = Date.now();
    const validDrafts = drafts.filter(d => (now - (d.updatedAt || d.createdAt || 0)) < EXPIRATION_MS);

    if (validDrafts.length !== drafts.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validDrafts));
    }

    return validDrafts.map(d => ({
      ...d,
      cart: (d.cart || []).map(item => ({
        ...item,
        id: item.id || ('item_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9)),
      })),
    }));
  } catch (err) {
    console.error('Erro ao ler rascunhos em espera:', err);
    return [];
  }
}

/**
 * Obtém o ID do rascunho atualmente ativo
 */
export function getActiveDraftId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_ID_KEY);
}

/**
 * Define o ID do rascunho ativo e notifica componentes
 */
export function setActiveDraftId(draftId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_ID_KEY, draftId);
  notifyDraftsChanged();
}

/**
 * Salva ou atualiza um rascunho de atendimento na lista
 */
export function saveParkedDraft(draft: ParkedDraft): void {
  if (typeof window === 'undefined') return;

  try {
    const drafts = getParkedDrafts();
    const existingIndex = drafts.findIndex(d => d.id === draft.id);
    const updatedDraft: ParkedDraft = {
      ...draft,
      label: computeDraftLabel(draft, existingIndex >= 0 ? existingIndex + 1 : drafts.length + 1),
      updatedAt: Date.now(),
    };

    let updatedList: ParkedDraft[];
    if (existingIndex >= 0) {
      updatedList = [...drafts];
      updatedList[existingIndex] = updatedDraft;
    } else {
      if (drafts.length >= MAX_DRAFTS) {
        // Limita ao número máximo mantendo os mais recentes
        updatedList = [...drafts.slice(1), updatedDraft];
      } else {
        updatedList = [...drafts, updatedDraft];
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    localStorage.setItem(ACTIVE_ID_KEY, updatedDraft.id);
    notifyDraftsChanged();
  } catch (err) {
    console.error('Erro ao salvar rascunho de atendimento:', err);
  }
}

/**
 * Cria um novo atendimento limpo, preservando os atendimentos anteriores
 */
export function createNewParkedDraft(channel: 'balcao' | 'ifood' = 'balcao', customerName = ''): ParkedDraft {
  const drafts = getParkedDrafts();

  // Se já existir apenas um rascunho e ele estiver totalmente vazio, reaproveita-o como Atendimento #1
  if (drafts.length === 1 && drafts[0].cart.length === 0 && (!drafts[0].customerName || !drafts[0].customerName.trim())) {
    const existing = drafts[0];
    const updated: ParkedDraft = {
      ...existing,
      saleChannel: channel,
      customerName: customerName.trim(),
      label: computeDraftLabel({ ...existing, customerName: customerName.trim(), saleChannel: channel }, 1),
      updatedAt: Date.now(),
    };
    saveParkedDraft(updated);
    setActiveDraftId(updated.id);
    return updated;
  }

  const nextIndex = drafts.length + 1;
  const newDraft = createDefaultDraft(channel, nextIndex);
  if (customerName) {
    newDraft.customerName = customerName;
    newDraft.label = computeDraftLabel(newDraft, nextIndex);
  }

  saveParkedDraft(newDraft);
  setActiveDraftId(newDraft.id);
  return newDraft;
}

/**
 * Remove um rascunho (após conclusão da venda ou descarte explícito).
 * Retorna o ID do próximo rascunho que deve ser ativado.
 */
export function deleteParkedDraft(draftId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const drafts = getParkedDrafts();
    const remaining = drafts.filter(d => d.id !== draftId);

    const currentActiveId = getActiveDraftId();
    let nextActiveId: string | null = null;

    if (remaining.length === 0) {
      // Quando o último atendimento for concluído ou removido, inicializa imediatamente
      // um atendimento limpo #1 para o operador não começar no #2
      const freshDraft = createDefaultDraft('balcao', 1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([freshDraft]));
      localStorage.setItem(ACTIVE_ID_KEY, freshDraft.id);
      notifyDraftsChanged();
      return freshDraft.id;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));

    if (currentActiveId === draftId) {
      nextActiveId = remaining[remaining.length - 1].id;
      localStorage.setItem(ACTIVE_ID_KEY, nextActiveId);
    } else {
      nextActiveId = currentActiveId;
    }

    notifyDraftsChanged();
    return nextActiveId;
  } catch (err) {
    console.error('Erro ao remover rascunho em espera:', err);
    return null;
  }
}

/**
 * Limpa todos os rascunhos de atendimento em espera
 */
export function clearAllParkedDrafts(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_ID_KEY);
  localStorage.removeItem(LEGACY_DRAFT_KEY);
  notifyDraftsChanged();
}
