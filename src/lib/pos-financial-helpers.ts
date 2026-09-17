import { SaleItem, Product } from './store';

export interface CashChangeResult {
  isEnough: boolean;
  received: number;
  total: number;
  change: number;
  missing: number;
}

/**
 * Calcula o subtotal dos itens do carrinho.
 * Para brindes onde unitPrice já é 0, soma 0.
 */
export function calculateCartSubtotal(items: SaleItem[]): number {
  if (!items || !Array.isArray(items)) return 0;
  const rawSum = items.reduce((acc, item) => {
    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 0;
    const price = typeof item.unitPrice === 'number' && item.unitPrice > 0 ? item.unitPrice : 0;
    return acc + (price * qty);
  }, 0);
  return Number(rawSum.toFixed(2));
}

/**
 * Calcula a taxa de entrega garantindo que pedidos de balcão/mesa não cobrem taxa.
 */
export function calculateDeliveryFee(orderType: string, feeInput: string | number): number {
  if (orderType !== 'delivery') return 0;
  const num = typeof feeInput === 'number' ? feeInput : parseFloat(String(feeInput).replace(',', '.'));
  if (isNaN(num) || num <= 0) return 0;
  return Number(num.toFixed(2));
}

/**
 * Calcula o valor líquido do desconto em reais a partir de valor fixo ou porcentagem (ex: "10%").
 * O desconto nunca pode ser negativo nem ultrapassar o subtotal.
 */
export function calculateDiscount(discountInput: string | number, subtotal: number): number {
  if (subtotal <= 0) return 0;
  const str = String(discountInput || '').trim();
  if (!str) return 0;

  if (str.endsWith('%')) {
    const pct = parseFloat(str.replace('%', '').replace(',', '.'));
    if (isNaN(pct) || pct <= 0) return 0;
    const calculated = (subtotal * Math.min(100, pct)) / 100;
    return Number(Math.min(subtotal, calculated).toFixed(2));
  }

  const val = parseFloat(str.replace(',', '.'));
  if (isNaN(val) || val <= 0) return 0;
  return Number(Math.min(subtotal, val).toFixed(2));
}

/**
 * Calcula o total final da comanda: Subtotal - Desconto + Taxa de Entrega.
 * Nunca retorna valor negativo.
 */
export function calculateCartTotal(subtotal: number, discount: number, deliveryFee: number): number {
  const safeSubtotal = Math.max(0, subtotal || 0);
  const safeDiscount = Math.max(0, discount || 0);
  const safeFee = Math.max(0, deliveryFee || 0);
  const net = safeSubtotal - safeDiscount + safeFee;
  return Number(Math.max(0, net).toFixed(2));
}

/**
 * Calcula a suficiência e o troco para pagamento em dinheiro em espécie.
 */
export function calculateCashChange(cashReceivedInput: string | number, cartTotal: number): CashChangeResult {
  const safeTotal = Number(Math.max(0, cartTotal || 0).toFixed(2));
  const numReceived = typeof cashReceivedInput === 'number' 
    ? cashReceivedInput 
    : parseFloat(String(cashReceivedInput || '').replace(',', '.'));

  const safeReceived = isNaN(numReceived) || numReceived < 0 ? 0 : Number(numReceived.toFixed(2));

  if (safeReceived >= safeTotal) {
    return {
      isEnough: true,
      received: safeReceived,
      total: safeTotal,
      change: Number((safeReceived - safeTotal).toFixed(2)),
      missing: 0,
    };
  }

  return {
    isEnough: false,
    received: safeReceived,
    total: safeTotal,
    change: 0,
    missing: Number((safeTotal - safeReceived).toFixed(2)),
  };
}

/**
 * Normaliza as observações dos itens do carrinho para CAIXA ALTA (padrão de legibilidade para cozinha).
 */
export function normalizeCartItemNotes(cart: SaleItem[]): SaleItem[] {
  if (!cart || !Array.isArray(cart)) return [];
  return cart.map(item => ({
    ...item,
    notes: item.notes?.trim() ? item.notes.trim().toUpperCase() : undefined
  }));
}

/**
 * Calcula o valor em reais do subsídio do cupom iFood custeado pela loja.
 * Aplica-se exclusivamente quando o canal for iFood e a opção de cupom estiver marcada.
 */
export function calculateStoreCouponSubsidy(
  saleChannel: string,
  hasStoreCoupon: boolean,
  couponInput: string | number
): number {
  if (saleChannel !== 'ifood' || !hasStoreCoupon) return 0;
  const num = typeof couponInput === 'number' ? couponInput : parseFloat(String(couponInput).replace(',', '.'));
  if (isNaN(num) || num <= 0) return 0;
  return Number(num.toFixed(2));
}

/**
 * Recalcula os preços unitários de todos os itens do carrinho ao alternar entre canais (Balcão vs iFood).
 */
export function recalculateCartPrices(
  currentCart: SaleItem[],
  targetChannel: 'balcao' | 'ifood',
  productsList: Product[]
): SaleItem[] {
  if (!currentCart || !Array.isArray(currentCart)) return [];
  return currentCart.map(item => {
    const prod = productsList.find(
      p => p.id === item.productId || p.name.toLowerCase().trim() === item.productName.toLowerCase().trim()
    );
    if (!prod) return item;

    // 1. Preço base do produto no canal de destino
    const basePrice = targetChannel === 'ifood' ? prod.priceIfood : prod.priceBalcao;

    // 2. Preço de combos no canal de destino
    let comboPrice = 0;
    if (item.combo) {
      const cleanCombo = item.combo.toLowerCase().replace(/^combo:\s*/i, '').trim();
      const matchCombo = productsList.find(p => 
        p.category === 'combo' && (
          p.name.toLowerCase().trim() === item.combo!.toLowerCase().trim() ||
          p.name.toLowerCase().includes(cleanCombo) ||
          cleanCombo.includes(p.name.toLowerCase().replace(/^combo:\s*/i, '').trim())
        )
      );

      if (matchCombo) {
        comboPrice = targetChannel === 'ifood' 
          ? (matchCombo.priceIfood ?? matchCombo.priceBalcao) 
          : matchCombo.priceBalcao;
      } else {
        if (cleanCombo.includes('anéis') || cleanCombo.includes('aneis')) {
          comboPrice = targetChannel === 'ifood' ? 18.00 : 16.00;
        } else if (cleanCombo.includes('batata')) {
          comboPrice = targetChannel === 'ifood' ? 16.00 : 14.00;
        }
      }
    }

    // 3. Preço de adicionais no canal de destino
    let additionsTotal = 0;
    const updatedAdditionals = (item.additionals || []).map(add => {
      const cleanName = add.name.replace(/^\d+x\s*/, '').trim();
      const matchProd = productsList.find(p => 
        p.name === `Adicional: ${cleanName}` || 
        p.name === `Pote Maionese ${cleanName}` || 
        p.name.toLowerCase().includes(cleanName.toLowerCase())
      );
      const unitAddPrice = matchProd 
        ? (targetChannel === 'ifood' ? matchProd.priceIfood : matchProd.priceBalcao) 
        : (add.price || 5.00);

      const qtyMatch = add.name.match(/^(\d+)x/);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      additionsTotal += unitAddPrice * qty;
      return {
        ...add,
        price: unitAddPrice * qty,
      };
    });

    const newUnitPrice = item.isGift ? 0 : (basePrice + comboPrice + additionsTotal);

    return {
      ...item,
      unitPrice: newUnitPrice,
      comboPrice: comboPrice > 0 ? comboPrice : undefined,
      additionals: updatedAdditionals.length > 0 ? updatedAdditionals : item.additionals,
    };
  });
}

