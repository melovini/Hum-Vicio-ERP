import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { canAccessData, safeSelection, sanitizeKitchenRows, kitchenReadableFields } from '@/lib/security/data-policy.mjs';

type Context = { params: Promise<{ table: string }> };
async function handle(request: Request, context: Context) {
  try {
    const session = await requireSession();
    const { table } = await context.params;
    const method = request.method;
    const reading = method === 'GET' || method === 'HEAD';
    if (!reading) requireSameOrigin(request);
    const url = new URL(request.url);
    if (new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length) {
      throw new AccessError(400, 'Parâmetros repetidos não são permitidos.');
    }
    if (!safeSelection(url.searchParams.get('select') || '*')) throw new AccessError(400, 'Consulta inválida.');
    if ([...url.searchParams.keys()].some(key => !/^[a-z_][a-z0-9_]*$/.test(key))) throw new AccessError(400, 'Filtro inválido.');
    const kitchenFields = session.role === 'cozinha' ? kitchenReadableFields[table as keyof typeof kitchenReadableFields] : undefined;
    if (kitchenFields) {
      const filterKeys = [...url.searchParams.keys()].filter(key => !['select', 'order', 'limit', 'offset'].includes(key));
      const requested = (url.searchParams.get('select') || '*').split(',');
      const orderFields = (url.searchParams.get('order') || '').split(',').filter(Boolean).map(value => value.split('.')[0]);
      if ([...filterKeys, ...orderFields, ...requested.filter(field => field !== '*')].some(field => !kitchenFields.includes(field))) {
        throw new AccessError(403, 'Consulta não disponível para o perfil da cozinha.');
      }
    }
    let body: unknown;
    if (!reading && method !== 'DELETE') {
      body = await readJsonBody(request, 1_000_000);
    }
    const rows = body ? (Array.isArray(body) ? body : [body]) : [];
    if (rows.length > 1000 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new AccessError(400, 'Dados inválidos.');
    if (!canAccessData(session.role, table, method, rows)) throw new AccessError(403, 'Operação não permitida para seu perfil.');
    if (['PATCH', 'DELETE'].includes(method) && ![...url.searchParams.keys()].some(key => !['select', 'order', 'limit', 'offset'].includes(key))) {
      throw new AccessError(400, 'Informe quais registros devem ser alterados.');
    }
    const prefer = request.headers.get('prefer') || '';
    if (['audit_logs', 'audit_log_salao', 'cash_movements'].includes(table) && prefer.includes('resolution=')) {
      throw new AccessError(403, 'Este registro não pode ser sobrescrito.');
    }
    for (const row of rows) {
      if (table === 'audit_logs') { row.operator = session.userName; row.created_at = new Date().toISOString(); }
      if (table === 'audit_log_salao') row.operador_id = session.collaboratorId;
      if (table === 'sales' && row.status === 'cancelled') row.cancelled_by = session.userName;
      if (table === 'kitchen_checklists' && row.signed_by) row.signed_by = session.userName;
    }
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !key) throw new Error('Banco indisponível.');
    const headers = new Headers({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
    for (const name of ['accept', 'prefer', 'range', 'range-unit']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const response = await fetch(`${base}/rest/v1/${table}${url.search}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
      signal: AbortSignal.timeout(15_000), redirect: 'error',
    });
    const outgoing = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': 'application/json' });
    const range = response.headers.get('content-range');
    if (range) outgoing.set('content-range', range);
    if (!response.ok) return Response.json({ message: 'Não foi possível concluir a operação no banco.' }, { status: response.status });
    if (session.role === 'cozinha' && method !== 'HEAD' && response.status !== 204) {
      const data = await response.json();
      const sanitized = Array.isArray(data) ? sanitizeKitchenRows(session.role, table, data) : sanitizeKitchenRows(session.role, table, [data])[0];
      return Response.json(sanitized, { status: response.status, headers: outgoing });
    }
    return new Response(method === 'HEAD' || response.status === 204 ? null : await response.text(), { status: response.status, headers: outgoing });
  } catch (error) { return apiError(error); }
}
export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
