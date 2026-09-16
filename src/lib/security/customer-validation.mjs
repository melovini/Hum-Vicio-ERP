export function validateCustomers(input) {
  if (!Array.isArray(input) || !input.length || input.length > 10_000) throw new Error('Importe entre 1 e 10.000 clientes por vez.');
  const ids = new Set();
  const optional = { phone: 40, address: 500, number: 30, neighborhood: 100, city: 100,
    complement: 150, fullAddress: 1000, source: 50, lastOrderDate: 50 };
  return input.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[\w-]{1,120}$/.test(item.id) ||
        ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 150) throw new Error('Cliente inválido ou duplicado.');
    ids.add(item.id);
    const result = { id: item.id, name: item.name.trim(), totalOrders: item.totalOrders ?? 1, importedAt: new Date().toISOString() };
    if (!Number.isSafeInteger(result.totalOrders) || result.totalOrders < 0 || result.totalOrders > 1_000_000) throw new Error('Quantidade de pedidos inválida.');
    for (const [key, length] of Object.entries(optional)) {
      if (item[key] != null) {
        if (typeof item[key] !== 'string' || item[key].length > length) throw new Error('Campo de cliente inválido.');
        result[key] = item[key].trim();
      }
    }
    return result;
  });
}
