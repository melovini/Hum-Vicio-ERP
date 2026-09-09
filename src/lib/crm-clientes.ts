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

export interface ImportedCustomer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  complement?: string;
  fullAddress?: string;
  totalOrders: number;
  lastOrderDate?: string;
  source: 'cardapio_web' | 'planilha' | 'manual';
  importedAt: string;
}

export interface CustomerSearchResult {
  id: string;
  name: string;
  rawFullName: string;
  totalOrders: number;
  lastOrderSummary?: string;
  frequentNotes?: string[];
  phone?: string;
  fullAddress?: string;
  source: 'erp' | 'cardapio_web';
  profile?: CustomerProfile;
  importedCustomer?: ImportedCustomer;
}

const STORAGE_CRM_KEY = 'hum_vicio_crm_cache';
const STORAGE_IMPORTED_KEY = 'hum_vicio_imported_customers';

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

// Obter clientes importados salvos localmente
export function getStoredImportedCustomers(): ImportedCustomer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_IMPORTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Salvar clientes importados
export function saveImportedCustomers(customers: ImportedCustomer[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_IMPORTED_KEY, JSON.stringify(customers));
  } catch (err) {
    console.error('Erro ao salvar clientes importados:', err);
  }
}

// Limpar clientes importados
export function clearImportedCustomers(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_IMPORTED_KEY);
  } catch {}
}

// Extrai perfis consolidados de clientes a partir do histórico de vendas do ERP
export function extractCustomerProfiles(sales: Sale[]): CustomerProfile[] {
  const profileMap = new Map<string, {
    cleanName: string;
    rawFullName: string;
    orders: CustomerPreviousOrder[];
    notesList: string[];
    orderTypes: ('mesa' | 'retirada' | 'delivery')[];
  }>();

  sales.forEach(sale => {
    if (sale.status === 'cancelled') return;
    const candidateName = sale.customerName || sale.creditCustomerName;
    if (!candidateName) return;

    const { cleanName, addressPart } = cleanCustomerName(candidateName);
    if (!cleanName || cleanName.length < 2) return;

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
      if (cleanName.length > existing.cleanName.length) {
        existing.cleanName = cleanName;
      }
    }
  });

  const result: CustomerProfile[] = [];

  profileMap.forEach((val, normKey) => {
    const sortedOrders = [...val.orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalOrders = sortedOrders.length;
    const totalSpent = sortedOrders.reduce((acc, o) => acc + o.total, 0);
    const averageTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;

    const latestOrder = sortedOrders[0];
    const itemsSummary = latestOrder?.items && latestOrder.items.length > 0
      ? latestOrder.items.map(i => `${i.quantity}x ${i.productName}`).slice(0, 3).join(', ') + (latestOrder.items.length > 3 ? '...' : '')
      : 'Itens diversos';

    const typeCounts: Record<string, number> = {};
    val.orderTypes.forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
    const preferredOrderType = (Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0] || 'mesa') as 'mesa' | 'retirada' | 'delivery';

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

  result.sort((a, b) => b.totalOrders - a.totalOrders || new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());

  if (typeof window !== 'undefined' && result.length > 0) {
    try {
      localStorage.setItem(STORAGE_CRM_KEY, JSON.stringify(result.slice(0, 100)));
    } catch {}
  }

  return result;
}

// Filtra clientes pelo termo digitado (Unifica ERP com base importada do Cardápio Web)
export function searchRecurringCustomers(
  query: string,
  erpProfiles: CustomerProfile[],
  importedCustomers: ImportedCustomer[] = []
): CustomerSearchResult[] {
  const normQuery = normalizeSearchString(query);
  if (!normQuery || normQuery.length < 2) return [];

  const results: CustomerSearchResult[] = [];
  const seenNames = new Set<string>();

  // 1. Prioridade para clientes do histórico do ERP (possuem itens e observações detalhadas)
  erpProfiles.forEach(p => {
    const matchName = normalizeSearchString(p.name).includes(normQuery);
    const matchRaw = normalizeSearchString(p.rawFullName).includes(normQuery);
    if (matchName || matchRaw) {
      seenNames.add(normalizeSearchString(p.name));
      results.push({
        id: p.id,
        name: p.name,
        rawFullName: p.rawFullName,
        totalOrders: p.totalOrders,
        lastOrderSummary: p.lastOrderItemsSummary,
        frequentNotes: p.frequentNotes,
        source: 'erp',
        profile: p
      });
    }
  });

  // 2. Busca na base importada do Cardápio Web
  importedCustomers.forEach(imp => {
    const normImpName = normalizeSearchString(imp.name);
    if (seenNames.has(normImpName)) return;

    const matchName = normImpName.includes(normQuery);
    const matchPhone = imp.phone ? imp.phone.replace(/\D/g, '').includes(normQuery.replace(/\D/g, '')) : false;
    const matchAddress = imp.fullAddress ? normalizeSearchString(imp.fullAddress).includes(normQuery) : false;

    if (matchName || matchPhone || matchAddress) {
      seenNames.add(normImpName);
      results.push({
        id: imp.id,
        name: imp.name,
        rawFullName: imp.fullAddress 
          ? `${imp.name} - ${imp.fullAddress}${imp.phone ? ` (${imp.phone})` : ''}` 
          : imp.phone ? `${imp.name} - Tel: ${imp.phone}` : imp.name,
        totalOrders: imp.totalOrders || 1,
        lastOrderSummary: imp.fullAddress ? `Endereço: ${imp.fullAddress}` : imp.phone ? `Telefone: ${imp.phone}` : undefined,
        phone: imp.phone,
        fullAddress: imp.fullAddress,
        source: 'cardapio_web',
        importedCustomer: imp
      });
    }
  });

  return results.slice(0, 6);
}

// Parser Inteligente para Planilhas XLSX / XLS / CSV do Cardápio Web
export async function parseCardapioWebXlsx(file: File): Promise<{
  customers: ImportedCustomer[];
  totalRows: number;
  detectedColumns: {
    nameCol?: string;
    phoneCol?: string;
    addressCol?: string;
    numberCol?: string;
    neighborhoodCol?: string;
    cityCol?: string;
    complementCol?: string;
    ordersCol?: string;
    dateCol?: string;
  };
}> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return { customers: [], totalRows: 0, detectedColumns: {} };
  }

  const sampleRow = rawRows[0];
  const colKeys = Object.keys(sampleRow);

  const findCol = (regexes: RegExp[]) => {
    for (const regex of regexes) {
      const match = colKeys.find(k => regex.test(k.trim()));
      if (match) return match;
    }
    return undefined;
  };

  const nameCol = findCol([/^nome/i, /^cliente/i, /nome.*cliente/i, /destinatario/i, /^name/i]);
  const phoneCol = findCol([/telefone/i, /celular/i, /whatsapp/i, /fone/i, /contato/i, /^phone/i, /^tel/i]);
  const addressCol = findCol([/^endere[cç]o/i, /^rua/i, /^logradouro/i, /^address/i]);
  const numberCol = findCol([/^n[uú]mero/i, /^n[ºo]/i, /^num/i, /^number/i]);
  const neighborhoodCol = findCol([/^bairro/i, /^distrito/i, /bairro/i]);
  const cityCol = findCol([/^cidade/i, /^munic[ií]pio/i, /cidade/i]);
  const complementCol = findCol([/^complemento/i, /^refer[eê]ncia/i, /ponto.*refer/i]);
  const ordersCol = findCol([/qtd.*pedido/i, /total.*pedido/i, /^pedidos/i, /quantidade.*pedido/i, /compras/i]);
  const dateCol = findCol([/[uú]ltimo.*pedido/i, /data.*pedido/i, /^data/i, /cadastro/i]);

  const detectedColumns = {
    nameCol, phoneCol, addressCol, numberCol, neighborhoodCol, cityCol, complementCol, ordersCol, dateCol
  };

  const now = new Date().toISOString();
  const customers: ImportedCustomer[] = [];

  rawRows.forEach((row, idx) => {
    const rawName = nameCol ? String(row[nameCol] || '').trim() : '';
    if (!rawName || rawName.length < 2) return;

    const phone = phoneCol ? String(row[phoneCol] || '').trim() : undefined;
    const street = addressCol ? String(row[addressCol] || '').trim() : '';
    const num = numberCol ? String(row[numberCol] || '').trim() : '';
    const neighborhood = neighborhoodCol ? String(row[neighborhoodCol] || '').trim() : '';
    const city = cityCol ? String(row[cityCol] || '').trim() : '';
    const complement = complementCol ? String(row[complementCol] || '').trim() : '';
    const totalOrdersRaw = ordersCol ? Number(row[ordersCol]) : 1;
    const totalOrders = isNaN(totalOrdersRaw) || totalOrdersRaw < 1 ? 1 : totalOrdersRaw;
    const lastOrderDate = dateCol ? String(row[dateCol] || '').trim() : undefined;

    const addressParts: string[] = [];
    if (street) {
      addressParts.push(num ? `${street}, ${num}` : street);
    }
    if (neighborhood) addressParts.push(neighborhood);
    if (complement) addressParts.push(`(${complement})`);
    if (city) addressParts.push(city);
    const fullAddress = addressParts.join(' - ');

    const id = 'cw_' + normalizeSearchString(rawName) + '_' + (phone ? phone.replace(/\D/g, '') : idx);

    customers.push({
      id,
      name: rawName,
      phone,
      address: street,
      number: num,
      neighborhood,
      city,
      complement,
      fullAddress: fullAddress || undefined,
      totalOrders,
      lastOrderDate,
      source: 'cardapio_web',
      importedAt: now
    });
  });

  return { customers, totalRows: rawRows.length, detectedColumns };
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

    if (currentProduct) {
      const basePrice = channel === 'ifood' ? currentProduct.priceIfood : currentProduct.priceBalcao;
      
      if (item.combo?.toLowerCase().includes('anéis') || item.combo?.toLowerCase().includes('aneis')) {
        comboPrice = 16;
      } else if (item.combo?.toLowerCase().includes('batata')) {
        comboPrice = 14;
      }

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
