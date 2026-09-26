const tables = new Set(['inventory', 'products', 'recipes', 'sales', 'sale_items', 'cash_sessions',
  'cash_movements', 'waste_records', 'kitchen_checklists', 'suppliers', 'purchase_records', 'stock_audits',
  'sub_recipes', 'workstations', 'kitchen_components', 'audit_logs', 'layout_template', 'layout_template_item', 'sessao_caixa_salao',
  'salao_mesa_instancia', 'audit_log_salao', 'collaborator_diarias', 'imported_customers']);
const kitchenRead = new Set(['inventory', 'products', 'recipes', 'sales', 'sale_items', 'waste_records', 'kitchen_checklists', 'sub_recipes', 'kitchen_components']);
const cashierRead = new Set([...kitchenRead, 'cash_sessions', 'cash_movements', 'layout_template',
  'layout_template_item', 'sessao_caixa_salao', 'salao_mesa_instancia', 'imported_customers']);
const productionFields = ['production_status', 'production_started_at', 'production_completed_at',
  'production_time_minutes', 'delay_reason', 'delay_notes', 'target_prep_minutes'];

export function canAccessData(role, table, method, rows = []) {
  if (!['admin', 'gerente', 'caixa', 'cozinha'].includes(role) || !tables.has(table)) return false;
  if (method === 'GET' || method === 'HEAD') {
    if (role === 'admin') return true;
    if (role === 'gerente') return !['audit_logs', 'audit_log_salao', 'collaborator_diarias'].includes(table);
    return (role === 'cozinha' ? kitchenRead : cashierRead).has(table);
  }
  if (!['POST', 'PATCH', 'DELETE'].includes(method)) return false;
  // Importações exigem a validação e a transação da API de CRM.
  if (table === 'imported_customers') return false;
  if (['audit_logs', 'audit_log_salao'].includes(table)) return method === 'POST';
  if (['sales', 'sale_items', 'cash_sessions', 'cash_movements'].includes(table) && method === 'DELETE') return false;
  // Creation must go through authenticated business operations, never arbitrary table writes.
  if (method === 'POST' && ['sales', 'cash_sessions', 'cash_movements'].includes(table)) return false;
  if (role === 'caixa' && table === 'cash_sessions') return false;
  if (role === 'admin') return true;
  if (table === 'collaborator_diarias') return false;
  if (rows.some(row => 'deleted_at' in row || row.status === 'deleted' || ('sale_id' in row && row.sale_id === null))) return false;
  if (role === 'gerente') return true;
  const only = fields => rows.length > 0 && rows.every(row => Object.keys(row).every(key => fields.includes(key)));
  if (table === 'inventory') return method === 'PATCH' && only(['current_stock']);
  if (table === 'sales' && role === 'cozinha') return method === 'PATCH' && only(productionFields);
  if (['waste_records', 'kitchen_checklists'].includes(table)) return method === 'POST' || (table === 'kitchen_checklists' && method === 'PATCH');
  if (role === 'caixa') {
    const cashierAllowedSalePatchFields = [
      'production_status', 'customer_name', 'delay_notes', 'target_prep_minutes',
      'payment_status', 'paid_at', 'paid_method', 'delivered_at',
      'is_reopened', 'reopened_at', 'reopened_by'
    ];
    if (table === 'sales' && method === 'PATCH') return only(cashierAllowedSalePatchFields);
    if (table === 'sale_items') return false; // Edição de itens exige rota transacional /api/sales/edit
    if (['sessao_caixa_salao', 'salao_mesa_instancia'].includes(table)) return method === 'POST' || method === 'PATCH';
    if (table === 'cash_movements') return method === 'POST';
  }
  return false;
}

export function safeSelection(select) {
  // PostgREST embeds/computed relationships could expose tables outside the allowlist.
  return typeof select === 'string' && /^(\*|[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*)$/.test(select);
}


export const kitchenReadableFields = {
  inventory: ['id','name','category','unit','is_active','station','production_station','production_kind','portion_weight','portion_unit','kitchen_component_id'],
  products: ['id','name','category','subcategory','status','is_active','version','accepts_addons','allowed_addon_ids','is_addon'],
  recipes: ['id','product_id','ingredient_id','quantity','production_station','production_kind','kitchen_component_id'],
  sales: ['id','created_at','status','customer_name','order_type','production_status','production_started_at','production_completed_at','production_time_minutes','target_prep_minutes','delay_reason','delay_notes','deleted_at','delivered_at'],
  sale_items: ['id','sale_id','product_id','product_name','quantity','combo_id','combo','meat_point','removals','notes','recipe_version','production_snapshot','additionals','is_gift'],
};
export function sanitizeKitchenRows(role, table, rows) {
  const allowed = role === 'cozinha' ? kitchenReadableFields[table] : undefined;
  if (!allowed || !Array.isArray(rows)) return rows;
  return rows.map(row => {
    const result = Object.fromEntries(Object.entries(row).filter(([key]) => allowed.includes(key)));
    if (Array.isArray(result.additionals)) result.additionals = result.additionals.map(({ id, name, quantity, productId, ingredientId }) => ({ id, name, quantity, productId, ingredientId }));
    // Legacy production details can embed monetary fields: retain only immutable production requirements.
    if (result.production_snapshot) result.production_snapshot = { structuredProduction: result.production_snapshot.structuredProduction };
    return result;
  });
}
