import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';
import { verifyCredential } from '@/lib/security/credentials.mjs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CancelSalePayload {
  saleId: string;
  reason?: string;
  notes?: string;
  supervisorPassword?: string;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(['admin', 'gerente', 'caixa']);
    requireSameOrigin(request);

    const body = (await readJsonBody(request, 50_000)) as CancelSalePayload;
    if (!body || typeof body !== 'object') {
      throw new AccessError(400, 'Dados de cancelamento inválidos.');
    }

    const { saleId, reason = 'Desistência do cliente antes do preparo', notes, supervisorPassword } = body;

    if (!saleId || typeof saleId !== 'string' || !UUID_REGEX.test(saleId)) {
      throw new AccessError(400, 'ID da comanda inválido.');
    }

    const db = createServerDatabase();
    let authorizedBy = `${session.userName} (${session.role})`;

    // Se o operador for perfil caixa, a autorização gerencial no servidor é obrigatória
    if (session.role === 'caixa') {
      if (!supervisorPassword || typeof supervisorPassword !== 'string' || supervisorPassword.trim().length === 0) {
        throw new AccessError(403, 'Cancelamento exige senha de supervisor ou gerente.');
      }

      // Buscar supervisores/gerentes ativos no banco
      const { data: supervisors, error: supError } = await db
        .from('collaborators')
        .select('id, name, role, pin, is_active')
        .in('role', ['admin', 'gerente'])
        .eq('is_active', true);

      if (supError || !supervisors || supervisors.length === 0) {
        throw new AccessError(503, 'Nenhum supervisor ativo encontrado para autorização.');
      }

      let matchSupervisor: { name: string; role: string } | null = null;
      for (const sup of supervisors) {
        if (sup.pin && await verifyCredential(supervisorPassword.trim(), sup.pin)) {
          matchSupervisor = sup;
          break;
        }
      }

      if (!matchSupervisor) {
        throw new AccessError(403, 'Senha de supervisor incorreta. Estorno não autorizado.');
      }

      authorizedBy = `${matchSupervisor.name} (Autorizado para ${session.userName})`;
    }

    // Executa cancelamento atômico, estorno de estoque e auditoria
    const { data, error } = await db.rpc('cancel_order_transaction', {
      p_sale_id: saleId,
      p_cancellation_reason: reason.trim(),
      p_cancellation_notes: notes ? notes.trim() : null,
      p_cancelled_by: authorizedBy,
      p_operator_id: session.collaboratorId,
    });

    if (error) {
      console.error('[Cancel Sale Error]:', error);
      throw new AccessError(400, error.message || 'Falha ao cancelar pedido.');
    }

    return Response.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return apiError(error);
  }
}
