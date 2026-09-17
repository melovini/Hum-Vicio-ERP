import type { InventoryItem, StockAuditItem } from './store/types';

export type AuditFilterMode = 'all' | 'pending' | 'divergent' | 'matching';

export interface ExtendedAuditItem extends StockAuditItem {
  isCounted: boolean;
}

export interface AuditAnalysisResult {
  auditedList: ExtendedAuditItem[];
  totalMissingCost: number;
  totalSurplusCost: number;
  netVarianceCost: number;
  countedItemsCount: number;
  totalActiveCount: number;
  progressPercentage: number;
  divergentCount: number;
  matchingCount: number;
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function calculateAuditAnalysis(
  items: InventoryItem[],
  counts: Record<string, string>,
): AuditAnalysisResult {
  const activeItems = items.filter((i) => i.isActive !== false);

  let totalMissingCost = 0;
  let totalSurplusCost = 0;
  let countedItemsCount = 0;
  let divergentCount = 0;
  let matchingCount = 0;

  const auditedList: ExtendedAuditItem[] = activeItems.map((item) => {
    const rawVal = counts[item.id];
    const isCounted = rawVal !== undefined && rawVal.trim() !== '';

    let countedStock = item.currentStock;
    if (isCounted) {
      countedItemsCount++;
      const parsed = parseFloat(rawVal);
      countedStock = Number.isFinite(parsed) ? parsed : item.currentStock;
    }

    const diff = Math.round((countedStock - item.currentStock) * 1000) / 1000;
    const varianceCost = Math.round(diff * item.costPerUnit * 100) / 100;

    if (isCounted) {
      if (diff < 0) {
        totalMissingCost += Math.abs(varianceCost);
        divergentCount++;
      } else if (diff > 0) {
        totalSurplusCost += varianceCost;
        divergentCount++;
      } else {
        matchingCount++;
      }
    }

    return {
      id: item.id,
      name: item.name,
      category: item.category || 'Geral',
      unit: item.unit,
      costPerUnit: item.costPerUnit,
      systemStock: item.currentStock,
      countedStock,
      diff,
      varianceCost,
      isCounted,
    };
  });

  const totalActiveCount = activeItems.length;
  const progressPercentage =
    totalActiveCount > 0 ? Math.round((countedItemsCount / totalActiveCount) * 100) : 0;
  const netVarianceCost = Math.round((totalSurplusCost - totalMissingCost) * 100) / 100;

  return {
    auditedList,
    totalMissingCost: Math.round(totalMissingCost * 100) / 100,
    totalSurplusCost: Math.round(totalSurplusCost * 100) / 100,
    netVarianceCost,
    countedItemsCount,
    totalActiveCount,
    progressPercentage,
    divergentCount,
    matchingCount,
  };
}

export function filterAuditItems(
  list: ExtendedAuditItem[],
  query: string,
  filterMode: AuditFilterMode = 'all',
  categoryFilter: string = '',
): ExtendedAuditItem[] {
  const normalizedQuery = normalizeText(query);
  const normalizedCategory = categoryFilter.trim();

  return list.filter((item) => {
    // Modo de filtro
    if (filterMode === 'pending' && item.isCounted) return false;
    if (filterMode === 'divergent' && (!item.isCounted || item.diff === 0)) return false;
    if (filterMode === 'matching' && (!item.isCounted || item.diff !== 0)) return false;

    // Filtro de categoria
    if (normalizedCategory && (item.category || 'Geral').trim() !== normalizedCategory) {
      return false;
    }

    // Busca textual
    if (!normalizedQuery) return true;

    const nameMatch = normalizeText(item.name).includes(normalizedQuery);
    const catMatch = normalizeText(item.category).includes(normalizedQuery);
    return nameMatch || catMatch;
  });
}
