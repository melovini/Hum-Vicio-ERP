// === INSUMOS (Inventário) ===
export type StockStatus = 'ok' | 'acabando' | 'zerado';

export type KitchenStation = 
  | 'nenhuma' 
  | 'chapa' 
  | 'fritadeira_frango' 
  | 'fritadeira_queijo' 
  | 'fritadeira_batata' 
  | 'fritadeira_onion';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  costPerUnit: number;
  currentStock: number;
  minStock?: number;
  status: StockStatus;
  isActive?: boolean;
  station?: KitchenStation;
}

// === PRODUTOS (Lanches/Combos) ===
export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

export interface SubRecipeItem {
  id: string;
  parentIngredientId: string;
  childIngredientId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  category: 'lanche' | 'bebida' | 'porcao' | 'combo';
  subcategory?: string;
  priceBalcao: number;
  priceIfood: number;
  recipe: RecipeIngredient[];
  isActive?: boolean;
  status?: 'rascunho' | 'validado' | 'ativo' | 'inativo';
  ncm?: string;
  cest?: string;
  cfop?: string;
  csosn?: string;
  origem?: number;
  unidadeComercial?: string;
  acceptsAddons?: boolean;
  allowedAddonIds?: string[];
  isAddon?: boolean;
}

// === VENDAS ===
export type GiftReason = 
  | 'falta_pedido_anterior'
  | 'fidelidade_cliente'
  | 'atraso_preparo'
  | 'cortesia_casa'
  | 'outro';

export interface SaleItemAdditional {
  id?: string;
  name: string;
  quantity?: number;
  unitPrice?: number;
  price: number;
}

export interface SaleItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  isGift?: boolean;
  giftReason?: GiftReason;
  giftNotes?: string;
  comboId?: string;
  combo?: string;
  comboPrice?: number;
  meatPoint?: string;
  removals?: string[];
  additionals?: SaleItemAdditional[];
  notes?: string;
}

export type ProductionStatus = 'em_producao' | 'em_espera' | 'agendado' | 'concluido';
export type DelayReason = 'erro_producao' | 'falta_insumo' | 'falta_atencao' | 'desperdicio';

export interface Sale {
  id: string;
  customerName?: string;
  orderType?: 'mesa' | 'retirada' | 'delivery';
  channel: 'balcao' | 'ifood';
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  storeCouponSubsidy?: number;
  total: number;
  paymentMethod: string;
  items: SaleItem[];
  date: string;
  createdAt?: string;
  status: 'completed' | 'cancelled';
  isReopened?: boolean;
  reopenedAt?: string;
  reopenedBy?: string;
  originalItemsSnapshot?: SaleItem[];
  orderDiff?: {
    added: SaleItem[];
    removed: SaleItem[];
    modified: { item: SaleItem; oldNotes?: string; newNotes?: string }[];
  };
  isModifiedInKitchen?: boolean;
  hasGifts?: boolean;
  giftsTotalValue?: number;
  productionStatus?: ProductionStatus;
  productionStartedAt?: string;
  productionCompletedAt?: string;
  productionTimeMinutes?: number;
  targetPrepMinutes?: number;
  delayReason?: DelayReason;
  delayNotes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationNotes?: string;
  collaboratorId?: string;
  collaboratorName?: string;
  creditCustomerName?: string;
  creditDueDate?: string;
  creditNotes?: string;
  creditStatus?: 'pendente' | 'quitado';
  creditPaidAt?: string;
  creditPaidMethod?: string;
  fiscalCpfCnpj?: string;
  fiscalStatus?: 'nao_emitida' | 'autorizada' | 'emitida' | 'rejeitada' | 'cancelada' | 'simulada' | 'contingencia';
  fiscalNfceNumber?: number;
  fiscalNfceSeries?: number;
  fiscalAccessKey?: string;
  fiscalXmlUrl?: string;
  fiscalDanfeUrl?: string;
  fiscalQrCode?: string;
  fiscalIssuedAt?: string;
  fiscalProtocol?: string;
  paymentStatus?: 'pago' | 'pendente_retirada';
  paidAt?: string;
  paidMethod?: string;
  isOfflineSynced?: boolean;
  syncStatus?: 'synced' | 'pending' | 'failed';
  syncError?: string;
  idempotencyKey?: string;
}

// === CUSTOS FIXOS MENSAIS ===
export interface FixedExpensesConfig {
  rent: number;
  electricity: number;
  gas: number;
  water: number;
  internetSoftware: number;
  payroll: number;
  proLabore: number;
  otherExpenses: number;
  operatingDaysPerMonth: number;
}

export const DEFAULT_FIXED_EXPENSES: FixedExpensesConfig = {
  rent: 2500,
  electricity: 1200,
  gas: 800,
  water: 250,
  internetSoftware: 350,
  payroll: 4500,
  proLabore: 3000,
  otherExpenses: 500,
  operatingDaysPerMonth: 26
};

// === CAIXA ===
export interface CashMovement {
  id: string;
  type: 'sangria' | 'suprimento';
  amount: number;
  description: string;
  date: string;
}

export interface CashClosingDetails {
  countedCash?: number;
  expectedCash?: number;
  varianceCash?: number;
  countedDebito?: number;
  expectedDebito?: number;
  varianceDebito?: number;
  countedCredito?: number;
  expectedCredito?: number;
  varianceCredito?: number;
  countedPix?: number;
  expectedPix?: number;
  variancePix?: number;
  countedTotal?: number;
  expectedTotal?: number;
  varianceTotal?: number;
  notes?: string;
}

export interface CashSession {
  id: string;
  status: 'open' | 'closed';
  initialAmount: number;
  finalAmount?: number;
  expectedAmount?: number;
  varianceAmount?: number;
  openedBy: string;
  closedBy?: string;
  openedAt: string;
  closedAt?: string;
  closingDetails?: CashClosingDetails;
}

// === AUDITORIA ===
export type AuditAction = 
  | 'CANCELAMENTO_VENDA' 
  | 'FECHAMENTO_CAIXA' 
  | 'ABERTURA_CAIXA' 
  | 'SANGRIA' 
  | 'SUPRIMENTO' 
  | 'ALTERACAO_PRECO' 
  | 'AJUSTE_ESTOQUE' 
  | 'EXCLUSAO_ITEM'
  | 'CADASTRO_PRODUTO'
  | 'DESATIVACAO_PRODUTO'
  | 'ITEM_BRINDE'
  | 'DESCONTO_CONCEDIDO'
  | 'CUPOM_HITS_IFOOD'
  | 'EXCLUSAO_CAIXA_TESTE'
  | 'EXPURGO_VENDAS_TESTE'
  | 'REABERTURA_PEDIDO'
  | 'ALTERACAO_PEDIDO'
  | 'CHECKLIST_TAREFA'
  | 'LIQUIDACAO_FIADO'
  | 'LIQUIDACAO_RETIRADA'
  | 'CUSTOS_FIXOS_CONFIG'
  | 'VINCULO_LOTE_RECEITAS'
  | 'BAIXA_ESTOQUE_VENDA';

export interface AuditLog {
  id: string;
  timestamp: string;
  action: AuditAction;
  operator: string;
  details: string;
  oldValue?: string;
  newValue?: string;
}

// === REGISTRO DE PERDAS ===
export interface WasteRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costAtTime: number;
  totalLoss: number;
  reason: string;
  responsibleName: string;
  createdAt: string;
}

// === CHECKLIST ===
export interface ChecklistTask {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: string;
  registeredByUserId?: string;
  executedByCollaboratorId?: string;
  executedByName?: string;
  completedAt?: string;
}

export interface DailyChecklist {
  id: string;
  date: string;
  tasks: ChecklistTask[];
  signedBy?: string;
}

// === FORNECEDORES & COMPRAS ===
export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  category: string;
  notes: string;
  createdAt?: string;
}

export interface PurchaseRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  supplierId?: string;
  supplierName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  createdAt: string;
}

// === AUDITORIA DE INVENTÁRIO FÍSICO ===
export interface StockAuditItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  costPerUnit: number;
  systemStock: number;
  countedStock: number;
  diff: number;
  varianceCost: number;
}

export interface StockAudit {
  id: string;
  auditedBy: string;
  items: StockAuditItem[];
  totalVarianceCost: number;
  createdAt: string;
}
