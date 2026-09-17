import type { InventoryItem } from './store/types';

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export type PurchaseFilterMode = 'all' | 'urgent' | 'predictive';

export interface PurchaseCalculation {
  totalCost: number;
  newStock: number;
  costDiffPercentage: number;
}

export function isItemUrgent(item: InventoryItem): boolean {
  if (item.isActive === false) return false;
  if (item.status !== 'ok') return true;
  if (item.minStock !== undefined && item.minStock > 0 && item.currentStock <= item.minStock) {
    return true;
  }
  return false;
}

export function isItemPredictive(item: InventoryItem, salesCount: number): boolean {
  if (item.isActive === false) return false;
  if (isItemUrgent(item)) return false; // Se já é urgente, não duplica como preditivo
  const estimatedConsumption = salesCount * 0.5;
  return item.currentStock < 15 && estimatedConsumption > 2;
}

export function calculatePurchaseTotals(
  quantity: number,
  costPerUnit: number,
  previousCostPerUnit: number,
  currentStock: number,
): PurchaseCalculation {
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const unitCost = Number.isFinite(costPerUnit) && costPerUnit >= 0 ? costPerUnit : 0;
  const prevCost = Number.isFinite(previousCostPerUnit) && previousCostPerUnit >= 0 ? previousCostPerUnit : 0;
  const stock = Number.isFinite(currentStock) ? currentStock : 0;

  const totalCost = Math.round(qty * unitCost * 100) / 100;
  const newStock = Math.round((stock + qty) * 1000) / 1000;
  const costDiffPercentage = prevCost > 0 
    ? Math.round(((unitCost - prevCost) / prevCost) * 1000) / 10 
    : 0;

  return {
    totalCost,
    newStock,
    costDiffPercentage,
  };
}

export function filterPurchaseItems(
  items: InventoryItem[],
  query: string,
  filterMode: PurchaseFilterMode = 'all',
  categoryFilter: string = '',
  salesCount: number = 0,
): InventoryItem[] {
  const normalizedQuery = normalizeText(query);
  const normalizedCategory = categoryFilter.trim();

  return items.filter((item) => {
    // Apenas itens ativos
    if (item.isActive === false) return false;

    // Filtro por modo
    if (filterMode === 'urgent') {
      if (!isItemUrgent(item)) return false;
    } else if (filterMode === 'predictive') {
      if (!isItemPredictive(item, salesCount)) return false;
    }

    // Filtro por categoria
    if (normalizedCategory && (item.category || 'Geral').trim() !== normalizedCategory) {
      return false;
    }

    // Filtro por busca textual
    if (!normalizedQuery) return true;

    const normalizedName = normalizeText(item.name || '');
    const itemCat = normalizeText(item.category || '');
    return normalizedName.includes(normalizedQuery) || itemCat.includes(normalizedQuery);
  });
}
