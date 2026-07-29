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
