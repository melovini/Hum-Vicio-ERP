import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';

interface SaleItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  isGift?: boolean;
  giftReason?: string;
  giftNotes?: string;
  combo?: string;
  additionals?: { name: string; price: number; productId?: string; ingredientId?: string }[];
  notes?: string;
}

interface SaleInput {
  id: string;
  channel: 'balcao' | 'ifood';
  total: number;
  subtotal?: number;
  discount?: number;
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

    if (!Array.isArray(sale.items) || sale.items.length === 0) {
      throw new AccessError(400, 'O pedido deve conter pelo menos 1 item.');
    }

    const subtotal = Number(sale.subtotal ?? sale.total);
    const discount = Number(sale.discount ?? 0);
    const deliveryFee = Number(sale.deliveryFee ?? 0);
    const total = Number(sale.total);

    if (isNaN(subtotal) || subtotal < 0) throw new AccessError(400, 'Subtotal inválido.');
    if (isNaN(discount) || discount < 0) throw new AccessError(400, 'Desconto inválido.');
    if (isNaN(deliveryFee) || deliveryFee < 0) throw new AccessError(400, 'Taxa de entrega inválida.');
    if (isNaN(total) || total < 0) throw new AccessError(400, 'Total da venda não pode ser negativo.');

    // 5. Validação matemática do total (tolerância de arredondamento de 5 centavos)
    const computedExpectedTotal = Math.max(0, subtotal - discount + deliveryFee);
    if (Math.abs(computedExpectedTotal - total) > 0.05) {
      throw new AccessError(400, `Divergência matemática no total do pedido: informado R$ ${total.toFixed(2)}, esperado R$ ${computedExpectedTotal.toFixed(2)}.`);
    }

    // Validação de cada item
    for (const item of sale.items) {
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

    // 6. Execução atômica no banco via RPC com service_role
    const db = createServerDatabase();
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
