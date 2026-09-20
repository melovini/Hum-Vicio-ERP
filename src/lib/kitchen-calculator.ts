import { 
  KitchenComponent, 
  KitchenComponentType, 
  RecipeProductionStation, 
  Product, 
  InventoryItem, 
  SaleItem,
  StructuredComponentRequirement,
  StructuredProductionSnapshot
} from './store/types';

export const DEFAULT_KITCHEN_COMPONENTS: KitchenComponent[] = [
  {
    id: 'cmp-bovino-180',
    name: 'Bovino 180 g',
    componentType: 'burger',
    station: 'grill',
    productionUnit: 'disco',
    portionWeight: 180,
    portionUnit: 'g',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-bovino-90',
    name: 'Bovino 90 g',
    componentType: 'burger',
    station: 'grill',
    productionUnit: 'disco',
    portionWeight: 90,
    portionUnit: 'g',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-costela-180',
    name: 'Costela 180 g',
    componentType: 'burger',
    station: 'grill',
    productionUnit: 'disco',
    portionWeight: 180,
    portionUnit: 'g',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-linguica',
    name: 'Linguiça',
    componentType: 'burger',
    station: 'grill',
    productionUnit: 'disco',
    portionWeight: 150,
    portionUnit: 'g',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-ovo',
    name: 'Ovo',
    componentType: 'egg',
    station: 'grill',
    productionUnit: 'unidade',
    portionWeight: 1,
    portionUnit: 'un',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-batata-peq',
    name: 'Batata pequena',
    componentType: 'side',
    station: 'fryer',
    productionUnit: 'porcao',
    portionWeight: 150,
    portionUnit: 'g',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-batata-gde',
    name: 'Batata grande',
    componentType: 'side',
    station: 'fryer',
    productionUnit: 'porcao',
    portionWeight: 300,
    portionUnit: 'g',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-aneis-cebola',
    name: 'Anéis de cebola',
    componentType: 'side',
    station: 'fryer',
    productionUnit: 'porcao',
    portionWeight: 150,
    portionUnit: 'g',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-frango-emp',
    name: 'Frango empanado',
    componentType: 'protein',
    station: 'fryer',
    productionUnit: 'unidade',
    portionWeight: 1,
    portionUnit: 'un',
    showInSummary: true,
    isActive: true,
  },
  {
    id: 'cmp-queijo-emp',
    name: 'Queijo empanado',
    componentType: 'side',
    station: 'fryer',
    productionUnit: 'unidade',
    portionWeight: 1,
    portionUnit: 'un',
    showInSummary: true,
    isActive: true,
  },
];

/**
 * Normaliza strings de unidade para cálculo matemático coerente
 */
export function normalizeUnit(unit: string = ''): 'kg' | 'g' | 'un' | 'other' {
  const norm = (unit || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (['kg', 'kilo', 'quilo', 'kilos', 'quilos'].includes(norm)) return 'kg';
  if (['g', 'gr', 'grama', 'gramas'].includes(norm)) return 'g';
  if (['un', 'und', 'unidade', 'unidades', 'pc', 'peca', 'disco', 'discos', 'porcao', 'porcoes'].includes(norm)) return 'un';
  return 'other';
}

/**
 * Converte matematicamente a quantidade consumida para a quantidade em unidades de produção
 * Exemplo: 0.360 kg com porção de 180 g -> 2 discos.
 */
export function convertPortionRatio(
  consumptionQty: number,
  consumptionUnit: string,
  portionWeight?: number,
  portionUnit?: string
): { units: number; needsPortionDefinition: boolean } {
  if (typeof consumptionQty !== 'number' || isNaN(consumptionQty) || consumptionQty <= 0) {
    return { units: 0, needsPortionDefinition: false };
  }

  const cUnitNorm = normalizeUnit(consumptionUnit);
  const pUnitNorm = normalizeUnit(portionUnit || 'g');

  // Se o insumo é medido por unidade simples (ex: 1 ovo, 2 fatias)
  if (cUnitNorm === 'un') {
    return { units: consumptionQty, needsPortionDefinition: false };
  }

  // Se o insumo é medido por peso (kg ou g)
  if (cUnitNorm === 'kg' || cUnitNorm === 'g') {
    const consumptionInG = cUnitNorm === 'kg' ? consumptionQty * 1000 : consumptionQty;

    if (!portionWeight || portionWeight <= 0) {
      return { units: 0, needsPortionDefinition: true };
    }

    const portionInG = pUnitNorm === 'kg' ? portionWeight * 1000 : portionWeight;
    if (portionInG <= 0) {
      return { units: 0, needsPortionDefinition: true };
    }

    const ratio = consumptionInG / portionInG;
    const rounded = Math.round(ratio * 100) / 100;
    return { units: rounded, needsPortionDefinition: false };
  }

  // Outras unidades sem conversão de peso
  return { units: consumptionQty, needsPortionDefinition: false };
}

/**
 * Encontra o componente de preparo correspondente a uma linha da receita
 */
export function resolveKitchenComponentForRecipeLine(
  recipeItem: { ingredientId: string; quantity: number; kitchenComponentId?: string; productionStation?: RecipeProductionStation; productionKind?: string },
  inventoryItem?: InventoryItem,
  allComponents: KitchenComponent[] = DEFAULT_KITCHEN_COMPONENTS
): { component?: KitchenComponent; needsConfiguration: boolean; isNonKitchen: boolean } {
  // 1. Vínculo explícito na linha da receita (prioridade máxima)
  if (recipeItem.kitchenComponentId) {
    const comp = allComponents.find(c => c.id === recipeItem.kitchenComponentId && c.isActive !== false);
    if (comp) return { component: comp, needsConfiguration: false, isNonKitchen: false };
  }

  // 2. Vínculo padrão herdado do insumo no estoque
  if (inventoryItem?.kitchenComponentId) {
    const comp = allComponents.find(c => c.id === inventoryItem.kitchenComponentId && c.isActive !== false);
    if (comp) return { component: comp, needsConfiguration: false, isNonKitchen: false };
  }

  // 3. Se explicitamente marcado como 'none' (não vai à cozinha, ex: embalagens, gás)
  const station = recipeItem.productionStation || inventoryItem?.productionStation || inventoryItem?.station;
  if (station === 'none' || station === 'nenhuma') {
    return { component: undefined, needsConfiguration: false, isNonKitchen: true };
  }

  // 4. Mapeamento inequívoco de compatibilidade para cadastros legados
  if (inventoryItem) {
    const nameNorm = (inventoryItem.name || '').toLowerCase();
    const catNorm = (inventoryItem.category || '').toLowerCase();

    // Se é embalagem ou utilidade
    if (catNorm.includes('embalag') || catNorm.includes('limpeza') || catNorm.includes('operacional') || nameNorm.includes('embalagem') || nameNorm.includes('sacola')) {
      return { component: undefined, needsConfiguration: false, isNonKitchen: true };
    }

    // Inequívoco: Ovo
    if (nameNorm === 'ovo' || nameNorm === 'ovos' || recipeItem.productionKind === 'egg' || inventoryItem.productionKind === 'egg') {
      const eggComp = allComponents.find(c => c.componentType === 'egg' || c.id === 'cmp-ovo');
      if (eggComp) return { component: eggComp, needsConfiguration: false, isNonKitchen: false };
    }

    // Inequívoco: Frango empanado
    if (nameNorm.includes('frango empanado') || nameNorm.includes('file de frango') || recipeItem.productionKind === 'breaded_chicken' || inventoryItem.productionKind === 'breaded_chicken') {
      const chickenComp = allComponents.find(c => c.id === 'cmp-frango-emp' || c.name.toLowerCase().includes('frango'));
      if (chickenComp) return { component: chickenComp, needsConfiguration: false, isNonKitchen: false };
    }

    // Inequívoco: Queijo empanado
    if (nameNorm.includes('queijo empanado') || (nameNorm.includes('queijo') && nameNorm.includes('minas') && (inventoryItem.station?.includes('fritadeira') || recipeItem.productionStation === 'fryer')) || recipeItem.productionKind === 'breaded_cheese' || inventoryItem.productionKind === 'breaded_cheese') {
      const cheeseComp = allComponents.find(c => c.id === 'cmp-queijo-emp' || c.name.toLowerCase().includes('queijo empanado'));
      if (cheeseComp) return { component: cheeseComp, needsConfiguration: false, isNonKitchen: false };
    }

    // Inequívoco: Anéis de cebola
    if (nameNorm.includes('onion') || nameNorm.includes('anel') || nameNorm.includes('aneis') || nameNorm.includes('cebola congelad') || recipeItem.productionKind === 'onion_rings' || inventoryItem.productionKind === 'onion_rings') {
      const onionComp = allComponents.find(c => c.id === 'cmp-aneis-cebola' || c.name.toLowerCase().includes('cebola') || c.name.toLowerCase().includes('onion'));
      if (onionComp) return { component: onionComp, needsConfiguration: false, isNonKitchen: false };
    }

    // Inequívoco: Batata
    if (nameNorm.includes('batata palito') || nameNorm.includes('batata congelada') || nameNorm.includes('batata rústica') || nameNorm.includes('batata rustica') || recipeItem.productionKind === 'fries') {
      const pw = inventoryItem.portionWeight || (recipeItem.quantity > 0.25 ? 300 : 150);
      if (pw) {
        const matchingFries = allComponents.find(c => c.station === 'fryer' && c.portionWeight === pw);
        if (matchingFries) return { component: matchingFries, needsConfiguration: false, isNonKitchen: false };
      }
      const defaultFries = allComponents.find(c => c.station === 'fryer' && c.name.toLowerCase().includes('batata'));
      if (defaultFries) return { component: defaultFries, needsConfiguration: false, isNonKitchen: false };
    }

    // Inequívoco: Hambúrguer com gramatura explícita ou padrão
    if (recipeItem.productionKind === 'beef_patty' || inventoryItem.productionKind === 'beef_patty' || catNorm.includes('carnes') || nameNorm.includes('hamburguer') || nameNorm.includes('hamb')) {
      const pw = inventoryItem.portionWeight;
      if (pw) {
        const matchingPatty = allComponents.find(c => c.componentType === 'burger' && c.station === 'grill' && c.portionWeight === pw);
        if (matchingPatty) return { component: matchingPatty, needsConfiguration: false, isNonKitchen: false };
      }
      const defaultPatty = allComponents.find(c => c.componentType === 'burger' && c.station === 'grill');
      if (defaultPatty) return { component: defaultPatty, needsConfiguration: false, isNonKitchen: false };
    }
  }

  // Falta configuração explícita e não é item de não-preparo
  return { component: undefined, needsConfiguration: true, isNonKitchen: false };
}

export interface ProductKitchenItemDetail {
  componentId: string;
  name: string;
  componentType: KitchenComponentType;
  station: RecipeProductionStation;
  productionUnit: string;
  portionWeight?: number;
  portionUnit?: string;
  showInSummary: boolean;
  quantity: number; // unidades por 1 produto
  ingredientName: string;
  rawGrams?: number;
}

export interface ProductKitchenBreakdown {
  items: ProductKitchenItemDetail[];
  pendingReview: Array<{
    ingredientId: string;
    ingredientName: string;
    reason: string;
  }>;
}

/**
 * Calcula a composição de componentes de preparo para 1 unidade de um produto
 */
export function calculateProductKitchenComponents(
  product: Partial<Product>,
  inventoryItems: InventoryItem[] = [],
  kitchenComponents: KitchenComponent[] = DEFAULT_KITCHEN_COMPONENTS
): ProductKitchenBreakdown {
  const recipe = Array.isArray(product.recipe) ? product.recipe : [];
  const invMap = new Map<string, InventoryItem>();
  inventoryItems.forEach(i => { if (i.id) invMap.set(i.id, i); });

  const items: ProductKitchenItemDetail[] = [];
  const pendingReview: ProductKitchenBreakdown['pendingReview'] = [];

  for (const r of recipe) {
    const inv = invMap.get(r.ingredientId);
    const { component, needsConfiguration, isNonKitchen } = resolveKitchenComponentForRecipeLine(r, inv, kitchenComponents);

    if (isNonKitchen) {
      continue;
    }

    if (needsConfiguration || !component) {
      pendingReview.push({
        ingredientId: r.ingredientId,
        ingredientName: inv?.name || 'Insumo sem nome',
        reason: 'Componente de preparo não definido para item que vai à cozinha.',
      });
      continue;
    }

    const { units, needsPortionDefinition } = convertPortionRatio(
      r.quantity,
      inv?.unit || 'un',
      component.portionWeight,
      component.portionUnit
    );

    if (needsPortionDefinition) {
      pendingReview.push({
        ingredientId: r.ingredientId,
        ingredientName: inv?.name || component.name,
        reason: 'Defina a porção do componente para calcular a quantidade na cozinha.',
      });
      continue;
    }

    let finalUnits = units;
    if (product.category === 'porcao' && (component.productionUnit === 'porcao' || component.productionUnit === 'unidade')) {
      finalUnits = 1;
    }

    if (finalUnits > 0) {
      items.push({
        componentId: component.id,
        name: component.name,
        componentType: component.componentType,
        station: component.station,
        productionUnit: component.productionUnit,
        portionWeight: component.portionWeight,
        portionUnit: component.portionUnit,
        showInSummary: component.showInSummary !== false,
        quantity: finalUnits,
        ingredientName: inv?.name || component.name,
      });
    }
  }

  return { items, pendingReview };
}

export interface StructuredStationItem {
  componentId: string;
  name: string;
  count: number;
  unit: string;
  portionWeight?: number;
  portionUnit?: string;
  label: string; // Ex: "3x Bovino 180 g"
}

export interface StructuredOrderProductionSummary {
  chapa: {
    totalBurgers: number;
    burgersLabel: string; // "6 HAMBÚRGUERES" ou "1 HAMBÚRGUER"
    burgersBreakdown: StructuredStationItem[];
    otherItems: StructuredStationItem[];
    status: 'ok' | 'sem_carnes' | 'a_conferir';
  };
  fritadeira: {
    totalPreparos: number;
    preparosLabel: string; // "2 PREPAROS" ou "1 PREPARO"
    items: StructuredStationItem[];
    status: 'ok' | 'sem_itens' | 'a_conferir';
  };
  otherStations: Record<string, StructuredStationItem[]>;
  pendingReview: string[];
  isComplete: boolean;
}

/**
 * Constrói o resumo consolidado de produção de um pedido ou lote de pedidos.
 * Respeita estritamente:
 * 1. Agrupar por estação, identificador de componente e porção.
 * 2. Separar carnes de tipos diferentes (bovino, costela, linguiça) e gramaturas diferentes.
 * 3. Somar somente componentes do tipo 'burger' no total de hambúrgueres.
 * 4. Multiplicar rigorosamente pela quantidade vendida sem duplicar.
 * 5. Considerar adicionais e retiradas.
 */
export function calculateOrderProductionRequirements(
  saleItems: SaleItem[],
  products: Product[] = [],
  inventoryItems: InventoryItem[] = [],
  kitchenComponents: KitchenComponent[] = DEFAULT_KITCHEN_COMPONENTS
): StructuredOrderProductionSummary {
  const prodMap = new Map<string, Product>();
  products.forEach(p => { if (p.id) prodMap.set(p.id, p); });

  const compMap = new Map<string, KitchenComponent>();
  kitchenComponents.forEach(c => { if (c.id) compMap.set(c.id, c); });

  const invMap = new Map<string, InventoryItem>();
  inventoryItems.forEach(i => { if (i.id) invMap.set(i.id, i); });

  // Mapas de agregação por identificador estável de componente
  const chapaBurgersMap = new Map<string, { comp: KitchenComponent; count: number }>();
  const chapaOthersMap = new Map<string, { comp: KitchenComponent; count: number }>();
  const fryerMap = new Map<string, { comp: KitchenComponent; count: number }>();
  const otherStationsMap = new Map<string, Map<string, { comp: KitchenComponent; count: number }>>();

  const pendingReviewSet = new Set<string>();

  for (const item of saleItems) {
    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;

    // Se o item já possui um snapshot estruturado persistido no servidor (versão 2)
    if (item.productionSnapshot?.structuredProduction?.components) {
      const snapComponents = item.productionSnapshot.structuredProduction.components;
      for (const sc of snapComponents) {
        const comp = compMap.get(sc.componentId) || {
          id: sc.componentId,
          name: sc.name,
          componentType: sc.componentType,
          station: sc.station,
          productionUnit: sc.productionUnit,
          portionWeight: sc.portionWeight,
          portionUnit: sc.portionUnit,
          showInSummary: sc.showInSummary !== false,
          isActive: true
        };

        const totalComponentCount = sc.quantity * qty;

        if (comp.station === 'grill') {
          if (comp.componentType === 'burger') {
            const current = chapaBurgersMap.get(comp.id) || { comp, count: 0 };
            chapaBurgersMap.set(comp.id, { comp, count: current.count + totalComponentCount });
          } else {
            const current = chapaOthersMap.get(comp.id) || { comp, count: 0 };
            chapaOthersMap.set(comp.id, { comp, count: current.count + totalComponentCount });
          }
        } else if (comp.station === 'fryer') {
          const current = fryerMap.get(comp.id) || { comp, count: 0 };
          fryerMap.set(comp.id, { comp, count: current.count + totalComponentCount });
        } else if (comp.station !== 'none') {
          if (!otherStationsMap.has(comp.station)) {
            otherStationsMap.set(comp.station, new Map());
          }
          const stMap = otherStationsMap.get(comp.station)!;
          const current = stMap.get(comp.id) || { comp, count: 0 };
          stMap.set(comp.id, { comp, count: current.count + totalComponentCount });
        }
      }

      if (Array.isArray(item.productionSnapshot.structuredProduction.pendingReview)) {
        item.productionSnapshot.structuredProduction.pendingReview.forEach(p => pendingReviewSet.add(p));
      }
      continue;
    }

    // Se o item possui snapshot legado (versão 1) com chapaPatties etc.
    if (item.productionSnapshot && item.productionSnapshot.chapaPatties !== undefined && !item.productionSnapshot.structuredProduction?.components) {
      const snap = item.productionSnapshot;
      if (snap.chapaPatties > 0) {
        const burgerComp = kitchenComponents.find(c => c.componentType === 'burger' && c.station === 'grill') || {
          id: 'cmp-bovino-180',
          name: 'Bovino 180 g',
          componentType: 'burger' as const,
          station: 'grill' as const,
          productionUnit: 'disco',
          portionWeight: 180,
          portionUnit: 'g',
          showInSummary: true,
          isActive: true
        };
        const current = chapaBurgersMap.get(burgerComp.id) || { comp: burgerComp, count: 0 };
        chapaBurgersMap.set(burgerComp.id, { comp: burgerComp, count: current.count + snap.chapaPatties });
      }
      if (snap.eggsCount && snap.eggsCount > 0) {
        const eggComp = kitchenComponents.find(c => c.componentType === 'egg' || c.id === 'cmp-ovo') || {
          id: 'cmp-ovo',
          name: 'Ovo',
          componentType: 'egg' as const,
          station: 'grill' as const,
          productionUnit: 'unidade',
          portionWeight: 1,
          portionUnit: 'un',
          showInSummary: true,
          isActive: true
        };
        const current = chapaOthersMap.get(eggComp.id) || { comp: eggComp, count: 0 };
        chapaOthersMap.set(eggComp.id, { comp: eggComp, count: current.count + snap.eggsCount });
      }
      if (snap.fryerChicken && snap.fryerChicken > 0) {
        const chickenComp = kitchenComponents.find(c => c.id === 'cmp-frango-emp') || {
          id: 'cmp-frango-emp',
          name: 'Frango empanado',
          componentType: 'protein' as const,
          station: 'fryer' as const,
          productionUnit: 'unidade',
          portionWeight: 1,
          portionUnit: 'un',
          showInSummary: true,
          isActive: true
        };
        const current = fryerMap.get(chickenComp.id) || { comp: chickenComp, count: 0 };
        fryerMap.set(chickenComp.id, { comp: chickenComp, count: current.count + snap.fryerChicken });
      }
      if (snap.fryerCheese && snap.fryerCheese > 0) {
        const cheeseComp = kitchenComponents.find(c => c.id === 'cmp-queijo-emp') || {
          id: 'cmp-queijo-emp',
          name: 'Queijo empanado',
          componentType: 'side' as const,
          station: 'fryer' as const,
          productionUnit: 'unidade',
          portionWeight: 1,
          portionUnit: 'un',
          showInSummary: true,
          isActive: true
        };
        const current = fryerMap.get(cheeseComp.id) || { comp: cheeseComp, count: 0 };
        fryerMap.set(cheeseComp.id, { comp: cheeseComp, count: current.count + snap.fryerCheese });
      }
      const totalBatatas = (snap.fryerBatatasCombo || 0) + (snap.fryerBatatasAvulsa || 0);
      if (totalBatatas > 0) {
        const friesComp = kitchenComponents.find(c => c.id === 'cmp-batata-peq' || c.name.toLowerCase().includes('batata')) || {
          id: 'cmp-batata-peq',
          name: 'Batata pequena',
          componentType: 'side' as const,
          station: 'fryer' as const,
          productionUnit: 'porcao',
          portionWeight: 150,
          portionUnit: 'g',
          showInSummary: true,
          isActive: true
        };
        const current = fryerMap.get(friesComp.id) || { comp: friesComp, count: 0 };
        fryerMap.set(friesComp.id, { comp: friesComp, count: current.count + totalBatatas });
      }
      const totalOnions = (snap.fryerOnionsCombo || 0) + (snap.fryerOnionsAvulsa || 0);
      if (totalOnions > 0) {
        const onionComp = kitchenComponents.find(c => c.id === 'cmp-aneis-cebola' || c.name.toLowerCase().includes('cebola')) || {
          id: 'cmp-aneis-cebola',
          name: 'Anéis de cebola',
          componentType: 'side' as const,
          station: 'fryer' as const,
          productionUnit: 'porcao',
          portionWeight: 150,
          portionUnit: 'g',
          showInSummary: true,
          isActive: true
        };
        const current = fryerMap.get(onionComp.id) || { comp: onionComp, count: 0 };
        fryerMap.set(onionComp.id, { comp: onionComp, count: current.count + totalOnions });
      }
      continue;
    }

    // Caso contrário, calcula dinamicamente com base na ficha técnica do produto
    const product = prodMap.get(item.productId);
    if (!product) {
      // Se não encontrou o produto no catálogo e não há snapshot
      pendingReviewSet.add(`Produto "${item.productName}" não localizado no cardápio ativo.`);
      continue;
    }

    const { items: baseComponents, pendingReview: basePending } = calculateProductKitchenComponents(
      product,
      inventoryItems,
      kitchenComponents
    );

    basePending.forEach(p => pendingReviewSet.add(`${item.productName}: ${p.reason}`));

    // Aplicar retiradas (removals)
    const activeRemovals = (item.removals || []).map(r => r.toLowerCase().trim());
    
    // Contabilizar cada componente da base multiplicado pela quantidade vendida
    for (const bc of baseComponents) {
      // Se houve retirada correspondente a este insumo
      const isRemoved = activeRemovals.some(rem => 
        bc.ingredientName.toLowerCase().includes(rem) || 
        bc.name.toLowerCase().includes(rem)
      );
      if (isRemoved) continue;

      const comp = compMap.get(bc.componentId) || {
        id: bc.componentId,
        name: bc.name,
        componentType: bc.componentType,
        station: bc.station,
        productionUnit: bc.productionUnit,
        portionWeight: bc.portionWeight,
        portionUnit: bc.portionUnit,
        showInSummary: bc.showInSummary !== false,
        isActive: true
      };

      const totalCount = bc.quantity * qty;

      if (comp.station === 'grill') {
        if (comp.componentType === 'burger') {
          const cur = chapaBurgersMap.get(comp.id) || { comp, count: 0 };
          chapaBurgersMap.set(comp.id, { comp, count: cur.count + totalCount });
        } else {
          const cur = chapaOthersMap.get(comp.id) || { comp, count: 0 };
          chapaOthersMap.set(comp.id, { comp, count: cur.count + totalCount });
        }
      } else if (comp.station === 'fryer') {
        const cur = fryerMap.get(comp.id) || { comp, count: 0 };
        fryerMap.set(comp.id, { comp, count: cur.count + totalCount });
      } else if (comp.station !== 'none') {
        if (!otherStationsMap.has(comp.station)) {
          otherStationsMap.set(comp.station, new Map());
        }
        const stMap = otherStationsMap.get(comp.station)!;
        const cur = stMap.get(comp.id) || { comp, count: 0 };
        stMap.set(comp.id, { comp, count: cur.count + totalCount });
      }
    }

    // Contabilizar Adicionais (additionals)
    if (Array.isArray(item.additionals) && item.additionals.length > 0) {
      for (const add of item.additionals) {
        const addQty = add.quantity && add.quantity > 0 ? add.quantity : 1;
        const totalAddCount = addQty * (qty > 1 ? qty : 1);

        // Tenta associar o adicional a um produto ou insumo cadastrado
        let matchedComp: KitchenComponent | undefined = undefined;

        // Se o adicional veio com productId ou ingredientId
        const addProduct = add.id ? prodMap.get(add.id) : undefined;
        if (addProduct) {
          const addBreakdown = calculateProductKitchenComponents(addProduct, inventoryItems, kitchenComponents);
          for (const ac of addBreakdown.items) {
            const c = compMap.get(ac.componentId);
            if (c) {
              const cTotal = ac.quantity * totalAddCount;
              if (c.station === 'grill') {
                if (c.componentType === 'burger') {
                  const cur = chapaBurgersMap.get(c.id) || { comp: c, count: 0 };
                  chapaBurgersMap.set(c.id, { comp: c, count: cur.count + cTotal });
                } else {
                  const cur = chapaOthersMap.get(c.id) || { comp: c, count: 0 };
                  chapaOthersMap.set(c.id, { comp: c, count: cur.count + cTotal });
                }
              } else if (c.station === 'fryer') {
                const cur = fryerMap.get(c.id) || { comp: c, count: 0 };
                fryerMap.set(c.id, { comp: c, count: cur.count + cTotal });
              }
            }
          }
          continue;
        }

        // Se o adicional é um insumo (ex: Bacon, Ovo, Hambúrguer extra)
        const addNorm = (add.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (addNorm.includes('ovo')) {
          matchedComp = compMap.get('cmp-ovo') || Array.from(compMap.values()).find(c => c.componentType === 'egg');
        } else if (addNorm.includes('carne') || addNorm.includes('burger') || addNorm.includes('hamburguer') || addNorm.includes('patty') || addNorm.includes('costela') || addNorm.includes('linguica')) {
          matchedComp = compMap.get('cmp-bovino-180') || Array.from(compMap.values()).find(c => c.componentType === 'burger');
        } else if (addNorm.includes('batata') || addNorm.includes('frita')) {
          matchedComp = compMap.get('cmp-batata-peq') || Array.from(compMap.values()).find(c => c.station === 'fryer' && c.name.toLowerCase().includes('batata'));
        } else if (addNorm.includes('onion') || addNorm.includes('anel') || addNorm.includes('cebola')) {
          matchedComp = compMap.get('cmp-aneis-cebola') || Array.from(compMap.values()).find(c => c.station === 'fryer' && c.name.toLowerCase().includes('cebola'));
        }

        if (matchedComp) {
          if (matchedComp.station === 'grill') {
            if (matchedComp.componentType === 'burger') {
              const cur = chapaBurgersMap.get(matchedComp.id) || { comp: matchedComp, count: 0 };
              chapaBurgersMap.set(matchedComp.id, { comp: matchedComp, count: cur.count + totalAddCount });
            } else {
              const cur = chapaOthersMap.get(matchedComp.id) || { comp: matchedComp, count: 0 };
              chapaOthersMap.set(matchedComp.id, { comp: matchedComp, count: cur.count + totalAddCount });
            }
          } else if (matchedComp.station === 'fryer') {
            const cur = fryerMap.get(matchedComp.id) || { comp: matchedComp, count: 0 };
            fryerMap.set(matchedComp.id, { comp: matchedComp, count: cur.count + totalAddCount });
          }
        }
      }
    }

    // Contabilizar Combo (se o item vem com combo de batata, onion, etc.)
    const comboProduct = item.comboId ? prodMap.get(item.comboId) : undefined;
    if (comboProduct) {
      const comboBreakdown = calculateProductKitchenComponents(comboProduct, inventoryItems, kitchenComponents);
      for (const cb of comboBreakdown.items) {
        const c = compMap.get(cb.componentId);
        if (c) {
          const cTotal = cb.quantity * qty;
          if (c.station === 'fryer') {
            const cur = fryerMap.get(c.id) || { comp: c, count: 0 };
            fryerMap.set(c.id, { comp: c, count: cur.count + cTotal });
          } else if (c.station === 'grill') {
            if (c.componentType === 'burger') {
              const cur = chapaBurgersMap.get(c.id) || { comp: c, count: 0 };
              chapaBurgersMap.set(c.id, { comp: c, count: cur.count + cTotal });
            } else {
              const cur = chapaOthersMap.get(c.id) || { comp: c, count: 0 };
              chapaOthersMap.set(c.id, { comp: c, count: cur.count + cTotal });
            }
          }
        }
      }
    } else if (item.combo) {
      const comboNorm = item.combo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (comboNorm.includes('onion') || comboNorm.includes('anel') || comboNorm.includes('cebola')) {
        const onionComp = compMap.get('cmp-aneis-cebola') || Array.from(compMap.values()).find(c => c.station === 'fryer' && c.name.toLowerCase().includes('cebola'));
        if (onionComp) {
          const cur = fryerMap.get(onionComp.id) || { comp: onionComp, count: 0 };
          fryerMap.set(onionComp.id, { comp: onionComp, count: cur.count + qty });
        }
      } else if (comboNorm.includes('batata') || comboNorm.includes('frita') || comboNorm.includes('combo')) {
        const friesComp = compMap.get('cmp-batata-peq') || Array.from(compMap.values()).find(c => c.station === 'fryer' && c.name.toLowerCase().includes('batata'));
        if (friesComp) {
          const cur = fryerMap.get(friesComp.id) || { comp: friesComp, count: 0 };
          fryerMap.set(friesComp.id, { comp: friesComp, count: cur.count + qty });
        }
      }
    }
  }

  // Montagem do Resumo de Chapa
  let totalBurgers = 0;
  const burgersBreakdown: StructuredStationItem[] = [];
  chapaBurgersMap.forEach(({ comp, count }) => {
    if (comp.showInSummary !== false) {
      totalBurgers += count;
      burgersBreakdown.push({
        componentId: comp.id,
        name: comp.name,
        count,
        unit: comp.productionUnit,
        portionWeight: comp.portionWeight,
        portionUnit: comp.portionUnit,
        label: `${count}x ${comp.name}`,
      });
    }
  });

  const otherChapaItems: StructuredStationItem[] = [];
  chapaOthersMap.forEach(({ comp, count }) => {
    if (comp.showInSummary !== false) {
      otherChapaItems.push({
        componentId: comp.id,
        name: comp.name,
        count,
        unit: comp.productionUnit,
        label: `${count}x ${comp.name}`,
      });
    }
  });

  // Montagem do Resumo de Fritadeira
  let totalFryer = 0;
  const fryerItems: StructuredStationItem[] = [];
  fryerMap.forEach(({ comp, count }) => {
    if (comp.showInSummary !== false) {
      totalFryer += count;
      fryerItems.push({
        componentId: comp.id,
        name: comp.name,
        count,
        unit: comp.productionUnit,
        portionWeight: comp.portionWeight,
        portionUnit: comp.portionUnit,
        label: `${count}x ${comp.name}`,
      });
    }
  });

  // Outras Estações
  const otherStationsSummary: Record<string, StructuredStationItem[]> = {};
  otherStationsMap.forEach((stMap, stationName) => {
    const list: StructuredStationItem[] = [];
    stMap.forEach(({ comp, count }) => {
      if (comp.showInSummary !== false) {
        list.push({
          componentId: comp.id,
          name: comp.name,
          count,
          unit: comp.productionUnit,
          label: `${count}x ${comp.name}`,
        });
      }
    });
    if (list.length > 0) {
      otherStationsSummary[stationName] = list;
    }
  });

  const hasPending = pendingReviewSet.size > 0;
  const chapaStatus = hasPending ? 'a_conferir' : (totalBurgers === 0 ? 'sem_carnes' : 'ok');
  const fryerStatus = hasPending && totalFryer === 0 ? 'a_conferir' : (totalFryer === 0 ? 'sem_itens' : 'ok');

  return {
    chapa: {
      totalBurgers,
      burgersLabel: totalBurgers === 1 ? '1 HAMBÚRGUER' : `${totalBurgers} HAMBÚRGUERES`,
      burgersBreakdown,
      otherItems: otherChapaItems,
      status: chapaStatus,
    },
    fritadeira: {
      totalPreparos: totalFryer,
      preparosLabel: totalFryer === 1 ? '1 PREPARO' : `${totalFryer} PREPAROS`,
      items: fryerItems,
      status: fryerStatus,
    },
    otherStations: otherStationsSummary,
    pendingReview: Array.from(pendingReviewSet),
    isComplete: !hasPending,
  };
}

/**
 * Cria o snapshot imutável para persistência na venda
 */
export function buildKitchenProductionSnapshot(
  product: Product,
  inventoryItems: InventoryItem[] = [],
  kitchenComponents: KitchenComponent[] = DEFAULT_KITCHEN_COMPONENTS
): StructuredProductionSnapshot {
  const { items, pendingReview } = calculateProductKitchenComponents(product, inventoryItems, kitchenComponents);
  return {
    version: 2,
    calculatedAt: new Date().toISOString(),
    components: items.map(it => ({
      componentId: it.componentId,
      name: it.name,
      componentType: it.componentType,
      station: it.station,
      productionUnit: it.productionUnit,
      portionWeight: it.portionWeight,
      portionUnit: it.portionUnit,
      showInSummary: it.showInSummary,
      quantity: it.quantity,
    })),
    pendingReview: pendingReview.map(p => p.reason),
  };
}
