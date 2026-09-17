import type { Product, RecipeIngredient, InventoryItem } from './store';

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
 * Filtra produtos do cardápio com suporte a busca insensível a acentos, categoria e ativos/inativos
 */
export function filterCardapioProducts(
  products: Product[],
  options: {
    category?: CardapioCategoryFilter;
    search?: string;
    showInactive?: boolean;
  } = {},
): Product[] {
  const { category = 'todos', search = '', showInactive = false } = options;
  const q = normalizeText(search);

  return products.filter((p) => {
    if (!showInactive && p.isActive === false) return false;
    if (category !== 'todos' && p.category !== category) return false;
    if (!q) return true;

    const nameNorm = normalizeText(p.name);
    const catNorm = normalizeText(p.category);
    return nameNorm.includes(q) || catNorm.includes(q);
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
