import 'server-only';
import { requireSession, apiError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';
import { canAccessData } from '@/lib/security/data-policy.mjs';

export async function GET() {
  try {
    const session = await requireSession();
    const db = createServerDatabase();

    // Consultas executadas no servidor com verificação de permissão de perfil
    const queries: Record<string, PromiseLike<any>> = {};

    if (canAccessData(session.role, 'inventory', 'GET')) {
      queries.inventory = db.from('inventory').select('*');
    }
    if (canAccessData(session.role, 'products', 'GET')) {
      queries.products = db.from('products').select('*');
    }
    if (canAccessData(session.role, 'recipes', 'GET')) {
      queries.recipes = db.from('recipes').select('*');
    }
    if (canAccessData(session.role, 'sales', 'GET')) {
      queries.sales = db.from('sales').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(80);
      queries.saleItems = db.from('sale_items').select('*').not('sale_id', 'is', null);
    }
    if (canAccessData(session.role, 'cash_sessions', 'GET')) {
      queries.cashSessions = db.from('cash_sessions').select('*').is('deleted_at', null).order('opened_at', { ascending: false }).limit(30);
    }
    if (canAccessData(session.role, 'cash_movements', 'GET')) {
      queries.cashMovements = db.from('cash_movements').select('*').order('created_at', { ascending: false }).limit(60);
    }
    if (canAccessData(session.role, 'kitchen_checklists', 'GET')) {
      queries.checklists = db.from('kitchen_checklists').select('*').order('date', { ascending: false }).limit(14);
    }
    if (canAccessData(session.role, 'waste_records', 'GET')) {
      queries.wasteRecords = db.from('waste_records').select('*').order('created_at', { ascending: false }).limit(50);
    }
    if (canAccessData(session.role, 'suppliers', 'GET')) {
      queries.suppliers = db.from('suppliers').select('*').order('name', { ascending: true });
    }
    if (canAccessData(session.role, 'purchase_records', 'GET')) {
      queries.purchaseRecords = db.from('purchase_records').select('*').order('created_at', { ascending: false }).limit(50);
    }
    if (canAccessData(session.role, 'stock_audits', 'GET')) {
      queries.stockAudits = db.from('stock_audits').select('*').order('created_at', { ascending: false }).limit(20);
    }
    if (canAccessData(session.role, 'sub_recipes', 'GET')) {
      queries.subRecipes = db.from('sub_recipes').select('*');
    }
    if (canAccessData(session.role, 'audit_logs', 'GET')) {
      queries.auditLogs = db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    }

    const keys = Object.keys(queries);
    const results = await Promise.all(
      keys.map(async k => {
        try {
          return await queries[k];
        } catch {
          return { data: null };
        }
      })
    );
    
    const payload: Record<string, any> = {
      role: session.role,
      userName: session.userName,
    };
    keys.forEach((k, idx) => {
      payload[k] = results[idx]?.data || [];
    });

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
