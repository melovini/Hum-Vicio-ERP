import type { Product } from './store';

export type PricingCategoryFilter = 'todos' | 'lanche' | 'duplo' | 'combo' | 'porcao' | 'bebida';

export interface ChannelMetrics {
  gross: number;
  fees: number;
  netRev: number;
  profit: number;
  margin: number;
}

export interface ProductChannelComparison {
  balcao: ChannelMetrics;
  ifood: ChannelMetrics;
  profitDiff: number;
  marginDiff: number;
}

export interface PricingSummaryMetrics {
  avgBalcao: number;
  avgIfood: number;
  avgMargin: number;
  criticalItemsCount: number;
  totalCount: number;
}

export function normalizePricingText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Filtra produtos para a mesa de precificação, ignorando adicionais de estoque internos
 */
export function filterPricingProducts(
  products: Product[],
  options: {
    category?: PricingCategoryFilter;
    search?: string;
  } = {},
): Product[] {
  const { category = 'todos', search = '' } = options;
  const q = normalizePricingText(search);

  return products.filter((p) => {
    if (p.isActive === false) return false;
    if (p.name.startsWith('Adicional:') || p.name.startsWith('Pote Maionese')) return false;

    const nameLower = p.name.toLowerCase();

    if (category === 'duplo') {
      if (!nameLower.includes('duplo')) return false;
    } else if (category === 'lanche') {
      if (p.category !== 'lanche' || nameLower.includes('duplo')) return false;
    } else if (category === 'combo') {
      if (p.category !== 'combo' && !nameLower.includes('combo')) return false;
    } else if (category !== 'todos' && p.category !== category) {
      return false;
    }

    if (!q) return true;

    const nameNorm = normalizePricingText(p.name);
    const catNorm = normalizePricingText(p.category);
    return nameNorm.includes(q) || catNorm.includes(q);
  });
}

/**
 * Aplica markup percentual sobre o preço do balcão
 */
export function applyPercentMarkup(
  priceBalcao: number,
  percent: number,
  options: { round90?: boolean } = {},
): number {
  if (priceBalcao <= 0) return 0;
  const raw = priceBalcao * (1 + percent / 100);
  if (options.round90) {
    return Math.floor(raw) + 0.9;
  }
  return Math.round(raw * 10) / 10;
}

/**
 * Calcula a comparação direta Balcão vs iFood para um produto
 */
export function calculateChannelComparison(
  priceBalcao: number,
  priceIfood: number,
  cmv: number,
  options: {
    ifoodCommissionPct?: number; // Ex: 23
    paymentFeePct?: number; // Ex: 3.2
    balcaoFeePct?: number; // Ex: 3.0
  } = {},
): ProductChannelComparison {
  const {
    ifoodCommissionPct = 23,
    paymentFeePct = 3.2,
    balcaoFeePct = 3.0,
  } = options;

  const totalIfoodFeeRate = (ifoodCommissionPct + paymentFeePct) / 100;
  const balcaoFeeRate = balcaoFeePct / 100;

  // Balcão
  const balcaoFees = priceBalcao * balcaoFeeRate;
  const balcaoNetRev = priceBalcao - balcaoFees;
  const balcaoProfit = balcaoNetRev - cmv;
  const balcaoMargin = priceBalcao > 0 ? (balcaoProfit / priceBalcao) * 100 : 0;

  // iFood
  const ifoodFees = priceIfood * totalIfoodFeeRate;
  const ifoodNetRev = priceIfood - ifoodFees;
  const ifoodProfit = ifoodNetRev - cmv;
  const ifoodMargin = priceIfood > 0 ? (ifoodProfit / priceIfood) * 100 : 0;

  return {
    balcao: {
      gross: Math.round(priceBalcao * 100) / 100,
      fees: Math.round(balcaoFees * 100) / 100,
      netRev: Math.round(balcaoNetRev * 100) / 100,
      profit: Math.round(balcaoProfit * 100) / 100,
      margin: Math.round(balcaoMargin * 10) / 10,
    },
    ifood: {
      gross: Math.round(priceIfood * 100) / 100,
      fees: Math.round(ifoodFees * 100) / 100,
      netRev: Math.round(ifoodNetRev * 100) / 100,
      profit: Math.round(ifoodProfit * 100) / 100,
      margin: Math.round(ifoodMargin * 10) / 10,
    },
    profitDiff: Math.round((ifoodProfit - balcaoProfit) * 100) / 100,
    marginDiff: Math.round((ifoodMargin - balcaoMargin) * 10) / 10,
  };
}

/**
 * Calcula métricas agregadas da carteira ativa
 */
export function calculatePricingSummaryMetrics(
  products: Product[],
  getCmv: (p: Product) => number,
  getIfoodPrice: (p: Product) => number,
  options: {
    ifoodCommissionPct?: number;
    paymentFeePct?: number;
  } = {},
): PricingSummaryMetrics {
  const { ifoodCommissionPct = 23, paymentFeePct = 3.2 } = options;
  const totalFeeRate = (ifoodCommissionPct + paymentFeePct) / 100;

  let totalBalcao = 0;
  let totalIfood = 0;
  let totalMargin = 0;
  let criticalCount = 0;
  let count = 0;

  for (const p of products) {
    if (p.isActive === false) continue;
    if (p.name.startsWith('Adicional:') || p.name.startsWith('Pote Maionese')) continue;

    const ifoodPrice = getIfoodPrice(p);
    const cmv = getCmv(p);
    const fees = ifoodPrice * totalFeeRate;
    const netProfit = ifoodPrice - fees - cmv;
    const margin = ifoodPrice > 0 ? (netProfit / ifoodPrice) * 100 : 0;

    totalBalcao += p.priceBalcao;
    totalIfood += ifoodPrice;
    totalMargin += margin;
    count++;

    if (margin < 18) {
      criticalCount++;
    }
  }

  return {
    avgBalcao: count > 0 ? Math.round((totalBalcao / count) * 100) / 100 : 0,
    avgIfood: count > 0 ? Math.round((totalIfood / count) * 100) / 100 : 0,
    avgMargin: count > 0 ? Math.round((totalMargin / count) * 10) / 10 : 0,
    criticalItemsCount: criticalCount,
    totalCount: count,
  };
}
