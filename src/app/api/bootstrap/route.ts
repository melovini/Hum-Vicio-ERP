import 'server-only';
import { requireSession, apiError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';
import { canAccessData } from '@/lib/security/data-policy.mjs';

export type BootstrapScope = 'caixa' | 'cozinha' | 'admin' | 'all';

export async function GET(request?: Request) {
  try {
    const session = await requireSession();
    const db = createServerDatabase();

    const url = request ? new URL(request.url) : null;
    const scope: BootstrapScope = (url?.searchParams.get('scope') as BootstrapScope) || 'all';

    // Determinar tabelas necessárias com base no escopo requisitado
    const isCozinha = scope === 'cozinha';
    const isCaixa = scope === 'caixa';
    const isFull = scope === 'admin' || scope === 'all';

    const queries: Record<string, PromiseLike<any>> = {};

    // 1. Insumos (Necessário para Caixa e Cozinha)
    if (canAccessData(session.role, 'inventory', 'GET')) {
      queries.inventory = db.from('inventory').select('*');
    }

    // 2. Produtos e Receitas (Necessário para Caixa e Cozinha)
    if (canAccessData(session.role, 'products', 'GET')) {
      queries.products = db.from('products').select('*');
    }
    if (canAccessData(session.role, 'recipes', 'GET')) {
      queries.recipes = db.from('recipes').select('*');
    }
    if ((isCozinha || isFull) && canAccessData(session.role, 'sub_recipes', 'GET')) {
      queries.subRecipes = db.from('sub_recipes').select('*');
    }

    // 3. Vendas (Cozinha precisa de pendentes e recentes; Caixa precisa dos últimos 80)
    if (canAccessData(session.role, 'sales', 'GET')) {
      if (isCozinha) {
        queries.sales = db
          .from('sales')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(60);
      } else {
        queries.sales = db
          .from('sales')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(80);
      }
    }

    // 4. Sessões e Movimentações de Caixa (Apenas Caixa e Admin/All)
    if ((isCaixa || isFull) && canAccessData(session.role, 'cash_sessions', 'GET')) {
      queries.cashSessions = db
        .from('cash_sessions')
        .select('*')
        .is('deleted_at', null)
        .order('opened_at', { ascending: false })
        .limit(30);
    }
    if ((isCaixa || isFull) && canAccessData(session.role, 'cash_movements', 'GET')) {
      queries.cashMovements = db
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);
    }

    // 5. Checklists e Perdas da Cozinha (Apenas Cozinha e Admin/All)
    if ((isCozinha || isFull) && canAccessData(session.role, 'kitchen_checklists', 'GET')) {
      queries.checklists = db
        .from('kitchen_checklists')
        .select('*')
        .order('date', { ascending: false })
        .limit(14);
    }
    if ((isCozinha || isFull) && canAccessData(session.role, 'waste_records', 'GET')) {
      queries.wasteRecords = db
        .from('waste_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    }

    // 6. Módulos Administrativos e de Auditoria (Apenas Admin/All)
    if (isFull && canAccessData(session.role, 'suppliers', 'GET')) {
      queries.suppliers = db.from('suppliers').select('*').order('name', { ascending: true });
    }
    if (isFull && canAccessData(session.role, 'purchase_records', 'GET')) {
      queries.purchaseRecords = db.from('purchase_records').select('*').order('created_at', { ascending: false }).limit(50);
    }
    if (isFull && canAccessData(session.role, 'stock_audits', 'GET')) {
      queries.stockAudits = db.from('stock_audits').select('*').order('created_at', { ascending: false }).limit(20);
    }
    if (isFull && canAccessData(session.role, 'audit_logs', 'GET')) {
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
      scope,
    };
    keys.forEach((k, idx) => {
      payload[k] = results[idx]?.data || [];
    });

    // 7. Restrição Estrita de Itens: buscar apenas os itens dos pedidos consultados (evita scan irrestrito)
    if (payload.sales && payload.sales.length > 0 && canAccessData(session.role, 'sale_items', 'GET')) {
      const saleIds = payload.sales.map((s: any) => s.id);
      try {
        const { data: items } = await db.from('sale_items').select('*').in('sale_id', saleIds);
        payload.saleItems = items || [];
      } catch {
        payload.saleItems = [];
      }
    } else {
      payload.saleItems = [];
    }

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
