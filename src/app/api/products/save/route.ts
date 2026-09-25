import { requireSession, requireSameOrigin, readJsonBody, apiError, AccessError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_CATEGORIES = ['lanche', 'bebida', 'porcao', 'combo'] as const;
const VALID_STATUSES = ['rascunho', 'validado', 'ativo', 'inativo'] as const;
const VALID_STATIONS = ['none', 'grill', 'fryer', 'oven', 'cold', 'assembly', 'other'] as const;
const VALID_KINDS = [
  'none', 'beef_patty', 'egg', 'bacon', 'breaded_chicken',
  'breaded_cheese', 'fries', 'onion_rings', 'other'
] as const;

interface SaveProductPayload {
  product: {
    id?: string;
    name: string;
    category: 'lanche' | 'bebida' | 'porcao' | 'combo';
    subcategory?: string;
    priceBalcao: number;
    priceIfood?: number;
    status?: 'rascunho' | 'validado' | 'ativo' | 'inativo';
    isActive?: boolean;
    expectedVersion?: number;
  };
  recipe?: Array<{
    ingredientId: string;
    quantity: number;
    kitchenComponentId?: string;
    productionStation?: string;
    productionKind?: string;
  }>;
  clientRequestId?: string;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(['admin', 'gerente']);
    requireSameOrigin(request);

    const body = (await readJsonBody(request, 150_000)) as SaveProductPayload;
    if (!body || typeof body !== 'object' || !body.product || typeof body.product !== 'object') {
      throw new AccessError(400, 'Dados do produto inválidos ou ausentes.');
    }

    const { product, recipe = [] } = body;

    // 1. Validação do Produto
    const rawName = typeof product.name === 'string' ? product.name.trim() : '';
    if (!rawName || rawName.length === 0) {
      throw new AccessError(400, 'O nome do produto é obrigatório.');
    }
    if (rawName.length > 120) {
      throw new AccessError(400, 'O nome do produto deve ter no máximo 120 caracteres.');
    }

    if (!VALID_CATEGORIES.includes(product.category as any)) {
      throw new AccessError(400, 'Categoria inválida. Escolha entre lanche, porção, bebida ou combo.');
    }

    const priceBalcao = Number(product.priceBalcao);
    if (isNaN(priceBalcao) || priceBalcao <= 0) {
      throw new AccessError(400, 'Preço Balcão deve ser maior que zero.');
    }

    const priceIfood = product.priceIfood !== undefined ? Number(product.priceIfood) : priceBalcao;
    if (isNaN(priceIfood) || priceIfood < 0) {
      throw new AccessError(400, 'Preço iFood não pode ser negativo.');
    }

    if (product.id && !UUID_REGEX.test(product.id)) {
      throw new AccessError(400, 'Identificador de produto inválido.');
    }

    if (product.status && !VALID_STATUSES.includes(product.status as any)) {
      throw new AccessError(400, 'Status de produto inválido.');
    }

    // 2. Validação da Ficha Técnica (Receita)
    if (!Array.isArray(recipe)) {
      throw new AccessError(400, 'A ficha técnica deve ser uma lista de insumos.');
    }

    const sanitizedRecipe = recipe.map((item, idx) => {
      if (!item || typeof item !== 'object') {
        throw new AccessError(400, `Item ${idx + 1} da receita inválido.`);
      }

      const ingId = String(item.ingredientId || '').trim();
      if (!UUID_REGEX.test(ingId)) {
        throw new AccessError(400, `Identificador do insumo na linha ${idx + 1} é inválido.`);
      }

      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0 || !isFinite(qty)) {
        throw new AccessError(400, `Informe uma quantidade válida maior que zero na linha ${idx + 1}.`);
      }

      const station = (item.productionStation || 'none') as (typeof VALID_STATIONS)[number];
      if (!VALID_STATIONS.includes(station)) {
        throw new AccessError(400, `Destino de preparo inválido na linha ${idx + 1}.`);
      }

      let kind = (item.productionKind || 'none') as (typeof VALID_KINDS)[number];
      if (!VALID_KINDS.includes(kind)) {
        throw new AccessError(400, `Regra de contagem inválida na linha ${idx + 1}.`);
      }

      // Se o item não vai à cozinha, a regra de contagem deve ser 'none'
      if (station === 'none') {
        kind = 'none';
      }

      const kCompId = item.kitchenComponentId && typeof item.kitchenComponentId === 'string' && item.kitchenComponentId.trim()
        ? item.kitchenComponentId.trim()
        : undefined;

      return {
        ingredientId: ingId,
        quantity: qty,
        kitchenComponentId: kCompId,
        productionStation: station,
        productionKind: kind,
      };
    });

    // 3. Execução Transacional Atômica no Banco de Dados
    const db = createServerDatabase();
    const { data, error } = await db.rpc('save_product_transaction', {
      p_product: {
        id: product.id || undefined,
        name: rawName,
        category: product.category,
        subcategory: product.subcategory?.trim() || undefined,
        priceBalcao,
        priceIfood,
        status: product.status || 'validado',
        isActive: product.isActive !== false,
        expectedVersion: product.expectedVersion !== undefined ? Number(product.expectedVersion) : undefined,
      },
      p_recipe: sanitizedRecipe,
      p_operator: session.userName,
    });

    if (error) {
      const errMessage = error.message || '';

      // Detecção de conflito de concorrência
      if (errMessage.includes('CONFLITO_VERSAO')) {
        throw new AccessError(409, 'Outra pessoa atualizou esta ficha. Compare as versões antes de continuar.');
      }

      // Erro de validação de insumo inexistente
      if (errMessage.includes('Insumo da receita inválido ou não encontrado')) {
        throw new AccessError(400, 'Um ou mais insumos informados na ficha técnica não existem no estoque.');
      }

      // Se a RPC falhar por não existir no Supabase (função não declarada) ou colunas de produção ausentes, executar fallback
      const isRpcOrSchemaError = 
        errMessage.includes('save_product_transaction') ||
        error.code === '42883' ||
        (error.code === '42703' && (errMessage.includes('production_station') || errMessage.includes('production_kind')));

      if (isRpcOrSchemaError) {
        throw new AccessError(503, 'A atualização do banco para salvar fichas está pendente. Nenhuma gravação alternativa foi executada. Solicite a atualização ao administrador.');
      }

      // Código de auditoria para diagnóstico seguro no servidor
      const incidentCode = `ERR_PROD_${Date.now().toString(36).toUpperCase()}`;
      console.error(`[Product Save Incident ${incidentCode}]:`, {
        user: session.userName,
        productId: product.id,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      throw new AccessError(
        500,
        `Não foi possível salvar. A ficha publicada não foi alterada. Seus ajustes continuam nesta tela. (Código: ${incidentCode})`
      );
    }

    return Response.json(
      {
        success: true,
        productId: data?.productId || product.id,
        version: data?.version || 1,
        savedAt: data?.savedAt || new Date().toISOString(),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return apiError(error);
  }
}
