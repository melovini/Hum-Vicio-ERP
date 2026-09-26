import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';
import { DEFAULT_CENTRAL_CONFIG, CentralStoreConfig } from '@/lib/central-config';

// Armazenamento em memória do servidor como fallback sincronizado em tempo de execução
let serverCentralConfig: CentralStoreConfig = { ...DEFAULT_CENTRAL_CONFIG };

export async function GET() {
  try {
    await requireSession(['admin', 'gerente', 'caixa', 'cozinha']);
    const db = createServerDatabase();

    // Tentar ler da tabela system_settings ou audit_logs se disponível
    try {
      const { data, error } = await db
        .from('audit_logs')
        .select('details, created_at, operator')
        .eq('action', 'CENTRAL_CONFIG_UPDATE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && data.details) {
        const parsed = JSON.parse(data.details);
        if (parsed && typeof parsed.version === 'number') {
          if (parsed.version > serverCentralConfig.version) {
            serverCentralConfig = parsed;
          }
        }
      }
    } catch {
      // Usa fallback serverCentralConfig em memória
    }

    return Response.json(serverCentralConfig, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    // Somente admin ou gerente tem autoridade para publicar configurações oficiais da loja (V06)
    const session = await requireSession(['admin', 'gerente']);
    requireSameOrigin(request);

    const body = (await readJsonBody(request, 100_000)) as Partial<CentralStoreConfig>;
    if (!body || typeof body !== 'object') {
      throw new AccessError(400, 'Payload de configuração central inválido.');
    }

    const nextVersion = Math.max(serverCentralConfig.version + 1, Number(body.version) || (serverCentralConfig.version + 1));
    const now = new Date().toISOString();

    const updatedConfig: CentralStoreConfig = {
      version: nextVersion,
      updatedAt: now,
      updatedBy: `${session.userName} (${session.role})`,
      targetPrepMinutes: Number(body.targetPrepMinutes) || serverCentralConfig.targetPrepMinutes || 20,
      fixedExpenses: body.fixedExpenses || serverCentralConfig.fixedExpenses,
      subcategoriesByCategory: body.subcategoriesByCategory || serverCentralConfig.subcategoriesByCategory,
      ingredientStations: body.ingredientStations || serverCentralConfig.ingredientStations || {},
      printerProfile: body.printerProfile || serverCentralConfig.printerProfile || DEFAULT_CENTRAL_CONFIG.printerProfile,
      receiptTemplate: body.receiptTemplate || serverCentralConfig.receiptTemplate || DEFAULT_CENTRAL_CONFIG.receiptTemplate,
      terminalBindings: Array.isArray(body.terminalBindings) && body.terminalBindings.length > 0 ? body.terminalBindings : (serverCentralConfig.terminalBindings || DEFAULT_CENTRAL_CONFIG.terminalBindings),
    };

    serverCentralConfig = updatedConfig;

    // Persistir no histórico de auditoria do banco
    const db = createServerDatabase();
    try {
      await db.from('audit_logs').insert({
        action: 'CENTRAL_CONFIG_UPDATE',
        details: JSON.stringify(updatedConfig),
        operator: session.userName,
        previous_value: `v${serverCentralConfig.version - 1}`,
        new_value: `v${nextVersion}`,
        created_at: now,
      });
    } catch (dbErr) {
      console.warn('[CentralConfig API] Aviso ao persistir em audit_logs:', dbErr);
    }

    return Response.json(updatedConfig, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
