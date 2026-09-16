import { KitchenStation, ProductionStatus } from './types';

export const DEFAULT_INGREDIENT_STATIONS: Record<string, KitchenStation> = {
  // Carnes para Chapa
  'hambúrguer bovino 180g': 'chapa',
  'hamburguer bovino 180g': 'chapa',
  'carne bovina (blend)': 'chapa',
  'carne bovina': 'chapa',
  'hambúrguer recheado costela 180g': 'chapa',
  'hamburguer recheado costela 180g': 'chapa',
  'hambúrguer de linguiça 150g': 'chapa',
  'hamburguer de linguiça 150g': 'chapa',
  'hamburguer de linguica 150g': 'chapa',
  'hamb. bovino recheado mozarela 180g': 'chapa',
  'hamb bovino recheado mozarela 180g': 'chapa',

  // Fritadeira - Frango Empanado
  'hamb. frango empanado c/ cream cheese 150g': 'fritadeira_frango',
  'hamb frango empanado c/ cream cheese 150g': 'fritadeira_frango',
  'frango empanado': 'fritadeira_frango',

  // Fritadeira - Queijo Empanado
  'hamb. queijo minas empanado 120g': 'fritadeira_queijo',
  'hamb queijo minas empanado 120g': 'fritadeira_queijo',
  'queijo minas empanado': 'fritadeira_queijo',
  'queijo empanado': 'fritadeira_queijo',

  // Fritadeira - Batatas
  'batata palito congelada': 'fritadeira_batata',
  'batata frita palito': 'fritadeira_batata',
  'batata congelada': 'fritadeira_batata',

  // Fritadeira - Onions
  'anéis de cebola congelados': 'fritadeira_onion',
  'aneis de cebola congelados': 'fritadeira_onion',
  'anéis de cebola': 'fritadeira_onion',
  'aneis de cebola': 'fritadeira_onion',
};

export function getDefaultStationForIngredient(name: string): KitchenStation {
  const norm = (name || '').toLowerCase().trim();
  if (DEFAULT_INGREDIENT_STATIONS[norm]) return DEFAULT_INGREDIENT_STATIONS[norm];
  for (const [key, station] of Object.entries(DEFAULT_INGREDIENT_STATIONS)) {
    if (norm.includes(key) || key.includes(norm)) return station;
  }
  return 'nenhuma';
}

export function getSavedStationMap(): Record<string, KitchenStation> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_ingredient_stations_map') || '{}');
  } catch {
    return {};
  }
}

/**
 * Validador estrito de transições de produção (Frente 4.2 e 5.1)
 * Garante que pedidos cancelados ou concluídos não retornem inadvertidamente
 */
export function isValidProductionTransition(
  currentStatus: ProductionStatus, 
  newStatus: ProductionStatus, 
  isCancelled = false
): boolean {
  if (isCancelled) return false;
  if (currentStatus === newStatus) return true;
  // Se já está concluído, impede regressão para em_producao, em_espera ou agendado
  if (currentStatus === 'concluido') return false;
  // Transições permitidas:
  // em_espera -> em_producao, agendado
  // agendado -> em_espera, em_producao
  // em_producao -> concluido, em_espera
  return true;
}
