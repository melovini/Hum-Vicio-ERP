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

// Filtra clientes pelo termo digitado (Unifica ERP com base importada do Cardápio Web com relevância e ranking)
export function searchRecurringCustomers(
  query: string,
  erpProfiles: CustomerProfile[],
  importedCustomers: ImportedCustomer[] = []
): CustomerSearchResult[] {
  const normQuery = normalizeSearchString(query);
  if (!normQuery || normQuery.length < 2) return [];

  const queryDigits = query.replace(/\D/g, '');
  // Busca por telefone só ativa se houver pelo menos 3 dígitos consecutivos ou consulta predominantemente numérica
  const isNumericQuery = /^\d+$/.test(normQuery);
  const hasValidPhoneQuery = isNumericQuery ? queryDigits.length >= 3 : queryDigits.length >= 4;

  interface ScoredResult {
    score: number;
    result: CustomerSearchResult;
  }

  const scoredResults: ScoredResult[] = [];
  const seenKeys = new Set<string>();

  const calculateScore = (
    name: string,
    phone?: string,
    address?: string
  ): number => {
    const normName = normalizeSearchString(name);
    let score = 0;

    // 1. Match exato de nome
    if (normName === normQuery) {
      score = Math.max(score, 1000);
    }
    // 2. Início do nome bate exatamente
    else if (normName.startsWith(normQuery)) {
      score = Math.max(score, 600);
    }
    // 3. Qualquer palavra do nome começa com o termo (ex: "fat" -> "vitor fatureto")
    else {
      const words = normName.split(/\s+/);
      if (words.some(w => w.startsWith(normQuery))) {
        score = Math.max(score, 500);
      } else if (normName.includes(normQuery)) {
        score = Math.max(score, 300);
      }
    }

    // 4. Busca por telefone (CRÍTICO: nunca comparar string vazia!)
    if (hasValidPhoneQuery && phone) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits && queryDigits) {
        if (phoneDigits.startsWith(queryDigits)) {
          score = Math.max(score, 450);
        } else if (phoneDigits.includes(queryDigits)) {
          score = Math.max(score, 350);
        }
      }
    }

    // 5. Busca por endereço
    if (address && !isNumericQuery) {
      const normAddr = normalizeSearchString(address);
      if (normAddr.startsWith(normQuery)) {
        score = Math.max(score, 250);
      } else if (normAddr.includes(normQuery)) {
        score = Math.max(score, 200);
      }
    }

    return score;
  };

  // 1. Clientes recorrentes do ERP (prioridade de catálogo e reordenação)
  erpProfiles.forEach(p => {
    const score = calculateScore(p.name, undefined, p.rawFullName);
    if (score > 0) {
      const key = normalizeSearchString(p.name);
      seenKeys.add(key);
      scoredResults.push({
        score: score + Math.min(p.totalOrders * 2, 20) + 15, // Bônus ERP
        result: {
          id: p.id,
          name: p.name,
          rawFullName: p.rawFullName,
          totalOrders: p.totalOrders,
          lastOrderSummary: p.lastOrderItemsSummary,
          frequentNotes: p.frequentNotes,
          source: 'erp',
          profile: p
        }
      });
    }
  });

  // 2. Clientes importados do Cardápio Web
  importedCustomers.forEach(imp => {
    const key = normalizeSearchString(imp.name);
    if (seenKeys.has(key)) return;

    const score = calculateScore(imp.name, imp.phone, imp.fullAddress);
    if (score > 0) {
      seenKeys.add(key);
      scoredResults.push({
        score: score + Math.min((imp.totalOrders || 1) * 2, 20),
        result: {
          id: imp.id,
          name: imp.name,
          rawFullName: imp.fullAddress ? `${imp.name} - ${imp.fullAddress}` : imp.name,
          totalOrders: imp.totalOrders || 1,
          lastOrderSummary: imp.fullAddress ? imp.fullAddress : undefined,
          phone: imp.phone,
          fullAddress: imp.fullAddress,
          source: 'cardapio_web',
          importedCustomer: imp
        }
      });
    }
  });

  // Ordena por maior pontuação de relevância
  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.slice(0, 6).map(s => s.result);
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

// === INTELIGÊNCIA EXECUTIVA DE CLIENTES (CRM GERENCIAL & LUCRATIVIDADE) ===

export interface CustomerTopProduct {
  name: string;
  count: number;
  totalSpent: number;
  totalProfit: number;
  marginPercent: number;
  isHighMargin: boolean;
}

export interface CustomerAnalyticsProfile {
  id: string;
  name: string;
  rawFullName: string;
  phone?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  totalCmv: number;
  totalGrossProfit: number;
  profitMargin: number; // Margem Real %
  averageTicket: number;
  firstOrderDate: string;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  churnRisk: 'ativo' | 'regular' | 'em_risco' | 'churn';
  preferredOrderType: 'mesa' | 'retirada' | 'delivery';
  preferredChannel: 'balcao' | 'ifood';
  // Horários e Hábitos de Consumo
  offPeakOrdersCount: number;
  peakOrdersCount: number;
  offPeakRatio: number; // 0..1
  isOffPeakHero: boolean; // Pede predominantemente em horário ocioso
  preferredHourStr: string; // Ex: "16h - 17h"
  preferredDayOfWeekStr: string; // Ex: "Quarta-feira"
  topProducts: CustomerTopProduct[];
  lastOrderSummary: string;
  frequentNotes: string[];
  badges: ('vip_lucro' | 'alta_margem' | 'horario_vazio' | 'fiel' | 'risco_churn')[];
  orders: CustomerPreviousOrder[];
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Determina se o pedido foi realizado em horário/dia de ociosidade operacional
export function isOrderInOffPeak(dateString: string): {
  isOffPeak: boolean;
  reason: 'tarde' | 'inicio_noite' | 'dia_lento' | 'pico_noturno';
  label: string;
} {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      return { isOffPeak: false, reason: 'pico_noturno', label: '⚡ Horário Regular' };
    }
    const hour = d.getHours();
    const day = d.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab

    // 1. Tarde (antes das 18h30) - chapa e equipe com capacidade ociosa
    if (hour < 18 || (hour === 18 && d.getMinutes() < 30)) {
      return { isOffPeak: true, reason: 'tarde', label: '☀️ Tarde Ociosa (12h-18h30)' };
    }

    // 2. Terça ou Quarta (dias tradicionalmente de baixo movimento na gastronomia)
    if (day === 2 || day === 3) {
      return { isOffPeak: true, reason: 'dia_lento', label: '📅 Dia Ocioso (Terça/Quarta)' };
    }

    // 3. Pré-Rush (18h30 às 19h15)
    if (hour === 18 || (hour === 19 && d.getMinutes() < 15)) {
      return { isOffPeak: true, reason: 'inicio_noite', label: '🕒 Pré-Rush (18h30-19h15)' };
    }

    return { isOffPeak: false, reason: 'pico_noturno', label: '⚡ Pico Noturno / Rush' };
  } catch {
    return { isOffPeak: false, reason: 'pico_noturno', label: '⚡ Horário Regular' };
  }
}

// Analisador gerencial completo de clientes, lucratividade e horários
export function extractCustomerAnalytics(
  sales: Sale[],
  products: Product[] = [],
  getProductCmv?: (recipe: any) => number,
  importedCustomers: ImportedCustomer[] = []
): CustomerAnalyticsProfile[] {
  // Mapa de clientes importados indexados pelo nome normalizado para enriquecer telefone e endereço
  const importedMap = new Map<string, ImportedCustomer>();
  importedCustomers.forEach(imp => {
    const norm = normalizeSearchString(imp.name);
    if (norm && !importedMap.has(norm)) {
      importedMap.set(norm, imp);
    }
  });

  const rawMap = new Map<string, {
    cleanName: string;
    rawFullName: string;
    orders: CustomerPreviousOrder[];
    notesList: string[];
    orderTypes: ('mesa' | 'retirada' | 'delivery')[];
    channels: ('balcao' | 'ifood')[];
  }>();

  sales.forEach(sale => {
    if (sale.status === 'cancelled') return;
    const candidate = sale.customerName || sale.creditCustomerName;
    if (!candidate) return;

    const { cleanName, addressPart } = cleanCustomerName(candidate);
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

    const notes = (sale.items || [])
      .map(i => i.notes?.trim())
      .filter((n): n is string => Boolean(n && n.length > 2));

    if (!rawMap.has(norm)) {
      rawMap.set(norm, {
        cleanName,
        rawFullName: candidate,
        orders: [orderData],
        notesList: notes,
        orderTypes: [orderData.orderType],
        channels: [orderData.channel]
      });
    } else {
      const existing = rawMap.get(norm)!;
      existing.orders.push(orderData);
      existing.notesList.push(...notes);
      existing.orderTypes.push(orderData.orderType);
      existing.channels.push(orderData.channel);
      if (cleanName.length > existing.cleanName.length) {
        existing.cleanName = cleanName;
      }
    }
  });

  const nowTime = Date.now();
  const profiles: CustomerAnalyticsProfile[] = [];

  rawMap.forEach((entry, normKey) => {
    const sortedOrders = [...entry.orders].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const totalOrders = sortedOrders.length;
    const totalSpent = sortedOrders.reduce((sum, o) => sum + o.total, 0);
    const averageTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const firstOrderDate = sortedOrders[sortedOrders.length - 1]?.date || new Date().toISOString();
    const lastOrderDate = sortedOrders[0]?.date || new Date().toISOString();

    const lastOrderTimestamp = new Date(lastOrderDate).getTime();
    const daysSinceLastOrder = Math.max(0, Math.floor((nowTime - (isNaN(lastOrderTimestamp) ? nowTime : lastOrderTimestamp)) / (1000 * 60 * 60 * 24)));

    // Determinar Risco de Churn
    let churnRisk: 'ativo' | 'regular' | 'em_risco' | 'churn' = 'ativo';
    if (daysSinceLastOrder > 45) {
      churnRisk = 'churn';
    } else if (daysSinceLastOrder > 20) {
      churnRisk = 'em_risco';
    } else if (daysSinceLastOrder > 7) {
      churnRisk = 'regular';
    }

    // Canais e tipos preferidos
    const typeCount: Record<string, number> = {};
    entry.orderTypes.forEach(t => { typeCount[t] = (typeCount[t] || 0) + 1; });
    const preferredOrderType = (Object.keys(typeCount).sort((a, b) => typeCount[b] - typeCount[a])[0] || 'mesa') as 'mesa' | 'retirada' | 'delivery';

    const channelCount: Record<string, number> = {};
    entry.channels.forEach(c => { channelCount[c] = (channelCount[c] || 0) + 1; });
    const preferredChannel = (Object.keys(channelCount).sort((a, b) => channelCount[b] - channelCount[a])[0] || 'balcao') as 'balcao' | 'ifood';

    // Cálculo Financeiro Real: CMV dos itens, Lucro Bruto e Margem
    let totalCmv = 0;
    const productStatsMap = new Map<string, {
      name: string;
      count: number;
      totalSpent: number;
      totalCost: number;
    }>();

    // Horários e Dias
    let offPeakCount = 0;
    let peakCount = 0;
    const hourHistogram: Record<number, number> = {};
    const dayHistogram: Record<number, number> = {};

    sortedOrders.forEach(order => {
      const offPeakCheck = isOrderInOffPeak(order.date);
      if (offPeakCheck.isOffPeak) {
        offPeakCount++;
      } else {
        peakCount++;
      }

      const od = new Date(order.date);
      if (!isNaN(od.getTime())) {
        const h = od.getHours();
        const d = od.getDay();
        hourHistogram[h] = (hourHistogram[h] || 0) + 1;
        dayHistogram[d] = (dayHistogram[d] || 0) + 1;
      }

      // CMV e Produtos
      (order.items || []).forEach(item => {
        const prod = products.find(
          p => p.id === item.productId || normalizeSearchString(p.name) === normalizeSearchString(item.productName)
        );

        let unitCost = 0;
        if (prod && prod.recipe && prod.recipe.length > 0 && getProductCmv) {
          unitCost = getProductCmv(prod.recipe);
        } else {
          unitCost = item.unitPrice * 0.32; // Média estimada caso sem ficha técnica
        }

        const itemTotalCost = unitCost * (item.quantity || 1);
        const itemTotalRevenue = (item.unitPrice * (item.quantity || 1)) + (item.comboPrice || 0);

        totalCmv += itemTotalCost;

        const prodKey = normalizeSearchString(item.productName);
        if (!productStatsMap.has(prodKey)) {
          productStatsMap.set(prodKey, {
            name: item.productName,
            count: item.quantity || 1,
            totalSpent: itemTotalRevenue,
            totalCost: itemTotalCost
          });
        } else {
          const st = productStatsMap.get(prodKey)!;
          st.count += (item.quantity || 1);
          st.totalSpent += itemTotalRevenue;
          st.totalCost += itemTotalCost;
        }
      });
    });

    const totalGrossProfit = totalSpent - totalCmv;
    const profitMargin = totalSpent > 0 ? (totalGrossProfit / totalSpent) * 100 : 0;
    const offPeakRatio = totalOrders > 0 ? offPeakCount / totalOrders : 0;
    const isOffPeakHero = offPeakRatio >= 0.4 || offPeakCount >= 2;

    // Determinar hora e dia preferidos
    const topHour = Object.keys(hourHistogram).sort((a, b) => hourHistogram[Number(b)] - hourHistogram[Number(a)])[0];
    const preferredHourStr = topHour ? `${topHour}h - ${Number(topHour) + 1}h` : 'Variado';

    const topDay = Object.keys(dayHistogram).sort((a, b) => dayHistogram[Number(b)] - dayHistogram[Number(a)])[0];
    const preferredDayOfWeekStr = topDay ? DAYS_OF_WEEK[Number(topDay)] || 'Variado' : 'Variado';

    // Produtos mais pedidos
    const topProducts: CustomerTopProduct[] = Array.from(productStatsMap.values())
      .map(p => {
        const profit = p.totalSpent - p.totalCost;
        const margin = p.totalSpent > 0 ? (profit / p.totalSpent) * 100 : 0;
        return {
          name: p.name,
          count: p.count,
          totalSpent: p.totalSpent,
          totalProfit: profit,
          marginPercent: margin,
          isHighMargin: margin >= 65
        };
      })
      .sort((a, b) => b.count - a.count || b.totalProfit - a.totalProfit)
      .slice(0, 4);

    // Badges estratégicas
    const badges: ('vip_lucro' | 'alta_margem' | 'horario_vazio' | 'fiel' | 'risco_churn')[] = [];
    if (totalGrossProfit >= 150 || totalSpent >= 300) badges.push('vip_lucro');
    if (profitMargin >= 65) badges.push('alta_margem');
    if (isOffPeakHero) badges.push('horario_vazio');
    if (totalOrders >= 3) badges.push('fiel');
    if (churnRisk === 'em_risco' || churnRisk === 'churn') badges.push('risco_churn');

    const importedMatch = importedMap.get(normKey);
    const phone = importedMatch?.phone;
    const address = importedMatch?.fullAddress || sortedOrders.find(o => o.addressOrComplement)?.addressOrComplement;

    const latestOrder = sortedOrders[0];
    const itemsSummary = latestOrder?.items && latestOrder.items.length > 0
      ? latestOrder.items.map(i => `${i.quantity}x ${i.productName}`).slice(0, 3).join(', ')
      : 'Itens diversos';

    const uniqueNotes = Array.from(new Set(entry.notesList.map(n => n.toUpperCase()))).slice(0, 3);

    profiles.push({
      id: normKey,
      name: entry.cleanName,
      rawFullName: entry.rawFullName,
      phone,
      address,
      totalOrders,
      totalSpent,
      totalCmv,
      totalGrossProfit,
      profitMargin,
      averageTicket,
      firstOrderDate,
      lastOrderDate,
      daysSinceLastOrder,
      churnRisk,
      preferredOrderType,
      preferredChannel,
      offPeakOrdersCount: offPeakCount,
      peakOrdersCount: peakCount,
      offPeakRatio,
      isOffPeakHero,
      preferredHourStr,
      preferredDayOfWeekStr,
      topProducts,
      lastOrderSummary: itemsSummary,
      frequentNotes: uniqueNotes,
      badges,
      orders: sortedOrders
    });
  });

  return profiles;
}

// Gerador de mensagem personalizada para WhatsApp do Cliente
export function generateCustomerWhatsAppMessage(
  customer: CustomerAnalyticsProfile,
  campaignType: 'horario_ocioso' | 'reativacao_churn' | 'vip_agradecimento' | 'livre'
): { message: string; url: string } {
  const firstName = customer.name.split(' ')[0] || customer.name;
  const favoriteProduct = customer.topProducts[0]?.name || 'seu hambúrguer preferido';

  let message = '';

  if (campaignType === 'horario_ocioso') {
    message = `Olá ${firstName}! Tudo bem? 😊\n\nPassando para avisar que a nossa chapa do Hum Vício já está aquecida a todo vapor hoje! 🔥\n\nComo sabemos que você gosta de pedir no meio da tarde, liberamos um cupom especial de *10% OFF* ou entrega grátis para você saborear aquele *${favoriteProduct}* sem esperar pela fila do rush da noite!\n\nPodemos preparar o seu agora? 🍔`;
  } else if (campaignType === 'reativacao_churn') {
    message = `Oi ${firstName}! Sentimos sua falta por aqui no Hum Vício! 🍔❤️\n\nJá faz um tempinho desde o seu último pedido com a gente. Preparamos uma cortesia exclusiva para matar a saudade do seu *${favoriteProduct}* hoje!\n\nQuer dar uma olhadinha no cardápio de hoje?`;
  } else if (campaignType === 'vip_agradecimento') {
    message = `Fala ${firstName}! Tudo bem? 🌟\n\nVocê é um dos nossos clientes mais especiais aqui no Hum Vício Burger! Muito obrigado pela confiança e fidelidade de sempre!\n\nEstamos lançando novidades no cardápio e queríamos te oferecer um mimo VIP no seu próximo pedido. É só nos dar um toque por aqui! 🙌`;
  } else {
    message = `Olá ${firstName}! Tudo bem? Aqui é do Hum Vício Burger! Como podemos te atender hoje? 🍔✨`;
  }

  const cleanPhone = customer.phone ? customer.phone.replace(/\D/g, '') : '';
  const fullPhone = cleanPhone.length === 10 || cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;
  const encoded = encodeURIComponent(message);
  const url = fullPhone ? `https://wa.me/${fullPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;

  return { message, url };
}

