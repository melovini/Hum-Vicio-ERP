import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configure o acesso privado ao banco para verificar a compatibilidade.');
const db = createClient(url, key, { auth: { persistSession: false } });
const checks = {
  sale_items: 'id,production_snapshot,combo_id,recipe_version,meat_point,removals',
  products: 'id,version,status,subcategory',
  recipes: 'product_id,kitchen_component_id,production_station,production_kind',
  inventory: 'id,kitchen_component_id',
  kitchen_components: 'id,station,production_unit,portion_weight,portion_unit',
  workstations: 'id',
  idempotency_keys: 'key,sale_id,status,response',
};
let failed = false;
for (const [table, columns] of Object.entries(checks)) {
  const { error } = await db.from(table).select(columns).limit(0);
  console.log(`${error ? 'FALHA' : 'OK'}: ${table}${error ? ` (${error.code || 'comunicação'})` : ''}`);
  if (error) failed = true;
}
// Discover RPC signatures without executing financial or catalog mutations.
try {
  const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' }, signal: AbortSignal.timeout(10000) });
  const schema = await response.json();
  for (const name of ['save_product_transaction', 'process_sale_checkout']) {
    const present = response.ok && Boolean(schema.paths?.[`/rpc/${name}`]);
    console.log(`${present ? 'OK' : 'FALHA'}: função ${name}`);
    if (!present) failed = true;
  }
} catch { failed = true; console.log('FALHA: não foi possível verificar as funções.'); }
process.exitCode = failed ? 1 : 0;
