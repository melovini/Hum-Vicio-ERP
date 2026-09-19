import { KitchenStation, InventoryItem, Product, SaleItem, ProductionBreakdown, ItemProductionDetails, ComboStationDetails } from './store/types';

export type { ProductionBreakdown, ItemProductionDetails, ComboStationDetails };

export type ComponentType =
  | 'carne_bovina'      // Discos de hambúrguer bovino, costela, linguiça, smash
  | 'frango_empanado'   // Filé de frango empanado
  | 'queijo_empanado'   // Queijo minas/coalho empanado
  | 'ovo'               // Ovos fritos na manteiga / chapa
  | 'bacon'             // Bacon fatiado crocante
  | 'batata'            // Batata palito / rústica
  | 'onion'             // Anéis de cebola
  | 'pao'               // Pães de hambúrguer
  | 'laticinio'         // Queijos fatiados (cheddar, prato, mussarela)
  | 'molho'             // Maioneses, molhos, condimentos
  | 'hortifruti'        // Alface, tomate, cebola
  | 'nao_alimentar'     // Gás, embalagens, energia
  | 'outro';

/**
 * Normaliza strings para comparações insensíveis a acentos, caixa e espaços
 */
export function normalizeProductionString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Classifica o tipo de componente de forma determinística com base na categoria e no nome
 */
export function inferComponentType(name: string, category: string = ''): ComponentType {
  const normName = normalizeProductionString(name);
  const normCat = normalizeProductionString(category);

  // 1. Não-alimentares (embalagens, gás, energia, limpeza)
  if (
    normCat === 'embalagens' ||
    normCat === 'diversos' ||
    normCat === 'operacional' ||
    normCat === 'utilidades' ||
    normCat === 'limpeza' ||
    normName.includes('gas') ||
    normName.includes('energia') ||
    normName.includes('luz') ||
    normName.includes('embalagem') ||
    normName.includes('sacola') ||
    normName.includes('embrulho') ||
    normName.includes('papel') ||
    normName.includes('copo')
  ) {
    return 'nao_alimentar';
  }

  // 2. Ovos
  if (normName.includes('ovo') || normName.includes('ovos')) {
    return 'ovo';
  }

  // 3. Frango Empanado
  if (normName.includes('frango empanado') || normName.includes('file de frango')) {
    return 'frango_empanado';
  }

  // 4. Queijo Empanado
  if (
    (normName.includes('queijo') || normName.includes('minas') || normName.includes('coalho')) &&
    normName.includes('empanado')
  ) {
    return 'queijo_empanado';
  }

  // 5. Bacon
  if (normName.includes('bacon')) {
    return 'bacon';
  }

  // 6. Batatas
  if (normName.includes('batata') || normName.includes('fritas')) {
    return 'batata';
  }

  // 7. Onions
  if (normName.includes('onion') || normName.includes('anel') || normName.includes('aneis') || normName.includes('cebola congelad')) {
    return 'onion';
  }

  // 8. Carnes / Hambúrgueres (bovino, blend, costela, linguiça, smash)
  if (
    normName.includes('hamburguer') ||
    normName.includes('hamb.') ||
    normName.includes('hamb ') ||
    normName.includes('blend') ||
    normName.includes('costela') ||
    normName.includes('linguica') ||
    normName.includes('smash') ||
    (normCat === 'carnes' && !normName.includes('bacon')) ||
    (normName.includes('carne') && !normName.includes('carne seca'))
  ) {
    return 'carne_bovina';
  }

  // 9. Pães
  if (normCat === 'paes' || normCat === 'padaria' || normName.includes('pao')) {
    return 'pao';
  }

  // 10. Laticínios
  if (
    normCat === 'laticinios' ||
    normName.includes('queijo') ||
    normName.includes('cheddar') ||
    normName.includes('mussarela') ||
    normName.includes('mozarela') ||
    normName.includes('catupiry') ||
    normName.includes('cream cheese')
  ) {
    return 'laticinio';
  }

  // 11. Molhos
  if (
    normCat.includes('molho') ||
    normCat.includes('condimento') ||
    normName.includes('maionese') ||
    normName.includes('molho') ||
    normName.includes('barbecue') ||
    normName.includes('chimichurri') ||
    normName.includes('geleia')
  ) {
    return 'molho';
  }

  // 12. Hortifruti
  if (
    normCat === 'hortifruti' ||
    normName.includes('alface') ||
    normName.includes('tomate') ||
    normName.includes('cebola') ||
    normName.includes('picles') ||
    normName.includes('rucula')
  ) {
    return 'hortifruti';
  }

  return 'outro';
}

/**
 * Estação padrão de produção de acordo com o tipo do componente
 */
export function inferStationForComponent(type: ComponentType, name: string = ''): KitchenStation {
  const norm = normalizeProductionString(name);

  switch (type) {
    case 'carne_bovina':
    case 'ovo':
    case 'bacon':
      return 'chapa';
    case 'frango_empanado':
      return 'fritadeira_frango';
    case 'queijo_empanado':
      return 'fritadeira_queijo';
    case 'batata':
      return 'fritadeira_batata';
    case 'onion':
      return 'fritadeira_onion';
    case 'pao':
    case 'laticinio':
    case 'molho':
    case 'hortifruti':
      return 'nenhuma';
    case 'nao_alimentar':
    case 'outro':
    default:
      if (norm.includes('frango empanado')) return 'fritadeira_frango';
      if (norm.includes('queijo empanado')) return 'fritadeira_queijo';
      if (norm.includes('batata')) return 'fritadeira_batata';
      if (norm.includes('onion') || norm.includes('anel')) return 'fritadeira_onion';
      return 'nenhuma';
  }
}

/**
 * Infere o peso da porção (em gramas) a partir dos dados do insumo ou de seu nome
 * Ex: "Hambúrguer 180g" -> 180; "Smash 90g" -> 90; "Batata 150g" -> 150
 */
export function inferPortionWeightFromInventory(inv?: InventoryItem): { weight: number; unit: string } | null {
  if (!inv) return null;
  if (inv.portionWeight && inv.portionWeight > 0) {
    return { weight: inv.portionWeight, unit: inv.portionUnit || 'g' };
  }
  const match = (inv.name || '').match(/(\d+(?:[.,]\d+)?)\s*(g|kg|gr|gramas)\b/i);
  if (match) {
    const rawVal = parseFloat(match[1].replace(',', '.'));
    const rawUnit = match[2].toLowerCase();
    if (!isNaN(rawVal) && rawVal > 0) {
      if (rawUnit === 'kg') return { weight: rawVal * 1000, unit: 'g' };
      return { weight: rawVal, unit: 'g' };
    }
  }
  return null;
}

/**
 * Extrai a quantidade numérica de porções a partir da quantidade da receita e unidade física.
 * Normaliza deterministicamente g -> kg e aplica o peso da porção real (V01).
 */
export function resolveRecipeUnitQuantity(
  qty: number, 
  unit: string = 'un', 
  componentType?: ComponentType,
  portionWeight?: number,
  portionUnit?: string
): number {
  if (qty <= 0) return 0;
  const normUnit = normalizeProductionString(unit);

  // 1. Unidades contadas discretamente
  if (normUnit === 'un' || normUnit === 'und' || normUnit === 'unidade' || normUnit === 'unidades' || normUnit === 'pc' || normUnit === 'peca') {
    return Math.round(qty);
  }

  // 2. Normalização física para quilogramas (KG)
  let qtyInKg: number | null = null;
  if (normUnit === 'kg' || normUnit === 'kilo' || normUnit === 'quilo' || normUnit === 'kilos' || normUnit === 'quilos') {
    qtyInKg = qty;
  } else if (normUnit === 'g' || normUnit === 'gr' || normUnit === 'grama' || normUnit === 'gramas') {
    qtyInKg = qty / 1000;
  }

  if (qtyInKg !== null) {
    // Se foi fornecido portionWeight explícito (ou inferido do cadastro do insumo)
    if (portionWeight && portionWeight > 0) {
      let portionInKg = portionWeight;
      const normPortionUnit = normalizeProductionString(portionUnit || 'g');
      if (normPortionUnit === 'g' || normPortionUnit === 'gr' || normPortionUnit === 'gramas') {
        portionInKg = portionWeight / 1000;
      }
      if (portionInKg > 0) {
        const rawRatio = qtyInKg / portionInKg;
        if (Math.abs(rawRatio - Math.round(rawRatio)) <= 0.05) {
          return Math.round(rawRatio);
        }
        return Number(rawRatio.toFixed(2));
      }
    }

    // Carne bovina em kg sem porção explícita
    if (componentType === 'carne_bovina') {
      if (qtyInKg >= 0.08 && qtyInKg <= 0.22) {
        return 1;
      }
      if (qtyInKg > 0.22 && qtyInKg <= 0.40) {
        return 2;
      }
      return Math.max(1, Math.round(qtyInKg / 0.18));
    }

    // Batata ou anéis de cebola (V01)
    if (componentType === 'batata' || componentType === 'onion') {
      // Porção padrão de porção ou acompanhamento: 150g (0.150 kg)
      const portionInKg = 0.150;
      const ratio = qtyInKg / portionInKg;
      if (Math.abs(ratio - Math.round(ratio)) <= 0.08) {
        return Math.round(ratio);
      }
      return Number(ratio.toFixed(2));
    }

    if (componentType === 'ovo') {
      return Math.max(1, Math.round(qtyInKg >= 0.04 ? qtyInKg / 0.05 : 1));
    }
  }

  if (componentType === 'ovo') {
    return Math.max(1, Math.round(qty));
  }

  return qty;
}

/**
 * Parser inteligente de adicionais em strings: extrai quantidade e nome limpo
 * Exemplo: "2x Hambúrguer 160g Extra" -> { count: 2, cleanName: "Hambúrguer 160g Extra" }
 *          "+ [Ovo Frito na Manteiga]" -> { count: 1, cleanName: "Ovo Frito na Manteiga" }
 */
export function parseAdditionalString(raw: string): { count: number; cleanName: string } {
  let text = (raw || '')
    .replace(/^\+\s*\[/, '')
    .replace(/\]$/, '')
    .replace(/^\+\s*/, '')
    .trim();

  let count = 1;
  const multiplierMatch = text.match(/^(\d+)x\s*(.*)$/i);
  if (multiplierMatch) {
    count = parseInt(multiplierMatch[1], 10) || 1;
    text = multiplierMatch[2].trim();
  }

  return { count, cleanName: text };
}

/**
 * Extrai o ponto da carne a partir de observações e nome do produto
 */
export function extractMeatPoint(text: string): string | undefined {
  const norm = normalizeProductionString(text);
  if (norm.includes('mal passado') || norm.includes('mal-passado') || norm.includes('malpassado')) {
    return 'Mal Passado';
  }
  if (norm.includes('ao ponto p/ bem') || norm.includes('ao ponto pra bem') || norm.includes('ponto mais') || norm.includes('p/ bem')) {
    return 'Ao Ponto +';
  }
  if (norm.includes('ao ponto p/ menos') || norm.includes('ao ponto pra menos') || norm.includes('ponto menos') || norm.includes('p/ menos')) {
    return 'Ao Ponto -';
  }
  if (norm.includes('ao ponto')) {
    return 'Ao Ponto';
  }
  if (norm.includes('bem passado') || norm.includes('bem-passado') || norm.includes('bempassado')) {
    return 'Bem Passado';
  }
  return undefined;
}

/**
 * MOTOR CENTRAL DE CÁLCULO DE PRODUÇÃO (Etapa 1)
 *
 * Implementa de forma determinística e testável:
 * Total a preparar = quantidade de lanches × (unidades da receita + unidades adicionais - unidades retiradas)
 *
 * Desacopla estação chapa de tipo carne, não duplica adicionais e nunca adivinha carnes por nome.
 */
export function createItemProductionSnapshot(
  item: SaleItem,
  products: Product[] = [],
  inventoryItems: InventoryItem[] = []
): ItemProductionDetails {
  const itemWithoutSnapshot = { ...item, productionSnapshot: undefined };
  return calculateItemProduction(itemWithoutSnapshot, products, inventoryItems);
}

export function calculateItemProduction(
  item: SaleItem,
  products: Product[] = [],
  inventoryItems: InventoryItem[] = []
): ItemProductionDetails {
  // Se o item já possui composição confirmada salva (Etapa 4), respeita o snapshot original imutável
  // EXCETO se o snapshot estiver com 0 carnes em lanche conhecido sem retirada de carne
  if (item.productionSnapshot && item.productionSnapshot.chapaPatties !== undefined) {
    const checkName = (item.productName || '').toLowerCase();
    const isBurger = checkName.includes('burger') || checkName.includes('lanche') || checkName.includes('mexico') || checkName.includes('argentina') || checkName.includes('brasil') || checkName.includes('alemanha') || checkName.includes('israel') || checkName.includes('wakanda') || checkName.includes('duplo');
    const removalsStr = Array.isArray(item.removals) ? item.removals.join(' ').toLowerCase() : '';
    const explicitlyRemovedMeat = removalsStr.includes('sem carne') || removalsStr.includes('sem burger');
    if (!isBurger || item.productionSnapshot.chapaPatties > 0 || explicitlyRemovedMeat) {
      return item.productionSnapshot;
    }
  }

  const rawName = (item.productName || '').trim();
  const notes = (item.notes || '').trim();
  const comboProduct = item.comboId ? products.find(p => p.id === item.comboId) : undefined;
  const combo = (item.combo || comboProduct?.name || '').trim();
  const qty = Math.max(1, Number(item.quantity) || 1);

  // Mapa rápido de insumos por ID e por nome normalizado
  const inventoryById = new Map<string, InventoryItem>();
  const inventoryByNormName = new Map<string, InventoryItem>();
  for (const inv of inventoryItems) {
    if (inv.id) inventoryById.set(inv.id, inv);
    if (inv.name) inventoryByNormName.set(normalizeProductionString(inv.name), inv);
  }

  // Nome limpo do produto base
  const baseCleanName = rawName
    .replace(/\+\s*\[.*?\]/g, '')
    .replace(/\s*\(Combo.*?\)/i, '')
    .replace(/\s*\*Obs:.*?\*/i, '')
    .trim();
  const normBaseName = normalizeProductionString(baseCleanName);

  // Localiza produto cadastrado
  const matchedProduct = products.find(p =>
    (item.productId && p.id === item.productId) ||
    normalizeProductionString(p.name) === normBaseName
  );

  let basePattiesPerBurger = 0;
  let eggsPerBurger = 0;
  let baconChapaPerBurger = 0;
  let chickenPerBurger = 0;
  let cheeseBreadedPerBurger = 0;
  let recipeBatatasPerBurger = 0;
  let recipeOnionsPerBurger = 0;
  let resolvedFromRecipe = false;

  // Se o matchedProduct não possui receita cadastrada, ou se é um lanche variante (Duplo, Triplo),
  // buscar o produto base para herdar a receita oficial (ex: "México Duplo" herda "México")
  let effectiveRecipe = (matchedProduct && Array.isArray(matchedProduct.recipe) && matchedProduct.recipe.length > 0)
    ? matchedProduct.recipe
    : undefined;

  let isInheritedFromBase = false;
  const isDuploVariant = normBaseName.includes('duplo') || normBaseName.includes('dupla') || normBaseName.includes('2x');
  const isTriploVariant = normBaseName.includes('triplo') || normBaseName.includes('tripla') || normBaseName.includes('3x');

  if (!effectiveRecipe) {
    const baseCleanWithoutVariant = normBaseName
      .replace(/\b(duplo|dupla|triplo|tripla|smash duplo|smash triplo|duplo burger)\b/gi, '')
      .trim();

    const baseProduct = products.find(p =>
      normalizeProductionString(p.name) === baseCleanWithoutVariant
    );

    if (baseProduct && Array.isArray(baseProduct.recipe) && baseProduct.recipe.length > 0) {
      effectiveRecipe = baseProduct.recipe;
      isInheritedFromBase = true;
    }
  }

  // Multiplica as carnes apenas se a receita for herdada da base (se o próprio produto tem receita, a receita é soberana)
  const pattyMultiplier = isInheritedFromBase
    ? (isTriploVariant ? 3 : (isDuploVariant ? 2 : 1))
    : 1;

  // 1. Resolução dos componentes do produto base via Receita Oficial (própria ou herdada)
  if (effectiveRecipe && effectiveRecipe.length > 0) {
    resolvedFromRecipe = true;

    for (const r of effectiveRecipe) {
      const inv = inventoryById.get(r.ingredientId);
      const ingName = inv?.name || '';
      const normIng = normalizeProductionString(ingName);

      // Verificação estruturada de retirada (V09): se o item.removals contiver o insumo, não entra
      const isExplicitlyRemoved = Array.isArray(item.removals) && item.removals.some(rem => {
        const normRem = normalizeProductionString(rem);
        return normRem === normIng || normRem.includes(normIng) || normIng.includes(normRem);
      });
      if (isExplicitlyRemoved) continue;

      const ingCategory = inv?.category || '';
      const compType = inferComponentType(ingName, ingCategory);
      const portionInfo = inferPortionWeightFromInventory(inv);
      const unitQty = resolveRecipeUnitQuantity(
        r.quantity, 
        inv?.unit || 'un', 
        compType, 
        portionInfo?.weight, 
        portionInfo?.unit
      );

      if (compType === 'carne_bovina') {
        basePattiesPerBurger += (unitQty * pattyMultiplier);
      } else if (compType === 'ovo') {
        eggsPerBurger += unitQty;
      } else if (compType === 'bacon') {
        baconChapaPerBurger += unitQty;
      } else if (compType === 'frango_empanado') {
        chickenPerBurger += (unitQty * (isDuploVariant ? 2 : 1));
      } else if (compType === 'queijo_empanado') {
        cheeseBreadedPerBurger += unitQty;
      } else if (compType === 'batata') {
        recipeBatatasPerBurger += unitQty;
      } else if (compType === 'onion') {
        recipeOnionsPerBurger += unitQty;
      }
    }
  } else {
    // Fallback restrito e explícito quando o produto preparado não tem receita cadastrada
    if (
      normBaseName.includes('estados unidos') ||
      normBaseName === 'eua' ||
      normBaseName.includes('frango empanado')
    ) {
      chickenPerBurger = isDuploVariant ? 2 : 1;
    } else if (normBaseName.includes('argentina') && normBaseName.includes('empanado')) {
      basePattiesPerBurger = isDuploVariant ? 2 : 1;
      cheeseBreadedPerBurger = 1;
    } else if (normBaseName.includes('israel')) {
      cheeseBreadedPerBurger = 1;
    } else if (
      normBaseName.includes('argentina') ||
      normBaseName.includes('alemanha') ||
      normBaseName.includes('brasil') ||
      normBaseName.includes('mexico') ||
      normBaseName.includes('wakanda') ||
      normBaseName.includes('kids') ||
      normBaseName.includes('burger') ||
      normBaseName.includes('hamb')
    ) {
      basePattiesPerBurger = isDuploVariant ? 2 : 1;
    } else if (normBaseName.includes('batata') || normBaseName.includes('fritas')) {
      recipeBatatasPerBurger = 1;
    } else if (normBaseName.includes('onion') || normBaseName.includes('anel') || normBaseName.includes('aneis')) {
      recipeOnionsPerBurger = 1;
    }
  }

  // 2. Coleta e Expansão de Adicionais (Estruturados vs Legados no Título) (V04)
  let additionalPattiesPerBurger = 0;
  let additionalEggsPerBurger = 0;
  let additionalChickenPerBurger = 0;
  let additionalCheeseBreadedPerBurger = 0;
  let additionalBatatasAvulsa = 0;
  let additionalOnionsAvulsa = 0;

  const seenAdditionalsKey = new Set<string>();

  const processAdditionalItem = (rawIdentifier: string | undefined, rawName: string, explicitQuantity?: number) => {
    const parsed = parseAdditionalString(rawName);
    const count = typeof explicitQuantity === 'number' && explicitQuantity > 0 ? explicitQuantity : parsed.count;
    const cleanName = parsed.cleanName;
    const normAdd = normalizeProductionString(cleanName);

    // Evita duplicar se já foi processado
    if (seenAdditionalsKey.has(normAdd)) return;
    seenAdditionalsKey.add(normAdd);

    // 1º Verificar se corresponde a um PRODUTO cadastrado (ex: "Reforço Especial", "Adicional: Carne 180g") (V04)
    const matchedAddProduct = (rawIdentifier ? products.find(p => p.id === rawIdentifier) : undefined) ||
      products.find(p => {
        const normP = normalizeProductionString(p.name);
        return normP === normAdd || 
               normP === normalizeProductionString('Adicional: ' + cleanName) ||
               normP === normalizeProductionString('Adicional ' + cleanName);
      });

    // Se for um produto com receita cadastrada, expande TODOS os componentes de sua receita (V04)
    if (matchedAddProduct && Array.isArray(matchedAddProduct.recipe) && matchedAddProduct.recipe.length > 0) {
      for (const r of matchedAddProduct.recipe) {
        const inv = inventoryById.get(r.ingredientId);
        const ingName = inv?.name || '';
        const ingCategory = inv?.category || '';
        const compType = inferComponentType(ingName, ingCategory);
        const portionInfo = inferPortionWeightFromInventory(inv);
        const unitQty = resolveRecipeUnitQuantity(
          r.quantity, 
          inv?.unit || 'un', 
          compType, 
          portionInfo?.weight, 
          portionInfo?.unit
        );
        const totalCompQty = unitQty * count;

        if (compType === 'carne_bovina') additionalPattiesPerBurger += totalCompQty;
        else if (compType === 'ovo') additionalEggsPerBurger += totalCompQty;
        else if (compType === 'bacon') baconChapaPerBurger += totalCompQty;
        else if (compType === 'frango_empanado') additionalChickenPerBurger += totalCompQty;
        else if (compType === 'queijo_empanado') additionalCheeseBreadedPerBurger += totalCompQty;
        else if (compType === 'batata') additionalBatatasAvulsa += totalCompQty;
        else if (compType === 'onion') additionalOnionsAvulsa += totalCompQty;
      }
      return;
    }

    // 2º Se não for um produto com receita, verificar se corresponde diretamente a um INSUMO de estoque
    const matchedInv = (rawIdentifier ? inventoryById.get(rawIdentifier) : undefined) || inventoryByNormName.get(normAdd);
    const type = inferComponentType(cleanName, matchedInv?.category);
    const portionInfo = inferPortionWeightFromInventory(matchedInv);
    const unitQty = matchedInv 
      ? resolveRecipeUnitQuantity(1, matchedInv.unit || 'un', type, portionInfo?.weight, portionInfo?.unit)
      : 1;
    const totalCompQty = unitQty * count;

    switch (type) {
      case 'carne_bovina':
        additionalPattiesPerBurger += totalCompQty;
        break;
      case 'ovo':
        additionalEggsPerBurger += totalCompQty;
        break;
      case 'frango_empanado':
        additionalChickenPerBurger += totalCompQty;
        break;
      case 'queijo_empanado':
        additionalCheeseBreadedPerBurger += totalCompQty;
        break;
      case 'batata':
        additionalBatatasAvulsa += totalCompQty;
        break;
      case 'onion':
        additionalOnionsAvulsa += totalCompQty;
        break;
      default: {
        const n = normalizeProductionString(cleanName);
        if (n.includes('hamb') || n.includes('carne') || n.includes('bovino') || n.includes('costela') || n.includes('smash')) {
          additionalPattiesPerBurger += totalCompQty;
        } else if (n.includes('ovo')) {
          additionalEggsPerBurger += totalCompQty;
        }
        break;
      }
    }
  };

  // 2.1 Processar adicionais estruturados
  if (Array.isArray(item.additionals) && item.additionals.length > 0) {
    for (const add of item.additionals) {
      const q = typeof add.quantity === 'number' && add.quantity > 0 ? add.quantity : undefined;
      processAdditionalItem(add.id, add.name, q);
    }
  }

  // 2.2 Processar adicionais legados no título
  const addMatches = rawName.match(/\+\s*\[(.*?)\]/g);
  if (addMatches) {
    for (const m of addMatches) {
      processAdditionalItem(undefined, m, undefined);
    }
  }

  // 4. Retiradas de Ingredientes (ex: "SEM CARNE", "SEM OVO")
  const removalsStr = Array.isArray(item.removals) ? item.removals.join(' ') : '';
  const normNotes = normalizeProductionString(`${rawName} ${notes} ${removalsStr}`);
  let removedPattiesPerBurger = 0;
  let removedEggsPerBurger = 0;

  if (normNotes.includes('sem carne') || normNotes.includes('sem hamburguer') || normNotes.includes('sem burger')) {
    removedPattiesPerBurger = basePattiesPerBurger;
  }
  if (normNotes.includes('sem ovo')) {
    removedEggsPerBurger = eggsPerBurger;
  }

  // 5. Consolidação Matemática dos Totais
  // Total a preparar = quantidade de lanches × (unidades da receita + unidades adicionais - unidades retiradas)
  const netPattiesPerBurger = Math.max(0, basePattiesPerBurger + additionalPattiesPerBurger - removedPattiesPerBurger);
  const totalChapaPatties = netPattiesPerBurger * qty;

  const netEggsPerBurger = Math.max(0, eggsPerBurger + additionalEggsPerBurger - removedEggsPerBurger);
  const totalEggs = netEggsPerBurger * qty;

  const totalChicken = (chickenPerBurger + additionalChickenPerBurger) * qty;
  const totalCheeseBreaded = (cheeseBreadedPerBurger + additionalCheeseBreadedPerBurger) * qty;

  // 6. Definição se o lanche é Duplo
  // CRITÉRIO REAL: Tem 2 ou mais carnes na composição por lanche. NÃO depende do nome conter 'duplo'.
  const isDouble = netPattiesPerBurger >= 2;

  // 7. Combos de Batata e Onion Rings (detecção em combo, notes, additionals e nome)
  const normCombo = normalizeProductionString(combo);
  const additionalsNames = Array.isArray(item.additionals)
    ? item.additionals.map(a => a.name).join(' ')
    : '';
  const allComboSearchText = normalizeProductionString(
    `${combo} ${rawName} ${notes} ${additionalsNames}`
  );

  let isComboCheddarBacon =
    allComboSearchText.includes('cheddar') &&
    allComboSearchText.includes('bacon') &&
    (allComboSearchText.includes('combo') || allComboSearchText.includes('batata') || allComboSearchText.includes('bebida'));

  let isComboOnion =
    allComboSearchText.includes('combo onion') ||
    allComboSearchText.includes('combo aneis') ||
    allComboSearchText.includes('combo anéis') ||
    allComboSearchText.includes('combo anel') ||
    allComboSearchText.includes('aneis de cebola') ||
    allComboSearchText.includes('anéis de cebola') ||
    allComboSearchText.includes('cebola empanada') ||
    allComboSearchText.includes('onion rings') ||
    ((allComboSearchText.includes('onion') || allComboSearchText.includes('anel') || allComboSearchText.includes('aneis') || allComboSearchText.includes('anéis') || allComboSearchText.includes('cebola empanada')) &&
      (allComboSearchText.includes('combo') || allComboSearchText.includes('bebida') || allComboSearchText.includes('refri')));

  let isComboBatata =
    allComboSearchText.includes('combo batata') ||
    allComboSearchText.includes('batata e bebida') ||
    allComboSearchText.includes('batata + bebida') ||
    allComboSearchText.includes('batata & bebida') ||
    allComboSearchText.includes('combo com batata') ||
    (allComboSearchText.includes('combo') && (allComboSearchText.includes('batata') || allComboSearchText.includes('frita'))) ||
    isComboCheddarBacon;

  if (item.comboId) {
    const matchedComboProduct = products.find(p => p.id === item.comboId);
    if (matchedComboProduct) {
      const normCName = normalizeProductionString(matchedComboProduct.name);
      if (normCName.includes('cheddar') && normCName.includes('bacon')) {
        isComboCheddarBacon = true;
        isComboBatata = true;
      }
      if (normCName.includes('batata')) isComboBatata = true;
      if (normCName.includes('onion') || normCName.includes('anel') || normCName.includes('cebola')) isComboOnion = true;

      if (Array.isArray(matchedComboProduct.recipe) && matchedComboProduct.recipe.length > 0) {
        for (const r of matchedComboProduct.recipe) {
          const inv = inventoryById.get(r.ingredientId);
          const compType = inferComponentType(inv?.name || '', inv?.category);
          if (compType === 'batata') isComboBatata = true;
          if (compType === 'onion') isComboOnion = true;
        }
      }
    }
  }

  // Se o item tiver 'combo' genérico explícito e não for onion, trata como batata (padrão da casa)
  if (!isComboBatata && !isComboOnion && (normCombo.includes('combo') || allComboSearchText.includes('combo'))) {
    isComboBatata = true;
  }

  // Se o combo for Batata Cheddar e Bacon, o chapeiro prepara o bacon crocante para a batata
  if (isComboCheddarBacon) {
    baconChapaPerBurger += 1;
  }

  let fryerBatatasCombo = 0;
  let fryerBatatasAvulsa = 0;
  if (isComboBatata) {
    // Se for combo, a batata da receita (se houver) é a do combo
    fryerBatatasCombo = (recipeBatatasPerBurger > 0 ? recipeBatatasPerBurger : 1) * qty;
    fryerBatatasAvulsa = additionalBatatasAvulsa * qty;
  } else {
    fryerBatatasAvulsa = (recipeBatatasPerBurger * qty) + (additionalBatatasAvulsa * qty);
  }

  let fryerOnionsCombo = 0;
  let fryerOnionsAvulsa = 0;
  if (isComboOnion) {
    // Se for combo, as onions da receita (se houver) são as do combo
    fryerOnionsCombo = (recipeOnionsPerBurger > 0 ? recipeOnionsPerBurger : 1) * qty;
    fryerOnionsAvulsa = additionalOnionsAvulsa * qty;
  } else {
    fryerOnionsAvulsa = (recipeOnionsPerBurger * qty) + (additionalOnionsAvulsa * qty);
  }

  // 8. Ponto da Carne
  const meatPoint = (item.meatPoint && item.meatPoint.trim().toUpperCase()) || extractMeatPoint(`${rawName} ${notes}`);

  const breakdown: ProductionBreakdown = {
    basePattiesPerBurger,
    additionalPattiesPerBurger,
    totalPattiesPerBurger: netPattiesPerBurger,
    totalPattiesAllBurgers: totalChapaPatties,
    eggsPerBurger: netEggsPerBurger,
    totalEggsAllBurgers: totalEggs,
    chickenPerBurger,
    totalChickenAllBurgers: totalChicken,
    cheeseBreadedPerBurger,
    totalCheeseBreadedAllBurgers: totalCheeseBreaded,
    resolvedFromRecipe,
    notesSummary: notes.trim()
  };

  return {
    chapaPatties: totalChapaPatties,
    isDouble,
    meatPoint,
    eggsCount: totalEggs,
    baconChapaCount: baconChapaPerBurger * qty,
    fryerChicken: totalChicken,
    fryerCheese: totalCheeseBreaded,
    fryerBatatasCombo,
    fryerBatatasAvulsa,
    fryerBatataName: fryerBatatasAvulsa > 0 ? (matchedProduct?.name || baseCleanName) : undefined,
    fryerOnionsCombo,
    fryerOnionsAvulsa,
    breakdown
  };
}

export interface BurgerPrintDetails {
  matchedProduct?: Product;
  production: ItemProductionDetails;
  recipeIngredients: string[];
  effectiveMeatPoint?: string;
  chapaItems: string[];
  fryerItems: string[];
  comboDetails?: ComboStationDetails;
}

function normalizeStandardDrink(candidate: string): string {
  const norm = normalizeProductionString(candidate);
  if (norm === 'coca zero' || norm.includes('coca zero')) return 'Coca Zero';
  if (norm.includes('coca cola zero')) return 'Coca-Cola Zero';
  if (norm.includes('coca cola') || norm.includes('coca')) return 'Coca-Cola';
  if (norm.includes('guarana zero') || norm.includes('antarctica zero')) return 'Guaraná Antarctica Zero';
  if (norm.includes('guarana') || norm.includes('antarctica')) return 'Guaraná Antarctica';
  if (norm.includes('fanta uva')) return 'Fanta Uva';
  if (norm.includes('fanta laranja') || norm === 'fanta') return 'Fanta Laranja';
  if (norm.includes('sprite zero')) return 'Sprite Zero';
  if (norm.includes('sprite')) return 'Sprite';
  if (norm.includes('schweppes')) return 'Schweppes';
  if (norm.includes('agua com gas')) return 'Água com Gás';
  if (norm.includes('agua sem gas') || norm.includes('agua mineral')) return 'Água Mineral';
  return candidate;
}

/**
 * Identifica o nome da bebida a partir do texto do combo, observações ou adicionais.
 */
export function extractDrinkName(comboStr: string = '', notesStr: string = '', additionalsStr: string = ''): string {
  const fullText = `${comboStr} ${notesStr} ${additionalsStr}`;

  // Verificar texto entre parênteses, ex: "Combo: Batata + Bebida (Coca Zero)" ou "Batata + Bebida (Guaraná)"
  const parenMatch = comboStr.match(/\((.*?)\)/) || notesStr.match(/\((.*?)\)/);
  if (parenMatch && parenMatch[1]) {
    const candidate = parenMatch[1].trim();
    if (candidate.length > 1) return normalizeStandardDrink(candidate);
  }

  // Verificar prefixo explícito nas observações ou combo, ex: "Refri: Coca Zero" ou "Bebida: Fanta Laranja"
  const prefixMatch = fullText.match(/(?:refri(?:gerante)?|bebida)\s*[:=-]\s*([a-zA-Z0-9\s-]+?)(?:;|,|\.|$)/i);
  if (prefixMatch && prefixMatch[1]) {
    const candidate = prefixMatch[1].trim();
    if (candidate.length > 1) return normalizeStandardDrink(candidate);
  }

  // Identificar refrigerantes e bebidas comuns
  const norm = normalizeProductionString(fullText);
  if (norm.includes('coca cola zero') || norm.includes('coca zero')) return 'Coca-Cola Zero';
  if (norm.includes('coca cola') || norm.includes('coca')) return 'Coca-Cola';
  if (norm.includes('guarana zero') || norm.includes('antarctica zero')) return 'Guaraná Antarctica Zero';
  if (norm.includes('guarana') || norm.includes('antarctica')) return 'Guaraná Antarctica';
  if (norm.includes('fanta uva')) return 'Fanta Uva';
  if (norm.includes('fanta laranja') || norm.includes('fanta')) return 'Fanta Laranja';
  if (norm.includes('sprite zero')) return 'Sprite Zero';
  if (norm.includes('sprite')) return 'Sprite';
  if (norm.includes('schweppes')) return 'Schweppes';
  if (norm.includes('agua com gas')) return 'Água com Gás';
  if (norm.includes('agua sem gas') || norm.includes('agua mineral') || norm.includes('agua')) return 'Água Mineral';
  if (norm.includes('suco')) return 'Suco';

  return 'Refrigerante / Bebida do Combo (Conferir e Enviar)';
}

/**
 * Consolida os detalhes completos de montagem, ficha técnica, ponto da carne
 * e estações de preparo para a comanda física e digital da cozinha.
 */
export function getBurgerPrintDetails(
  item: SaleItem,
  products: Product[] = [],
  inventoryItems: InventoryItem[] = []
): BurgerPrintDetails {
  const normItemName = normalizeProductionString(item.productName || '');
  const matchedProduct = products.find(p =>
    (item.productId && p.id === item.productId) ||
    normalizeProductionString(p.name) === normItemName ||
    normItemName.startsWith(normalizeProductionString(p.name))
  );

  let effectiveRecipe = (matchedProduct && Array.isArray(matchedProduct.recipe) && matchedProduct.recipe.length > 0)
    ? matchedProduct.recipe
    : undefined;

  let effectiveDescription = matchedProduct?.description;

  // Herança de receita para lanches variantes (ex: "México Duplo" herda a montagem de "México")
  if (!effectiveRecipe) {
    const baseCleanWithoutVariant = normItemName
      .replace(/\b(duplo|dupla|triplo|tripla|smash duplo|smash triplo|duplo burger)\b/gi, '')
      .trim();

    const baseProduct = products.find(p =>
      normalizeProductionString(p.name) === baseCleanWithoutVariant
    );

    if (baseProduct) {
      if (Array.isArray(baseProduct.recipe) && baseProduct.recipe.length > 0) {
        effectiveRecipe = baseProduct.recipe;
      }
      if (!effectiveDescription && baseProduct.description) {
        effectiveDescription = baseProduct.description;
      }
    }
  }

  const production = calculateItemProduction(item, products, inventoryItems);
  const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
  const matchedComboProduct = item.comboId ? products.find(p => p.id === item.comboId) : undefined;
  const rawCombo = (item.combo || matchedComboProduct?.name || '').trim();
  const normCombo = normalizeProductionString(rawCombo);

  // Ficha técnica / Ingredientes da Montagem (receita cadastrada ou herdada)
  let recipeIngredients: string[] = [];

  if (effectiveRecipe && effectiveRecipe.length > 0) {
    const removalsList = Array.isArray(item.removals)
      ? item.removals.map(r => normalizeProductionString(r))
      : [];

    for (const r of effectiveRecipe) {
      const inv = inventoryItems.find(i => i.id === r.ingredientId);
      if (!inv) continue;
      const ingName = inv.name || '';
      const compType = inferComponentType(ingName, inv.category || '');
      // Pular itens operacionais não alimentares (sacolas, embalagens, guardanapos, gás)
      if (compType === 'nao_alimentar') continue;

      const normIng = normalizeProductionString(ingName);
      // Pular se foi explicitamente removido
      const isRemoved = removalsList.some(rem => normIng.includes(rem) || rem.includes(normIng));
      if (!isRemoved) {
        recipeIngredients.push(ingName);
      }
    }
  } else if (effectiveDescription) {
    recipeIngredients = [effectiveDescription.trim()];
  }

  // Ponto da Carne: se não foi especificado e tem hambúrguer bovino na chapa, padrão é "AO PONTO"
  let effectiveMeatPoint = item.meatPoint || production.meatPoint;
  if (!effectiveMeatPoint && production.chapaPatties > 0) {
    effectiveMeatPoint = 'AO PONTO';
  }

  // Detecção e Estruturação de Combos em todas as fontes (combo, notes, additionals, productName)
  const additionalsNames = Array.isArray(item.additionals)
    ? item.additionals.map(a => a.name).join(' ')
    : '';
  const allComboSearchText = normalizeProductionString(
    `${rawCombo} ${normItemName} ${item.notes || ''} ${additionalsNames}`
  );

  let isComboCheddarBacon =
    allComboSearchText.includes('cheddar') &&
    allComboSearchText.includes('bacon') &&
    (allComboSearchText.includes('combo') || allComboSearchText.includes('batata') || allComboSearchText.includes('bebida'));

  let isComboOnion =
    allComboSearchText.includes('combo onion') ||
    allComboSearchText.includes('combo aneis') ||
    allComboSearchText.includes('combo anéis') ||
    allComboSearchText.includes('combo anel') ||
    allComboSearchText.includes('aneis de cebola') ||
    allComboSearchText.includes('anéis de cebola') ||
    allComboSearchText.includes('cebola empanada') ||
    allComboSearchText.includes('onion rings') ||
    ((allComboSearchText.includes('onion') || allComboSearchText.includes('anel') || allComboSearchText.includes('aneis') || allComboSearchText.includes('anéis') || allComboSearchText.includes('cebola empanada')) &&
      (allComboSearchText.includes('combo') || allComboSearchText.includes('bebida') || allComboSearchText.includes('refri')));

  let isComboBatata =
    allComboSearchText.includes('combo batata') ||
    allComboSearchText.includes('batata e bebida') ||
    allComboSearchText.includes('batata + bebida') ||
    allComboSearchText.includes('batata & bebida') ||
    allComboSearchText.includes('combo com batata') ||
    (allComboSearchText.includes('combo') && (allComboSearchText.includes('batata') || allComboSearchText.includes('frita'))) ||
    isComboCheddarBacon;

  if (matchedComboProduct) {
    const normCName = normalizeProductionString(matchedComboProduct.name);
    if (normCName.includes('cheddar') && normCName.includes('bacon')) {
      isComboCheddarBacon = true;
      isComboBatata = true;
    }
    if (normCName.includes('batata')) isComboBatata = true;
    if (normCName.includes('onion') || normCName.includes('anel') || normCName.includes('aneis') || normCName.includes('cebola empanada')) isComboOnion = true;
  }

  // Se o item tiver 'combo' genérico (ex: "Combo", "Combo 1") e não for onion, trata como batata (padrão)
  if (!isComboBatata && !isComboOnion && (normCombo.includes('combo') || allComboSearchText.includes('combo'))) {
    isComboBatata = true;
  }

  const hasCombo = Boolean(
    rawCombo || 
    isComboCheddarBacon || 
    isComboOnion || 
    isComboBatata || 
    production.fryerBatatasCombo > 0 || 
    production.fryerOnionsCombo > 0
  );

  let comboDetails: ComboStationDetails | undefined = undefined;

  if (hasCombo) {
    const drinkName = extractDrinkName(rawCombo, item.notes || '', additionalsNames);
    const drinkLabel = qty > 1 ? `${qty}x ${drinkName}` : drinkName;

    if (isComboCheddarBacon) {
      comboDetails = {
        rawCombo: rawCombo || 'Combo: Batata Cheddar e Bacon + Bebida',
        comboType: 'batata_cheddar_bacon',
        title: 'COMBO: BATATA CHEDDAR E BACON + BEBIDA',
        icon: '🍟🥓🧀🥤',
        fryerItem: `${qty}x Batata Palito / Frita (Combo)`,
        chapaItem: `${qty > 1 ? `${qty}x ` : ''}Cobertura Cheddar Cremoso + Bacon Crocante na Batata`,
        drinkItem: drinkLabel,
        summary: `${qty}x Batata Cheddar & Bacon + Bebida`
      };
    } else if (isComboOnion) {
      comboDetails = {
        rawCombo: rawCombo || 'Combo: Anéis de Cebola + Bebida',
        comboType: 'onion',
        title: 'COMBO: ANÉIS DE CEBOLA + BEBIDA',
        icon: '🧅🥤',
        fryerItem: `${qty}x Porção de Anéis de Cebola (Combo)`,
        chapaItem: undefined,
        drinkItem: drinkLabel,
        summary: `${qty}x Anéis de Cebola + Bebida`
      };
    } else if (isComboBatata || production.fryerBatatasCombo > 0) {
      comboDetails = {
        rawCombo: rawCombo || 'Combo: Batata + Bebida',
        comboType: 'batata',
        title: 'COMBO: BATATA PALITO + BEBIDA',
        icon: '🍟🥤',
        fryerItem: `${qty}x Batata Palito / Frita (Combo)`,
        chapaItem: undefined,
        drinkItem: drinkLabel,
        summary: `${qty}x Batata Palito + Bebida`
      };
    } else if (rawCombo) {
      const cleanCombo = rawCombo.replace(/^combo:\s*/i, '').trim();
      comboDetails = {
        rawCombo,
        comboType: 'custom',
        title: `COMBO: ${cleanCombo.toUpperCase()}`,
        icon: '🍟🥤',
        fryerItem: `${qty}x Acompanhamento do Combo`,
        chapaItem: undefined,
        drinkItem: drinkLabel,
        summary: `${qty}x ${cleanCombo}`
      };
    }
  }

  // Resumo de Estação Chapa
  const chapaItems: string[] = [];
  if (production.chapaPatties > 0) {
    const burgerLabel = production.chapaPatties > 1
      ? (production.isDouble ? `${production.chapaPatties}x Carnes (Duplo)` : `${production.chapaPatties}x Carnes`)
      : '1x Carne';
    chapaItems.push(`${burgerLabel}${effectiveMeatPoint ? ` [${effectiveMeatPoint.toUpperCase()}]` : ''}`);
  }
  if (production.eggsCount > 0) {
    chapaItems.push(`${production.eggsCount}x ${production.eggsCount > 1 ? 'Ovos' : 'Ovo'}`);
  }
  if (production.baconChapaCount > 0) {
    if (isComboCheddarBacon) {
      const burgerHasBacon = (production.baconChapaCount - qty) > 0;
      if (burgerHasBacon) {
        chapaItems.push('Bacon Crocante (Lanche)');
      }
      chapaItems.push('Bacon Crocante (Batata Cheddar & Bacon)');
    } else {
      chapaItems.push('Bacon Crocante');
    }
  }

  // Resumo de Estação Fritadeira
  const fryerItems: string[] = [];
  if (production.fryerChicken > 0) {
    fryerItems.push(`${production.fryerChicken}x Frango Empanado`);
  }
  if (production.fryerCheese > 0) {
    fryerItems.push(`${production.fryerCheese}x Queijo Empanado`);
  }
  if (production.fryerBatatasCombo > 0) {
    if (isComboCheddarBacon) {
      fryerItems.push(`${production.fryerBatatasCombo}x Batata (Combo - Cheddar & Bacon)`);
    } else {
      fryerItems.push(`${production.fryerBatatasCombo}x Batata (Combo)`);
    }
  }
  if (production.fryerBatatasAvulsa > 0) {
    fryerItems.push(`${production.fryerBatatasAvulsa}x Porção Batata`);
  }
  if (production.fryerOnionsCombo > 0) {
    fryerItems.push(`${production.fryerOnionsCombo}x Onion (Combo)`);
  }
  if (production.fryerOnionsAvulsa > 0) {
    fryerItems.push(`${production.fryerOnionsAvulsa}x Porção Onion`);
  }

  // Garantia de sincronização de estações: se há comboDetails, adiciona na Fritadeira/Chapa caso não estejam presentes
  if (comboDetails) {
    if (comboDetails.comboType === 'batata_cheddar_bacon') {
      if (!fryerItems.some(f => f.toLowerCase().includes('batata'))) {
        fryerItems.push(`${qty}x Batata (Combo - Cheddar & Bacon)`);
      }
      if (!chapaItems.some(c => c.toLowerCase().includes('bacon crocante'))) {
        chapaItems.push('Bacon Crocante (Batata Cheddar & Bacon)');
      }
    } else if (comboDetails.comboType === 'onion') {
      if (!fryerItems.some(f => f.toLowerCase().includes('onion') || f.toLowerCase().includes('cebola'))) {
        fryerItems.push(`${qty}x Porção de Anéis de Cebola (Combo)`);
      }
    } else if (comboDetails.comboType === 'batata') {
      if (!fryerItems.some(f => f.toLowerCase().includes('batata'))) {
        fryerItems.push(`${qty}x Batata (Combo)`);
      }
    }
  }

  return {
    matchedProduct,
    production: {
      ...production,
      comboDetails
    },
    recipeIngredients,
    effectiveMeatPoint,
    chapaItems,
    fryerItems,
    comboDetails
  };
}
