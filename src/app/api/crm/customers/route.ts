import { createServerDatabase } from '@/lib/supabase-server';
import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { validateCustomers } from '@/lib/security/customer-validation.mjs';

export async function GET() {
  try {
    await requireSession(['admin', 'gerente', 'caixa']);
    const db = createServerDatabase();
    const customers = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('imported_customers').select('*').order('id').range(offset, offset + 999);
      if (error) throw error;
      customers.push(...(data || []).map(c => ({
        id: c.id, name: c.name, phone: c.phone, address: c.address, number: c.number, neighborhood: c.neighborhood,
        city: c.city, complement: c.complement, fullAddress: c.full_address, totalOrders: c.total_orders,
        lastOrderDate: c.last_order_date, source: c.source, importedAt: c.imported_at,
      })));
      if (!data || data.length < 1000) break;
    }
    return Response.json({ success: true, customers, count: customers.length, source: 'supabase' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    await requireSession(['admin', 'gerente']);
    requireSameOrigin(request);
    const body = await readJsonBody(request, 5_000_000) as { mode?: string; customers?: unknown } | null;
    let customers;
    try {
      if (!body || !body.mode || !['merge', 'replace'].includes(body.mode)) throw new Error('Modo inválido.');
      customers = validateCustomers(body.customers);
    } catch (error) { throw new AccessError(400, error instanceof Error ? error.message : 'Dados inválidos.'); }
    const { error } = await createServerDatabase().rpc('import_customers_secure', { incoming: customers, replace_existing: body!.mode === 'replace' });
    if (error) throw error;
    return Response.json({ success: true, totalSaved: customers.length, supabaseSynced: true, mode: body!.mode });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    await requireSession(['admin']);
    requireSameOrigin(request);
    const { error } = await createServerDatabase().from('imported_customers').delete().neq('id', 'keep_empty');
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
