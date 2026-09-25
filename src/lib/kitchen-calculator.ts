import { inferComponentType, inferPortionWeightFromInventory } from './production-calculator';
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

function componentKey(c: KitchenComponent): string { return JSON.stringify([c.id, c.station, c.componentType, c.productionUnit, c.portionWeight, c.portionUnit]); }

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
  if (typeof consumptionQty !== 'number' || !Number.isFinite(consumptionQty) || consumptionQty <= 0) {
    return { units: 0, needsPortionDefinition: true };
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

    if (!portionWeight || !Number.isFinite(portionWeight) || portionWeight <= 0 || !['kg', 'g'].includes(pUnitNorm)) {
      return { units: 0, needsPortionDefinition: true };
    }

    const portionInG = pUnitNorm === 'kg' ? portionWeight * 1000 : portionWeight;
    if (portionInG <= 0) {
      return { units: 0, needsPortionDefinition: true };
    }

    const ratio = consumptionInG / portionInG;
    return { units: ratio, needsPortionDefinition: false };
  }

  // Outras unidades sem conversão de peso
  return { units: 0, needsPortionDefinition: true };
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
    if (comp) return { component: comp, needsConfiguration: false, isNonKitchen: comp.station === 'none' };
    return { needsConfiguration: true, isNonKitchen: false };
  }

  // 2. Vínculo padrão herdado do insumo no estoque
  if (inventoryItem?.kitchenComponentId) {
    const comp = allComponents.find(c => c.id === inventoryItem.kitchenComponentId && c.isActive !== false);
    if (comp) return { component: comp, needsConfiguration: false, isNonKitchen: comp.station === 'none' };
    return { needsConfiguration: true, isNonKitchen: false };
  }

  // 3. Se explicitamente marcado como 'none' (não vai à cozinha, ex: embalagens, gás)
  const station = inventoryItem?.productionStation ?? recipeItem.productionStation;
  if (!station) return { needsConfiguration: false, isNonKitchen: true };
  if (station === 'none' || station === 'nenhuma') {
    return { component: undefined, needsConfiguration: false, isNonKitchen: true };
  }

  // Legacy recipes retain ingredient identity instead of selecting the first burger
  // with the same weight. Explicit links always take precedence.
  if (inventoryItem) {
    const kind = recipeItem.productionKind || inventoryItem.productionKind;
    const types: Record<string, [KitchenComponentType, RecipeProductionStation]> = {
      carne_bovina: ['burger', 'grill'], ovo: ['egg', 'grill'],
      frango_empanado: ['protein', 'fryer'], queijo_empanado: ['side', 'fryer'],
      batata: ['side', 'fryer'], onion: ['side', 'fryer'],
      beef_patty: ['burger', 'grill'], egg: ['egg', 'grill'],
      breaded_chicken: ['protein', 'fryer'], breaded_cheese: ['side', 'fryer'],
      fries: ['side', 'fryer'], onion_rings: ['side', 'fryer'],
    };
    const resolved = types[kind || ''] || ['other', station] as [KitchenComponentType, RecipeProductionStation];
    if (resolved) {
      const portion = inferPortionWeightFromInventory(inventoryItem);
      return { needsConfiguration: false, isNonKitchen: false, component: {
        id: `ingredient:${inventoryItem.id}`, name: inventoryItem.name,
        componentType: resolved[0], station,
        productionUnit: resolved[0] === 'burger' ? 'disco' : 'unidade',
        portionWeight: portion?.weight, portionUnit: portion?.unit,
        showInSummary: true, isActive: true,
      } };
    }
  }
  return { needsConfiguration: true, isNonKitchen: false };
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

    const finalUnits = Math.round(units);
    if (!Number.isFinite(units) || units <= 0 || Math.abs(units - finalUnits) > 0.000001) {
      pendingReview.push({ ingredientId: r.ingredientId, ingredientName: inv?.name || component.name,
        reason: `Revise a porção de ${inv?.name || component.name}: o consumo não corresponde a unidades inteiras de preparo.` });
      continue;
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
        if (!Number.isFinite(sc.quantity) || sc.quantity <= 0 || !Number.isInteger(sc.quantity)) {
          pendingReviewSet.add(`Composição salva de ${item.productName} contém quantidade inválida. Revise o pedido.`);
          continue;
        }
        const comp = {
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
            const current = chapaBurgersMap.get(componentKey(comp)) || { comp, count: 0 };
            chapaBurgersMap.set(componentKey(comp), { comp, count: current.count + totalComponentCount });
          } else {
            const current = chapaOthersMap.get(componentKey(comp)) || { comp, count: 0 };
            chapaOthersMap.set(componentKey(comp), { comp, count: current.count + totalComponentCount });
          }
        } else if (comp.station === 'fryer') {
          const current = fryerMap.get(componentKey(comp)) || { comp, count: 0 };
          fryerMap.set(componentKey(comp), { comp, count: current.count + totalComponentCount });
        } else if (comp.station !== 'none') {
          if (!otherStationsMap.has(comp.station)) {
            otherStationsMap.set(comp.station, new Map());
          }
          const stMap = otherStationsMap.get(comp.station)!;
          const current = stMap.get(componentKey(comp)) || { comp, count: 0 };
          stMap.set(componentKey(comp), { comp, count: current.count + totalComponentCount });
        }
      }

      if (Array.isArray(item.productionSnapshot.structuredProduction.pendingReview)) {
        item.productionSnapshot.structuredProduction.pendingReview.forEach(p => pendingReviewSet.add(p));
      }
      if (item.productionSnapshot.structuredProduction.version >= 3) continue;
    }

    if (item.productionSnapshot && !item.productionSnapshot.structuredProduction) {
      pendingReviewSet.add(`Pedido ${item.productName} possui composição antiga sem identificação dos componentes. Confira a ficha antes de reemitir.`);
      continue;
    }
    const product = prodMap.get(item.productId);
    const storedBase = item.productionSnapshot?.structuredProduction;
    const { items: baseComponents, pendingReview: basePending } = storedBase
      ? { items: [], pendingReview: [] }
      : product ? calculateProductKitchenComponents(product, inventoryItems, kitchenComponents)
      : { items: [], pendingReview: [{ reason: `Produto "${item.productName}" sem composição identificada.` }] };
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

      const comp = {
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
          const cur = chapaBurgersMap.get(componentKey(comp)) || { comp, count: 0 };
          chapaBurgersMap.set(componentKey(comp), { comp, count: cur.count + totalCount });
        } else {
          const cur = chapaOthersMap.get(componentKey(comp)) || { comp, count: 0 };
          chapaOthersMap.set(componentKey(comp), { comp, count: cur.count + totalCount });
        }
      } else if (comp.station === 'fryer') {
        const cur = fryerMap.get(componentKey(comp)) || { comp, count: 0 };
        fryerMap.set(componentKey(comp), { comp, count: cur.count + totalCount });
      } else if (comp.station !== 'none') {
        if (!otherStationsMap.has(comp.station)) {
          otherStationsMap.set(comp.station, new Map());
        }
        const stMap = otherStationsMap.get(comp.station)!;
        const cur = stMap.get(componentKey(comp)) || { comp, count: 0 };
        stMap.set(componentKey(comp), { comp, count: cur.count + totalCount });
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
        const addProduct = prodMap.get(add.id || '') || products.find(p => p.name === add.name || p.name === `Adicional: ${add.name}`);
        if (addProduct) {
          const addBreakdown = calculateProductKitchenComponents(addProduct, inventoryItems, kitchenComponents);
          addBreakdown.pendingReview.forEach(p => pendingReviewSet.add(`${add.name}: ${p.reason}`));
          for (const ac of addBreakdown.items) {
            const c: KitchenComponent = { ...ac, id: ac.componentId, isActive: true };
            if (c) {
              const cTotal = ac.quantity * totalAddCount;
              if (c.station === 'grill') {
                if (c.componentType === 'burger') {
                  const cur = chapaBurgersMap.get(componentKey(c)) || { comp: c, count: 0 };
                  chapaBurgersMap.set(componentKey(c), { comp: c, count: cur.count + cTotal });
                } else {
                  const cur = chapaOthersMap.get(componentKey(c)) || { comp: c, count: 0 };
                  chapaOthersMap.set(componentKey(c), { comp: c, count: cur.count + cTotal });
                }
              } else if (c.station === 'fryer') {
                const cur = fryerMap.get(componentKey(c)) || { comp: c, count: 0 };
                fryerMap.set(componentKey(c), { comp: c, count: cur.count + cTotal });
              } else if (c.station !== 'none') {
                if (!otherStationsMap.has(c.station)) otherStationsMap.set(c.station, new Map());
                const st = otherStationsMap.get(c.station)!;
                const cur = st.get(componentKey(c)) || { comp: c, count: 0 };
                st.set(componentKey(c), { comp: c, count: cur.count + cTotal });
              }
            }
          }
          continue;
        }

        const inv = invMap.get(add.id || '') || inventoryItems.find(i => i.name.toLowerCase() === add.name.toLowerCase());
        if (inv) {
          const resolved = resolveKitchenComponentForRecipeLine({ ingredientId: inv.id, quantity: 1 }, inv, kitchenComponents);
          matchedComp = resolved.component;
          if (resolved.isNonKitchen) continue;
        }
        if (!matchedComp) {
          pendingReviewSet.add(`Adicional ${add.name}: vincule ao produto ou componente de preparo.`);
          continue;
        }
        if (normalizeUnit(inv?.unit || '') !== 'un') {
          pendingReviewSet.add(`Adicional ${add.name}: cadastre uma ficha com a quantidade consumida.`);
          continue;
        }
        const target = matchedComp.station === 'fryer' ? fryerMap : matchedComp.componentType === 'burger' ? chapaBurgersMap : chapaOthersMap;
        const key = componentKey(matchedComp);
        const current = target.get(key) || { comp: matchedComp, count: 0 };
        target.set(key, { comp: matchedComp, count: current.count + totalAddCount });
      }
    }

    // Contabilizar Combo (se o item vem com combo de batata, onion, etc.)
    const normalizeComboName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^combo:\s*/i, '').trim().toLowerCase();
    const matches = item.combo ? products.filter(p => p.category === 'combo' && normalizeComboName(p.name) === normalizeComboName(item.combo!)) : [];
    const comboProduct = (item.comboId ? prodMap.get(item.comboId) : undefined) || (matches.length === 1 ? matches[0] : undefined);
    if (comboProduct) {
      const comboBreakdown = calculateProductKitchenComponents(comboProduct, inventoryItems, kitchenComponents);
      comboBreakdown.pendingReview.forEach(p => pendingReviewSet.add(`${comboProduct.name}: ${p.reason}`));
      for (const cb of comboBreakdown.items) {
        const c: KitchenComponent = { ...cb, id: cb.componentId, isActive: true };
        if (c) {
          const cTotal = cb.quantity * qty;
          if (c.station === 'fryer') {
            const cur = fryerMap.get(componentKey(c)) || { comp: c, count: 0 };
            fryerMap.set(componentKey(c), { comp: c, count: cur.count + cTotal });
          } else if (c.station === 'grill') {
            if (c.componentType === 'burger') {
              const cur = chapaBurgersMap.get(componentKey(c)) || { comp: c, count: 0 };
              chapaBurgersMap.set(componentKey(c), { comp: c, count: cur.count + cTotal });
            } else {
              const cur = chapaOthersMap.get(componentKey(c)) || { comp: c, count: 0 };
              chapaOthersMap.set(componentKey(c), { comp: c, count: cur.count + cTotal });
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
  const fryerStatus = hasPending ? 'a_conferir' : (totalFryer === 0 ? 'sem_itens' : 'ok');

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

/** Full composition per ONE sold unit, including choices. Never trust a client snapshot. */
export function buildSaleItemKitchenSnapshot(item: SaleItem, products: Product[], inventory: InventoryItem[], components: KitchenComponent[] = DEFAULT_KITCHEN_COMPONENTS): StructuredProductionSnapshot {
  const summary = calculateOrderProductionRequirements([{ ...item, quantity: 1, productionSnapshot: undefined }], products, inventory, components);
  const rows = [...summary.chapa.burgersBreakdown, ...summary.chapa.otherItems, ...summary.fritadeira.items,
    ...Object.values(summary.otherStations).flat()];
  return { version: 3, calculatedAt: new Date().toISOString(), pendingReview: summary.pendingReview,
    components: rows.map(row => ({
      componentId: row.componentId, name: row.name, quantity: row.count,
      componentType: summary.chapa.burgersBreakdown.includes(row) ? 'burger' : (components.find(c => c.id === row.componentId)?.componentType || 'other'),
      station: summary.chapa.burgersBreakdown.includes(row) || summary.chapa.otherItems.includes(row) ? 'grill' : summary.fritadeira.items.includes(row) ? 'fryer' : Object.keys(summary.otherStations).find(key => summary.otherStations[key].includes(row)) as RecipeProductionStation,
      productionUnit: row.unit, portionWeight: row.portionWeight, portionUnit: row.portionUnit, showInSummary: true,
    })) };
}
