import type { CustomerAnalyticsProfile } from './crm-clientes';

export type CustomerSegmentFilter = 'todos' | 'lucrativos' | 'ociosos' | 'risco' | 'frequentes';
export type CustomerChannelFilter = 'todos' | 'balcao' | 'ifood';
export type CustomerSortOption = 'lucro_desc' | 'margem_desc' | 'receita_desc' | 'pedidos_desc' | 'recencia_desc';

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function formatPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function filterAndSortCustomers(
  profiles: CustomerAnalyticsProfile[],
  query: string,
  segment: CustomerSegmentFilter = 'todos',
  channel: CustomerChannelFilter = 'todos',
  sort: CustomerSortOption = 'lucro_desc',
): CustomerAnalyticsProfile[] {
  const normQuery = normalizeText(query);
  const queryDigits = query.replace(/\D/g, '');

  const filtered = profiles.filter((p) => {
    // Filtro por canal
    if (channel !== 'todos' && p.preferredChannel !== channel) {
      return false;
    }

    // Filtro por segmento
    if (segment === 'lucrativos') {
      const isLucrativo =
        p.badges.includes('vip_lucro') ||
        p.badges.includes('alta_margem') ||
        p.profitMargin >= 60;
      if (!isLucrativo) return false;
    } else if (segment === 'ociosos') {
      const isOcioso = p.isOffPeakHero || p.offPeakOrdersCount > 0;
      if (!isOcioso) return false;
    } else if (segment === 'risco') {
      const isRisco =
        p.churnRisk === 'em_risco' ||
        p.churnRisk === 'churn' ||
        p.badges.includes('risco_churn');
      if (!isRisco) return false;
    } else if (segment === 'frequentes') {
      const isFrequente = p.totalOrders >= 3 || p.badges.includes('fiel');
      if (!isFrequente) return false;
    }

    // Busca textual tolerante
    if (!normQuery) return true;

    const normName = normalizeText(p.name || '');
    const normFull = normalizeText(p.rawFullName || '');
    const normAddr = normalizeText(p.address || '');
    const phoneDigits = (p.phone || '').replace(/\D/g, '');

    const matchesName = normName.includes(normQuery);
    const matchesFull = normFull.includes(normQuery);
    const matchesAddr = normAddr.includes(normQuery);
    const matchesPhone = queryDigits.length >= 3 && phoneDigits.includes(queryDigits);

    return matchesName || matchesFull || matchesAddr || matchesPhone;
  });

  return filtered.sort((a, b) => {
    switch (sort) {
      case 'lucro_desc':
        return b.totalGrossProfit - a.totalGrossProfit;
      case 'margem_desc':
        return b.profitMargin - a.profitMargin;
      case 'receita_desc':
        return b.totalSpent - a.totalSpent;
      case 'pedidos_desc':
        return b.totalOrders - a.totalOrders;
      case 'recencia_desc':
        return a.daysSinceLastOrder - b.daysSinceLastOrder;
      default:
        return 0;
    }
  });
}
