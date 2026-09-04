'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

// === INSUMOS (Inventário) ===
export type StockStatus = 'ok' | 'acabando' | 'zerado';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  costPerUnit: number;
  currentStock: number;
  minStock?: number; // Ponto de Reposição / Estoque Mínimo
  status: StockStatus;
  isActive?: boolean;
}

// === PRODUTOS (Lanches/Combos) ===
export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

// === SUB-RECEITAS / PRÉ-PREPAROS (MAIONESES E MOLHOS) ===
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
  priceBalcao: number;
  priceIfood: number;
  recipe: RecipeIngredient[];
  isActive?: boolean;
}

// === VENDAS ===
export type GiftReason = 
  | 'falta_pedido_anterior' // Esquecimento / Falta no último pedido (ex: batata que faltou)
  | 'fidelidade_cliente'    // Brinde por ser excelente cliente / fidelidade
  | 'atraso_preparo'        // Compensação por atraso na cozinha / entrega
  | 'cortesia_casa'         // Cortesia da gerência / amigo / degustação
  | 'outro';                // Outro motivo com justificativa

export interface SaleItem {
  id?: string; // id único no carrinho
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number; // Preço original antes de ser marcado como brinde
  isGift?: boolean; // Marcação de brinde / cortesia
  giftReason?: GiftReason; // Motivo do brinde
  giftNotes?: string; // Observação explicativa do brinde
  combo?: string;
  comboPrice?: number;
  additionals?: { name: string; price: number }[];
  notes?: string;
}

export type ProductionStatus = 'em_producao' | 'em_espera' | 'agendado' | 'concluido';
export type DelayReason = 'erro_producao' | 'falta_insumo' | 'falta_atencao' | 'desperdicio';

export interface Sale {
  id: string;
  customerName?: string;
  orderType?: 'mesa' | 'retirada' | 'delivery';
  channel: 'balcao' | 'ifood';
  subtotal?: number; // Valor bruto dos itens antes de desconto e taxa
  discount?: number; // Desconto em R$ concedido no pedido
  deliveryFee?: number; // Taxa de entrega em R$ (para modalidade delivery)
  storeCouponSubsidy?: number; // Cupom do iFood custeado pela loja (ex: Cupom Hits R$ 10,00)
  total: number; // Subtotal - discount + deliveryFee
  paymentMethod: string;
  items: SaleItem[];
  date: string;
  createdAt?: string;
  status: 'completed' | 'cancelled';
  // Reabertura e Alteração de Pedidos Fechados:
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
  // Auditoria de Brindes no Pedido:
  hasGifts?: boolean;
  giftsTotalValue?: number; // Total financeiro em R$ dos itens doados
  // Campos KDS & Produção:
  productionStatus?: ProductionStatus;
  productionStartedAt?: string;
  productionCompletedAt?: string;
  productionTimeMinutes?: number;
  targetPrepMinutes?: number;
  delayReason?: DelayReason;
  delayNotes?: string;
  // Campos de Auditoria de Cancelamento:
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationNotes?: string;
  // Contas a Receber (Fiado VIP & Consumo de Funcionários):
  collaboratorId?: string;
  collaboratorName?: string;
  creditCustomerName?: string;
  creditDueDate?: string;
  creditNotes?: string;
  creditStatus?: 'pendente' | 'quitado';
  creditPaidAt?: string;
  creditPaidMethod?: string;
}

// === CUSTOS FIXOS MENSAIS ESTRUTURADOS (DRE & PONTO DE EQUILÍBRIO) ===
export interface FixedExpensesConfig {
  rent: number;               // Aluguel
  electricity: number;        // Energia elétrica / Luz
  gas: number;                // Gás industrial P45
  water: number;              // Água e saneamento
  internetSoftware: number;   // Internet, sistemas, softwares e assinaturas
  payroll: number;            // Folha de pagamento fixa (equipe)
  proLabore: number;          // Pró-labore dos sócios
  otherExpenses: number;      // Outros custos fixos mensais
  operatingDaysPerMonth: number; // Dias de operação por mês (ex: 26)
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

// === CAIXA EM NUVEM ===
export interface CashMovement {
  id: string;
  type: 'sangria' | 'suprimento';
  amount: number;
  description: string;
  date: string;
}

export interface CashSession {
  id: string;
  status: 'open' | 'closed';
  initialAmount: number;
  finalAmount?: number;
  expectedAmount?: number;
  varianceAmount?: number; // finalAmount - expectedAmount (Quebra ou Sobra)
  openedBy: string;
  closedBy?: string;
  openedAt: string;
  closedAt?: string;
}

// === CENTRAL DE LOGS DE AUDITORIA (SEGURANÇA DO ADMINISTRADOR) ===
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
  | 'CUSTOS_FIXOS_CONFIG'
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

// === REGISTRO DE PERDAS (COZINHA) ===
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

// === CHECKLIST DE COZINHA ===
export interface ChecklistTask {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: string; // Nome legível de quem marcou ou registrou
  registeredByUserId?: string; // Sessão/ID do usuário que interagiu
  executedByCollaboratorId?: string; // ID do colaborador que executou o trabalho
  executedByName?: string; // Nome do colaborador que executou o trabalho
  completedAt?: string;
}

export interface DailyChecklist {
  id: string;
  date: string;
  tasks: ChecklistTask[];
  signedBy?: string;
}

// === FORNECEDORES & COMPRAS (FASE 3) ===
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

// === AUDITORIA DE INVENTÁRIO FÍSICO (FASE 3) ===
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

const defaultChecklistTasks: ChecklistTask[] = [
  { id: '1', label: 'Verificar o conteúdo do freezer e geladeiras e ver o que será necessário', checked: false },
  { id: '2', label: 'Verificar os pães e a integridade deles', checked: false },
  { id: '3', label: 'Verificar a quantidade de carne', checked: false },
  { id: '4', label: 'Verificar a lista de compras', checked: false },
  { id: '5', label: 'Verificar o freezer de verduras e queijos', checked: false },
];

function getSavedProductionOverrides(): Record<string, { status: ProductionStatus; startedAt?: string }> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_prod_status_map') || '{}');
  } catch {
    return {};
  }
}

function saveProductionOverrides(updates: { id: string; status: ProductionStatus; startedAt?: string }[]) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedProductionOverrides();
    updates.forEach(u => {
      map[u.id] = { status: u.status, startedAt: u.startedAt };
    });
    localStorage.setItem('hum_vicio_prod_status_map', JSON.stringify(map));
  } catch {}
}

function getSavedMinStockMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_min_stock_map') || '{}');
  } catch {
    return {};
  }
}

function saveMinStockItem(id: string, minStock: number) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedMinStockMap();
    map[id] = minStock;
    localStorage.setItem('hum_vicio_min_stock_map', JSON.stringify(map));
  } catch {}
}

function getSavedCreditSalesMap(): Record<string, {
  collaboratorId?: string;
  collaboratorName?: string;
  creditCustomerName?: string;
  creditDueDate?: string;
  creditNotes?: string;
  creditStatus?: 'pendente' | 'quitado';
  creditPaidAt?: string;
  creditPaidMethod?: string;
}> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('hum_vicio_credit_sales_map') || '{}');
  } catch {
    return {};
  }
}

function saveCreditSaleOverride(saleId: string, creditData: any) {
  if (typeof window === 'undefined') return;
  try {
    const map = getSavedCreditSalesMap();
    map[saleId] = { ...(map[saleId] || {}), ...creditData };
    localStorage.setItem('hum_vicio_credit_sales_map', JSON.stringify(map));
  } catch {}
}

function getSavedFixedExpensesConfig(): FixedExpensesConfig {
  if (typeof window === 'undefined') return DEFAULT_FIXED_EXPENSES;
  try {
    const saved = localStorage.getItem('hum_vicio_fixed_expenses_config');
    if (saved) {
      return { ...DEFAULT_FIXED_EXPENSES, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_FIXED_EXPENSES;
}

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Custos Fixos Mensais (DRE & Ponto de Equilíbrio)
  const [fixedExpensesConfig, setFixedExpensesConfigState] = useState<FixedExpensesConfig>(DEFAULT_FIXED_EXPENSES);

  useEffect(() => {
    setFixedExpensesConfigState(getSavedFixedExpensesConfig());
  }, []);

  const saveFixedExpensesConfig = (config: FixedExpensesConfig) => {
    setFixedExpensesConfigState(config);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hum_vicio_fixed_expenses_config', JSON.stringify(config));
      } catch {}
    }
    const totalMonthly = config.rent + config.electricity + config.gas + config.water + config.internetSoftware + config.payroll + config.proLabore + config.otherExpenses;
    addAuditLog(
      'CUSTOS_FIXOS_CONFIG',
      `Custos Fixos Mensais atualizados. Total mensal: R$ ${totalMonthly.toFixed(2)} (${config.operatingDaysPerMonth} dias úteis).`,
      'Gestor / Admin'
    );
  };

  // Caixa State (em Nuvem)
  const [isOpen, setIsOpen] = useState(false);
  const [activeCashSession, setActiveCashSession] = useState<CashSession | null>(null);
  const [allCashSessions, setAllCashSessions] = useState<CashSession[]>([]);

  // Tempo Médio Dinâmico de Preparo (KDS / Balcão)
  const [targetPrepMinutes, setTargetPrepMinutesState] = useState<number>(20);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('hum_vicio_target_prep_minutes') : null;
    if (saved) setTargetPrepMinutesState(Number(saved) || 20);
  }, []);

  const setTargetPrepMinutes = (mins: number) => {
    setTargetPrepMinutesState(mins);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hum_vicio_target_prep_minutes', mins.toString());
    }
  };
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);

  // Perdas State (em Nuvem)
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);

  // Checklist State
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [allChecklists, setAllChecklists] = useState<DailyChecklist[]>([]);

  // Fase 3 States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
  const [stockAudits, setStockAudits] = useState<StockAudit[]>([]);

  // Sub-receitas State
  const [subRecipes, setSubRecipes] = useState<SubRecipeItem[]>([]);

  // Logs de Auditoria do Administrador (Segurança & Rastreabilidade)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const addAuditLog = async (
    action: AuditAction, 
    details: string, 
    operator?: string, 
    oldValue?: string, 
    newValue?: string
  ) => {
    const newLog: AuditLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      operator: operator || 'Sistema',
      details,
      oldValue,
      newValue
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 500);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_audit_logs', JSON.stringify(updated.slice(0, 200))); } catch {}
      }
      return updated;
    });

    try {
      await supabase.from('audit_logs').insert({
        action: newLog.action,
        operator: newLog.operator,
        details: newLog.details,
        old_value: newLog.oldValue || null,
        new_value: newLog.newValue || null,
        created_at: newLog.timestamp
      });
    } catch (err) {
      console.warn('Registro de auditoria salvo localmente:', err);
    }
  };

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      // 1. Fetch Inventory
      const { data: invData } = await supabase.from('inventory').select('*');
      if (invData) {
        const minStockMap = getSavedMinStockMap();
        setItems(invData.map(i => ({
          id: i.id, name: i.name, category: i.category, unit: i.unit, 
          costPerUnit: Number(i.cost_per_unit) || 0, 
          currentStock: Number(i.current_stock) || 0, 
          minStock: i.min_stock !== undefined && i.min_stock !== null ? Number(i.min_stock) : minStockMap[i.id],
          status: i.status,
          isActive: i.is_active !== undefined ? i.is_active : true
        })));
      }

      // 2. Fetch Products & Recipes
      const { data: prodData } = await supabase.from('products').select('*');
      const { data: recData } = await supabase.from('recipes').select('*');
      
      if (prodData) {
        setProducts(prodData.map(p => ({
          id: p.id, name: p.name, category: p.category, 
          priceBalcao: Number(p.price_balcao) || 0, 
          priceIfood: Number(p.price_ifood) || 0,
          recipe: (recData || []).filter(r => r.product_id === p.id).map(r => ({
            ingredientId: r.ingredient_id,
            quantity: Number(r.quantity) || 0
          }))
        })));
      }

      // 3. Fetch Sales (com suporte a fallback local resiliente)
      try {
        const { data: salesData } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(80);
        const { data: saleItemsData } = await supabase.from('sale_items').select('*');
        
        if (salesData && salesData.length > 0) {
          const overrides = getSavedProductionOverrides();
          const creditMap = getSavedCreditSalesMap();
          const mappedSales: Sale[] = salesData.map(s => {
            const override = overrides[s.id];
            const creditInfo = creditMap[s.id] || {};
            const prodStatus = (override?.status || s.production_status || 'em_espera') as ProductionStatus;
            const prodStarted = override?.startedAt || s.production_started_at || s.created_at;

            return {
              id: s.id, 
              customerName: creditInfo.creditCustomerName || s.customer_name || 'Balcão',
              orderType: (s.order_type || (s.channel === 'ifood' ? 'delivery' : 'mesa')) as any,
              channel: s.channel, 
              total: Number(s.total) || 0, 
              paymentMethod: s.payment_method, 
              date: s.created_at, 
              status: s.status,
              productionStatus: prodStatus,
              productionStartedAt: prodStarted,
              productionCompletedAt: s.production_completed_at || undefined,
              productionTimeMinutes: s.production_time_minutes ? Number(s.production_time_minutes) : undefined,
              targetPrepMinutes: s.target_prep_minutes ? Number(s.target_prep_minutes) : 20,
              delayReason: s.delay_reason || undefined,
              delayNotes: s.delay_notes || undefined,
              collaboratorId: creditInfo.collaboratorId || s.collaborator_id || undefined,
              collaboratorName: creditInfo.collaboratorName || s.collaborator_name || undefined,
              creditCustomerName: creditInfo.creditCustomerName || s.credit_customer_name || undefined,
              creditDueDate: creditInfo.creditDueDate || s.credit_due_date || undefined,
              creditNotes: creditInfo.creditNotes || s.credit_notes || undefined,
              creditStatus: creditInfo.creditStatus || s.credit_status || (s.payment_method === 'consumo_funcionario' || s.payment_method === 'fiado_vip' ? 'pendente' : undefined),
              creditPaidAt: creditInfo.creditPaidAt || s.credit_paid_at || undefined,
              creditPaidMethod: creditInfo.creditPaidMethod || s.credit_paid_method || undefined,
              items: (saleItemsData || []).filter(i => i.sale_id === s.id).map(i => ({
                id: i.id,
                productId: i.product_id, 
                productName: i.product_name, 
                quantity: Number(i.quantity) || 0, 
                unitPrice: Number(i.unit_price) || 0,
                combo: i.combo || undefined,
                notes: i.notes || undefined,
                additionals: Array.isArray(i.additionals) ? i.additionals : undefined
              }))
            };
          });
          setSales(mappedSales);
          if (typeof window !== 'undefined') {
            try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(mappedSales.slice(0, 100))); } catch {}
          }
        } else if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('hum_vicio_cached_sales');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) setSales(parsed);
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar vendas do Supabase, buscando cache local:', err);
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('hum_vicio_cached_sales');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) setSales(parsed);
            } catch {}
          }
        }
      }

      // 4. Fetch Todas as Sessões de Caixa (Histórico + Ativo)
      try {
        const { data: allSessData } = await supabase
          .from('cash_sessions')
          .select('*')
          .order('opened_at', { ascending: false });

        if (allSessData && allSessData.length > 0) {
          const mappedSessions: CashSession[] = allSessData.map(s => ({
            id: s.id,
            status: s.status,
            initialAmount: Number(s.initial_amount) || 0,
            finalAmount: s.final_amount ? Number(s.final_amount) : undefined,
            expectedAmount: s.expected_amount ? Number(s.expected_amount) : undefined,
            varianceAmount: s.variance_amount ? Number(s.variance_amount) : undefined,
            openedBy: s.opened_by,
            closedBy: s.closed_by,
            openedAt: s.opened_at,
            closedAt: s.closed_at
          }));
          setAllCashSessions(mappedSessions);

          const openOne = mappedSessions.find(s => s.status === 'open');
          if (openOne) {
            setActiveCashSession(openOne);
            setIsOpen(true);
          } else {
            setActiveCashSession(null);
            setIsOpen(false);
          }
        } else {
          setAllCashSessions([]);
          setActiveCashSession(null);
          setIsOpen(false);
        }
      } catch (err) {
        console.warn('Tabela cash_sessions ainda não criada:', err);
      }

      // 5. Fetch Movimentações de Caixa
      try {
        const { data: movData } = await supabase
          .from('cash_movements')
          .select('*')
          .order('created_at', { ascending: false });

        if (movData) {
          setMovements(movData.map(m => ({
            id: m.id,
            type: m.type,
            amount: Number(m.amount) || 0,
            description: m.description,
            date: m.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela cash_movements ainda não criada:', err);
      }

      // 6. Fetch Perdas / Desperdícios
      try {
        const { data: wasteData } = await supabase
          .from('waste_records')
          .select('*')
          .order('created_at', { ascending: false });

        if (wasteData) {
          setWasteRecords(wasteData.map(w => ({
            id: w.id,
            ingredientId: w.ingredient_id,
            ingredientName: w.ingredient_name,
            quantity: Number(w.quantity) || 0,
            unit: w.unit,
            costAtTime: Number(w.cost_at_time) || 0,
            totalLoss: Number(w.total_loss) || 0,
            reason: w.reason,
            responsibleName: w.responsible_name,
            createdAt: w.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela waste_records ainda não criada:', err);
      }

      // 7. Fetch Daily Checklist & All Checklists
      const today = new Date().toLocaleDateString('en-CA');
      const { data: allChecks } = await supabase.from('kitchen_checklists').select('*').order('date', { ascending: false });
      
      if (allChecks) {
        const mappedChecks = allChecks.map(c => ({
          id: c.id,
          date: c.date,
          tasks: c.tasks,
          signedBy: c.signed_by
        }));
        setAllChecklists(mappedChecks);
        
        const todayCheck = mappedChecks.find(c => c.date === today);
        if (todayCheck) {
          setChecklist(todayCheck);
        } else {
          setChecklist({ id: '', date: today, tasks: defaultChecklistTasks });
        }
      } else {
        setChecklist({ id: '', date: today, tasks: defaultChecklistTasks });
      }

      // 8. Fetch Fornecedores (Fase 3)
      try {
        const { data: supData } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
        if (supData) {
          setSuppliers(supData.map(s => ({
            id: s.id,
            name: s.name,
            contactName: s.contact_name || '',
            phone: s.phone || '',
            category: s.category || 'Geral',
            notes: s.notes || '',
            createdAt: s.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela suppliers ainda não criada:', err);
      }

      // 9. Fetch Histórico de Compras (Fase 3)
      try {
        const { data: purchData } = await supabase.from('purchase_records').select('*').order('created_at', { ascending: false });
        if (purchData) {
          setPurchaseRecords(purchData.map(p => ({
            id: p.id,
            ingredientId: p.ingredient_id,
            ingredientName: p.ingredient_name,
            supplierId: p.supplier_id,
            supplierName: p.supplier_name || 'Diversos',
            quantity: Number(p.quantity) || 0,
            unit: p.unit,
            costPerUnit: Number(p.cost_per_unit) || 0,
            totalCost: Number(p.total_cost) || 0,
            createdAt: p.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela purchase_records ainda não criada:', err);
      }

      // 10. Fetch Auditorias de Inventário (Fase 3)
      try {
        const { data: auditData } = await supabase.from('stock_audits').select('*').order('created_at', { ascending: false });
        if (auditData) {
          setStockAudits(auditData.map(a => ({
            id: a.id,
            auditedBy: a.audited_by,
            items: a.items || [],
            totalVarianceCost: Number(a.total_variance_cost) || 0,
            createdAt: a.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela stock_audits ainda não criada:', err);
      }

      // 11. Fetch Sub-Receitas
      try {
        const { data: subData } = await supabase.from('sub_recipes').select('*');
        if (subData) {
          setSubRecipes(subData.map(s => ({
            id: s.id,
            parentIngredientId: s.parent_ingredient_id,
            childIngredientId: s.child_ingredient_id,
            quantity: Number(s.quantity) || 0
          })));
        }
      } catch (err) {
        console.warn('Tabela sub_recipes ainda não criada:', err);
      }

      // 12. Fetch Logs de Auditoria
      try {
        const { data: logsData } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
        if (logsData && logsData.length > 0) {
          setAuditLogs(logsData.map((l: any) => ({
            id: l.id,
            timestamp: l.created_at || l.timestamp,
            action: l.action,
            operator: l.operator || 'Sistema',
            details: l.details || '',
            oldValue: l.old_value,
            newValue: l.new_value
          })));
        } else if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('hum_vicio_audit_logs');
          if (cached) setAuditLogs(JSON.parse(cached));
        }
      } catch {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('hum_vicio_audit_logs');
          if (cached) setAuditLogs(JSON.parse(cached));
        }
      }

      setIsLoaded(true);
    };

    loadData();

    // Sincronização instantânea entre abas no mesmo navegador
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'hum_vicio_cached_sales' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setSales(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Polling contínuo a cada 3.5s para sincronizar Caixa e Cozinha em tempo real entre dispositivos
    const syncInterval = setInterval(async () => {
      try {
        const { data: latestSales } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(60);
        const { data: latestItems } = await supabase.from('sale_items').select('*');
        if (latestSales && latestSales.length > 0) {
          const overrides = getSavedProductionOverrides();
          setSales(prev => {
            const localOnly = prev.filter(p => p.id.startsWith('local_') && !latestSales.some(ls => ls.id === p.id));
            const remoteMapped: Sale[] = latestSales.map(s => {
              const existing = prev.find(p => p.id === s.id);
              const override = overrides[s.id];
              const prodStatus = (override?.status || s.production_status || existing?.productionStatus || 'em_espera') as ProductionStatus;
              const prodStarted = override?.startedAt || s.production_started_at || existing?.productionStartedAt || s.created_at;

              return {
                id: s.id,
                customerName: s.customer_name || 'Balcão',
                orderType: (s.order_type || (s.channel === 'ifood' ? 'delivery' : 'mesa')) as any,
                channel: s.channel,
                total: Number(s.total) || 0,
                paymentMethod: s.payment_method,
                date: s.created_at,
                status: s.status,
                productionStatus: prodStatus,
                productionStartedAt: prodStarted,
                productionCompletedAt: s.production_completed_at || undefined,
                productionTimeMinutes: s.production_time_minutes ? Number(s.production_time_minutes) : undefined,
                targetPrepMinutes: s.target_prep_minutes ? Number(s.target_prep_minutes) : 20,
                delayReason: s.delay_reason || undefined,
                delayNotes: s.delay_notes || undefined,
                items: (latestItems || []).filter(i => i.sale_id === s.id).map(i => ({
                  id: i.id,
                  productId: i.product_id,
                  productName: i.product_name,
                  quantity: Number(i.quantity) || 0,
                  unitPrice: Number(i.unit_price) || 0,
                  combo: i.combo || undefined,
                  notes: i.notes || undefined,
                  additionals: Array.isArray(i.additionals) ? i.additionals : undefined
                }))
              };
            });
            return [...localOnly, ...remoteMapped];
          });
        }
      } catch {}
    }, 3500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(syncInterval);
    };
  }, []);

  // --- INSUMOS ACTIONS ---
  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    try {
      let data: any = null;
      let error: any = null;

      try {
        const res = await supabase.from('inventory').insert({
          name: item.name, category: item.category, unit: item.unit, 
          cost_per_unit: item.costPerUnit, current_stock: item.currentStock, status: item.status,
          min_stock: item.minStock
        }).select().single();
        data = res.data;
        error = res.error;
      } catch {
        const fallbackRes = await supabase.from('inventory').insert({
          name: item.name, category: item.category, unit: item.unit, 
          cost_per_unit: item.costPerUnit, current_stock: item.currentStock, status: item.status
        }).select().single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }
      
      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        alert(`Erro ao salvar no banco: ${error.message}`);
        return;
      }
      
      const newId = data ? data.id : ('inv_' + Date.now().toString(36));
      if (item.minStock !== undefined) {
        saveMinStockItem(newId, item.minStock);
      }
      setItems([...items, { ...item, id: newId }]);
    } catch (err: any) {
      alert(`Erro inesperado: ${err.message}`);
    }
  };
  
  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.costPerUnit !== undefined) dbUpdates.cost_per_unit = updates.costPerUnit;
    if (updates.currentStock !== undefined) dbUpdates.current_stock = updates.currentStock;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.minStock !== undefined) {
      saveMinStockItem(id, updates.minStock);
      dbUpdates.min_stock = updates.minStock;
    }

    try {
      await supabase.from('inventory').update(dbUpdates).eq('id', id);
    } catch {
      // Fallback sem min_stock caso coluna não exista no Postgres
      delete dbUpdates.min_stock;
      try {
        await supabase.from('inventory').update(dbUpdates).eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar insumo no Supabase:', err);
      }
    }
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeInventoryItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    try {
      await supabase.from('inventory').update({ is_active: false }).eq('id', id);
    } catch {
      await supabase.from('inventory').delete().eq('id', id);
    }
    setItems(items.map(i => i.id === id ? { ...i, isActive: false } : i));

    addAuditLog(
      'EXCLUSAO_ITEM',
      `Insumo "${item?.name || id}" desativado do inventário.`,
      'Admin'
    );
  };

  const updateStatus = async (id: string, newStatus: StockStatus, remainingQuantity?: number) => {
    const updates: Partial<InventoryItem> = { status: newStatus };
    if (remainingQuantity !== undefined) updates.currentStock = remainingQuantity;
    await updateInventoryItem(id, updates);
  };

  const registerPurchase = async (id: string, quantity: number, newCost: number) => {
    const item = items.find(i => i.id === id);
    if (item) {
      await updateInventoryItem(id, { currentStock: item.currentStock + quantity, costPerUnit: newCost, status: 'ok' });
    }
  };

  // --- REGISTRO DE COMPRA COM FORNECEDOR (FASE 3) ---
  const recordPurchaseWithSupplier = async (
    ingredientId: string, 
    quantity: number, 
    newCost: number,
    supplierId?: string,
    supplierName?: string
  ) => {
    const item = items.find(i => i.id === ingredientId);
    if (!item) return { success: false, error: 'Insumo não encontrado' };

    const totalCost = quantity * newCost;
    const finalSupplierName = supplierName || 'Diversos / Não Informado';

    try {
      // 1. Inserir histórico de compras
      const { data: pData } = await supabase.from('purchase_records').insert({
        ingredient_id: ingredientId,
        ingredient_name: item.name,
        supplier_id: supplierId || null,
        supplier_name: finalSupplierName,
        quantity,
        unit: item.unit,
        cost_per_unit: newCost,
        total_cost: totalCost
      }).select().single();

      // 2. Atualizar estoque e custo unitário
      await updateInventoryItem(ingredientId, {
        currentStock: item.currentStock + quantity,
        costPerUnit: newCost,
        status: 'ok'
      });

      if (pData) {
        const newRecord: PurchaseRecord = {
          id: pData.id,
          ingredientId: pData.ingredient_id,
          ingredientName: pData.ingredient_name,
          supplierId: pData.supplier_id,
          supplierName: pData.supplier_name,
          quantity: Number(pData.quantity),
          unit: pData.unit,
          costPerUnit: Number(pData.cost_per_unit),
          totalCost: Number(pData.total_cost),
          createdAt: pData.created_at
        };
        setPurchaseRecords([newRecord, ...purchaseRecords]);
      }

      return { success: true };
    } catch (err: any) {
      // Fallback
      await registerPurchase(ingredientId, quantity, newCost);
      return { success: true };
    }
  };

  // --- FORNECEDORES ACTIONS (FASE 3) ---
  const addSupplier = async (sup: Omit<Supplier, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase.from('suppliers').insert({
        name: sup.name,
        contact_name: sup.contactName,
        phone: sup.phone,
        category: sup.category,
        notes: sup.notes
      }).select().single();

      if (error) {
        alert(`Erro ao salvar fornecedor: ${error.message}`);
        return;
      }

      if (data) {
        setSuppliers([...suppliers, {
          id: data.id,
          name: data.name,
          contactName: data.contact_name,
          phone: data.phone,
          category: data.category,
          notes: data.notes,
          createdAt: data.created_at
        }]);
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase.from('suppliers').update(dbUpdates).eq('id', id);
    setSuppliers(suppliers.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSupplier = async (id: string) => {
    await supabase.from('suppliers').delete().eq('id', id);
    setSuppliers(suppliers.filter(s => s.id !== id));
  };

  // --- AUDITORIA DE INVENTÁRIO FÍSICO (FASE 3) ---
  const saveStockAudit = async (auditedBy: string, auditItems: StockAuditItem[], totalVarianceCost: number) => {
    try {
      // 1. Salvar relatório da auditoria
      const { data: aData, error: aErr } = await supabase.from('stock_audits').insert({
        audited_by: auditedBy,
        items: auditItems,
        total_variance_cost: totalVarianceCost
      }).select().single();

      if (aErr) {
        console.error('Erro ao salvar auditoria:', aErr);
      }

      // 2. Ajustar saldos de estoque no banco para cada insumo contado
      for (const ai of auditItems) {
        if (ai.diff !== 0) {
          await updateInventoryItem(ai.id, { currentStock: ai.countedStock });
        }
      }

      if (aData) {
        const newAudit: StockAudit = {
          id: aData.id,
          auditedBy: aData.audited_by,
          items: aData.items,
          totalVarianceCost: Number(aData.total_variance_cost),
          createdAt: aData.created_at
        };
        setStockAudits([newAudit, ...stockAudits]);
      }

      addAuditLog(
        'AJUSTE_ESTOQUE',
        `Auditoria física concluída por ${auditedBy}. Variação financeira apurada: R$ ${totalVarianceCost.toFixed(2)}`,
        auditedBy
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // --- PERDAS / DESPERDÍCIO (COZINHA) ---
  const registerWaste = async (ingredientId: string, quantity: number, reason: string, responsibleName: string) => {
    const ing = items.find(i => i.id === ingredientId);
    if (!ing) return { success: false, error: 'Insumo não encontrado no cadastro.' };

    const costAtTime = ing.costPerUnit;
    const totalLoss = costAtTime * quantity;

    try {
      const { data: wData, error: wErr } = await supabase.from('waste_records').insert({
        ingredient_id: ingredientId,
        ingredient_name: ing.name,
        quantity,
        unit: ing.unit,
        cost_at_time: costAtTime,
        total_loss: totalLoss,
        reason,
        responsible_name: responsibleName
      }).select().single();

      if (wErr) {
        console.error('Erro ao registrar perda:', wErr);
      }

      const newStock = Math.max(0, ing.currentStock - quantity);
      await updateInventoryItem(ingredientId, { currentStock: newStock });

      const newRecord: WasteRecord = {
        id: wData ? wData.id : Math.random().toString(36).substring(2, 9),
        ingredientId,
        ingredientName: ing.name,
        quantity,
        unit: ing.unit,
        costAtTime,
        totalLoss,
        reason,
        responsibleName,
        createdAt: wData ? wData.created_at : new Date().toISOString()
      };

      setWasteRecords([newRecord, ...wasteRecords]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getTotalWasteCost = () => {
    return wasteRecords.reduce((acc, w) => acc + (w.totalLoss || 0), 0);
  };

  // --- PRODUTOS ACTIONS ---
  const addProduct = async (prod: Omit<Product, 'id'>) => {
    const { data: pData } = await supabase.from('products').insert({
      name: prod.name, category: prod.category, price_balcao: prod.priceBalcao, price_ifood: prod.priceIfood
    }).select().single();
    
    if (pData) {
      if (prod.recipe && prod.recipe.length > 0) {
        const recipeInserts = prod.recipe.map(r => ({
          product_id: pData.id, ingredient_id: r.ingredientId, quantity: r.quantity
        }));
        await supabase.from('recipes').insert(recipeInserts);
      }
      setProducts([...products, { ...prod, id: pData.id, isActive: true }]);

      addAuditLog(
        'CADASTRO_PRODUTO',
        `Produto "${prod.name}" cadastrado na categoria "${prod.category}". Preço Balcão: R$ ${prod.priceBalcao.toFixed(2)}`,
        'Admin'
      );
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const existing = products.find(p => p.id === id);

    await supabase.from('products').update({
      name: updates.name, category: updates.category, 
      price_balcao: updates.priceBalcao, price_ifood: updates.priceIfood
    }).eq('id', id);

    if (updates.recipe) {
      await supabase.from('recipes').delete().eq('product_id', id);
      if (updates.recipe.length > 0) {
        const recipeInserts = updates.recipe.map(r => ({
          product_id: id, ingredient_id: r.ingredientId, quantity: r.quantity
        }));
        await supabase.from('recipes').insert(recipeInserts);
      }
    }

    if (existing && (updates.priceBalcao !== undefined || updates.priceIfood !== undefined)) {
      if (updates.priceBalcao !== existing.priceBalcao || updates.priceIfood !== existing.priceIfood) {
        addAuditLog(
          'ALTERACAO_PRECO',
          `Preço do produto "${existing.name}" alterado. Balcão: R$ ${existing.priceBalcao.toFixed(2)} -> R$ ${(updates.priceBalcao ?? existing.priceBalcao).toFixed(2)} | iFood: R$ ${existing.priceIfood.toFixed(2)} -> R$ ${(updates.priceIfood ?? existing.priceIfood).toFixed(2)}`,
          'Admin'
        );
      }
    }

    setProducts(products.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProduct = async (id: string) => {
    const prod = products.find(p => p.id === id);
    try {
      await supabase.from('products').update({ is_active: false }).eq('id', id);
    } catch {
      await supabase.from('products').delete().eq('id', id);
    }
    setProducts(products.map(p => p.id === id ? { ...p, isActive: false } : p));

    addAuditLog(
      'DESATIVACAO_PRODUTO',
      `Produto "${prod?.name || id}" desativado do cardápio.`,
      'Admin'
    );
  };

  // Cálculo de custo real do insumo (com suporte a sub-receitas de maioneses e molhos)
  const getIngredientTrueCost = (ingId: string, visited = new Set<string>()): number => {
    const ing = items.find(i => i.id === ingId);
    if (!ing) return 0;
    if (visited.has(ingId)) return ing.costPerUnit;
    visited.add(ingId);

    const children = subRecipes.filter(s => s.parentIngredientId === ingId);
    if (children.length === 0) return ing.costPerUnit;

    const calculated = children.reduce((acc, child) => {
      const childCost = getIngredientTrueCost(child.childIngredientId, new Set(visited));
      return acc + (childCost * child.quantity);
    }, 0);

    return calculated > 0 ? calculated : ing.costPerUnit;
  };

  const getProductCmv = (recipe: RecipeIngredient[]) => {
    return recipe.reduce((total, recipeItem) => {
      const unitCost = getIngredientTrueCost(recipeItem.ingredientId);
      return total + (unitCost * recipeItem.quantity);
    }, 0);
  };

  const saveSubRecipe = async (parentIngredientId: string, components: { childIngredientId: string; quantity: number }[]) => {
    try {
      await supabase.from('sub_recipes').delete().eq('parent_ingredient_id', parentIngredientId);
      if (components.length > 0) {
        const inserts = components.map(c => ({
          parent_ingredient_id: parentIngredientId,
          child_ingredient_id: c.childIngredientId,
          quantity: c.quantity
        }));
        await supabase.from('sub_recipes').insert(inserts);
      }

      const remaining = subRecipes.filter(s => s.parentIngredientId !== parentIngredientId);
      const newItems: SubRecipeItem[] = components.map(c => ({
        id: Math.random().toString(36).substring(2, 9),
        parentIngredientId,
        childIngredientId: c.childIngredientId,
        quantity: c.quantity
      }));
      setSubRecipes([...remaining, ...newItems]);

      // Atualizar o custo do insumo pai no banco com o novo valor somado
      const calculatedCost = components.reduce((acc, c) => {
        const childIng = items.find(i => i.id === c.childIngredientId);
        return acc + ((childIng?.costPerUnit || 0) * c.quantity);
      }, 0);

      if (calculatedCost > 0) {
        await updateInventoryItem(parentIngredientId, { costPerUnit: calculatedCost });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const removeSubRecipe = async (parentIngredientId: string) => {
    try {
      await supabase.from('sub_recipes').delete().eq('parent_ingredient_id', parentIngredientId);
      await removeInventoryItem(parentIngredientId);
      setSubRecipes(subRecipes.filter(s => s.parentIngredientId !== parentIngredientId));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getRealSalesCmv = (salesList?: Sale[]) => {
    const completedSales = (salesList || sales).filter(s => s.status === 'completed');
    let totalCmv = 0;
    
    completedSales.forEach(sale => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product && product.recipe && product.recipe.length > 0) {
            totalCmv += getProductCmv(product.recipe) * item.quantity;
          } else {
            totalCmv += (item.unitPrice * 0.30) * item.quantity;
          }
        });
      } else {
        totalCmv += sale.total * 0.30;
      }
    });

    return totalCmv;
  };

  // --- CAIXA ACTIONS (EM NUVEM) ---
  const openCaixa = async (initialAmount: number, operatorName: string) => {
    try {
      const { data } = await supabase.from('cash_sessions').insert({
        status: 'open',
        initial_amount: initialAmount,
        opened_by: operatorName,
        opened_at: new Date().toISOString()
      }).select().single();

      if (data) {
        const newSess: CashSession = {
          id: data.id,
          status: 'open',
          initialAmount: Number(data.initial_amount) || initialAmount,
          openedBy: data.opened_by || operatorName,
          openedAt: data.opened_at || new Date().toISOString()
        };
        setActiveCashSession(newSess);
        setAllCashSessions(prev => [newSess, ...prev.filter(s => s.id !== newSess.id)]);
      } else {
        const fallbackSess: CashSession = {
          id: 'sess_' + Date.now().toString(36),
          status: 'open',
          initialAmount,
          openedBy: operatorName,
          openedAt: new Date().toISOString()
        };
        setActiveCashSession(fallbackSess);
        setAllCashSessions(prev => [fallbackSess, ...prev]);
      }
      setIsOpen(true);
    } catch {
      const fallbackSess: CashSession = {
        id: 'sess_' + Date.now().toString(36),
        status: 'open',
        initialAmount,
        openedBy: operatorName,
        openedAt: new Date().toISOString()
      };
      setActiveCashSession(fallbackSess);
      setAllCashSessions(prev => [fallbackSess, ...prev]);
      setIsOpen(true);
    }

    addAuditLog(
      'ABERTURA_CAIXA',
      `Caixa aberto por ${operatorName} com fundo de troco inicial de R$ ${initialAmount.toFixed(2)}`,
      operatorName,
      'Fechado',
      `Aberto com R$ ${initialAmount.toFixed(2)}`
    );
  };

  const closeCaixa = async (finalAmount: number, operatorName: string, expectedAmount?: number) => {
    const variance = finalAmount - (expectedAmount || 0);
    const now = new Date().toISOString();

    if (activeCashSession) {
      try {
        await supabase.from('cash_sessions').update({
          status: 'closed',
          final_amount: finalAmount,
          expected_amount: expectedAmount,
          variance_amount: variance,
          closed_by: operatorName,
          closed_at: now
        }).eq('id', activeCashSession.id);
      } catch (err) {
        console.error('Erro ao fechar caixa no banco:', err);
      }

      setAllCashSessions(prev => prev.map(s => {
        if (s.id === activeCashSession.id) {
          return {
            ...s,
            status: 'closed',
            finalAmount,
            expectedAmount,
            varianceAmount: variance,
            closedBy: operatorName,
            closedAt: now
          };
        }
        return s;
      }));
    }

    addAuditLog(
      'FECHAMENTO_CAIXA',
      `Fechamento de Caixa efetuado por ${operatorName}. Contado: R$ ${finalAmount.toFixed(2)} | Esperado: R$ ${(expectedAmount || 0).toFixed(2)} | Diferença: ${variance >= 0 ? `+R$ ${variance.toFixed(2)} (Sobra)` : `-R$ ${Math.abs(variance).toFixed(2)} (Falta)`}`,
      operatorName,
      `Esperado: R$ ${(expectedAmount || 0).toFixed(2)}`,
      `Contado: R$ ${finalAmount.toFixed(2)} (Diferença: R$ ${variance.toFixed(2)})`
    );

    setActiveCashSession(null);
    setIsOpen(false);
  };

  const toggleCaixa = (status: boolean) => {
    if (status) {
      openCaixa(0, 'Operador');
    } else {
      closeCaixa(0, 'Operador');
    }
  };

  // Exclusão de Sessão de Caixa & Expurgar Vendas de Teste (Exclusivo Master Admin)
  const deleteCashSession = async (sessionId: string, masterPassword: string): Promise<{ success: boolean; error?: string; count?: number }> => {
    const cleanPass = masterPassword.trim();
    if (cleanPass !== 'admin') {
      return { success: false, error: 'Senha de Administrador Master incorreta.' };
    }

    const session = allCashSessions.find(s => s.id === sessionId);
    const openedAt = session ? new Date(session.openedAt).getTime() : 0;
    const closedAt = session?.closedAt ? new Date(session.closedAt).getTime() : Date.now();

    // Vendas que ocorreram no período da sessão
    const salesToDelete = sales.filter(s => {
      const saleTime = new Date(s.date).getTime();
      return saleTime >= (openedAt - 120000) && saleTime <= (closedAt + 120000);
    });
    const saleIdsToDelete = salesToDelete.map(s => s.id);

    try {
      if (saleIdsToDelete.length > 0) {
        await supabase.from('sale_items').delete().in('sale_id', saleIdsToDelete);
        await supabase.from('sales').delete().in('id', saleIdsToDelete);
      }
      await supabase.from('cash_sessions').delete().eq('id', sessionId);
    } catch (err) {
      console.warn('Erro ao deletar sessão do banco:', err);
    }

    setAllCashSessions(prev => prev.filter(s => s.id !== sessionId));
    if (saleIdsToDelete.length > 0) {
      setSales(prev => {
        const remaining = prev.filter(s => !saleIdsToDelete.includes(s.id));
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(remaining.slice(0, 100))); } catch {}
        }
        return remaining;
      });
    }

    if (activeCashSession?.id === sessionId) {
      setActiveCashSession(null);
      setIsOpen(false);
    }

    addAuditLog(
      'EXCLUSAO_CAIXA_TESTE',
      `Sessão de Caixa #${sessionId.slice(0, 6)} excluída pelo Administrador Master. ${saleIdsToDelete.length} vendas de teste expurgadas do faturamento.`,
      'Administrador Master'
    );

    return { success: true, count: saleIdsToDelete.length };
  };

  // Exclusão manual direta de vendas de teste selecionadas
  const deleteTestSales = async (saleIds: string[], masterPassword: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = masterPassword.trim();
    if (cleanPass !== 'admin') {
      return { success: false, error: 'Senha de Administrador Master incorreta.' };
    }

    if (!saleIds || saleIds.length === 0) return { success: true };

    try {
      await supabase.from('sale_items').delete().in('sale_id', saleIds);
      await supabase.from('sales').delete().in('id', saleIds);
    } catch (err) {
      console.warn('Erro ao deletar vendas de teste no banco:', err);
    }

    setSales(prev => {
      const remaining = prev.filter(s => !saleIds.includes(s.id));
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(remaining.slice(0, 100))); } catch {}
      }
      return remaining;
    });

    addAuditLog(
      'EXPURGO_VENDAS_TESTE',
      `${saleIds.length} vendas de teste expurgadas do faturamento pelo Administrador Master.`,
      'Administrador Master'
    );

    return { success: true };
  };

  const addSale = async (sale: Omit<Sale, 'id' | 'date' | 'status'>) => {
    const initialProductionStatus = sale.productionStatus || 'em_espera';
    const initialProductionStarted = sale.productionStartedAt || new Date().toISOString();
    const initialTargetPrep = sale.targetPrepMinutes || targetPrepMinutes;
    let sData: any = null;

    // 1. Tentar inserção completa com colunas novas
    try {
      const { data, error } = await supabase.from('sales').insert({
        channel: sale.channel, 
        total: sale.total, 
        payment_method: sale.paymentMethod,
        customer_name: sale.customerName || 'Balcão',
        order_type: sale.orderType || 'mesa',
        production_status: initialProductionStatus,
        production_started_at: initialProductionStarted,
        target_prep_minutes: initialTargetPrep
      }).select().single();

      if (!error && data) {
        sData = data;
      }
    } catch (e) {
      console.warn('Tentativa 1 de inserção falhou:', e);
    }

    // 2. Fallback intermediário caso colunas novas de KDS não existam
    if (!sData) {
      try {
        const { data: retryData, error: retryErr } = await supabase.from('sales').insert({
          channel: sale.channel, 
          total: sale.total, 
          payment_method: sale.paymentMethod,
          customer_name: sale.customerName || 'Balcão',
          order_type: sale.orderType || 'mesa'
        }).select().single();

        if (!retryErr && retryData) {
          sData = retryData;
        }
      } catch (e) {
        console.warn('Tentativa 2 de inserção falhou:', e);
      }
    }

    // 3. Fallback mínimo com colunas base
    if (!sData) {
      try {
        const { data: minData } = await supabase.from('sales').insert({
          channel: sale.channel, 
          total: sale.total, 
          payment_method: sale.paymentMethod
        }).select().single();

        if (minData) {
          sData = minData;
        }
      } catch (e) {
        console.warn('Tentativa 3 de inserção falhou:', e);
      }
    }

    // Gerar ID seguro
    const saleId = sData?.id || ('local_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36));

    // Salvar itens se houver conexão com o banco
    if (sData && sale.items && sale.items.length > 0) {
      try {
        const saleItems = sale.items.map(i => {
          let displayName = i.productName;
          if (i.combo) displayName += ` (${i.combo})`;
          if (i.additionals && i.additionals.length > 0) {
            displayName += ` + [${i.additionals.map(a => a.name).join(', ')}]`;
          }
          if (i.notes) displayName += ` *Obs: ${i.notes}*`;

          return {
            sale_id: sData.id, 
            product_id: i.productId, 
            product_name: displayName,
            quantity: i.quantity, 
            unit_price: i.unitPrice
          };
        });
        await supabase.from('sale_items').insert(saleItems);
      } catch (err) {
        console.warn('Erro ao salvar sale_items no Supabase:', err);
      }
    }

    // Baixa local de estoque imediata & Sincronização Supabase (Explosão de Ficha Técnica)
    const newItems = [...items];
    const deductedItems: { id: string; name: string; deducted: number; remaining: number }[] = [];

    sale.items.forEach(si => {
      const prod = products.find(p => p.id === si.productId);
      if (prod) {
        prod.recipe.forEach(r => {
          const invIdx = newItems.findIndex(inv => inv.id === r.ingredientId);
          if (invIdx > -1) {
            const decr = r.quantity * si.quantity;
            const newStock = Number((newItems[invIdx].currentStock - decr).toFixed(3));
            newItems[invIdx] = { 
              ...newItems[invIdx], 
              currentStock: newStock,
              status: newStock <= 0 ? 'zerado' : (newItems[invIdx].minStock && newStock <= newItems[invIdx].minStock) ? 'acabando' : newItems[invIdx].status
            };
            deductedItems.push({ id: r.ingredientId, name: newItems[invIdx].name, deducted: decr, remaining: newStock });
          }
        });
      }

      // Baixa de insumos por adicionais extras selecionados (ex: Bacon extra, Queijo extra)
      if (si.additionals && si.additionals.length > 0) {
        si.additionals.forEach(add => {
          const matchedInvIdx = newItems.findIndex(inv => 
            inv.name.toLowerCase().includes(add.name.toLowerCase()) || 
            add.name.toLowerCase().includes(inv.name.toLowerCase())
          );
          if (matchedInvIdx > -1) {
            const decr = 1 * si.quantity;
            const newStock = Number((newItems[matchedInvIdx].currentStock - decr).toFixed(3));
            newItems[matchedInvIdx] = {
              ...newItems[matchedInvIdx],
              currentStock: newStock,
              status: newStock <= 0 ? 'zerado' : (newItems[matchedInvIdx].minStock && newStock <= newItems[matchedInvIdx].minStock) ? 'acabando' : newItems[matchedInvIdx].status
            };
            deductedItems.push({ id: newItems[matchedInvIdx].id, name: newItems[matchedInvIdx].name, deducted: decr, remaining: newStock });
          }
        });
      }
    });

    setItems(newItems);

    // Sincronização assíncrona da baixa de estoque no Supabase
    deductedItems.forEach(async dItem => {
      try {
        await supabase.from('inventory').update({ current_stock: dItem.remaining }).eq('id', dItem.id);
      } catch (err) {
        console.warn('Erro ao sincronizar baixa de estoque no Supabase:', err);
      }
    });

    if (deductedItems.length > 0) {
      addAuditLog(
        'BAIXA_ESTOQUE_VENDA',
        `Explosão de receita: baixa automática de ${deductedItems.length} insumo(s) referente ao pedido de "${sale.customerName || 'Balcão'}".`,
        'Sistema'
      );
    }

    // Identificação de Brindes no Pedido
    const giftItems = (sale.items || []).filter(i => i.isGift);
    const hasGifts = giftItems.length > 0;
    const giftsTotalValue = giftItems.reduce((acc, i) => acc + ((i.originalPrice || 0) * i.quantity), 0);

    // Auditoria automática de brindes concedidos pelo operador
    giftItems.forEach(g => {
      const reasonLabel = 
        g.giftReason === 'falta_pedido_anterior' ? 'Falta / Esquecimento no pedido anterior' :
        g.giftReason === 'fidelidade_cliente' ? 'Fidelidade / Excelente cliente' :
        g.giftReason === 'atraso_preparo' ? 'Atraso no preparo / Atendimento' :
        g.giftReason === 'cortesia_casa' ? 'Cortesia da casa' : 'Outro motivo';
      
      addAuditLog(
        'ITEM_BRINDE',
        `Item marcado como Brinde no pedido de "${sale.customerName || 'Balcão'}": ${g.quantity}x ${g.productName}. Motivo: ${reasonLabel}${g.giftNotes ? ` (Obs: ${g.giftNotes})` : ''}. Valor estornado: R$ ${((g.originalPrice || 0) * g.quantity).toFixed(2)}`,
        'Operador',
        `R$ ${((g.originalPrice || 0) * g.quantity).toFixed(2)}`,
        'R$ 0.00'
      );
    });

    // Auditoria de desconto concedido
    if (sale.discount && sale.discount > 0) {
      addAuditLog(
        'DESCONTO_CONCEDIDO',
        `Desconto de R$ ${sale.discount.toFixed(2)} concedido no pedido de "${sale.customerName || 'Balcão'}". Subtotal: R$ ${(sale.subtotal || sale.total).toFixed(2)} -> Total Final: R$ ${sale.total.toFixed(2)}`,
        'Operador',
        `R$ ${(sale.subtotal || sale.total).toFixed(2)}`,
        `R$ ${sale.total.toFixed(2)}`
      );
    }

    // Auditoria de cupom iFood custeado pela loja (Hits)
    if (sale.storeCouponSubsidy && sale.storeCouponSubsidy > 0) {
      addAuditLog(
        'CUPOM_HITS_IFOOD',
        `Pedido no iFood com cupom custeado pela loja no valor de R$ ${sale.storeCouponSubsidy.toFixed(2)} (${sale.customerName || 'Cliente iFood'}).`,
        'Operador',
        undefined,
        `Subsídio Loja: R$ ${sale.storeCouponSubsidy.toFixed(2)}`
      );
    }

    // Configuração de Vendas a Prazo / Contas a Receber
    const isCreditSale = sale.paymentMethod === 'consumo_funcionario' || sale.paymentMethod === 'fiado_vip';
    const creditStatus = isCreditSale ? (sale.creditStatus || 'pendente') : undefined;

    // O pedido É SEMPRE INCLUÍDO E NUNCA SE PERDE!
    const newSaleLocal: Sale = {
      ...sale,
      id: saleId,
      customerName: sale.customerName || (sale.paymentMethod === 'consumo_funcionario' ? sale.collaboratorName : sale.creditCustomerName) || 'Balcão',
      orderType: sale.orderType || 'mesa',
      subtotal: sale.subtotal !== undefined ? sale.subtotal : sale.total,
      discount: sale.discount || 0,
      deliveryFee: sale.deliveryFee || 0,
      storeCouponSubsidy: sale.storeCouponSubsidy || 0,
      hasGifts,
      giftsTotalValue,
      productionStatus: initialProductionStatus,
      productionStartedAt: initialProductionStarted,
      targetPrepMinutes: initialTargetPrep,
      collaboratorId: sale.collaboratorId,
      collaboratorName: sale.collaboratorName,
      creditCustomerName: sale.creditCustomerName,
      creditDueDate: sale.creditDueDate,
      creditNotes: sale.creditNotes,
      creditStatus,
      creditPaidAt: sale.creditPaidAt,
      creditPaidMethod: sale.creditPaidMethod,
      date: sData?.created_at || new Date().toISOString(),
      status: 'completed'
    };

    // Salvar override do pedido para persistir localmente e nunca voltar para espera
    saveProductionOverrides([{ id: saleId, status: initialProductionStatus, startedAt: initialProductionStarted }]);

    if (isCreditSale) {
      saveCreditSaleOverride(saleId, {
        collaboratorId: sale.collaboratorId,
        collaboratorName: sale.collaboratorName,
        creditCustomerName: sale.creditCustomerName,
        creditDueDate: sale.creditDueDate,
        creditNotes: sale.creditNotes,
        creditStatus,
        creditPaidAt: sale.creditPaidAt,
        creditPaidMethod: sale.creditPaidMethod
      });
    }

    setSales(prev => {
      const updated = [newSaleLocal, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });
  };

  // Liquidação de Contas a Receber (Fiado VIP e Consumo de Funcionários)
  const settleCreditSale = async (saleId: string, paymentMethod: string, operatorName: string) => {
    const target = sales.find(s => s.id === saleId);
    if (!target) return { success: false, message: 'Venda não encontrada' };

    const paidAt = new Date().toISOString();
    const updatedSale: Sale = {
      ...target,
      creditStatus: 'quitado',
      creditPaidAt: paidAt,
      creditPaidMethod: paymentMethod
    };

    saveCreditSaleOverride(saleId, {
      creditStatus: 'quitado',
      creditPaidAt: paidAt,
      creditPaidMethod: paymentMethod
    });

    setSales(prev => {
      const updated = prev.map(s => s.id === saleId ? updatedSale : s);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    // Se o cliente quitou em dinheiro físico no balcão, insere suprimento na gaveta do caixa ativo
    if (paymentMethod === 'dinheiro') {
      await addMovement({
        type: 'suprimento',
        amount: target.total,
        description: `Recebimento Quitação ${target.paymentMethod === 'consumo_funcionario' ? 'Consumo Equipe' : 'Fiado VIP'} #${saleId.slice(0, 5).toUpperCase()} (${target.customerName || target.collaboratorName || 'Cliente'})`
      });
    }

    addAuditLog(
      'LIQUIDACAO_FIADO',
      `Conta a Receber #${saleId.slice(0, 6).toUpperCase()} liquidada no valor de R$ ${target.total.toFixed(2)} via ${paymentMethod.toUpperCase()} (${target.customerName || target.collaboratorName || 'Cliente'}).`,
      operatorName || 'Operador',
      'pendente',
      'quitado'
    );

    return { success: true, sale: updatedSale };
  };

  // Ação do Balcão: alterar status de produção (para chapa, em espera, agendado)
  const updateOrderProductionStatus = async (saleId: string, newStatus: ProductionStatus) => {
    const startedAt = newStatus === 'em_producao' ? new Date().toISOString() : undefined;
    
    // 1. Salvar override no storage local para nunca ser sobrescrito pelo polling
    saveProductionOverrides([{ id: saleId, status: newStatus, startedAt: startedAt || new Date().toISOString() }]);

    // 2. Atualizar no Supabase
    try {
      const updateData: any = { production_status: newStatus };
      if (startedAt) updateData.production_started_at = startedAt;
      await supabase.from('sales').update(updateData).eq('id', saleId);
    } catch (err) {
      console.warn('Erro ao atualizar status de produção no Supabase:', err);
    }

    setSales(prev => {
      const updated = prev.map(s => {
        if (s.id === saleId) {
          return {
            ...s,
            productionStatus: newStatus,
            productionStartedAt: startedAt || s.productionStartedAt || s.date
          };
        }
        return s;
      });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });
  };

  // Ação do Balcão: Enviar múltiplos pedidos em lote para a Chapa de uma vez
  const updateBatchProductionStatus = async (saleIds: string[], newStatus: ProductionStatus) => {
    if (!saleIds || saleIds.length === 0) return;
    const startedAt = newStatus === 'em_producao' ? new Date().toISOString() : undefined;

    // 1. Salvar overrides de todos os pedidos selecionados
    saveProductionOverrides(saleIds.map(id => ({ 
      id, 
      status: newStatus, 
      startedAt: startedAt || new Date().toISOString() 
    })));

    // 2. Atualizar no Supabase em lote
    try {
      const updateData: any = { production_status: newStatus };
      if (startedAt) updateData.production_started_at = startedAt;
      await supabase.from('sales').update(updateData).in('id', saleIds);
    } catch (err) {
      console.warn('Erro ao atualizar lote de pedidos no Supabase:', err);
    }

    setSales(prev => {
      const updated = prev.map(s => {
        if (saleIds.includes(s.id)) {
          return {
            ...s,
            productionStatus: newStatus,
            productionStartedAt: startedAt || s.productionStartedAt || s.date
          };
        }
        return s;
      });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });
  };

  // Ação da Cozinha: concluir pedido (com justificativa de atraso se aplicável)
  const completeOrderProduction = async (saleId: string, delayReason?: DelayReason, delayNotes?: string) => {
    const completedAt = new Date().toISOString();
    const existing = sales.find(s => s.id === saleId);
    let timeMinutes = 0;
    if (existing?.productionStartedAt) {
      const startMs = new Date(existing.productionStartedAt).getTime();
      const endMs = new Date(completedAt).getTime();
      timeMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
    }

    try {
      const updateData: any = {
        production_status: 'concluido',
        production_completed_at: completedAt,
        production_time_minutes: timeMinutes
      };
      if (delayReason) {
        updateData.delay_reason = delayReason;
        updateData.delay_notes = delayNotes;
      }
      await supabase.from('sales').update(updateData).eq('id', saleId);
    } catch (err) {
      console.warn('Erro ao concluir produção no Supabase:', err);
    }

    // Salvar override no storage local para nunca ressuscitar na chapa
    saveProductionOverrides([{ id: saleId, status: 'concluido', startedAt: existing?.productionStartedAt }]);

    setSales(prev => {
      const updated = prev.map(s => {
        if (s.id === saleId) {
          return {
            ...s,
            productionStatus: 'concluido' as ProductionStatus,
            productionCompletedAt: completedAt,
            productionTimeMinutes: timeMinutes,
            delayReason: delayReason || s.delayReason,
            delayNotes: delayNotes || s.delayNotes
          };
        }
        return s;
      });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });
  };

  const cancelSale = async (id: string, reason?: string, authorizedBy?: string, notes?: string) => {
    // Salvar override no storage local
    saveProductionOverrides([{ id, status: 'concluido' }]);

    const existingSale = sales.find(s => s.id === id);
    const cancellationReason = reason || 'Cancelamento manual pelo operador';
    const cancelledBy = authorizedBy || 'Supervisor / Admin';
    const now = new Date().toISOString();

    try {
      await supabase.from('sales').update({ 
        status: 'cancelled',
        cancellation_reason: cancellationReason,
        cancelled_by: cancelledBy,
        cancelled_at: now
      }).eq('id', id);
    } catch (err) {
      console.warn('Erro ao cancelar venda no Supabase:', err);
    }
    
    // Estornar estoque localmente
    const saleToCancel = existingSale;
    if (saleToCancel && saleToCancel.items) {
      const restoredItems = [...items];
      saleToCancel.items.forEach(si => {
        const prod = products.find(p => p.id === si.productId);
        if (prod) {
          prod.recipe.forEach(r => {
            const invIdx = restoredItems.findIndex(inv => inv.id === r.ingredientId);
            if (invIdx > -1) {
              restoredItems[invIdx] = { 
                ...restoredItems[invIdx], 
                currentStock: restoredItems[invIdx].currentStock + (r.quantity * si.quantity) 
              };
            }
          });
        }
      });
      setItems(restoredItems);
    }

    setSales(prev => {
      const updated = prev.map(s => s.id === id ? { 
        ...s, 
        status: 'cancelled' as const,
        cancellationReason,
        cancelledBy,
        cancelledAt: now,
        cancellationNotes: notes
      } : s);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    addAuditLog(
      'CANCELAMENTO_VENDA',
      `Venda #${id.slice(0, 5).toUpperCase()} no valor de R$ ${existingSale?.total.toFixed(2) || '0.00'} foi estornada por ${cancelledBy}. Motivo: ${cancellationReason}.${notes ? ` Obs: ${notes}` : ''}`,
      cancelledBy,
      'Concluída',
      'Cancelada'
    );
  };

  // Reabertura de Pedido Fechado para Edição com Preservação de Identidade
  const reopenOrderForEdit = async (saleId: string, authorizedBy: string): Promise<Sale | null> => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return null;

    const snapshot: SaleItem[] = JSON.parse(JSON.stringify(sale.items));
    const updatedSale: Sale = {
      ...sale,
      isReopened: true,
      reopenedAt: new Date().toISOString(),
      reopenedBy: authorizedBy,
      originalItemsSnapshot: snapshot
    };

    setSales(prev => {
      const updated = prev.map(s => s.id === saleId ? updatedSale : s);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    try {
      await supabase.from('sales').update({
        production_status: 'em_espera'
      }).eq('id', saleId);
    } catch (e) {
      console.warn('Erro ao atualizar reabertura no banco:', e);
    }

    addAuditLog(
      'REABERTURA_PEDIDO',
      `Pedido #${saleId.slice(0, 6).toUpperCase()} (${sale.customerName || 'Cliente'}) reaberto para edição por ${authorizedBy}. Total antes da edição: R$ ${sale.total.toFixed(2)}.`,
      authorizedBy,
      `R$ ${sale.total.toFixed(2)}`,
      'Em Edição'
    );

    return updatedSale;
  };

  // Atualizar Pedido Reaberto e Calcular Delta / Diff de Itens
  const updateReopenedOrder = async (
    saleId: string, 
    updatedSaleData: Partial<Sale>
  ): Promise<{ success: boolean; sale?: Sale; diff?: { added: SaleItem[]; removed: SaleItem[]; modified: { item: SaleItem; oldNotes?: string; newNotes?: string }[] } }> => {
    const existingSale = sales.find(s => s.id === saleId);
    if (!existingSale) return { success: false };

    const oldItems: SaleItem[] = existingSale.originalItemsSnapshot || existingSale.items || [];
    const newItems: SaleItem[] = updatedSaleData.items || [];

    // 1. Calcular Adicionados
    const added: SaleItem[] = [];
    newItems.forEach(newItem => {
      const matchingOld = oldItems.find(o => o.productId === newItem.productId && (o.notes || '') === (newItem.notes || ''));
      if (!matchingOld) {
        added.push(newItem);
      } else if (newItem.quantity > matchingOld.quantity) {
        added.push({ ...newItem, quantity: newItem.quantity - matchingOld.quantity });
      }
    });

    // 2. Calcular Removidos
    const removed: SaleItem[] = [];
    oldItems.forEach(oldItem => {
      const matchingNew = newItems.find(n => n.productId === oldItem.productId && (n.notes || '') === (oldItem.notes || ''));
      if (!matchingNew) {
        removed.push(oldItem);
      } else if (matchingNew.quantity < oldItem.quantity) {
        removed.push({ ...oldItem, quantity: oldItem.quantity - matchingNew.quantity });
      }
    });

    // 3. Calcular Modificados (ex: observação alterada no mesmo lanche)
    const modified: { item: SaleItem; oldNotes?: string; newNotes?: string }[] = [];
    newItems.forEach(newItem => {
      const sameProductOld = oldItems.find(o => o.productId === newItem.productId);
      if (sameProductOld && (sameProductOld.notes || '') !== (newItem.notes || '')) {
        modified.push({
          item: newItem,
          oldNotes: sameProductOld.notes,
          newNotes: newItem.notes
        });
      }
    });

    const orderDiff = { added, removed, modified };

    const finalizedSale: Sale = {
      ...existingSale,
      ...updatedSaleData,
      orderDiff,
      isModifiedInKitchen: true,
      productionStatus: 'em_producao' // Reativa na chapa se alterado
    };

    setSales(prev => {
      const updated = prev.map(s => s.id === saleId ? finalizedSale : s);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_cached_sales', JSON.stringify(updated.slice(0, 100))); } catch {}
      }
      return updated;
    });

    try {
      await supabase.from('sales').update({
        total: finalizedSale.total,
        subtotal: finalizedSale.subtotal,
        discount: finalizedSale.discount,
        delivery_fee: finalizedSale.deliveryFee,
        production_status: 'em_producao'
      }).eq('id', saleId);
    } catch (e) {
      console.warn('Erro ao salvar alteração de venda no banco:', e);
    }

    addAuditLog(
      'ALTERACAO_PEDIDO',
      `Pedido #${saleId.slice(0, 6).toUpperCase()} editado e sincronizado. Delta: +${added.length} adicionados, -${removed.length} removidos, *${modified.length} modificados. Total ajustado: R$ ${finalizedSale.total.toFixed(2)}.`,
      existingSale.reopenedBy || 'Supervisor',
      `R$ ${existingSale.total.toFixed(2)}`,
      `R$ ${finalizedSale.total.toFixed(2)}`
    );

    return { success: true, sale: finalizedSale, diff: orderDiff };
  };

  const addMovement = async (mov: Omit<CashMovement, 'id' | 'date'>) => {
    try {
      const { data } = await supabase.from('cash_movements').insert({
        type: mov.type,
        amount: mov.amount,
        description: mov.description
      }).select().single();

      const newMov: CashMovement = {
        id: data ? data.id : Math.random().toString(36).substr(2, 9),
        type: mov.type,
        amount: mov.amount,
        description: mov.description,
        date: data ? data.created_at : new Date().toISOString()
      };

      setMovements([newMov, ...movements]);
    } catch {
      const fallbackMov: CashMovement = {
        id: Math.random().toString(36).substr(2, 9),
        type: mov.type,
        amount: mov.amount,
        description: mov.description,
        date: new Date().toISOString()
      };
      setMovements([fallbackMov, ...movements]);
    }

    addAuditLog(
      mov.type === 'sangria' ? 'SANGRIA' : 'SUPRIMENTO',
      `${mov.type.toUpperCase()}: R$ ${mov.amount.toFixed(2)} — ${mov.description}`,
      'Operador do Caixa'
    );
  };

  // --- CHECKLIST ACTIONS (COM ATRIBUIÇÃO FLEXÍVEL E TOGGLE BIDIRECIONAL) ---
  const toggleChecklistTask = async (
    taskId: string, 
    executorName?: string, 
    executorId?: string, 
    registeredBy?: string
  ) => {
    if (!checklist) return;
    
    const targetTask = checklist.tasks.find(t => t.id === taskId);
    const isCurrentlyChecked = !!targetTask?.checked;

    const updatedTasks: ChecklistTask[] = checklist.tasks.map(t => {
      if (t.id === taskId) {
        if (isCurrentlyChecked) {
          // Desmarcar por engano (reverte para PENDENTE e limpa campos de execução)
          return {
            ...t,
            checked: false,
            checkedBy: undefined,
            registeredByUserId: undefined,
            executedByCollaboratorId: undefined,
            executedByName: undefined,
            completedAt: undefined
          };
        } else {
          // Marcar como concluída atribuindo o colaborador executor
          return {
            ...t,
            checked: true,
            checkedBy: executorName || registeredBy || 'Colaborador',
            registeredByUserId: registeredBy,
            executedByCollaboratorId: executorId,
            executedByName: executorName || 'Colaborador',
            completedAt: new Date().toISOString()
          };
        }
      }
      return t;
    });
    
    const newChecklist = { ...checklist, tasks: updatedTasks };
    setChecklist(newChecklist);

    try {
      if (checklist.id === '') {
        const { data, error } = await supabase.from('kitchen_checklists').insert({
          date: checklist.date,
          tasks: updatedTasks
        }).select().single();
        
        if (data) setChecklist({ ...newChecklist, id: data.id });
        if (error) console.error(error);
      } else {
        await supabase.from('kitchen_checklists').update({ tasks: updatedTasks }).eq('id', checklist.id);
      }
    } catch (e) {
      console.warn('Erro ao atualizar checklist:', e);
    }

    addAuditLog(
      'CHECKLIST_TAREFA',
      isCurrentlyChecked
        ? `Tarefa "${targetTask?.label}" revertida para PENDENTE por ${registeredBy || 'Operador'}.`
        : `Tarefa "${targetTask?.label}" marcada como CONCLUÍDA. Executou: ${executorName || 'Equipe'}. Registrou: ${registeredBy || 'Operador'}.`,
      registeredBy || 'Operador'
    );
  };

  const signChecklist = async (personName: string) => {
    if (!checklist || checklist.id === '') return;
    const newChecklist = { ...checklist, signedBy: personName };
    setChecklist(newChecklist);
    await supabase.from('kitchen_checklists').update({ signed_by: personName }).eq('id', checklist.id);
  };

  return { 
    items, addInventoryItem, updateInventoryItem, removeInventoryItem, updateStatus, registerPurchase,
    products, addProduct, updateProduct, removeProduct, getProductCmv, getRealSalesCmv,
    isLoaded, isOpen, activeCashSession, allCashSessions, openCaixa, closeCaixa, toggleCaixa, deleteCashSession, deleteTestSales,
    sales, addSale, cancelSale, reopenOrderForEdit, updateReopenedOrder,
    movements, addMovement,
    wasteRecords, registerWaste, getTotalWasteCost,
    checklist, toggleChecklistTask, signChecklist, allChecklists,
    suppliers, addSupplier, updateSupplier, removeSupplier,
    purchaseRecords, recordPurchaseWithSupplier,
    stockAudits, saveStockAudit,
    subRecipes, saveSubRecipe, removeSubRecipe, getIngredientTrueCost,
    targetPrepMinutes, setTargetPrepMinutes, updateOrderProductionStatus, updateBatchProductionStatus, completeOrderProduction,
    auditLogs, addAuditLog,
    fixedExpensesConfig, saveFixedExpensesConfig, settleCreditSale
  };
}
