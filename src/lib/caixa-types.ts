import { Product, SaleItem, Sale, ProductionStatus } from './store';
import { SalaoMesaInstancia } from './mesas';

export type PosTab = 'pdv' | 'mesas' | 'producao' | 'rotas' | 'historico' | 'sangria' | 'contas_receber';

export interface DeliveryRouteBlock {
  id: string;
  courierName: string;
  courierPhone?: string;
  createdAt: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  status: 'montando' | 'em_rota' | 'entregue';
  saleIds: string[];
}

export type PosCategory = 'mais_pedidos' | 'hamburgueres' | 'duplos' | 'bebidas' | 'porcoes';

export interface BurgerCustomizerState {
  product: Product;
  breadType: string;
  meatDoneness: string;
  selectedCombo: string | null;
  selectedAdditionals: { name: string; price: number }[];
  notes: string;
}

export interface CashConferenceValues {
  dinheiroGaveta: string;
  cartaoDebitoMaq: string;
  cartaoCreditoMaq: string;
  pixMaq: string;
  observacoes: string;
}
