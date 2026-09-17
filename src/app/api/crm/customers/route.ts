import { createServerDatabase } from '@/lib/supabase-server';
import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { validateCustomers } from '@/lib/security/customer-validation.mjs';

function buildAccentRegex(str: string): string {
  const map: Record<string, string> = {
    a: '[aáàãâä]',
    e: '[eéêë]',
    i: '[iíîï]',
    o: '[oóôõö]',
    u: '[uúüû]',
    c: '[cç]'
  };
  const base = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const clean = base.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  let regex = '';
  for (const ch of clean) {
    if (map[ch]) {
      regex += map[ch];
    } else if (/\s+/.test(ch)) {
      regex += '.*';
    } else {
      regex += ch;
    }
  }
  return regex;
}

export async function GET(request?: Request) {
  try {
    await requireSession(['admin', 'gerente', 'caixa']);
    const db = createServerDatabase();

    let search = '';
    let limit = 8;
    if (request && request.url) {
      try {
        const url = new URL(request.url);
        search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();
        const limitParam = parseInt(url.searchParams.get('limit') || '8', 10);
        if (!isNaN(limitParam) && limitParam > 0) {
          limit = Math.min(limitParam, 50);
        }
      } catch {}
    }

    if (search) {
      const pattern = buildAccentRegex(search);
      const digits = search.replace(/\D/g, '');
      const orParts: string[] = [];

      if (pattern) {
        orParts.push(`name.imatch.${pattern}`);
        orParts.push(`full_address.imatch.${pattern}`);
        orParts.push(`address.imatch.${pattern}`);
      }
      if (digits.length >= 3) {
        orParts.push(`phone.ilike.%${digits}%`);
      }

      if (orParts.length === 0) {
        return Response.json(
          { success: true, customers: [], count: 0, source: 'supabase_search' },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const { data, error } = await db
        .from('imported_customers')
        .select('*')
        .or(orParts.join(','))
        .order('total_orders', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const customers = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        number: c.number,
        neighborhood: c.neighborhood,
        city: c.city,
        complement: c.complement,
        fullAddress: c.full_address,
        totalOrders: c.total_orders,
        lastOrderDate: c.last_order_date,
        source: c.source,
        importedAt: c.imported_at,
      }));

      return Response.json(
        { success: true, customers, count: customers.length, source: 'supabase_search' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

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
