import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';
import { validateCheckoutPricing } from '@/lib/checkout-pricing';
import { buildSaleItemKitchenSnapshot } from '@/lib/kitchen-calculator';

interface SaleItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  isGift?: boolean;
  giftReason?: string;
  giftNotes?: string;
  comboId?: string;
  combo?: string;
  comboPrice?: number;
  meatPoint?: string;
  removals?: string[];
  additionals?: {
    id?: string;
    name: string;
    quantity?: number;
    unitPrice?: number;
    price: number;
    productId?: string;
    ingredientId?: string;
  }[];
  notes?: string;
  recipeVersion?: number;
  productionSnapshot?: any;
}

interface SaleInput {
  id: string;
  channel: 'balcao' | 'ifood';
  total: number;
  subtotal?: number;
  discount?: number;
  discountReason?: string;
  deliveryFee?: number;
  storeCouponSubsidy?: number;
  paymentMethod: string;
  paidMethod?: string;
  paymentStatus?: 'pago' | 'pendente_retirada';
  paidAt?: string;
  customerName?: string;
  orderType?: 'mesa' | 'retirada' | 'delivery';
  productionStatus?: 'em_espera' | 'agendado' | 'em_producao' | 'concluido';
  productionStartedAt?: string;
  targetPrepMinutes?: number;
  items: SaleItemInput[];
  date?: string;
  collaboratorId?: string;
  collaboratorName?: string;
  creditCustomerName?: string;
  creditDueDate?: string;
  creditNotes?: string;
  creditStatus?: 'pendente' | 'quitado';
}

interface CheckoutPayload {
  idempotencyKey: string;
  sale: SaleInput;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    // 1. Autorização estrita: somente caixa, gerente ou administrador
    const session = await requireSession(['admin', 'gerente', 'caixa']);
    requireSameOrigin(request);

    // 2. Leitura e validação do corpo da requisição
    const body = (await readJsonBody(request, 500_000)) as CheckoutPayload;
    if (!body || typeof body !== 'object') {
      throw new AccessError(400, 'Corpo da requisição inválido.');
    }

    const { idempotencyKey, sale } = body;

    // 3. Validação da chave de idempotência
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8) {
      throw new AccessError(400, 'Chave de idempotência ausente ou inválida.');
    }

    // 4. Validação da estrutura do pedido
    if (!sale || typeof sale !== 'object') {
      throw new AccessError(400, 'Dados da venda ausentes.');
    }

    if (!sale.id || typeof sale.id !== 'string' || !UUID_REGEX.test(sale.id)) {
      throw new AccessError(400, 'ID da venda deve ser um UUID válido.');
    }

    if (!['balcao', 'ifood'].includes(sale.channel)) {
      throw new AccessError(400, 'Canal de venda inválido (balcao ou ifood).');
    }

    if (!Array.isArray(sale.items) || sale.items.length === 0 || sale.items.length > 200) {
      throw new AccessError(400, 'O pedido deve conter pelo menos 1 item.');
    }

    const subtotal = Number(sale.subtotal ?? sale.total);
    const discount = Number(sale.discount ?? 0);
    const deliveryFee = Number(sale.deliveryFee ?? 0);
    const total = Number(sale.total);

    if (!Number.isFinite(subtotal) || subtotal < 0) throw new AccessError(400, 'Subtotal inválido.');
    if (!Number.isFinite(discount) || discount < 0) throw new AccessError(400, 'Desconto inválido.');
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) throw new AccessError(400, 'Taxa de entrega inválida.');
    if (!Number.isFinite(total) || total < 0) throw new AccessError(400, 'Total da venda não pode ser negativo.');

    // 5. Validação matemática do total (tolerância de arredondamento de 5 centavos)
    const computedExpectedTotal = Math.max(0, subtotal - discount + deliveryFee);
    if (Math.abs(computedExpectedTotal - total) > 0.05) {
      throw new AccessError(400, `Divergência matemática no total do pedido: informado R$ ${total.toFixed(2)}, esperado R$ ${computedExpectedTotal.toFixed(2)}.`);
    }

    // Validação de cada item
    for (const item of sale.items) {
      if (!item || (item.additionals !== undefined && (!Array.isArray(item.additionals) || item.additionals.length > 100 || item.additionals.some(add => !add || typeof add !== 'object')))) throw new AccessError(400, 'Itens ou adicionais inválidos.');
      if (!item.productName || typeof item.productName !== 'string') {
        throw new AccessError(400, 'Nome do produto obrigatório.');
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        throw new AccessError(400, `Quantidade inválida para o produto "${item.productName}".`);
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        throw new AccessError(400, `Preço unitário inválido para o produto "${item.productName}".`);
      }
    }

    // Recalculate against the authoritative catalog before making any sale mutation.
    const pricingDb = createServerDatabase();
    const { data: previous, error: previousError } = await pricingDb.from('idempotency_keys').select('response,status').eq('key', idempotencyKey.trim()).eq('sale_id', sale.id).maybeSingle();
    if (previousError) throw new AccessError(503, 'Não foi possível conferir um envio anterior. Tente novamente.');
    if (previous?.status === 'completed' && previous.response) return Response.json(previous.response, { headers: { 'Cache-Control': 'no-store' } });
    const pricingIds = [...new Set(sale.items.flatMap(item => [item.productId, item.comboId, ...(item.additionals || []).map(add => add.productId || add.id)].filter((id): id is string => Boolean(id))))];
    if (pricingIds.some(id => !UUID_REGEX.test(id))) throw new AccessError(400, 'Produto, combo ou adicional sem cadastro válido. Atualize o cardápio e revise o pedido.');
    const { data: pricingCatalog, error: pricingError } = await pricingDb.from('products').select('id,name,category,price_balcao,price_ifood,status,is_active').in('id', pricingIds);
    if (pricingError || !pricingCatalog) throw new AccessError(503, 'Não foi possível consultar os preços. O pedido permanece aguardando confirmação.');
    try { validateCheckoutPricing(sale, pricingCatalog); }
    catch (error) { throw new AccessError(400, error instanceof Error ? error.message : 'Revise os valores do pedido.'); }

    // 6. Validação no servidor contra produtos em rascunho ou inativos (V07)
    const db = createServerDatabase();
    const productIds = sale.items
      .map(i => i.productId)
      .filter(id => id && UUID_REGEX.test(id));

    if (productIds.length > 0) {
      try {
        const query = db.from('products').select('id, name, category, status, is_active');
        if (typeof (query as any)?.in === 'function') {
          const { data: dbProducts } = await (query as any).in('id', productIds);
          if (dbProducts && Array.isArray(dbProducts)) {
            for (const item of sale.items) {
              const match = dbProducts.find((p: any) => p.id === item.productId);
              if (match) {
                if (match.status === 'rascunho' || match.is_active === false) {
                  throw new AccessError(400, `O produto "${match.name}" está em rascunho ou inativo e não pode ser vendido.`);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof AccessError) throw err;
      }
    }

    // 7. Garantir Snapshot Imutável de Produção da Cozinha para cada Item
    const itemsNeedingSnapshot = sale.items.filter(
      i => i.productId && UUID_REGEX.test(i.productId)
    );

    if (itemsNeedingSnapshot.length > 0) {
      try {
        const recQuery = db.from('recipes').select('*');
        const [recRes, invRes, compRes, prodRes] = await Promise.all([
          recQuery,
          db.from('inventory').select('*'),
          db.from('kitchen_components').select('*'),
          db.from('products').select('*')
        ]);

        // Older installations may not have applied the optional kitchen migration yet.
        // Only tolerate a missing table, never permissions, network or other database failures.
        const missingComponents = compRes.error?.code === 'PGRST205' || compRes.error?.code === '42P01';
        if ([recRes, invRes, prodRes].some(result => result.error) || (compRes.error && !missingComponents)) {
          console.error('[Checkout composition]', { recipes: recRes.error, inventory: invRes.error, components: compRes.error, products: prodRes.error });
          throw new AccessError(503, 'Não foi possível consultar a composição no banco. O pedido permanece na fila para nova tentativa.');
        }
        const recipes = recRes.data || [];
        const inventory = invRes.data || [];
        const components = compRes.data || [];

        for (const item of sale.items) {
          if (item.productId && UUID_REGEX.test(item.productId)) {
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

            const catalog = (prodRes.data || []).map((p: any) => ({
              id: p.id, name: p.name, category: p.category, priceBalcao: Number(p.price_balcao), priceIfood: Number(p.price_ifood), recipe: recipes.filter((r: any) => r.product_id === p.id).map((r: any) => ({
                ingredientId: r.ingredient_id, quantity: Number(r.quantity), kitchenComponentId: r.kitchen_component_id || undefined,
                productionStation: r.production_station || undefined, productionKind: r.production_kind || undefined,
              })),
            }));
            const structuredSnap = buildSaleItemKitchenSnapshot(item as any, catalog, mappedInv, mappedComps.length > 0 ? mappedComps : undefined);
            if (missingComponents) {
              structuredSnap.components = [];
              structuredSnap.pendingReview = ['Configuração de cozinha indisponível. Confira a ficha do item antes de produzir e solicite a atualização do banco.'];
            }
            item.productionSnapshot = {
              ...(item.productionSnapshot || {}),
              structuredProduction: structuredSnap,
              discountReason: sale.discount ? sale.discountReason?.trim() : undefined,
            };
          }
        }
      } catch (err) {
        if (err instanceof AccessError) throw err;
        throw new AccessError(503, 'Não foi possível confirmar a composição. Tente novamente.');
      }
    }

    // 8. Execução atômica no banco via RPC com service_role
    const { data, error } = await db.rpc('process_sale_checkout', {
      p_idempotency_key: idempotencyKey.trim(),
      p_sale: sale,
      p_operator_id: session.collaboratorId,
      p_operator_name: session.userName,
      p_operator_role: session.role,
    });

    if (error) {
      console.error('[Checkout RPC Error]:', error);
      throw new AccessError(500, error.message || 'Falha ao processar transação de venda.');
    }

    return Response.json(data, {
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
