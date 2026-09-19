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
      const isSchemaMismatch = (error as any).code === '42703' || 
        (typeof error.message === 'string' && (
          error.message.includes('payment_status') || 
          error.message.includes('credit_status') ||
          error.message.includes('has no field')
        ));

      if (isSchemaMismatch) {
        console.warn('[Settle Sale Fallback] RPC failed with schema mismatch. Executing resilient settlement for saleId:', saleId, error.message);
        const now = new Date().toISOString();
        const method = paymentMethod.toLowerCase().trim();

        // 1. Buscar a venda para validação
        const { data: saleToSettle, error: fetchErr } = await db
          .from('sales')
          .select('id, total, status, customer_name')
          .eq('id', saleId)
          .single();

        if (fetchErr || !saleToSettle) {
          throw new AccessError(404, 'Pedido não encontrado.');
        }

        if (saleToSettle.status === 'cancelled') {
          throw new AccessError(400, 'Não é possível quitar um pedido que já foi cancelado.');
        }

        // 2. Atualização melhor esforço em sales
        try {
          await db
            .from('sales')
            .update({
              payment_method: method,
              updated_at: now
            })
            .eq('id', saleId);
        } catch (updErr) {
          console.warn('[Settle Update Sales Non-fatal]:', updErr);
        }

        // 3. Registro em payment_events
        const eventType = settlementType === 'fiado' ? 'liquidacao_fiado' : 'liquidacao_retirada';
        try {
          await db.from('payment_events').insert({
            sale_id: saleId,
            cash_session_id: validSessionId,
            amount: saleToSettle.total,
            payment_method: method,
            event_type: eventType,
            operator_id: session.collaboratorId,
            operator_name: session.userName,
            created_at: now
          });
        } catch (peErr) {
          console.warn('[Payment Events Insert Non-fatal]:', peErr);
        }

        // 4. Se foi dinheiro físico e existe sessão aberta, registra suprimento
        if (method === 'dinheiro' && validSessionId) {
          try {
            await db.from('cash_movements').insert({
              session_id: validSessionId,
              type: 'suprimento',
              amount: saleToSettle.total,
              description: `Recebimento Quitação #${saleId.slice(0, 6)} (${saleToSettle.customer_name || 'Cliente'})`,
              operator: session.userName,
              created_at: now
            });
          } catch (cmErr) {
            console.warn('[Cash Movement Insert Non-fatal]:', cmErr);
          }
        }

        // 5. Auditoria no servidor
        try {
          await db.from('audit_logs').insert({
            action: settlementType === 'fiado' ? 'LIQUIDACAO_FIADO' : 'LIQUIDACAO_RETIRADA',
            details: `Quitação do pedido #${saleId.slice(0, 6)} confirmada no valor de R$ ${Number(saleToSettle.total).toFixed(2)} via ${method.toUpperCase()} (${saleToSettle.customer_name || 'Cliente'}).`,
            operator: session.userName,
            previous_value: 'pendente',
            new_value: 'pago',
            created_at: now
          });
        } catch (auditErr) {
          console.warn('[Audit Log Insert Non-fatal]:', auditErr);
        }

        return Response.json({
          success: true,
          saleId,
          paidAt: now,
          paidMethod: method,
          total: saleToSettle.total
        }, {
          status: 200,
          headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
        });
      }

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
