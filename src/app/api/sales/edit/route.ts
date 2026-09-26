import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';
import { validateCheckoutPricing } from '@/lib/checkout-pricing';
import { buildSaleItemKitchenSnapshot } from '@/lib/kitchen-calculator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface EditSalePayload {
  saleId: string;
  items: any[];
  customerName?: string;
  orderType?: 'mesa' | 'retirada' | 'delivery';
  channel?: 'balcao' | 'ifood';
  discount?: number;
  discountReason?: string;
  deliveryFee?: number;
  subtotal?: number;
  total?: number;
  editReason?: string;
  productionStatus?: string;
  notes?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Autorização estrita: somente caixa, gerente ou administrador
    const session = await requireSession(['admin', 'gerente', 'caixa']);
    requireSameOrigin(request);

    // 2. Leitura e validação do corpo da requisição
    const body = (await readJsonBody(request, 500_000)) as EditSalePayload;
    if (!body || typeof body !== 'object') {
      throw new AccessError(400, 'Corpo da requisição inválido.');
    }

    const {
      saleId,
      items,
      customerName,
      orderType,
      channel,
      discount = 0,
      discountReason,
      deliveryFee = 0,
      subtotal: rawSubtotal,
      total: rawTotal,
      editReason = 'Ajuste de comanda pelo operador',
      productionStatus
    } = body;

    // 3. Validação do ID da venda
    if (!saleId || typeof saleId !== 'string' || !UUID_REGEX.test(saleId)) {
      throw new AccessError(400, 'ID da comanda deve ser um UUID válido.');
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
      throw new AccessError(400, 'A comanda deve conter pelo menos 1 item.');
    }

    const db = createServerDatabase();

    // 4. Buscar venda existente no banco
    const { data: existingSale, error: saleError } = await db
      .from('sales')
      .select('*, sale_items(*)')
      .eq('id', saleId)
      .single();

    if (saleError || !existingSale) {
      throw new AccessError(404, 'Comanda não encontrada para edição.');
    }

    if (existingSale.status === 'cancelled') {
      throw new AccessError(400, 'Comanda cancelada não pode ser editada.');
    }

    const effectiveChannel = channel || existingSale.channel || 'balcao';
    if (!['balcao', 'ifood'].includes(effectiveChannel)) {
      throw new AccessError(400, 'Canal de venda inválido.');
    }

    // 5. Validação autoritativa de preços no servidor com catálogo atual
    const pricingIds = [...new Set(items.flatMap(item => [
      item.productId,
      item.comboId,
      ...(item.additionals || []).map((add: any) => add.productId || add.id)
    ].filter((id): id is string => Boolean(id))))];

    if (pricingIds.some(id => !UUID_REGEX.test(id))) {
      throw new AccessError(400, 'Produto, combo ou adicional sem cadastro válido. Revise o cardápio.');
    }

    const { data: pricingCatalog, error: pricingError } = await db
      .from('products')
      .select('id, name, category, price_balcao, price_ifood, status, is_active')
      .in('id', pricingIds);

    if (pricingError || !pricingCatalog) {
      throw new AccessError(503, 'Não foi possível consultar os preços oficiais no cardápio.');
    }

    const saleForPricingValidation = {
      channel: effectiveChannel,
      subtotal: rawSubtotal,
      total: rawTotal,
      discount,
      discountReason,
      items,
    };

    try {
      validateCheckoutPricing(saleForPricingValidation, pricingCatalog);
    } catch (err: any) {
      throw new AccessError(400, err?.message || 'Validação de preços falhou.');
    }

    const finalSubtotal = Number(rawSubtotal ?? rawTotal ?? 0);
    const finalDiscount = Number(discount ?? 0);
    const finalDeliveryFee = Number(deliveryFee ?? 0);
    const finalTotal = Math.max(0, finalSubtotal - finalDiscount + finalDeliveryFee);

    // 6. Reconstituição do Snapshot de Produção da Cozinha para cada Item
    const recQuery = db.from('recipes').select('*');
    const [recRes, invRes, compRes, prodRes] = await Promise.all([
      recQuery,
      db.from('inventory').select('*'),
      db.from('kitchen_components').select('*'),
      db.from('products').select('*')
    ]);

    const recipes = recRes.data || [];
    const inventory = invRes.data || [];
    const components = compRes.data || [];
    const allProducts = prodRes.data || [];

    const mappedInv: any = inventory.map((i: any) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      category: i.category,
      station: i.station,
      productionStation: i.production_station,
      productionKind: i.production_kind,
      portionWeight: i.portion_weight ? Number(i.portion_weight) : undefined,
      portionUnit: i.portion_unit,
      kitchenComponentId: i.kitchen_component_id,
    }));

    const mappedComps: any = components.map((c: any) => ({
      id: c.id,
      name: c.name,
      componentType: c.component_type,
      station: c.station,
      productionUnit: c.production_unit,
      portionWeight: c.portion_weight ? Number(c.portion_weight) : undefined,
      portionUnit: c.portion_unit,
      showInSummary: c.show_in_summary !== false,
      isActive: c.is_active !== false,
    }));

    const catalogWithRecipes = allProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      priceBalcao: Number(p.price_balcao),
      priceIfood: Number(p.price_ifood),
      recipe: recipes.filter((r: any) => r.product_id === p.id).map((r: any) => ({
        ingredientId: r.ingredient_id,
        quantity: Number(r.quantity),
        kitchenComponentId: r.kitchen_component_id || undefined,
        productionStation: r.production_station || undefined,
        productionKind: r.production_kind || undefined,
      })),
    }));

    const normalizedNewItems = items.map((item: any) => {
      const structuredSnap = buildSaleItemKitchenSnapshot(item, catalogWithRecipes, mappedInv, mappedComps.length > 0 ? mappedComps : undefined);
      return {
        ...item,
        notes: item.notes?.trim() ? item.notes.trim().toUpperCase() : undefined,
        productionSnapshot: {
          ...(item.productionSnapshot || {}),
          structuredProduction: structuredSnap,
          discountReason: finalDiscount ? discountReason?.trim() : undefined,
        }
      };
    });

    // 7. Calcular Diferencial da Cozinha (Diff)
    const oldItems: any[] = existingSale.sale_items || existingSale.items || [];
    const added: any[] = [];
    const removed: any[] = [];
    const modified: any[] = [];

    normalizedNewItems.forEach(newItem => {
      const matchOld = oldItems.find(o => (o.product_id || o.productId) === newItem.productId && (o.notes || '') === (newItem.notes || ''));
      if (!matchOld) {
        added.push(newItem);
      } else if (newItem.quantity > matchOld.quantity) {
        added.push({ ...newItem, quantity: newItem.quantity - matchOld.quantity });
      }
    });

    oldItems.forEach(oldItem => {
      const matchNew = normalizedNewItems.find(n => n.productId === (oldItem.product_id || oldItem.productId) && (n.notes || '') === (oldItem.notes || ''));
      if (!matchNew) {
        removed.push({ ...oldItem, productName: oldItem.product_name || oldItem.productName });
      } else if (matchNew.quantity < oldItem.quantity) {
        removed.push({ ...oldItem, productName: oldItem.product_name || oldItem.productName, quantity: oldItem.quantity - matchNew.quantity });
      }
    });

    normalizedNewItems.forEach(newItem => {
      const matchOld = oldItems.find(o => (o.product_id || o.productId) === newItem.productId);
      if (matchOld && (matchOld.notes || '') !== (newItem.notes || '')) {
        modified.push({
          item: newItem,
          oldNotes: matchOld.notes,
          newNotes: newItem.notes,
        });
      }
    });

    const orderDiff = { added, removed, modified };
    const hasDiff = added.length > 0 || removed.length > 0 || modified.length > 0;
    const isCurrentlyCooking = existingSale.production_status === 'em_producao';
    const effectiveProductionStatus = productionStatus || existingSale.production_status || 'em_espera';

    // 8. Reconciliação de Estoque por Delta
    // Calcula o consumo anterior vs o novo consumo de ingredientes
    const ingredientDeltas = new Map<string, number>();

    // Subtrai o consumo anterior
    for (const oldIt of oldItems) {
      const prod = catalogWithRecipes.find(p => p.id === (oldIt.product_id || oldIt.productId));
      const q = oldIt.quantity || 1;
      if (prod?.recipe) {
        for (const r of prod.recipe) {
          const prev = ingredientDeltas.get(r.ingredientId) || 0;
          ingredientDeltas.set(r.ingredientId, prev - (r.quantity * q));
        }
      }
    }

    // Adiciona o novo consumo
    for (const newIt of normalizedNewItems) {
      const prod = catalogWithRecipes.find(p => p.id === newIt.productId);
      const q = newIt.quantity || 1;
      if (prod?.recipe) {
        for (const r of prod.recipe) {
          const prev = ingredientDeltas.get(r.ingredientId) || 0;
          ingredientDeltas.set(r.ingredientId, prev + (r.quantity * q));
        }
      }
    }

    // Aplica o delta no estoque se houver variação
    for (const [ingId, delta] of ingredientDeltas.entries()) {
      if (Math.abs(delta) > 0.0001) {
        // Se delta > 0: consumiu mais, então current_stock diminui
        // Se delta < 0: consumiu menos, então current_stock aumenta (estorno parcial)
        const currentInv = inventory.find((i: any) => i.id === ingId);
        if (currentInv) {
          const prevStock = Number(currentInv.current_stock || 0);
          const newStock = prevStock - delta;
          await db.from('inventory').update({ current_stock: newStock }).eq('id', ingId);
          await db.from('inventory_movements').insert({
            ingredient_id: ingId,
            quantity_delta: -delta,
            previous_stock: prevStock,
            new_stock: newStock,
            movement_type: 'venda',
            reference_id: saleId,
            operator: session.userName,
            notes: `Ajuste de estoque por edição de comanda: ${delta > 0 ? 'consumo adicional' : 'estorno parcial'}`
          });
        }
      }
    }

    // 9. Atualizar Cabeçalho da Venda em `sales`
    const saleUpdatePayload: Record<string, any> = {
      total: finalTotal,
      subtotal: finalSubtotal,
      discount: finalDiscount,
      discount_reason: finalDiscount > 0 ? (discountReason || existingSale.discount_reason) : null,
      delivery_fee: finalDeliveryFee,
      customer_name: customerName || existingSale.customer_name,
      order_type: orderType || existingSale.order_type,
      channel: effectiveChannel,
      production_status: effectiveProductionStatus,
      is_reopened: true,
      reopened_at: new Date().toISOString(),
      reopened_by: session.userName,
    };

    if (isCurrentlyCooking && hasDiff) {
      saleUpdatePayload.delay_notes = JSON.stringify({ tag: 'KITCHEN_DIFF', orderDiff });
    }

    const { error: updateSaleError } = await db
      .from('sales')
      .update(saleUpdatePayload)
      .eq('id', saleId);

    if (updateSaleError) {
      throw new AccessError(500, 'Falha ao atualizar cabeçalho da comanda no banco.');
    }

    // 10. Atualizar Linhas em `sale_items` (In-place para auditoria antifraude)
    const { data: existingRows } = await db
      .from('sale_items')
      .select('id')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true });

    const reusableCount = Math.min((existingRows || []).length, normalizedNewItems.length);

    // Atualiza itens reutilizáveis
    for (let i = 0; i < reusableCount; i++) {
      const targetId = existingRows![i].id;
      const it = normalizedNewItems[i];
      await db.from('sale_items').update({
        product_id: it.productId,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        original_price: it.originalPrice,
        is_gift: Boolean(it.isGift),
        gift_reason: it.giftReason,
        gift_notes: it.giftNotes,
        combo_id: it.comboId,
        combo: it.combo,
        meat_point: it.meatPoint,
        removals: it.removals || [],
        additionals: it.additionals || [],
        notes: it.notes,
        recipe_version: it.recipeVersion || 1,
        production_snapshot: it.productionSnapshot
      }).eq('id', targetId);
    }

    // Insere excedentes se houver mais itens que antes
    if (normalizedNewItems.length > reusableCount) {
      const toInsert = normalizedNewItems.slice(reusableCount).map(it => ({
        sale_id: saleId,
        product_id: it.productId,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        original_price: it.originalPrice,
        is_gift: Boolean(it.isGift),
        gift_reason: it.giftReason,
        gift_notes: it.giftNotes,
        combo_id: it.comboId,
        combo: it.combo,
        meat_point: it.meatPoint,
        removals: it.removals || [],
        additionals: it.additionals || [],
        notes: it.notes,
        recipe_version: it.recipeVersion || 1,
        production_snapshot: it.productionSnapshot
      }));
      await db.from('sale_items').insert(toInsert);
    }

    // Remove excedentes se houver menos itens que antes
    if ((existingRows || []).length > normalizedNewItems.length) {
      const idsToRemove = existingRows!.slice(normalizedNewItems.length).map(r => r.id);
      await db.from('sale_items').delete().in('id', idsToRemove);
    }

    // 11. Auditoria Confiável no Servidor
    await db.from('audit_logs').insert({
      action: 'EDICAO_PEDIDO',
      operator: session.userName,
      details: `Comanda #${saleId.slice(0, 6).toUpperCase()} editada por ${session.userName}. Total: R$ ${Number(existingSale.total).toFixed(2)} -> R$ ${finalTotal.toFixed(2)}. Motivo: ${editReason}. Adicionados: ${added.length}, Removidos: ${removed.length}, Modificados: ${modified.length}.`,
      value_before: `R$ ${Number(existingSale.total).toFixed(2)}`,
      value_after: `R$ ${finalTotal.toFixed(2)}`,
      created_at: new Date().toISOString()
    });

    const updatedSaleResult = {
      ...existingSale,
      ...saleUpdatePayload,
      items: normalizedNewItems,
      orderDiff,
      isModifiedInKitchen: isCurrentlyCooking && hasDiff,
    };

    return Response.json({
      success: true,
      sale: updatedSaleResult,
      diff: orderDiff,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    return apiError(error);
  }
}
