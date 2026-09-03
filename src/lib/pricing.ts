export interface TaxConfig {
  ifoodPercentage: number;
  ifoodFixedFee: number;
  creditCardFee: number;
  debitPixFee: number;
}

export interface PricingSimulation {
  channel: 'balcao' | 'ifood';
  paymentMethod: 'credito' | 'debito' | 'pix' | 'ifood_online';
  salePrice: number;
  cmv: number;
}

export interface ProfitResult {
  grossRevenue: number;
  totalFees: number;
  netRevenue: number;
  cmv: number;
  netProfit: number;
  profitMargin: number;
}

export function calculateNetProfit(
  simulation: PricingSimulation, 
  config: TaxConfig
): ProfitResult {
  let totalFees = 0;

  if (simulation.channel === 'ifood') {
    totalFees += (simulation.salePrice * config.ifoodPercentage) + config.ifoodFixedFee;
  }

  if (simulation.channel === 'balcao') {
    if (simulation.paymentMethod === 'credito') {
      totalFees += simulation.salePrice * config.creditCardFee;
    } else if (simulation.paymentMethod === 'debito' || simulation.paymentMethod === 'pix') {
      totalFees += simulation.salePrice * config.debitPixFee;
    }
  }

  const netRevenue = simulation.salePrice - totalFees;
  const netProfit = netRevenue - simulation.cmv;
  
  const profitMargin = simulation.salePrice > 0 
    ? (netProfit / simulation.salePrice) * 100 
    : 0;

  return {
    grossRevenue: simulation.salePrice,
    totalFees: Number(totalFees.toFixed(2)),
    netRevenue: Number(netRevenue.toFixed(2)),
    cmv: simulation.cmv,
    netProfit: Number(netProfit.toFixed(2)),
    profitMargin: Number(profitMargin.toFixed(2))
  };
}

// === CÁLCULO DE VIABILIDADE IFOOD (PROMOÇÕES HITS, ADS & EMBALAGEM) ===
export interface IfoodViabilityParams {
  priceIfood: number;
  cmv: number;
  commissionPct?: number; // Ex: 0.23 (23%)
  paymentFeePct?: number; // Ex: 0.032 (3.2%)
  packagingCost?: number; // Ex: R$ 2.50
  adsCostPerOrder?: number; // Ex: R$ 2.00 (rateio de iFood Ads)
  hitsDiscount?: number; // Ex: R$ 10.00 (desconto do lanche bancado pela loja)
}

export interface IfoodViabilityResult {
  normalPrice: number;
  normalFees: number;
  normalNetRevenue: number;
  normalNetProfit: number;
  normalMarginPct: number;

  hitsEffectivePrice: number;
  hitsFees: number;
  hitsNetRevenue: number;
  hitsNetProfit: number;
  hitsMarginPct: number;
  hitsStatus: 'viavel' | 'alerta' | 'prejuizo';
  suggestedMinPriceForHits: number;
}

export function calculateIfoodViability(params: IfoodViabilityParams): IfoodViabilityResult {
  const {
    priceIfood,
    cmv,
    commissionPct = 0.23,
    paymentFeePct = 0.032,
    packagingCost = 2.50,
    adsCostPerOrder = 2.00,
    hitsDiscount = 10.00
  } = params;

  const totalFeePct = commissionPct + paymentFeePct;

  // 1. Cenário Normal (Preço Cheio Orgânico)
  const normalFees = priceIfood * totalFeePct;
  const normalNetRevenue = priceIfood - normalFees - packagingCost;
  const normalNetProfit = normalNetRevenue - cmv;
  const normalMarginPct = priceIfood > 0 ? (normalNetProfit / priceIfood) * 100 : 0;

  // 2. Cenário Promoção Hits (Desconto bancado pela loja + tráfego Ads da loja)
  const hitsEffectivePrice = Math.max(0, priceIfood - hitsDiscount);
  const hitsFees = hitsEffectivePrice * totalFeePct;
  const hitsNetRevenue = hitsEffectivePrice - hitsFees - packagingCost - adsCostPerOrder;
  const hitsNetProfit = hitsNetRevenue - cmv;
  const hitsMarginPct = hitsEffectivePrice > 0 ? (hitsNetProfit / hitsEffectivePrice) * 100 : (hitsNetProfit < 0 ? -100 : 0);

  let hitsStatus: 'viavel' | 'alerta' | 'prejuizo' = 'viavel';
  if (hitsNetProfit <= 0 || hitsMarginPct < 5) {
    hitsStatus = 'prejuizo';
  } else if (hitsMarginPct < 18) {
    hitsStatus = 'alerta';
  }

  // 3. Preço Mínimo Recomendado no iFood para poder participar do Hits mantendo 18% de margem
  const targetMargin = 0.18;
  const denominator = 1 - totalFeePct - targetMargin;
  let suggestedMinPrice = priceIfood;
  if (denominator > 0) {
    const requiredEffective = (packagingCost + adsCostPerOrder + cmv) / denominator;
    suggestedMinPrice = Math.ceil((requiredEffective + hitsDiscount) * 10) / 10;
  }

  return {
    normalPrice: priceIfood,
    normalFees: Number(normalFees.toFixed(2)),
    normalNetRevenue: Number(normalNetRevenue.toFixed(2)),
    normalNetProfit: Number(normalNetProfit.toFixed(2)),
    normalMarginPct: Number(normalMarginPct.toFixed(1)),

    hitsEffectivePrice: Number(hitsEffectivePrice.toFixed(2)),
    hitsFees: Number(hitsFees.toFixed(2)),
    hitsNetRevenue: Number(hitsNetRevenue.toFixed(2)),
    hitsNetProfit: Number(hitsNetProfit.toFixed(2)),
    hitsMarginPct: Number(hitsMarginPct.toFixed(1)),
    hitsStatus,
    suggestedMinPriceForHits: Number(suggestedMinPrice.toFixed(2))
  };
}
