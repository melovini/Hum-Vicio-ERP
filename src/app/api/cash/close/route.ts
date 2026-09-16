import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CloseCashPayload {
  sessionId: string;
  finalAmount: number;
  expectedAmount?: number;
  varianceAmount?: number;
  closingDetails?: Record<string, unknown>;
  notes?: string;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(['admin', 'gerente', 'caixa']);
    requireSameOrigin(request);

    const body = (await readJsonBody(request, 100_000)) as CloseCashPayload;
    if (!body || typeof body !== 'object') {
      throw new AccessError(400, 'Dados de fechamento inválidos.');
    }

    const { sessionId, finalAmount, expectedAmount = 0, varianceAmount = 0, closingDetails, notes = '' } = body;

    if (!sessionId || typeof sessionId !== 'string' || !UUID_REGEX.test(sessionId)) {
      throw new AccessError(400, 'ID da sessão de caixa inválido.');
    }

    if (typeof finalAmount !== 'number' || isNaN(finalAmount) || finalAmount < 0) {
      throw new AccessError(400, 'Valor final informado inválido.');
    }

    const db = createServerDatabase();
    const { data, error } = await db.rpc('close_cash_session_transaction', {
      p_session_id: sessionId,
      p_final_amount: finalAmount,
      p_expected_amount: expectedAmount,
      p_variance_amount: varianceAmount,
      p_operator_name: session.userName,
      p_closing_details: closingDetails || {},
      p_notes: notes ? String(notes).trim() : null,
    });

    if (error) {
      console.error('[Cash Close Error]:', error);
      throw new AccessError(400, error.message || 'Falha ao encerrar sessão de caixa.');
    }

    return Response.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return apiError(error);
  }
}
