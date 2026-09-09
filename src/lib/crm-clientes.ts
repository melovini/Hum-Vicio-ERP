'use client';
import { Sale, SaleItem, Product } from './store';

export interface CustomerPreviousOrder {
  saleId: string;
  date: string;
  orderType: 'mesa' | 'retirada' | 'delivery';
  channel: 'balcao' | 'ifood';
  total: number;
  items: SaleItem[];
  deliveryFee?: number;
  addressOrComplement?: string;
}

export interface CustomerProfile {
  id: string; // Chave normalizada para busca
  name: string; // Nome limpo de exibição (ex: "Carlos Silva")
  rawFullName: string; // Nome completo com endereço se houver (ex: "Carlos Silva - Rua das Flores, 123")
  totalOrders: number;
  totalSpent: number;
  averageTicket: number;
  firstOrderDate: string;
  lastOrderDate: string;
  preferredOrderType: 'mesa' | 'retirada' | 'delivery';
  orders: CustomerPreviousOrder[];
  lastOrderItemsSummary: string;
  frequentNotes: string[];
}

const STORAGE_CRM_KEY = 'hum_vicio_crm_cache';

// Normalizar texto para busca (sem acentos, minúsculo)
export function normalizeSearchString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Limpar e extrair nome real do cliente a partir de strings como "Mesa 01 - Carlos" ou "Carlos - Rua XV, 120"
export function cleanCustomerName(rawName: string): { cleanName: string; addressPart?: string } {
  let text = (rawName || '').trim();
  if (!text) return { cleanName: '' };

  // Remove prefixos de mesa como "Mesa 01 - " ou "Mesa 12 -"
  if (/^mesa\s+\d+\s*[-:]\s*/i.test(text)) {
    text = text.replace(/^mesa\s+\d+\s*[-:]\s*/i, '').trim();
  }

  // Se tiver separador de endereço com hífen (ex: "Carlos Silva - Rua XV, 120")
  if (text.includes(' - ')) {
    const parts = text.split(' - ');
    const nameCandidate = parts[0].trim();
    const addressCandidate = parts.slice(1).join(' - ').trim();
    return { cleanName: nameCandidate, addressPart: addressCandidate };
  }

  return { cleanName: text };
}

// Extrai perfis consolidados de clientes a partir do histórico de vendas
export function extractCustomerProfiles(sales: Sale[]): CustomerProfile[] {
  const profileMap = new Map<string, {
    cleanName: string;
    rawFullName: string;
    orders: CustomerPreviousOrder[];
    notesList: string[];
    orderTypes: ('mesa' | 'retirada' | 'delivery')[];
  }>();

  // Processa as vendas válidas
  sales.forEach(sale => {
    if (sale.status === 'cancelled') return;
    const candidateName = sale.customerName || sale.creditCustomerName;
    if (!candidateName) return;

    const { cleanName, addressPart } = cleanCustomerName(candidateName);
    if (!cleanName || cleanName.length < 2) return;

    // Ignora nomes genéricos de sistema
    const norm = normalizeSearchString(cleanName);
    if (norm === 'cliente' || norm === 'cliente balcao' || norm === 'balcao' || norm === 'consumidor' || norm.startsWith('mesa ')) {
      return;
    }

    const orderData: CustomerPreviousOrder = {
      saleId: sale.id,
      date: sale.date || sale.createdAt || new Date().toISOString(),
      orderType: sale.orderType || 'mesa',
      channel: sale.channel || 'balcao',
      total: sale.total || 0,
      items: (sale.items || []).map(i => ({ ...i })),
      deliveryFee: sale.deliveryFee,
      addressOrComplement: addressPart
    };

    const notesFromItems = (sale.items || [])
      .map(i => i.notes?.trim())
      .filter((n): n is string => Boolean(n && n.length > 2));

    if (!profileMap.has(norm)) {
      profileMap.set(norm, {
        cleanName,
        rawFullName: candidateName,
        orders: [orderData],
        notesList: notesFromItems,
        orderTypes: [orderData.orderType]
      });
    } else {
      const existing = profileMap.get(norm)!;
      existing.orders.push(orderData);
      existing.notesList.push(...notesFromItems);
      existing.orderTypes.push(orderData.orderType);
      // Mantém o nome com melhor capitalização
      if (cleanName.length > existing.cleanName.length) {
        existing.cleanName = cleanName;
      }
    }
  });

  const result: CustomerProfile[] = [];

  profileMap.forEach((val, normKey) => {
    // Ordena pedidos do mais recente para o mais antigo
    const sortedOrders = [...val.orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalOrders = sortedOrders.length;
    const totalSpent = sortedOrders.reduce((acc, o) => acc + o.total, 0);
    const averageTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;

    // Resumo dos itens do último pedido (ex: "1x Hum Bacon + 1x Batata + 1x Coca Zero")
    const latestOrder = sortedOrders[0];
    const itemsSummary = latestOrder?.items && latestOrder.items.length > 0
      ? latestOrder.items.map(i => `${i.quantity}x ${i.productName}`).slice(0, 3).join(', ') + (latestOrder.items.length > 3 ? '...' : '')
      : 'Itens diversos';

    // Determina modalidade mais frequente
    const typeCounts: Record<string, number> = {};
    val.orderTypes.forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
    const preferredOrderType = (Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0] || 'mesa') as 'mesa' | 'retirada' | 'delivery';

    // Observações frequentes únicas
    const uniqueNotes = Array.from(new Set(val.notesList.map(n => n.toUpperCase()))).slice(0, 3);

    result.push({
      id: normKey,
      name: val.cleanName,
      rawFullName: val.rawFullName,
      totalOrders,
      totalSpent,
      averageTicket,
      firstOrderDate: sortedOrders[sortedOrders.length - 1]?.date || new Date().toISOString(),
      lastOrderDate: latestOrder?.date || new Date().toISOString(),
      preferredOrderType,
      orders: sortedOrders,
      lastOrderItemsSummary: itemsSummary,
      frequentNotes: uniqueNotes
    });
  });

  // Ordena por clientes mais recorrentes e recentes
  result.sort((a, b) => b.totalOrders - a.totalOrders || new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());

  // Salva no cache local para resiliência offline
  if (typeof window !== 'undefined' && result.length > 0) {
    try {
      localStorage.setItem(STORAGE_CRM_KEY, JSON.stringify(result.slice(0, 100)));
    } catch {}
  }

  return result;
}

// Filtra clientes pelo termo digitado (a partir de 2 caracteres)
export function searchRecurringCustomers(query: string, customers: CustomerProfile[]): CustomerProfile[] {
  const normQuery = normalizeSearchString(query);
  if (!normQuery || normQuery.length < 2) return [];

  return customers.filter(c => {
    const matchName = normalizeSearchString(c.name).includes(normQuery);
    const matchRaw = normalizeSearchString(c.rawFullName).includes(normQuery);
    return matchName || matchRaw;
  }).slice(0, 5); // Limite de 5 sugestões para visual limpo
}

// Clona os itens de um pedido anterior e atualiza preços com o cardápio vigente (Antifraude & Integridade)
export function cloneOrderItemsToCart(
  previousItems: SaleItem[],
  activeProducts: Product[],
  channel: 'balcao' | 'ifood' = 'balcao'
): SaleItem[] {
  if (!Array.isArray(previousItems) || previousItems.length === 0) return [];

  return previousItems.map(item => {
    const currentProduct = activeProducts.find(
      p => p.id === item.productId || normalizeSearchString(p.name) === normalizeSearchString(item.productName)
    );

    let unitPrice = item.unitPrice;
    let comboPrice = item.comboPrice || 0;

    // Se o produto foi encontrado no cardápio ativo, recalcula com os preços de hoje
    if (currentProduct) {
      const basePrice = channel === 'ifood' ? currentProduct.priceIfood : currentProduct.priceBalcao;
      
      // Se continha combo, aplica valor padrão do combo
      if (item.combo?.toLowerCase().includes('anéis') || item.combo?.toLowerCase().includes('aneis')) {
        comboPrice = 16;
      } else if (item.combo?.toLowerCase().includes('batata')) {
        comboPrice = 14;
      }

      // Soma adicionais registrados no item
      const additionsTotal = (item.additionals || []).reduce((acc, a) => acc + (a.price || 0), 0);
      unitPrice = basePrice + comboPrice + additionsTotal;
    }

    return {
      id: Math.random().toString(36).substring(2, 9),
      productId: currentProduct?.id || item.productId,
      productName: currentProduct?.name || item.productName,
      quantity: item.quantity || 1,
      unitPrice,
      combo: item.combo,
      comboPrice,
      additionals: item.additionals ? item.additionals.map(a => ({ ...a })) : [],
      notes: item.notes ? item.notes.trim().toUpperCase() : undefined
    };
  });
}
