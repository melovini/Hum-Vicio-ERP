export const DEFAULT_SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
  lanche: [
    'Smash Burgers',
    'Artesanais 180g',
    'Hambúrgueres Especiais',
    'Linha Duplos',
    'Vegetarianos',
    'Kids',
  ],
  porcao: [
    'Batatas Fritas',
    'Adicionais de Hambúrguer',
    'Molhos & Maioneses da Casa',
    'Petiscos & Empanados',
  ],
  bebida: [
    'Refrigerantes',
    'Sucos & Chás',
    'Águas',
    'Cervejas',
  ],
  combo: [
    'Combos com Batata',
    'Combos Especiais',
  ],
};

import { getActiveCentralConfig, publishCentralConfig } from './central-config';

export type CustomSubcategoriesMap = Record<string, string[]>;

export function getCustomSubcategories(): CustomSubcategoriesMap {
  if (typeof window === 'undefined') return { ...DEFAULT_SUBCATEGORIES_BY_CATEGORY };
  try {
    const central = getActiveCentralConfig();
    return central.subcategoriesByCategory || { ...DEFAULT_SUBCATEGORIES_BY_CATEGORY };
  } catch {
    return { ...DEFAULT_SUBCATEGORIES_BY_CATEGORY };
  }
}

export function saveCustomSubcategories(data: CustomSubcategoriesMap): void {
  if (typeof window === 'undefined') return;
  try {
    publishCentralConfig({ subcategoriesByCategory: data });
  } catch {}
}

export function getSubcategoriesForCategory(category: string, products?: { category: string; subcategory?: string }[]): string[] {
  const all = getCustomSubcategories();

  if (category === 'todas') {
    const set = new Set<string>();
    (['lanche', 'porcao', 'bebida', 'combo'] as const).forEach(cat => {
      const list = all[cat] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[cat] || [];
      list.forEach(s => set.add(s));
    });
    if (products) {
      products.forEach(p => {
        if (p.subcategory && p.subcategory.trim()) {
          set.add(p.subcategory.trim());
        }
      });
    }
    return Array.from(set);
  }

  const base = [...(all[category] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[category] || [])];
  if (!products || products.length === 0) return base;

  // Inclui eventuais subcategorias existentes em produtos que ainda não estejam na lista base
  const set = new Set(base);
  products.forEach(p => {
    if (p.category === category && p.subcategory && !set.has(p.subcategory)) {
      base.push(p.subcategory);
      set.add(p.subcategory);
    }
  });

  return base;
}

export function addSubcategory(category: string, name: string): CustomSubcategoriesMap {
  const trimmed = name.trim();
  const all = getCustomSubcategories();
  if (!trimmed) return all;
  const targetCat = category === 'todas' ? 'lanche' : category;
  const current = all[targetCat] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[targetCat] || [];
  if (current.includes(trimmed)) return all;
  all[targetCat] = [...current, trimmed];
  saveCustomSubcategories(all);
  return all;
}

export function renameSubcategory(category: string, oldName: string, newName: string): CustomSubcategoriesMap {
  const trimmedNew = newName.trim();
  const all = getCustomSubcategories();
  if (!trimmedNew || oldName === trimmedNew) return all;

  if (category === 'todas') {
    (['lanche', 'porcao', 'bebida', 'combo'] as const).forEach(cat => {
      const current = all[cat] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[cat] || [];
      all[cat] = current.map(item => item === oldName ? trimmedNew : item);
    });
  } else {
    const current = all[category] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[category] || [];
    all[category] = current.map(item => item === oldName ? trimmedNew : item);
  }

  saveCustomSubcategories(all);
  return all;
}

export function deleteSubcategory(category: string, name: string): CustomSubcategoriesMap {
  const all = getCustomSubcategories();

  if (category === 'todas') {
    (['lanche', 'porcao', 'bebida', 'combo'] as const).forEach(cat => {
      const current = all[cat] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[cat] || [];
      all[cat] = current.filter(item => item !== name);
    });
  } else {
    const current = all[category] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[category] || [];
    all[category] = current.filter(item => item !== name);
  }

  saveCustomSubcategories(all);
  return all;
}

export function getFallbackSubcategoryForCategory(cat: string): string {
  const all = getCustomSubcategories();
  const list = all[cat] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[cat] || [];
  return list[0] || 'Geral';
}

export function purgeUnusedSubcategories(products: { category: string; subcategory?: string }[]): { countPurged: number; updatedMap: CustomSubcategoriesMap } {
  const all = getCustomSubcategories();
  const used = new Set<string>();
  products.forEach(p => {
    if (p.subcategory && p.subcategory.trim()) {
      used.add(p.subcategory.trim());
    }
  });

  let countPurged = 0;
  (['lanche', 'porcao', 'bebida', 'combo'] as const).forEach(cat => {
    const current = all[cat] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[cat] || [];
    const filtered = current.filter(item => used.has(item));
    countPurged += Math.max(0, current.length - filtered.length);
    all[cat] = filtered.length > 0 ? filtered : (DEFAULT_SUBCATEGORIES_BY_CATEGORY[cat] ? [DEFAULT_SUBCATEGORIES_BY_CATEGORY[cat][0]] : []);
  });

  saveCustomSubcategories(all);
  return { countPurged, updatedMap: all };
}

export function moveSubcategory(category: string, fromIndex: number, toIndexOrDirection: number | 'up' | 'down'): CustomSubcategoriesMap {
  const all = getCustomSubcategories();
  const current = [...(all[category] || DEFAULT_SUBCATEGORIES_BY_CATEGORY[category] || [])];
  let targetIndex: number;
  if (toIndexOrDirection === 'up') {
    targetIndex = fromIndex - 1;
  } else if (toIndexOrDirection === 'down') {
    targetIndex = fromIndex + 1;
  } else {
    targetIndex = toIndexOrDirection;
  }

  if (fromIndex < 0 || fromIndex >= current.length || targetIndex < 0 || targetIndex >= current.length) {
    return all;
  }
  const [removed] = current.splice(fromIndex, 1);
  current.splice(targetIndex, 0, removed);
  all[category] = current;
  saveCustomSubcategories(all);
  return all;
}
