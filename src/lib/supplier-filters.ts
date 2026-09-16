interface SearchableSupplier { name: string; contactName: string; category: string }

export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function filterSuppliers<T extends SearchableSupplier>(items: T[], search: string, category: string): T[] {
  const query = normalizeSearch(search);
  return items.filter((item) =>
    (!category || item.category === category) &&
    [item.name, item.contactName, item.category].some((value) => normalizeSearch(value).includes(query)),
  );
}
