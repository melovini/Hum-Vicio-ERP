import { Sale, SaleItem, Product, InventoryItem, KitchenStation, RecipeIngredient, KitchenComponent } from './store/types';
import {
  calculateItemProduction,
  inferComponentType,
  inferPortionWeightFromInventory,
  resolveRecipeComponentType,
  normalizeProductionString,
  getBurgerPrintDetails,
  BurgerPrintDetails
} from './production-calculator';
import { calculateOrderProductionRequirements, DEFAULT_KITCHEN_COMPONENTS } from './kitchen-calculator';

export interface OrderDiff {
  added: SaleItem[];
  removed: SaleItem[];
  modified: { item: SaleItem; oldNotes?: string; newNotes?: string }[];
}

export interface KitchenTicketHeader {
  customerName: string;
  orderIdShort: string;
  time: string;
  date: string;
  channel: string;
  orderType?: 'retirada' | 'delivery' | 'mesa';
  tableNumber?: string;
  isReprint?: boolean;
  isDifferential?: boolean;
}

export interface KitchenTicketItem {
  id?: string;
  quantity: number;
  productName: string;
  pattiesComposition?: string;
  meatPoint?: string;
  comboInfo?: {
    label: string;
    fryerItem: string;
    drinkItem?: string;
    chapaItem?: string;
  };
  additionals: { name: string; quantity: number; label: string }[];
  removals: string[];
  notes?: string;
  recipeIngredients?: string[];
  rawItem: SaleItem;
}

export interface KitchenProductionSummary {
  chapa: {
    totalPatties: number;
    pattiesLabel: string;
    pattiesBreakdown: { label: string; count: number }[];
    otherItems: { label: string; count: number }[];
    status: 'ok' | 'sem_carnes' | 'a_conferir';
  };
  fritadeira: {
    totalPreparos: number;
    preparosLabel: string;
    items: { label: string; count: number }[];
    status: 'ok' | 'sem_itens' | 'a_conferir';
  };
  isComplete: boolean;
  differentialSummary?: {
    addChapa?: string[];
    removeChapa?: string[];
    addFryer?: string[];
    removeFryer?: string[];
  };
}

export interface KitchenTicketData {
  header: KitchenTicketHeader;
  items: KitchenTicketItem[];
  productionSummary: KitchenProductionSummary;
  diff?: {
    added: KitchenTicketItem[];
    removed: { quantity: number; productName: string }[];
    modified: { quantity: number; productName: string; oldNotes?: string; newNotes?: string }[];
  };
}

export interface BuildKitchenTicketOptions {
  sale: Sale;
  products?: Product[];
  inventoryItems?: InventoryItem[];
  kitchenComponents?: KitchenComponent[];
  showMontagem?: boolean;
  isReprint?: boolean;
  diff?: OrderDiff;
}

/**
 * Constrói a linha limpa de combo sem duplicações
 */
function resolveCleanComboLine(details: BurgerPrintDetails): {
  label: string;
  fryerItem: string;
  drinkItem?: string;
  chapaItem?: string;
} | undefined {
  const combo = details.comboDetails;
  if (!combo) return undefined;

  let fryerItem = '1 batata pequena';
  if (combo.comboType === 'onion') {
    fryerItem = '1 anéis de cebola';
  } else if (combo.comboType === 'batata_cheddar_bacon') {
    fryerItem = '1 batata cheddar e bacon';
  } else if (combo.comboType === 'batata') {
    fryerItem = '1 batata pequena';
  } else if (combo.fryerItem) {
    const clean = combo.fryerItem
      .replace(/^\d+x\s*/i, '')
      .replace(/\(combo.*?\)/gi, '')
      .replace(/\/\s*frita/gi, '')
      .trim();
    fryerItem = clean ? `1 ${clean.toLowerCase()}` : '1 batata pequena';
  }

  let drinkItem = combo.drinkItem
    ? combo.drinkItem.replace(/^\d+x\s*/i, '').trim()
    : 'bebida';

  if (drinkItem.toLowerCase().includes('conferir e enviar') || drinkItem.toLowerCase().includes('refrigerante / bebida')) {
    drinkItem = 'bebida';
  }

  const label = `Combo: ${fryerItem} + ${drinkItem}`;

  return {
    label,
    fryerItem,
    drinkItem,
    chapaItem: combo.chapaItem,
  };
}

/**
 * Processa um SaleItem individual para a estrutura de comanda da cozinha
 */
function processKitchenItem(
  item: SaleItem,
  products: Product[],
  inventoryItems: InventoryItem[],
  showMontagem: boolean,
  kitchenComponents: KitchenComponent[] = DEFAULT_KITCHEN_COMPONENTS
): { ticketItem: KitchenTicketItem; details: BurgerPrintDetails; hasUnconfirmed: boolean } {
  const details = getBurgerPrintDetails(item, products, inventoryItems);
  const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;

  const lineSummary = calculateOrderProductionRequirements([{ ...item, quantity: 1 }], products, inventoryItems, kitchenComponents);
  const compositionText = lineSummary.chapa.burgersBreakdown.map(row => row.label).join(' + ') || undefined;
  const pattiesUnconfirmed = !lineSummary.isComplete;
  const comboInfo = resolveCleanComboLine(details);

  // Adicionais com quantidade numérica e indicação clara se é por lanche
  const additionals: { name: string; quantity: number; label: string }[] = [];
  if (Array.isArray(item.additionals) && item.additionals.length > 0) {
    for (const add of item.additionals) {
      const addQty = add.quantity && add.quantity > 0 ? add.quantity : 1;
      const totalAddQty = addQty * (qty > 1 ? qty : 1);
      const suffix = qty > 1 ? ' (por lanche)' : '';
      additionals.push({
        name: add.name,
        quantity: totalAddQty,
        label: `ADICIONAR: ${addQty} ${add.name}${suffix}`,
      });
    }
  }

  // Retiradas com destaque legível
  const removals = Array.isArray(item.removals) ? item.removals.map(r => r.trim()) : [];

  // Ponto da carne (somente se aplicável)
  let meatPoint: string | undefined = undefined;
  if (item.meatPoint) {
    meatPoint = item.meatPoint.trim().toLowerCase();
  } else if (details.production.chapaPatties > 0 && details.effectiveMeatPoint) {
    meatPoint = details.effectiveMeatPoint.trim().toLowerCase();
  }

  // Ficha de montagem (opcional)
  const recipeIngredients = showMontagem && details.recipeIngredients.length > 0
    ? details.recipeIngredients
    : undefined;

  const matchedProduct = details.matchedProduct;
  const normName = normalizeProductionString(item.productName);
  const isLanche = matchedProduct?.category === 'lanche' || (!matchedProduct && (normName.includes('burger') || normName.includes('lanche')));
  const isPorcao = matchedProduct?.category === 'porcao' || (!matchedProduct && (normName.includes('batata') || normName.includes('fritas') || normName.includes('onion') || normName.includes('porcao')));

  // Se o item não tem snapshot e não foi encontrado produto com receita confirmada
  const hasNoRecipe = !item.productionSnapshot && (!matchedProduct || !Array.isArray(matchedProduct.recipe) || matchedProduct.recipe.length === 0);
  const hasUnconfirmed = pattiesUnconfirmed || ((isLanche || (!isPorcao && !matchedProduct)) && hasNoRecipe);

  const ticketItem: KitchenTicketItem = {
    id: item.id,
    quantity: qty,
    productName: item.productName,
    pattiesComposition: compositionText,
    meatPoint,
    comboInfo,
    additionals,
    removals,
    notes: item.notes ? item.notes.trim() : undefined,
    recipeIngredients,
    rawItem: item,
  };

  return { ticketItem, details, hasUnconfirmed };
}

/**
 * Função Pura Principal: Constrói os dados da comanda da cozinha
 * Testável de forma determinística e independente de ambiente/DOM/banco de dados.
 */
export function buildKitchenTicket({
  sale,
  products = [],
  inventoryItems = [],
  kitchenComponents = DEFAULT_KITCHEN_COMPONENTS,
  showMontagem = false,
  isReprint = false,
  diff,
}: BuildKitchenTicketOptions): KitchenTicketData {
  const activeDiff = diff || sale.orderDiff;
  const isDifferential = Boolean(activeDiff);

  // 1. Cabeçalho Compacto
  const customerName = sale.customerName && sale.customerName.trim()
    ? sale.customerName.trim().toUpperCase()
    : 'CLIENTE NÃO INFORMADO';

  const orderIdShort = `#${sale.id.slice(0, 6).toUpperCase()}`;
  const saleDate = new Date(sale.date);
  const time = !isNaN(saleDate.getTime())
    ? saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const date = !isNaN(saleDate.getTime())
    ? saleDate.toLocaleDateString('pt-BR')
    : '';

  // Identificação de mesa se real e disponível
  let tableNumber: string | undefined = undefined;
  if (sale.orderType === 'mesa') {
    const match = customerName.match(/MESA\s*(\d+|[A-Z0-9]+)/i);
    if (match) tableNumber = match[1];
  }

  const header: KitchenTicketHeader = {
    customerName,
    orderIdShort,
    time,
    date,
    channel: (sale.channel || 'balcao').toUpperCase(),
    orderType: sale.orderType,
    tableNumber,
    isReprint,
    isDifferential,
  };

  // 2. Processar Itens
  const itemsToProcess = sale.items || [];
  let hasAnyUnconfirmed = false;

  const processedItems: KitchenTicketItem[] = [];
  const processedDetails: BurgerPrintDetails[] = [];

  for (const item of itemsToProcess) {
    const { ticketItem, details, hasUnconfirmed } = processKitchenItem(item, products, inventoryItems, showMontagem, kitchenComponents);
    processedItems.push(ticketItem);
    processedDetails.push(details);
    if (hasUnconfirmed) hasAnyUnconfirmed = true;
  }

  // 3. Resumo de Produção (Chapa e Fritadeira com Componentes Estruturados)
  const structuredReqs = calculateOrderProductionRequirements(
    itemsToProcess,
    products,
    inventoryItems,
    kitchenComponents || DEFAULT_KITCHEN_COMPONENTS
  );

  let totalChapaPatties = structuredReqs.chapa.totalBurgers;
  let pattiesLabel = structuredReqs.chapa.burgersLabel;
  let pattiesBreakdown = structuredReqs.chapa.burgersBreakdown.map(b => ({ label: b.label, count: b.count }));
  let otherChapaItems = structuredReqs.chapa.otherItems.map(o => ({ label: o.label, count: o.count }));

  let totalFryerPreparos = structuredReqs.fritadeira.totalPreparos;
  let preparosLabel = structuredReqs.fritadeira.preparosLabel;
  let fryerItems = structuredReqs.fritadeira.items.map(f => ({ label: f.label, count: f.count }));

  let chapaStatus: 'ok' | 'sem_carnes' | 'a_conferir' = structuredReqs.chapa.status;
  if (hasAnyUnconfirmed || structuredReqs.pendingReview.length > 0) {
    chapaStatus = 'a_conferir';
  } else if (totalChapaPatties === 0) {
    chapaStatus = 'sem_carnes';
  }

  let fryerStatus: 'ok' | 'sem_itens' | 'a_conferir' = structuredReqs.fritadeira.status;
  if ((hasAnyUnconfirmed || structuredReqs.pendingReview.length > 0) && totalFryerPreparos === 0) {
    fryerStatus = 'a_conferir';
  } else if (totalFryerPreparos === 0) {
    fryerStatus = 'sem_itens';
  }

  const productionSummary: KitchenProductionSummary = {
    chapa: {
      totalPatties: totalChapaPatties,
      pattiesLabel,
      pattiesBreakdown,
      otherItems: otherChapaItems,
      status: chapaStatus,
    },
    fritadeira: {
      totalPreparos: totalFryerPreparos,
      preparosLabel,
      items: fryerItems,
      status: fryerStatus,
    },
    isComplete: !hasAnyUnconfirmed && structuredReqs.isComplete,
  };

  // 4. Tratamento da Via Diferencial (se aplicável)
  let diffData: KitchenTicketData['diff'] = undefined;
  if (activeDiff) {
    const diffAdded = (activeDiff.added || []).map(item => {
      const { ticketItem } = processKitchenItem(item, products, inventoryItems, showMontagem, kitchenComponents);
      return ticketItem;
    });

    const diffRemoved = (activeDiff.removed || []).map(item => ({
      quantity: item.quantity || 1,
      productName: item.productName,
    }));

    const diffModified = (activeDiff.modified || []).map(m => ({
      quantity: m.item.quantity || 1,
      productName: m.item.productName,
      oldNotes: m.oldNotes,
      newNotes: m.newNotes,
    }));

    diffData = {
      added: diffAdded,
      removed: diffRemoved,
      modified: diffModified,
    };
  }

  return {
    header,
    items: processedItems,
    productionSummary,
    diff: diffData,
  };
}

/**
 * Formatador ESC/POS (40 colunas contínuas para impressoras térmicas e cópia de texto)
 * Respeita estritamente o layout e diretrizes de AJUSTE-COMANDA-IMPRESSAO-COZINHA.md
 */
export function formatKitchenTicketEscPos(ticket: KitchenTicketData): string {
  const divider = '----------------------------------------\n';
  let out = '';

  const { header, items, productionSummary, diff } = ticket;

  // Se for via diferencial
  if (header.isDifferential && diff) {
    out += '*** ALTERAÇÃO DO PEDIDO ***\n';
    out += `CLIENTE: ${header.customerName}\n`;
    out += `Pedido ${header.orderIdShort} | ${header.time}`;
    if (header.orderType) out += ` | ${header.orderType.toUpperCase()}`;
    out += '\n';
    out += divider;

    if (diff.added.length > 0) {
      out += 'ITENS ADICIONADOS (+):\n';
      for (const item of diff.added) {
        out += `[+] ${item.quantity}x ${item.productName.toUpperCase()}\n`;
        if (item.pattiesComposition) out += `   ${item.pattiesComposition}\n`;
        if (item.comboInfo) out += `   ${item.comboInfo.label}\n`;
        if (item.meatPoint) out += `   Ponto: ${item.meatPoint}\n`;
        for (const add of item.additionals) out += `   ${add.label}\n`;
        for (const rem of item.removals) out += `   RETIRAR: ${rem}\n`;
        if (item.notes) out += `   OBS: ${item.notes}\n`;
      }
      out += '\n';
    }

    if (diff.removed.length > 0) {
      out += 'ITENS CANCELADOS (-):\n';
      for (const item of diff.removed) {
        out += `[-] ${item.quantity}x ${item.productName.toUpperCase()} (CANCELADO)\n`;
      }
      out += '\n';
    }

    if (diff.modified.length > 0) {
      out += 'OBSERVAÇÕES MODIFICADAS (*):\n';
      for (const m of diff.modified) {
        out += `[*] ${m.quantity}x ${m.productName.toUpperCase()}\n`;
        out += `   DE: ${m.oldNotes || 'Sem obs'}\n`;
        out += `   PARA: ${m.newNotes || 'Sem obs'}\n`;
      }
      out += '\n';
    }

    out += divider;
    out += '*** NÃO REPETIR ITENS JÁ PREPARADOS ***\n';
    return out;
  }

  // --- VIA REGULAR DA COZINHA ---
  if (header.isReprint) {
    out += '*** REIMPRESSÃO — MESMO PEDIDO ***\n';
  }

  out += `CLIENTE: ${header.customerName}\n`;
  out += `Pedido ${header.orderIdShort} | ${header.time}`;
  if (header.orderType) {
    const modalidade = header.orderType === 'mesa' && header.tableNumber
      ? `Mesa ${header.tableNumber}`
      : header.orderType.toUpperCase();
    out += ` | ${modalidade}`;
  }
  out += '\n';
  out += divider;

  // Itens
  for (const item of items) {
    out += `${item.quantity}x ${item.productName.toUpperCase()}\n`;
    if (item.pattiesComposition) {
      out += `   ${item.pattiesComposition}\n`;
    }
    if (item.comboInfo) {
      out += `   ${item.comboInfo.label}\n`;
    }
    if (item.meatPoint) {
      out += `   Ponto: ${item.meatPoint}\n`;
    }
    for (const add of item.additionals) {
      out += `   ${add.label}\n`;
    }
    for (const rem of item.removals) {
      out += `   RETIRAR: ${rem}\n`;
    }
    if (item.notes) {
      out += `   OBS: ${item.notes}\n`;
    }
    if (item.recipeIngredients && item.recipeIngredients.length > 0) {
      out += `   Montagem: ${item.recipeIngredients.join(', ')}\n`;
    }
    out += '\n';
  }

  // Rodapé de Produção
  out += divider;
  out += 'RESUMO DE PRODUÇÃO\n';

  // Chapa
  if (productionSummary.chapa.status === 'a_conferir') {
    out += 'CHAPA: QUANTIDADE A CONFERIR\n';
  } else if (productionSummary.chapa.status === 'sem_carnes') {
    out += 'CHAPA: SEM CARNES\n';
  } else {
    out += `CHAPA — ${productionSummary.chapa.pattiesLabel}\n`;
    for (const p of productionSummary.chapa.pattiesBreakdown) {
      out += `${p.label}\n`;
    }
  }

  if (productionSummary.chapa.otherItems.length > 0) {
    out += '\nOUTROS NA CHAPA\n';
    for (const o of productionSummary.chapa.otherItems) {
      out += `${o.label}\n`;
    }
  }

  out += '\n';

  // Fritadeira
  if (productionSummary.fritadeira.status === 'a_conferir') {
    out += 'FRITADEIRA: QUANTIDADE A CONFERIR\n';
  } else if (productionSummary.fritadeira.status === 'sem_itens') {
    out += 'FRITADEIRA: SEM ITENS\n';
  } else {
    out += 'FRITADEIRA\n';
    for (const f of productionSummary.fritadeira.items) {
      out += `${f.label}\n`;
    }
  }

  return out;
}
