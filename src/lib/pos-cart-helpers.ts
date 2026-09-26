import { Product, SaleItem, SaleItemAdditional } from '@/lib/store/types';

/**
 * Gera um ID único e estável para a linha do carrinho (UUID v4)
 */
export function generateCartItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Determina se o produto exige definição de ponto da carne
 * Respeita a propriedade explícita do cadastro ou usa fallback revisável para lanches bovinos
 */
export function isProductRequiringMeatPoint(product: Partial<Product>): boolean {
  if (product.requiresMeatPoint !== undefined) {
    return Boolean(product.requiresMeatPoint);
  }
  if (product.category !== 'lanche') {
    return false;
  }
  const name = (product.name || '').toLowerCase();
  if (name.includes('frango') || name.includes('estados unidos') || name.includes('eua') || name.includes('queijo empanado')) {
    return false;
  }
  return true;
}

/**
 * Retorna o ponto padrão da carne cadastrado ou 'AO PONTO'
 */
export function getDefaultMeatPoint(product: Partial<Product>): string {
  return product.defaultMeatPoint || 'AO PONTO';
}

export interface CreateCartItemOptions {
  mode?: 'simples' | 'combo';
  comboProduct?: Product | null;
  meatPoint?: string;
  removals?: string[];
  additionals?: SaleItemAdditional[];
  notes?: string;
  quantity?: number;
}

/**
 * Função pura que constrói um SaleItem canônico com ID estável e valores autoritativos
 */
export function createCartItemFromProduct(
  product: Product,
  channel: 'balcao' | 'ifood',
  options: CreateCartItemOptions = {}
): SaleItem {
  const basePrice = channel === 'ifood' ? (product.priceIfood ?? product.priceBalcao) : product.priceBalcao;
  const isComboMode = options.mode === 'combo' && options.comboProduct && options.comboProduct.category === 'combo';
  
  let comboPrice = 0;
  let comboId: string | undefined = undefined;
  let comboName: string | undefined = undefined;

  if (isComboMode && options.comboProduct) {
    comboPrice = channel === 'ifood' ? (options.comboProduct.priceIfood ?? options.comboProduct.priceBalcao) : options.comboProduct.priceBalcao;
    comboId = options.comboProduct.id;
    comboName = options.comboProduct.name;
  }

  // Preço dos adicionais se houver
  let additionalsTotal = 0;
  const sanitizedAdditionals: SaleItemAdditional[] = [];
  if (Array.isArray(options.additionals)) {
    for (const add of options.additionals) {
      const qty = add.quantity || 1;
      const unit = add.unitPrice || (add.price ? add.price / qty : 0);
      const total = Number((unit * qty).toFixed(2));
      additionalsTotal += total;
      sanitizedAdditionals.push({
        ...add,
        quantity: qty,
        unitPrice: unit,
        price: total,
      });
    }
  }

  const finalUnitPrice = Number((basePrice + comboPrice + additionalsTotal).toFixed(2));

  // Ponto da carne (apenas se o produto exigir)
  let meatPoint: string | undefined = undefined;
  if (isProductRequiringMeatPoint(product)) {
    meatPoint = options.meatPoint || getDefaultMeatPoint(product);
  }

  return {
    id: generateCartItemId(),
    productId: product.id,
    productName: product.name,
    quantity: Math.max(1, options.quantity || 1),
    unitPrice: finalUnitPrice,
    comboId,
    combo: comboName,
    comboPrice: comboPrice > 0 ? comboPrice : undefined,
    meatPoint,
    removals: options.removals && options.removals.length > 0 ? [...options.removals] : undefined,
    additionals: sanitizedAdditionals.length > 0 ? sanitizedAdditionals : undefined,
    notes: options.notes?.trim() ? options.notes.trim().toUpperCase() : undefined,
  };
}

/**
 * Gera uma assinatura canônica normalizada da configuração do item.
 * Linhas com a mesma assinatura podem ser agrupadas somando quantidade.
 */
export function computeCartItemSignature(item: SaleItem): string {
  const parts: string[] = [];

  parts.push(`prod:${item.productId}`);
  parts.push(`price:${Number(item.unitPrice).toFixed(2)}`);
  parts.push(`comboId:${item.comboId || ''}`);
  parts.push(`meatPoint:${(item.meatPoint || '').trim().toUpperCase()}`);

  // Retiradas ordenadas
  const removals = (item.removals || [])
    .map(r => r.trim().toUpperCase())
    .filter(Boolean)
    .sort();
  parts.push(`removals:${removals.join('|')}`);

  // Adicionais ordenados por identificador
  const additionals = (item.additionals || [])
    .map(a => `${a.id || a.productId || a.name}:${a.quantity || 1}:${Number(a.unitPrice || 0).toFixed(2)}`)
    .sort();
  parts.push(`additionals:${additionals.join('|')}`);

  // Observações livres
  parts.push(`notes:${(item.notes || '').trim().toUpperCase()}`);

  // Brinde e justificativa (itens de brinde NUNCA se agrupam com itens normais)
  parts.push(`isGift:${Boolean(item.isGift)}`);
  parts.push(`giftReason:${item.giftReason || ''}`);
  parts.push(`giftNotes:${(item.giftNotes || '').trim().toUpperCase()}`);

  return parts.join(';;');
}

/**
 * Adiciona um item ao carrinho ou agrupa com linha existente de mesma assinatura.
 * Não altera a quantidade de brindes nem de itens com configurações distintas.
 */
export function addOrMergeCartItem(cart: SaleItem[], newItem: SaleItem): SaleItem[] {
  // Brindes nunca sofrem fusão silenciosa
  if (newItem.isGift) {
    return [...cart, newItem];
  }

  const newSig = computeCartItemSignature(newItem);
  const matchIndex = cart.findIndex(existing => !existing.isGift && computeCartItemSignature(existing) === newSig);

  if (matchIndex >= 0) {
    return cart.map((item, idx) => {
      if (idx === matchIndex) {
        return {
          ...item,
          quantity: item.quantity + (newItem.quantity || 1),
        };
      }
      return item;
    });
  }

  return [...cart, newItem];
}

/**
 * Desmembra unidades de um item quando a quantidade for maior que 1.
 * Retorna o item restante com a quantidade reduzida e a unidade extraída com novo ID estável.
 */
export function splitCartItem(
  item: SaleItem,
  countToExtract: number = 1
): { remaining: SaleItem; extracted: SaleItem } {
  if (item.quantity <= countToExtract) {
    throw new Error('Não é possível desmembrar toda a quantidade do item.');
  }

  const remaining: SaleItem = {
    ...item,
    quantity: item.quantity - countToExtract,
  };

  const extracted: SaleItem = {
    ...item,
    id: generateCartItemId(),
    quantity: countToExtract,
  };

  return { remaining, extracted };
}

/**
 * Atualiza um item na lista do carrinho localizando-o pelo seu ID estável
 */
export function updateCartItemInList(
  cart: SaleItem[],
  itemId: string,
  updatedItem: SaleItem
): SaleItem[] {
  return cart.map(item => (item.id === itemId ? { ...updatedItem, id: itemId } : item));
}

/**
 * Remove um item do carrinho pelo seu ID estável
 */
export function removeCartItemFromList(
  cart: SaleItem[],
  itemId: string
): SaleItem[] {
  return cart.filter(item => item.id !== itemId);
}
