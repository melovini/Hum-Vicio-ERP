import type { Product, InventoryItem, RecipeIngredient } from './store/types';
import { calculateItemProduction, ItemProductionDetails, normalizeProductionString } from './production-calculator';
import { calculateRecipeMetrics, RecipeCalculatedMetrics } from './recipe-helpers';

export type ProductValidationSeverity = 'danger' | 'warning' | 'info';

export interface ProductValidationWarning {
  code: string;
  message: string;
  severity: ProductValidationSeverity;
}

export type ProductStatus = 'rascunho' | 'validado' | 'ativo' | 'inativo';

export interface ProductValidationIngredientSummary {
  ingredientId: string;
  station: string;
  kind?: string;
  name: string;
  quantity: number;
  unit: string;
  portionWeight?: number;
  portionUnit?: string;
  portionLabel: string;
  needsPortionDefinition: boolean;
}

export interface ProductValidationResult {
  isValid: boolean;
  status: 'rascunho' | 'validado' | 'alerta';
  warnings: ProductValidationWarning[];
  productionPreview: ItemProductionDetails;
  recipeMetrics: RecipeCalculatedMetrics;
  ingredientsSummary: ProductValidationIngredientSummary[];
}

export function formatDerivedPortionLabel(
  quantity: number,
  unit: string,
  portionWeight?: number,
  portionUnit?: string,
  kind?: string
): { label: string; count?: number; needsPortionDefinition: boolean } {
  const normUnit = normalizeProductionString(unit);

  if (['un', 'und', 'unidade', 'unidades', 'pc', 'peca'].includes(normUnit)) {
    const isDisco = kind === 'beef_patty';
    const unitWord = isDisco ? (quantity === 1 ? 'disco' : 'discos') : (quantity === 1 ? 'unidade' : 'unidades');
    return {
      label: `${quantity} ${unitWord}`,
      count: quantity,
      needsPortionDefinition: false
    };
  }

  let qtyInG = 0;
  if (['kg', 'kilo', 'quilo', 'kilos', 'quilos'].includes(normUnit)) {
    qtyInG = quantity * 1000;
  } else if (['g', 'gr', 'grama', 'gramas'].includes(normUnit)) {
    qtyInG = quantity;
  }

  if (qtyInG > 0) {
    if (portionWeight && portionWeight > 0) {
      let portionInG = portionWeight;
      const normPortionUnit = normalizeProductionString(portionUnit || 'g');
      if (['kg', 'kilo'].includes(normPortionUnit)) portionInG = portionWeight * 1000;

      const rawRatio = qtyInG / portionInG;
      const rounded = Math.round(rawRatio * 100) / 100;
      const isDisco = kind === 'beef_patty';
      const itemWord = isDisco ? (rounded === 1 ? 'disco' : 'discos') : (rounded === 1 ? 'porção' : 'porções');
      return {
        label: `${rounded} ${itemWord} de ${portionInG} g`,
        count: rounded,
        needsPortionDefinition: false
      };
    }

    if (kind === 'beef_patty' || kind === 'fries' || kind === 'onion_rings') {
      return {
        label: 'Defina a porção para calcular',
        needsPortionDefinition: true
      };
    }
  }

  return {
    label: `${quantity} ${unit}`,
    needsPortionDefinition: false
  };
}

/**
 * Validador puro e determinístico da integridade do produto do cardápio.
 * Analisa coerência entre nome, categoria, receita cadastrada, estações e custos.
 */
export function validateProductIntegrity(
  product: Partial<Product>,
  inventoryItems: InventoryItem[],
  targetCmvPercent: number = 30
): ProductValidationResult {
  const warnings: ProductValidationWarning[] = [];
  const rawName = (product.name || '').trim();
  const normName = normalizeProductionString(rawName);
  const category = product.category || 'lanche';
  const recipe = Array.isArray(product.recipe) ? product.recipe : [];
  const balcao = Number(product.priceBalcao) || 0;
  const ifood = Number(product.priceIfood) || 0;

  // Mapa rápido de insumos por ID
  const invMap = new Map<string, InventoryItem>();
  for (const inv of inventoryItems) {
    if (inv.id) invMap.set(inv.id, inv);
  }

  // 1. Validação básica de Nome e Preço
  if (!rawName) {
    warnings.push({
      code: 'MISSING_NAME',
      message: 'O nome do produto é obrigatório.',
      severity: 'danger'
    });
  }

  if (balcao <= 0) {
    warnings.push({
      code: 'INVALID_PRICE_BALCAO',
      message: 'Preço Balcão deve ser maior que zero (R$ 0,00).',
      severity: 'danger'
    });
  }

  // 2. Cálculo da Prévia de Produção KDS (usando o motor oficial de produção)
  const mockSaleItem = {
    productId: product.id || 'preview-temp-id',
    productName: rawName || 'Produto em Edição',
    quantity: 1,
    unitPrice: balcao,
    notes: '',
    combo: category === 'combo' ? rawName : undefined
  };

  // Montamos o produto simulado com a receita atual para que o motor utilize
  const mockProductObj: Product = {
    id: product.id || 'preview-temp-id',
    name: rawName || 'Produto',
    category,
    priceBalcao: balcao,
    priceIfood: ifood,
    recipe
  };

  const productionPreview = calculateItemProduction(mockSaleItem, [mockProductObj], inventoryItems);

  // 3. Validação de Ficha Técnica / Receita
  if (recipe.length === 0) {
    if (category === 'lanche' || category === 'combo') {
      warnings.push({
        code: 'EMPTY_RECIPE_HOT',
        message: 'Produto sem ficha técnica. Lanches e combos exigem receita para serem válidos para venda e produção.',
        severity: 'danger'
      });
    } else if (category === 'porcao') {
      warnings.push({
        code: 'EMPTY_RECIPE_PORCAO',
        message: 'Porção sem insumo vinculado. Recomenda-se adicionar o insumo para baixa de estoque.',
        severity: 'info'
      });
    }
  }

  // 4. Detecção de Discrepâncias de Lanches Duplos vs Simples
  const isDuploInName = normName.includes('duplo') || normName.includes('2x');
  const chapaPatties = productionPreview.chapaPatties;

  if (category === 'lanche' && recipe.length > 0) {
    if (isDuploInName && chapaPatties < 2) {
      warnings.push({
        code: 'NAME_DUPLO_MISMATCH',
        message: `O nome "${rawName}" sugere um lanche DUPLO, mas a receita contém apenas ${chapaPatties} carne(s). A cozinha preparará exatamente o que está na receita (${chapaPatties} carne).`,
        severity: 'warning'
      });
    } else if (!isDuploInName && chapaPatties >= 2) {
      warnings.push({
        code: 'RECIPE_DOUBLE_NAME_SIMPLE',
        message: `A receita contém ${chapaPatties} carnes bovinas. No KDS este item será exibido com destaque "(Lanche Duplo)".`,
        severity: 'info'
      });
    }

    // 5. Verificação de Proteínas Principais
    const totalProteins = chapaPatties + productionPreview.fryerChicken + productionPreview.fryerCheese;
    if (totalProteins === 0) {
      warnings.push({
        code: 'NO_PROTEIN_IDENTIFIED',
        message: 'Nenhuma proteína principal (carne bovina, frango ou queijo empanado) foi identificada na receita.',
        severity: 'warning'
      });
    }

    // 6. Alerta Informativo de Ovo na Chapa
    if (productionPreview.eggsCount > 0) {
      warnings.push({
        code: 'EGG_ON_CHAPA_SEPARATED',
        message: `${productionPreview.eggsCount}x Ovo(s) na chapa identificado(s). O KDS exibirá separadamente dos discos de hambúrguer.`,
        severity: 'info'
      });
    }
  }

  // 7. Anomalias de Peso / Unidades na Receita
  for (const r of recipe) {
    const inv = invMap.get(r.ingredientId);
    if (!inv) {
      warnings.push({
        code: 'UNKNOWN_INGREDIENT',
        message: `Insumo ID "${r.ingredientId}" não foi encontrado no estoque.`,
        severity: 'danger'
      });
      continue;
    }

    const normUnit = normalizeProductionString(inv.unit);
    // Se a unidade for kg mas a quantidade for >= 10 (ex: operador colocou 180 em vez de 0.180 kg)
    if ((normUnit === 'kg' || normUnit === 'kilo') && r.quantity >= 10) {
      warnings.push({
        code: 'UNIT_WEIGHT_ANOMALY',
        message: `Quantidade muito alta para insumo em KG: ${r.quantity} kg de "${inv.name}". Se a porção for ${r.quantity}g, cadastre como ${(r.quantity / 1000).toFixed(3)} kg.`,
        severity: 'danger'
      });
    }

    // Quantidade zerada ou negativa
    if (r.quantity <= 0) {
      warnings.push({
        code: 'ZERO_QUANTITY_INGREDIENT',
        message: `Insumo "${inv.name}" está com quantidade zerada ou negativa (${r.quantity}).`,
        severity: 'danger'
      });
    }
  }

  // 8. Métricas de Custo e CMV
  const getIngredientCost = (id: string) => invMap.get(id)?.costPerUnit || 0;
  const recipeMetrics = calculateRecipeMetrics(recipe, getIngredientCost, balcao, ifood, targetCmvPercent);
  if (recipeMetrics.hasZeroCostIngredient) {
    warnings.push({
      code: 'ZERO_COST_INGREDIENT',
      message: `${recipeMetrics.missingCostCount} insumo(s) na receita estão com custo R$ 0,00. O CMV informado está subestimado.`,
      severity: 'warning'
    });
  }

  // 9. Resumo de Insumos por Estação com Rótulos de Porção
  const ingredientsSummary: ProductValidationIngredientSummary[] = recipe.map(r => {
    const inv = invMap.get(r.ingredientId);
    const unit = inv?.unit || 'un';
    const portionInfo = formatDerivedPortionLabel(
      r.quantity,
      unit,
      inv?.portionWeight,
      inv?.portionUnit,
      r.productionKind
    );

    if (portionInfo.needsPortionDefinition) {
      warnings.push({
        code: 'MISSING_PORTION_WEIGHT',
        message: `Insumo "${inv?.name || 'Insumo'}" é controlado por peso (${unit}). Defina o peso da porção no estoque para o cálculo automático de preparo.`,
        severity: 'info'
      });
    }

    return {
      ingredientId: r.ingredientId,
      station: r.productionStation || inv?.station || 'none',
      kind: r.productionKind,
      name: inv?.name || 'Insumo',
      quantity: r.quantity,
      unit,
      portionWeight: inv?.portionWeight,
      portionUnit: inv?.portionUnit,
      portionLabel: portionInfo.label,
      needsPortionDefinition: portionInfo.needsPortionDefinition
    };
  });

  // 10. Definição do Status de Validação
  const hasDanger = warnings.some(w => w.severity === 'danger');
  const hasWarning = warnings.some(w => w.severity === 'warning');

  let status: 'rascunho' | 'validado' | 'alerta' = 'validado';
  if (hasDanger || recipe.length === 0) {
    status = 'rascunho';
  } else if (hasWarning) {
    status = 'alerta';
  }

  const isLancheOrCombo = category === 'lanche' || category === 'combo';
  const isValid = !hasDanger && !(isLancheOrCombo && recipe.length === 0);

  return {
    isValid,
    status,
    warnings,
    productionPreview,
    recipeMetrics,
    ingredientsSummary
  };
}
