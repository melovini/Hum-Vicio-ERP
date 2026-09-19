import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';

interface OpenCashPayload {
  initialAmount: number;
  operatorName?: string;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(['admin', 'gerente', 'caixa']);
    requireSameOrigin(request);

    const body = (await readJsonBody(request, 20_000)) as OpenCashPayload;
    if (!body || typeof body !== 'object') {
      throw new AccessError(400, 'Dados de abertura inválidos.');
    }

    const initialAmount = Number(body.initialAmount);
    if (!Number.isFinite(initialAmount) || initialAmount < 0) {
      throw new AccessError(400, 'O fundo inicial do caixa não pode ser negativo.');
    }

    const requestedOperator = typeof body.operatorName === 'string' ? body.operatorName.trim() : '';
    const operatorName = requestedOperator.slice(0, 100) || session.userName;
    const db = createServerDatabase();

    // Reutiliza o turno já aberto para evitar duas sessões concorrentes por duplo clique
    // ou por outro terminal da mesma operação.
    const { data: existingSessions, error: existingError } = await db
      .from('cash_sessions')
      .select('*')
      .eq('status', 'open')
      .is('deleted_at', null)
      .order('opened_at', { ascending: false })
      .limit(1);

    if (existingError) {
      console.error('[Cash Open Lookup Error]:', existingError);
      throw new AccessError(500, 'Não foi possível consultar o turno de caixa atual.');
    }

    if (Array.isArray(existingSessions) && existingSessions[0]) {
      return Response.json({ success: true, reused: true, session: existingSessions[0] }, {
        status: 200,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
      });
    }

    const openedAt = new Date().toISOString();
    const { data: openedSession, error: insertError } = await db
      .from('cash_sessions')
      .insert({
        status: 'open',
        initial_amount: initialAmount,
        opened_by: operatorName,
        opened_at: openedAt,
      })
      .select('*')
      .single();

    if (insertError || !openedSession) {
      console.error('[Cash Open Insert Error]:', insertError);
      throw new AccessError(500, insertError?.message || 'Não foi possível abrir o turno de caixa.');
    }

    return Response.json({ success: true, reused: false, session: openedSession }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return apiError(error);
  }
}
