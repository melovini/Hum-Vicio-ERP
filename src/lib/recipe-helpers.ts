import type { Product, RecipeIngredient, InventoryItem } from './store';
import { 
  DEFAULT_SUBCATEGORIES_BY_CATEGORY, 
  getCustomSubcategories,
  getSubcategoriesForCategory 
} from './subcategory-store';

export { DEFAULT_SUBCATEGORIES_BY_CATEGORY, getCustomSubcategories, getSubcategoriesForCategory };

export type CardapioCategoryFilter = 'todos' | 'lanche' | 'porcao' | 'bebida' | 'combo';

export interface RecipeCalculatedMetrics {
  totalCost: number;
  cmvBalcao: number;
  cmvIfood: number;
  marginBalcao: number;
  marginIfood: number;
  suggestedPrice: number;
  hasZeroCostIngredient: boolean;
  missingCostCount: number;
}

/**
 * Normaliza strings para busca sem acentos e minúsculas
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Infere uma subcategoria inteligente para produtos sem subcategoria explícita
 */
export function inferDefaultSubcategory(product: Product): string {
  if (product.subcategory && product.subcategory.trim()) {
    return product.subcategory.trim();
  }
  const nameNorm = normalizeText(product.name);
  const cat = product.category;

  if (cat === 'lanche') {
    if (nameNorm.includes('duplo') || nameNorm.includes('2x')) return 'Linha Duplos';
    if (nameNorm.includes('smash')) return 'Smash Burgers';
    if (nameNorm.includes('vegetariano') || nameNorm.includes('veggie')) return 'Vegetarianos';
    if (nameNorm.includes('kids') || nameNorm.includes('infantil')) return 'Kids';
    if (
      nameNorm.includes('costela') ||
      nameNorm.includes('empanado') ||
      nameNorm.includes('recheado') ||
      nameNorm.includes('especial') ||
      nameNorm.includes('edicao')
    ) {
      return 'Hambúrgueres Especiais';
    }
    return 'Artesanais 180g';
  }

  if (cat === 'porcao') {
    if (nameNorm.includes('batata') || nameNorm.includes('frita')) return 'Batatas Fritas';
    if (nameNorm.includes('anel') || nameNorm.includes('aneis') || nameNorm.includes('cebola')) return 'Anéis de Cebola & Petiscos';
    if (nameNorm.includes('pote') || nameNorm.includes('maionese') || nameNorm.includes('molho')) return 'Molhos & Maioneses da Casa';
    if (nameNorm.includes('adicional') || nameNorm.includes('extra')) return 'Adicionais de Hambúrguer';
    return 'Porções da Casa';
  }

  if (cat === 'bebida') {
    if (nameNorm.includes('suco') || nameNorm.includes('cha') || nameNorm.includes('nectar')) return 'Sucos & Chás';
    if (nameNorm.includes('agua')) return 'Águas';
    if (nameNorm.includes('cerveja') || nameNorm.includes('long neck') || nameNorm.includes('chope')) return 'Cervejas';
    return 'Refrigerantes';
  }

  if (cat === 'combo') {
    if (nameNorm.includes('batata')) return 'Combos com Batata';
    return 'Combos Especiais';
  }

  return 'Geral';
}

/**
 * Agrupa produtos por subcategoria para visualização hierárquica ordenada
 */
export function groupProductsBySubcategory(
  products: Product[],
  customOrder?: string[]
): { subcategory: string; products: Product[] }[] {
  const map = new Map<string, Product[]>();

  for (const product of products) {
    const sub = inferDefaultSubcategory(product);
    const list = map.get(sub) || [];
    list.push(product);
    map.set(sub, list);
  }

  const groups = Array.from(map.entries()).map(([subcategory, prods]) => ({
    subcategory,
    products: prods,
  }));

  if (customOrder && customOrder.length > 0) {
    groups.sort((a, b) => {
      const idxA = customOrder.indexOf(a.subcategory);
      const idxB = customOrder.indexOf(b.subcategory);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.subcategory.localeCompare(b.subcategory, 'pt-BR');
    });
  }

  return groups;
}

/**
 * Filtra produtos do cardápio com suporte a busca insensível a acentos, categoria, subcategoria e ativos/inativos
 */
export function filterCardapioProducts(
  products: Product[],
  options: {
    category?: CardapioCategoryFilter;
    subcategory?: string;
    search?: string;
    showInactive?: boolean;
  } = {},
): Product[] {
  const { category = 'todos', subcategory = 'todas', search = '', showInactive = false } = options;
  const q = normalizeText(search);

  return products.filter((p) => {
    if (!showInactive && p.isActive === false) return false;
    if (category !== 'todos' && p.category !== category) return false;
    if (subcategory && subcategory !== 'todas') {
      const pSub = inferDefaultSubcategory(p);
      if (normalizeText(pSub) !== normalizeText(subcategory)) return false;
    }
    if (!q) return true;

    const nameNorm = normalizeText(p.name);
    const catNorm = normalizeText(p.category);
    const subNorm = normalizeText(p.subcategory || inferDefaultSubcategory(p));
    return nameNorm.includes(q) || catNorm.includes(q) || subNorm.includes(q);
  });
}

/**
 * Calcula em tempo real o CMV %, margens brutas, preço sugerido e identifica insumos sem custo
 */
export function calculateRecipeMetrics(
  recipe: RecipeIngredient[],
  getIngredientCost: (id: string) => number,
  priceBalcao: number,
  priceIfood: number,
  targetCmvPercent: number = 30,
): RecipeCalculatedMetrics {
  let totalCost = 0;
  let missingCostCount = 0;

  for (const item of recipe) {
    const unitCost = getIngredientCost(item.ingredientId);
    const itemTotal = unitCost * (item.quantity || 0);
    totalCost += itemTotal;
    if (unitCost <= 0) {
      missingCostCount++;
    }
  }

  const roundedCost = Math.round(totalCost * 100) / 100;
  const safeBalcao = priceBalcao > 0 ? priceBalcao : 0;
  const safeIfood = priceIfood > 0 ? priceIfood : 0;

  const cmvBalcao = safeBalcao > 0 ? (roundedCost / safeBalcao) * 100 : 0;
  const cmvIfood = safeIfood > 0 ? (roundedCost / safeIfood) * 100 : 0;

  const marginBalcao = safeBalcao - roundedCost;
  const marginIfood = safeIfood - roundedCost;

  const targetRatio = targetCmvPercent > 0 ? targetCmvPercent / 100 : 0.3;
  const suggestedPrice = targetRatio > 0 ? Math.round((roundedCost / targetRatio) * 100) / 100 : 0;

  return {
    totalCost: roundedCost,
    cmvBalcao: Math.round(cmvBalcao * 10) / 10,
    cmvIfood: Math.round(cmvIfood * 10) / 10,
    marginBalcao: Math.round(marginBalcao * 100) / 100,
    marginIfood: Math.round(marginIfood * 100) / 100,
    suggestedPrice,
    hasZeroCostIngredient: missingCostCount > 0,
    missingCostCount,
  };
}

/**
 * Helper inteligente para cruzar produtos adicionais com o insumo de estoque correspondente
 */
export function findMatchingInventoryItem(
  productName: string,
  productRecipe: RecipeIngredient[] | undefined,
  itemsList: InventoryItem[],
): InventoryItem | undefined {
  if (productRecipe && productRecipe.length > 0) {
    const fromRecipe = itemsList.find((i) => i.id === productRecipe[0].ingredientId);
    if (fromRecipe) return fromRecipe;
  }

  const clean = normalizeText(
    productName
      .replace(/^(adicional|adic|porcao|porção)\s*:\s*/i, '')
      .replace(/\s*no hamb[uú]rguer/i, '')
      .trim(),
  );

  if (!clean) return undefined;

  const exact = itemsList.find((i) => normalizeText(i.name) === clean);
  if (exact) return exact;

  const startsWith = itemsList.find((i) => {
    const iName = normalizeText(i.name);
    return iName.startsWith(clean) || clean.startsWith(iName);
  });
  if (startsWith) return startsWith;

  const contains = itemsList.find((i) => normalizeText(i.name).includes(clean));
  if (contains) return contains;

  const stopwords = new Set(['hamburguer', 'lanche', 'porcao', 'adicional', 'extra', 'pote']);
  const words = clean.split(/\s+/).filter((w) => w.length > 3 && !stopwords.has(w));
  if (words.length > 0) {
    let bestMatch: InventoryItem | undefined;
    let maxMatchCount = 0;
    for (const item of itemsList) {
      const iName = normalizeText(item.name);
      let matchCount = 0;
      for (const w of words) {
        if (iName.includes(w)) matchCount++;
      }
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestMatch = item;
      }
    }
    if (bestMatch && maxMatchCount > 0) return bestMatch;
  }
  return undefined;
}
