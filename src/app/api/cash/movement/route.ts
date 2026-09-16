import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CashMovementPayload {
  sessionId?: string;
  type: 'sangria' | 'suprimento';
  amount: number;
  description: string;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(['admin', 'gerente', 'caixa']);
    requireSameOrigin(request);

    const body = (await readJsonBody(request, 50_000)) as CashMovementPayload;
    if (!body || typeof body !== 'object') {
      throw new AccessError(400, 'Dados da movimentação inválidos.');
    }

    const { sessionId, type, amount, description } = body;

    if (!['sangria', 'suprimento'].includes(type)) {
      throw new AccessError(400, 'Tipo de movimentação inválido (use sangria ou suprimento).');
    }

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new AccessError(400, 'O valor da movimentação deve ser maior que zero.');
    }

    if (!description || typeof description !== 'string' || description.trim().length < 3) {
      throw new AccessError(400, 'Informe um motivo/descrição com pelo menos 3 caracteres.');
    }

    const validSessionId = sessionId && UUID_REGEX.test(sessionId) ? sessionId : null;

    const db = createServerDatabase();
    const { data, error } = await db.rpc('record_cash_movement_transaction', {
      p_session_id: validSessionId,
      p_type: type,
      p_amount: amount,
      p_description: description.trim(),
      p_operator_name: session.userName,
    });

    if (error) {
      console.error('[Cash Movement Error]:', error);
      throw new AccessError(400, error.message || 'Falha ao registrar movimentação de caixa.');
    }

    return Response.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return apiError(error);
  }
}
