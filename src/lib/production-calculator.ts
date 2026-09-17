import { KitchenStation, InventoryItem, Product, SaleItem } from './store/types';

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

export interface ProductionBreakdown {
  basePattiesPerBurger: number;
  additionalPattiesPerBurger: number;
  totalPattiesPerBurger: number;
  totalPattiesAllBurgers: number;
  eggsPerBurger: number;
  totalEggsAllBurgers: number;
  chickenPerBurger: number;
  totalChickenAllBurgers: number;
  cheeseBreadedPerBurger: number;
  totalCheeseBreadedAllBurgers: number;
  resolvedFromRecipe: boolean;
  notesSummary: string;
}

export interface ItemProductionDetails {
  chapaPatties: number;
  isDouble: boolean;
  meatPoint?: string;
  eggsCount: number;
  baconChapaCount: number;
  fryerChicken: number;
  fryerCheese: number;
  fryerBatatasCombo: number;
  fryerBatatasAvulsa: number;
  fryerBatataName?: string;
  fryerOnionsCombo: number;
  fryerOnionsAvulsa: number;
  breakdown: ProductionBreakdown;
}

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
 * Extrai a quantidade numérica de porções a partir da quantidade da receita e unidade.
 * Converte kg para unidades de disco quando aplicável (ex: 0.180 kg = 1 disco de 180g; 0.360 kg = 2 discos).
 */
export function resolveRecipeUnitQuantity(qty: number, unit: string = 'un', componentType?: ComponentType): number {
  if (qty <= 0) return 0;
  const normUnit = normalizeProductionString(unit);

  if (normUnit === 'un' || normUnit === 'und' || normUnit === 'unidade' || normUnit === 'unidades') {
    return Math.round(qty);
  }

  // Se a carne estiver cadastrada em kg (ex: 0.180 kg de blend, 0.150 kg de carne, etc.)
  if (componentType === 'carne_bovina' && (normUnit === 'kg' || normUnit === 'kilo')) {
    // Porção padrão para lanches artesanais varia entre 100g (smash) e 180g
    if (qty >= 0.08 && qty <= 0.22) {
      return 1;
    }
    if (qty > 0.22 && qty <= 0.40) {
      return 2;
    }
    if (qty > 0.40) {
      return Math.round(qty / 0.18);
    }
    return 1;
  }

  // Porções de batata ou anéis de cebola cadastradas em kg na receita (ex: 0.15 kg = 1 porção)
  if ((componentType === 'batata' || componentType === 'onion') && (normUnit === 'kg' || normUnit === 'kilo' || normUnit === 'g' || normUnit === 'gramas')) {
    if (qty >= 0.08 && qty <= 0.35) {
      return 1;
    }
    if (qty > 0.35 && qty <= 0.70) {
      return 2;
    }
    return Math.max(1, Math.round(qty / 0.15));
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
export function calculateItemProduction(
  item: SaleItem,
  products: Product[] = [],
  inventoryItems: InventoryItem[] = []
): ItemProductionDetails {
  const rawName = item.productName || '';
  const notes = item.notes || '';
  const combo = (item.combo || '').trim();
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

  // Localiza produto base cadastrado
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

  // 1. Resolução dos componentes do produto base via Receita Oficial
  if (matchedProduct && Array.isArray(matchedProduct.recipe) && matchedProduct.recipe.length > 0) {
    resolvedFromRecipe = true;

    for (const r of matchedProduct.recipe) {
      const inv = inventoryById.get(r.ingredientId);
      const ingName = inv?.name || '';
      const ingCategory = inv?.category || '';
      const compType = inferComponentType(ingName, ingCategory);
      const unitQty = resolveRecipeUnitQuantity(r.quantity, inv?.unit || 'un', compType);

      if (compType === 'carne_bovina') {
        basePattiesPerBurger += unitQty;
      } else if (compType === 'ovo') {
        eggsPerBurger += unitQty;
      } else if (compType === 'bacon') {
        baconChapaPerBurger += unitQty;
      } else if (compType === 'frango_empanado') {
        chickenPerBurger += unitQty;
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
    // Não inventa carnes duplas: respeita 1 carne padrão por lanche artesanal conhecido
    if (
      normBaseName.includes('estados unidos') ||
      normBaseName === 'eua' ||
      normBaseName.includes('frango empanado')
    ) {
      chickenPerBurger = 1;
    } else if (normBaseName.includes('argentina') && normBaseName.includes('empanado')) {
      basePattiesPerBurger = 1;
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
      // Se for explicitamente um lanche duplo cadastrado no catálogo sem receita
      if (normBaseName.includes('duplo')) {
        basePattiesPerBurger = 2;
      } else {
        basePattiesPerBurger = 1;
      }
    } else if (normBaseName.includes('batata') || normBaseName.includes('fritas')) {
      recipeBatatasPerBurger = 1;
    } else if (normBaseName.includes('onion') || normBaseName.includes('anel') || normBaseName.includes('aneis')) {
      recipeOnionsPerBurger = 1;
    }
  }

  // 2. Coleta e Deduplicação de Adicionais (Estruturados vs Legados no Título)
  // Ex: se o pedido tiver item.additionals com "Ovo" e também "+ [Ovo]" no título, não soma 2x!
  interface ParsedAdditional {
    count: number;
    name: string;
    type: ComponentType;
  }

  const parsedAdditionals: ParsedAdditional[] = [];
  const seenAdditionalsKey = new Set<string>();

  // 2.1 Adicionais estruturados (preferência primária)
  if (Array.isArray(item.additionals) && item.additionals.length > 0) {
    for (const add of item.additionals) {
      const { count, cleanName } = parseAdditionalString(add.name);
      const normAdd = normalizeProductionString(cleanName);
      seenAdditionalsKey.add(normAdd);

      const matchedInv = inventoryByNormName.get(normAdd);
      const type = inferComponentType(cleanName, matchedInv?.category);
      parsedAdditionals.push({ count, name: cleanName, type });
    }
  }

  // 2.2 Adicionais do título legado entre colchetes "+ [Nome]"
  const addMatches = rawName.match(/\+\s*\[(.*?)\]/g);
  if (addMatches) {
    for (const m of addMatches) {
      const { count, cleanName } = parseAdditionalString(m);
      const normAdd = normalizeProductionString(cleanName);

      // Se já foi registrado pelos adicionais estruturados, pula para não duplicar
      if (seenAdditionalsKey.has(normAdd)) continue;
      seenAdditionalsKey.add(normAdd);

      const matchedInv = inventoryByNormName.get(normAdd);
      const type = inferComponentType(cleanName, matchedInv?.category);
      parsedAdditionals.push({ count, name: cleanName, type });
    }
  }

  // 3. Aplicação dos Adicionais nas Estações Específicas
  let additionalPattiesPerBurger = 0;
  let additionalEggsPerBurger = 0;
  let additionalChickenPerBurger = 0;
  let additionalCheeseBreadedPerBurger = 0;
  let additionalBatatasAvulsa = 0;
  let additionalOnionsAvulsa = 0;

  for (const add of parsedAdditionals) {
    switch (add.type) {
      case 'carne_bovina':
        additionalPattiesPerBurger += add.count;
        break;
      case 'ovo':
        additionalEggsPerBurger += add.count;
        break;
      case 'frango_empanado':
        additionalChickenPerBurger += add.count;
        break;
      case 'queijo_empanado':
        additionalCheeseBreadedPerBurger += add.count;
        break;
      case 'batata':
        additionalBatatasAvulsa += add.count;
        break;
      case 'onion':
        additionalOnionsAvulsa += add.count;
        break;
      default:
        // Caso genérico: se for carne por nome
        const n = normalizeProductionString(add.name);
        if (n.includes('hamb') || n.includes('carne') || n.includes('bovino') || n.includes('costela') || n.includes('smash')) {
          additionalPattiesPerBurger += add.count;
        } else if (n.includes('ovo')) {
          additionalEggsPerBurger += add.count;
        }
        break;
    }
  }

  // 4. Retiradas de Ingredientes (ex: "SEM CARNE", "SEM OVO")
  const normNotes = normalizeProductionString(`${rawName} ${notes}`);
  let removedPattiesPerBurger = 0;
  let removedEggsPerBurger = 0;

  if (normNotes.includes('sem carne') || normNotes.includes('sem hamburguer') || normNotes.includes('sem burger')) {
    removedPattiesPerBurger = Math.min(basePattiesPerBurger, 1);
  }
  if (normNotes.includes('sem ovo')) {
    removedEggsPerBurger = Math.min(eggsPerBurger, 1);
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

  // 7. Combos de Batata e Onion Rings
  const normCombo = normalizeProductionString(combo);
  const normComboInName = normalizeProductionString(rawName);

  const isComboBatata =
    normCombo.includes('batata') ||
    normComboInName.includes('combo batata') ||
    normComboInName.includes('batata e bebida') ||
    normComboInName.includes('batata + bebida');

  const isComboOnion =
    normCombo.includes('onion') ||
    normCombo.includes('anel') ||
    normCombo.includes('cebola') ||
    normComboInName.includes('combo onion') ||
    normComboInName.includes('combo aneis') ||
    normComboInName.includes('combo anéis') ||
    normComboInName.includes('aneis de cebola + bebida');

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
  const meatPoint = extractMeatPoint(`${rawName} ${notes}`);

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
