import { Sale, SaleItem, Product, InventoryItem, KitchenStation, RecipeIngredient } from './store/types';
import {
  calculateItemProduction,
  inferComponentType,
  inferPortionWeightFromInventory,
  resolveRecipeComponentType,
  normalizeProductionString,
  getBurgerPrintDetails,
  BurgerPrintDetails
} from './production-calculator';

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
  showMontagem?: boolean;
  isReprint?: boolean;
  diff?: OrderDiff;
}

/**
 * Extrai a composição confirmada de carne bovina de um item (ex: "1 carne bovina de 180 g")
 */
function resolvePattiesComposition(
  item: SaleItem,
  details: BurgerPrintDetails,
  inventoryItems: InventoryItem[]
): { compositionText?: string; pattyTypeLabel?: string; countPerBurger: number; hasUnconfirmed: boolean } {
  const breakdown = details.production?.breakdown;
  const totalPattiesPerBurger = breakdown?.totalPattiesPerBurger ?? 0;

  if (totalPattiesPerBurger <= 0) {
    return { countPerBurger: 0, hasUnconfirmed: false };
  }

  // Verificar se veio de receita confirmada ou snapshot
  const isResolved = breakdown?.resolvedFromRecipe || Boolean(item.productionSnapshot);
  const matchedProduct = details.matchedProduct;

  let pattyWeight = 0;
  let pattyUnit = 'g';
  let pattyName = 'carne bovina';

  if (matchedProduct && Array.isArray(matchedProduct.recipe)) {
    for (const r of matchedProduct.recipe) {
      const inv = inventoryItems.find(i => i.id === r.ingredientId);
      const compType = resolveRecipeComponentType(r, inv);
      if (compType === 'carne_bovina') {
        const weightInfo = inferPortionWeightFromInventory(inv);
        if (weightInfo) {
          pattyWeight = weightInfo.weight;
          pattyUnit = weightInfo.unit;
        }
        if (inv?.name) {
          const normInv = normalizeProductionString(inv.name);
          if (normInv.includes('costela')) pattyName = 'carne bovina (costela)';
          else if (normInv.includes('smash')) pattyName = 'carne bovina (smash)';
          else if (normInv.includes('linguica')) pattyName = 'carne de linguiça';
        }
        break;
      }
    }
  }

  // Se não encontrou insumo, mas temos o peso no nome do produto
  if (pattyWeight === 0 && matchedProduct?.name) {
    const match = matchedProduct.name.match(/(\d{2,3})\s*(g|gr)\b/i);
    if (match) {
      pattyWeight = parseInt(match[1], 10);
    }
  }

  // Se não estiver resolvido de receita/snapshot confirmados
  if (!isResolved && pattyWeight === 0) {
    return { countPerBurger: totalPattiesPerBurger, hasUnconfirmed: true };
  }

  const weightStr = pattyWeight > 0 ? ` de ${pattyWeight} ${pattyUnit}` : '';
  const pluralMeat = totalPattiesPerBurger > 1 ? 'carnes bovinas' : 'carne bovina';
  const compositionText = `${totalPattiesPerBurger} ${pluralMeat}${weightStr}`;
  const pattyTypeLabel = pattyWeight > 0 ? `Bovino ${pattyWeight} ${pattyUnit}` : 'Bovino';

  return {
    compositionText,
    pattyTypeLabel,
    countPerBurger: totalPattiesPerBurger,
    hasUnconfirmed: false,
  };
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
  showMontagem: boolean
): { ticketItem: KitchenTicketItem; details: BurgerPrintDetails; hasUnconfirmed: boolean } {
  const details = getBurgerPrintDetails(item, products, inventoryItems);
  const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;

  const { compositionText, hasUnconfirmed: pattiesUnconfirmed } = resolvePattiesComposition(item, details, inventoryItems);
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
    const { ticketItem, details, hasUnconfirmed } = processKitchenItem(item, products, inventoryItems, showMontagem);
    processedItems.push(ticketItem);
    processedDetails.push(details);
    if (hasUnconfirmed) hasAnyUnconfirmed = true;
  }

  // 3. Resumo de Produção (Chapa e Fritadeira)
  let totalChapaPatties = 0;
  const pattiesMap = new Map<string, number>();
  let totalEggs = 0;
  const otherChapaMap = new Map<string, number>();

  const fryerMap = new Map<string, number>();
  let totalFryerPreparos = 0;

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    const details = processedDetails[i];
    const prod = details.production;
    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;

    // --- CHAPA: Carnes ---
    if (prod.chapaPatties > 0) {
      totalChapaPatties += prod.chapaPatties;
      const { pattyTypeLabel } = resolvePattiesComposition(item, details, inventoryItems);
      const label = pattyTypeLabel || 'Bovino';
      pattiesMap.set(label, (pattiesMap.get(label) || 0) + prod.chapaPatties);
    }

    // --- CHAPA: Outros (Ovos, bacon) ---
    if (prod.eggsCount > 0) {
      totalEggs += prod.eggsCount;
    }

    // --- FRITADEIRA ---
    // Batata de combo (conta 1 porção por combo)
    if (prod.fryerBatatasCombo > 0) {
      const comboLabel = details.comboDetails?.comboType === 'batata_cheddar_bacon'
        ? 'Batata cheddar e bacon'
        : 'Batata pequena';
      fryerMap.set(comboLabel, (fryerMap.get(comboLabel) || 0) + prod.fryerBatatasCombo);
      totalFryerPreparos += prod.fryerBatatasCombo;
    }

    // Batata avulsa
    if (prod.fryerBatatasAvulsa > 0) {
      const isPortionProduct = details.matchedProduct?.category === 'porcao' || normalizeProductionString(item.productName).includes('batata');
      const count = isPortionProduct ? qty : Math.round(prod.fryerBatatasAvulsa);
      const avulsaLabel = details.matchedProduct?.name || prod.fryerBatataName || item.productName;
      fryerMap.set(avulsaLabel, (fryerMap.get(avulsaLabel) || 0) + count);
      totalFryerPreparos += count;
    }

    // Onions de combo
    if (prod.fryerOnionsCombo > 0) {
      const onionComboLabel = 'Anéis de cebola (combo)';
      fryerMap.set(onionComboLabel, (fryerMap.get(onionComboLabel) || 0) + prod.fryerOnionsCombo);
      totalFryerPreparos += prod.fryerOnionsCombo;
    }

    // Onions avulsas
    if (prod.fryerOnionsAvulsa > 0) {
      const isPortionProduct = details.matchedProduct?.category === 'porcao' || normalizeProductionString(item.productName).includes('onion') || normalizeProductionString(item.productName).includes('anel');
      const count = isPortionProduct ? qty : Math.round(prod.fryerOnionsAvulsa);
      const onionAvulsaLabel = details.matchedProduct?.name || prod.fryerBatataName || item.productName;
      fryerMap.set(onionAvulsaLabel, (fryerMap.get(onionAvulsaLabel) || 0) + count);
      totalFryerPreparos += count;
    }

    // Frango empanado
    if (prod.fryerChicken > 0) {
      const chickenLabel = 'Frango empanado';
      fryerMap.set(chickenLabel, (fryerMap.get(chickenLabel) || 0) + prod.fryerChicken);
      totalFryerPreparos += prod.fryerChicken;
    }

    // Queijo empanado
    if (prod.fryerCheese > 0) {
      const cheeseLabel = 'Queijo empanado';
      fryerMap.set(cheeseLabel, (fryerMap.get(cheeseLabel) || 0) + prod.fryerCheese);
      totalFryerPreparos += prod.fryerCheese;
    }
  }

  if (totalEggs > 0) {
    const eggLabel = totalEggs > 1 ? 'Ovos' : 'Ovo';
    otherChapaMap.set(eggLabel, totalEggs);
  }

  // Estruturação do rodapé
  const pattiesBreakdown: { label: string; count: number }[] = [];
  pattiesMap.forEach((count, label) => {
    pattiesBreakdown.push({ label: `${label}: ${count} ${count > 1 ? 'unidades' : 'unidade'}`, count });
  });

  const otherChapaItems: { label: string; count: number }[] = [];
  otherChapaMap.forEach((count, label) => {
    otherChapaItems.push({ label: `${label}: ${count}`, count });
  });

  const fryerItems: { label: string; count: number }[] = [];
  fryerMap.forEach((count, label) => {
    fryerItems.push({ label: `${label}: ${count}`, count });
  });

  let chapaStatus: 'ok' | 'sem_carnes' | 'a_conferir' = 'ok';
  if (hasAnyUnconfirmed) {
    chapaStatus = 'a_conferir';
  } else if (totalChapaPatties === 0) {
    chapaStatus = 'sem_carnes';
  }

  let fryerStatus: 'ok' | 'sem_itens' | 'a_conferir' = 'ok';
  if (hasAnyUnconfirmed && totalFryerPreparos === 0) {
    fryerStatus = 'a_conferir';
  } else if (totalFryerPreparos === 0) {
    fryerStatus = 'sem_itens';
  }

  const pattiesLabel = totalChapaPatties === 1 ? '1 CARNE' : `${totalChapaPatties} CARNES`;
  const preparosLabel = totalFryerPreparos === 1 ? '1 PREPARO' : `${totalFryerPreparos} PREPAROS`;

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
    isComplete: !hasAnyUnconfirmed,
  };

  // 4. Tratamento da Via Diferencial (se aplicável)
  let diffData: KitchenTicketData['diff'] = undefined;
  if (activeDiff) {
    const diffAdded = (activeDiff.added || []).map(item => {
      const { ticketItem } = processKitchenItem(item, products, inventoryItems, showMontagem);
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
    out += `CHAPA: ${productionSummary.chapa.pattiesLabel}\n`;
    for (const p of productionSummary.chapa.pattiesBreakdown) {
      out += `  ${p.label}\n`;
    }
  }

  if (productionSummary.chapa.otherItems.length > 0) {
    for (const o of productionSummary.chapa.otherItems) {
      out += `  Outros: ${o.label}\n`;
    }
  }

  // Fritadeira
  if (productionSummary.fritadeira.status === 'a_conferir') {
    out += 'FRITADEIRA: QUANTIDADE A CONFERIR\n';
  } else if (productionSummary.fritadeira.status === 'sem_itens') {
    out += 'FRITADEIRA: SEM ITENS\n';
  } else {
    out += `FRITADEIRA: ${productionSummary.fritadeira.preparosLabel}\n`;
    for (const f of productionSummary.fritadeira.items) {
      out += `  ${f.label}\n`;
    }
  }

  return out;
}
