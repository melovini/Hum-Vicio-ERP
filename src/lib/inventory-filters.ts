import type { InventoryItem } from '@/lib/store';

export function filterInventoryItems(
  items: InventoryItem[],
  query: string,
  category: string,
  filterLowStock: boolean,
  showInactive: boolean,
): InventoryItem[] {
  const normalizedQuery = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return items.filter((item) => {
    if (!showInactive && item.isActive === false) return false;
    if (filterLowStock) {
      const min = item.minStock || 0;
      if (min <= 0 || item.currentStock > min) return false;
    }
    if (category && (item.category || 'Geral').toLowerCase() !== category.toLowerCase()) {
      return false;
    }
    if (normalizedQuery) {
      const name = (item.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cat = (item.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const station = (item.station || '').toLowerCase();
      if (!name.includes(normalizedQuery) && !cat.includes(normalizedQuery) && !station.includes(normalizedQuery)) {
        return false;
      }
    }
    return true;
  });
}
