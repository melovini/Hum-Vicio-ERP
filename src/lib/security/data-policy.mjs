const tables = new Set(['inventory', 'products', 'recipes', 'sales', 'sale_items', 'cash_sessions',
  'cash_movements', 'waste_records', 'kitchen_checklists', 'suppliers', 'purchase_records', 'stock_audits',
  'sub_recipes', 'kitchen_components', 'audit_logs', 'layout_template', 'layout_template_item', 'sessao_caixa_salao',
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
  if (role === 'admin') return true;
  if (table === 'collaborator_diarias') return false;
  if (rows.some(row => 'deleted_at' in row || row.status === 'deleted' || ('sale_id' in row && row.sale_id === null))) return false;
  if (role === 'gerente') return true;
  const only = fields => rows.length > 0 && rows.every(row => Object.keys(row).every(key => fields.includes(key)));
  if (table === 'inventory') return method === 'PATCH' && only(['current_stock']);
  if (table === 'sales' && role === 'cozinha') return method === 'PATCH' && only(productionFields);
  if (['waste_records', 'kitchen_checklists'].includes(table)) return method === 'POST' || (table === 'kitchen_checklists' && method === 'PATCH');
  if (role === 'caixa') {
    if (['sales', 'sale_items', 'cash_sessions', 'sessao_caixa_salao', 'salao_mesa_instancia'].includes(table)) return method === 'POST' || method === 'PATCH';
    if (table === 'cash_movements') return method === 'POST';
  }
  return false;
}

export function safeSelection(select) {
  // PostgREST embeds/computed relationships could expose tables outside the allowlist.
  return typeof select === 'string' && /^(\*|[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*)$/.test(select);
}
