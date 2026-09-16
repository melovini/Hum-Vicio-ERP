import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SettlePaymentPayload {
  saleId: string;
  sessionId?: string;
  paymentMethod: string;
  settlementType: 'retirada' | 'fiado';
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(['admin', 'gerente', 'caixa']);
    requireSameOrigin(request);

    const body = (await readJsonBody(request, 50_000)) as SettlePaymentPayload;
    if (!body || typeof body !== 'object') {
      throw new AccessError(400, 'Dados da quitação inválidos.');
    }

    const { saleId, sessionId, paymentMethod, settlementType } = body;

    if (!saleId || typeof saleId !== 'string' || !UUID_REGEX.test(saleId)) {
      throw new AccessError(400, 'ID do pedido inválido.');
    }

    if (!paymentMethod || typeof paymentMethod !== 'string') {
      throw new AccessError(400, 'Forma de pagamento da quitação obrigatória.');
    }

    if (!['retirada', 'fiado'].includes(settlementType)) {
      throw new AccessError(400, 'Tipo de liquidação inválido.');
    }

    const validSessionId = sessionId && UUID_REGEX.test(sessionId) ? sessionId : null;

    const db = createServerDatabase();
    const { data, error } = await db.rpc('settle_order_payment_transaction', {
      p_sale_id: saleId,
      p_session_id: validSessionId,
      p_payment_method: paymentMethod.toLowerCase().trim(),
      p_operator_id: session.collaboratorId,
      p_operator_name: session.userName,
      p_settlement_type: settlementType,
    });

    if (error) {
      console.error('[Settlement Error]:', error);
      throw new AccessError(400, error.message || 'Falha ao processar quitação do pedido.');
    }

    return Response.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return apiError(error);
  }
}
