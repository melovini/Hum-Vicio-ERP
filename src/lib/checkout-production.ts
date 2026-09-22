import type { SaleItem, Product, InventoryItem, KitchenComponent } from './store/types';
import { calculateItemProduction } from './production-calculator';
import { buildSaleItemKitchenSnapshot } from './kitchen-calculator';

/** Freeze a NEW checkout for immediate printing and offline retry. Historical orders are not rewritten. */
export function prepareCheckoutItems(items: SaleItem[], products: Product[], inventory: InventoryItem[], components: KitchenComponent[]): SaleItem[] {
  return items.map(item => {
    const freshItem = { ...item, productionSnapshot: undefined, notes: item.notes?.trim() ? item.notes.trim().toUpperCase() : undefined };
    return {
      ...freshItem,
      productionSnapshot: {
        ...calculateItemProduction(freshItem, products, inventory),
        structuredProduction: buildSaleItemKitchenSnapshot(freshItem, products, inventory, components),
      },
    };
  });
}
