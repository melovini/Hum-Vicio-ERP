// Prices must be resolved from the server catalog, including each modifier.
export function validateCheckoutPricing(sale: any, catalog: any[]): void {
  const byId = new Map(catalog.map(product => [product.id, product]));
  const find = (id: string) => {
    const product = byId.get(id);
    if (!product || product.is_active === false || ['rascunho', 'inativo'].includes(product.status)) throw new Error('Produto indisponível. Atualize o cardápio e revise o pedido.');
    return product;
  };
  const price = (product: any) => {
    const value = Number(sale.channel === 'ifood' ? product.price_ifood ?? product.price_balcao : product.price_balcao);
    if (!Number.isFinite(value) || value < 0) throw new Error('Preço do cadastro inválido. Solicite a revisão ao gestor.');
    return Math.round(value * 100);
  };
  let subtotal = 0;
  for (const item of sale.items) {
    let unit = price(find(item.productId));
    if (item.comboId || item.combo) {
      const combo = find(item.comboId);
      if (combo.category !== 'combo') throw new Error('Combo inválido. Revise o pedido.');
      unit += price(combo);
    }
    for (const additional of item.additionals || []) {
      const count = additional.quantity ?? 1;
      if (!Number.isInteger(count) || count <= 0) throw new Error('Quantidade de adicional inválida.');
      unit += price(find(additional.productId || additional.id)) * count;
    }
    if (item.isGift) {
      if (typeof item.giftReason !== 'string' || !item.giftReason.trim()) throw new Error('Informe o motivo do brinde.');
      if (item.giftReason === 'outro' && (typeof item.giftNotes !== 'string' || !item.giftNotes.trim())) throw new Error('Descreva o motivo do brinde.');
      unit = 0;
    }
    if (!Number.isFinite(item.unitPrice) || Math.abs(Math.round(item.unitPrice * 100) - unit) > 1) {
      throw new Error('O preço do pedido difere do cadastro. Atualize o cardápio e revise o pedido antes de reenviar.');
    }
    subtotal += unit * item.quantity;
  }
  const sentSubtotal = Number(sale.subtotal ?? sale.total);
  if (!Number.isFinite(sentSubtotal) || Math.abs(Math.round(sentSubtotal * 100) - subtotal) > 1) throw new Error('O subtotal não corresponde aos itens do pedido.');
  const discount = Number(sale.discount ?? 0);
  if (discount > 0 && (typeof sale.discountReason !== 'string' || !sale.discountReason.trim())) throw new Error('Informe a justificativa do desconto.');
  if (!Number.isFinite(discount) || discount < 0 || Math.round(discount * 100) > subtotal) throw new Error('Desconto inválido para este pedido.');
}
