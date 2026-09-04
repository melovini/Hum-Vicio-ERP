'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useInventory, Product, SaleItem, Sale, ProductionStatus, GiftReason } from '@/lib/store';
import { 
  MonitorDot, ArrowLeft, Lock, Unlock, DollarSign, History, 
  Send, XCircle, ShoppingCart as CartIcon, Plus, Minus, Trash2, 
  Wallet, TrendingDown, TrendingUp, AlertCircle, CheckCircle2, User, Printer,
  Sparkles, Coffee, Flame, Check, X, MessageSquare, UtensilsCrossed, Utensils,
  Clock, Play, Pause, AlertOctagon, Bell, ShieldAlert, Receipt, Gift, Tag, Percent, Truck, LayoutGrid,
  Edit3, GitCompare, Search, Calendar, Filter, CreditCard, Banknote, UserCheck
} from 'lucide-react';
import Link from 'next/link';
import ReceiptModal from '@/components/ReceiptModal';
import RouteManifestModal from '@/components/RouteManifestModal';
import { playOrderReadyChime } from '@/lib/audio';
import MapaMesasCanvas from '@/components/MapaMesasCanvas';
import { 
  SessaoCaixaSalao, SalaoMesaInstancia, LayoutTemplate,
  getActiveFloorSession, createInitialSessionFromTemplate,
  lancarConsumoNaMesa, getStoredLayoutTemplates 
} from '@/lib/mesas';
import { sendOwnerSecurityAlert } from '@/lib/notifications';
import { getActiveCollaborators, Collaborator } from '@/lib/collaborators';

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

export default function CaixaPage() {
  const { 
    products, items, isOpen, activeCashSession, allCashSessions,
    openCaixa, closeCaixa, deleteCashSession, deleteTestSales,
    sales, addSale, cancelSale, 
    reopenOrderForEdit, updateReopenedOrder,
    movements, addMovement,
    targetPrepMinutes, setTargetPrepMinutes, updateOrderProductionStatus, updateBatchProductionStatus,
    settleCreditSale 
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'pdv' | 'mesas' | 'producao' | 'rotas' | 'historico' | 'sangria' | 'contas_receber'>('pdv');
  const [productionFilter, setProductionFilter] = useState<'todos' | 'em_espera' | 'agendado' | 'em_producao' | 'concluido'>('todos');
  const [selectedOrdersForBatch, setSelectedOrdersForBatch] = useState<string[]>([]);

  // Gestão de Rotas & Entregadores
  const [deliveryRoutes, setDeliveryRoutes] = useState<DeliveryRouteBlock[]>([]);
  const [routeViewTab, setRouteViewTab] = useState<'ativas' | 'entregues'>('ativas');
  const [newCourierInput, setNewCourierInput] = useState('');
  const [selectedOrdersForRoute, setSelectedOrdersForRoute] = useState<string[]>([]);
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  const [selectedRouteToPrint, setSelectedRouteToPrint] = useState<DeliveryRouteBlock | null>(null);
  const [historyScope, setHistoryScope] = useState<'turno' | 'todos'>('turno');

  // Isolamento estrito de pedidos por turno de caixa
  const sessionStartTime = useMemo(() => {
    if (!activeCashSession || !isOpen) return 0;
    return new Date(activeCashSession.openedAt).getTime();
  }, [activeCashSession, isOpen]);

  const currentSessionSales = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'cancelled') return false;
      if (sessionStartTime > 0 && new Date(s.date).getTime() < sessionStartTime) return false;
      return true;
    });
  }, [sales, sessionStartTime]);

  // Histórico permanente de IDs de comandas entregues (para nunca retornarem ao delivery sem rota)
  const [deliveredSaleIds, setDeliveredSaleIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hum_vicio_delivered_sales');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const markSalesAsDelivered = (ids: string[]) => {
    setDeliveredSaleIds(prev => {
      const combined = Array.from(new Set([...prev, ...ids]));
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('hum_vicio_delivered_sales', JSON.stringify(combined)); } catch {}
      }
      return combined;
    });
  };

  const allRoutedSaleIds = useMemo(() => {
    const fromRoutes = deliveryRoutes.flatMap(r => r.saleIds);
    return new Set([...fromRoutes, ...deliveredSaleIds]);
  }, [deliveryRoutes, deliveredSaleIds]);

  const unassignedDeliverySales = useMemo(() => {
    return sales.filter(s => 
      s.status !== 'cancelled' && 
      (s.orderType === 'delivery' || s.channel === 'ifood') && 
      (sessionStartTime === 0 || new Date(s.date).getTime() >= sessionStartTime) &&
      !allRoutedSaleIds.has(s.id)
    );
  }, [sales, allRoutedSaleIds, sessionStartTime]);

  // Resetar rotas e seleções em memória caso o caixa seja fechado ou inexistente
  useEffect(() => {
    if (!isOpen || !activeCashSession) {
      setDeliveryRoutes([]);
      setDeliveredSaleIds([]);
      setSelectedOrdersForRoute([]);
      setSelectedOrdersForBatch([]);
    }
  }, [isOpen, activeCashSession]);

  // Modais de Exclusão Segura de Caixa de Teste
  const [showDeleteTestModal, setShowDeleteTestModal] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState('');
  const [deleteSessionPassword, setDeleteSessionPassword] = useState('');
  const [deleteSessionError, setDeleteSessionError] = useState('');
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hum_vicio_delivery_routes');
        if (saved) setDeliveryRoutes(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveDeliveryRoutes = (routes: DeliveryRouteBlock[]) => {
    setDeliveryRoutes(routes);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hum_vicio_delivery_routes', JSON.stringify(routes));
      } catch {}
    }
  };

  // Lista de Colaboradores Ativos para Consumo da Equipe
  const [collaboratorsList, setCollaboratorsList] = useState<Collaborator[]>([]);
  useEffect(() => {
    setCollaboratorsList(getActiveCollaborators());
  }, []);

  // Formas de Pagamento Especiais: Consumo de Funcionários & Fiado VIP
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('');
  const [creditCustomerInput, setCreditCustomerInput] = useState('');
  const [creditDueDateInput, setCreditDueDateInput] = useState('');
  const [creditNotesInput, setCreditNotesInput] = useState('');

  // Estados de Liquidação de Contas a Receber
  const [saleToSettle, setSaleToSettle] = useState<Sale | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<string>('pix');
  const [settlementOperator, setSettlementOperator] = useState('');
  const [settling, setSettling] = useState(false);
  const [creditTabFilter, setCreditTabFilter] = useState<'todos' | 'pendentes' | 'quitados' | 'fiado_vip' | 'consumo_funcionario'>('pendentes');
  const [creditSearchQuery, setCreditSearchQuery] = useState('');

  // Calculadora Física de Cédulas e Moedas para Fechamento Cego
  const [usePhysicalCalc, setUsePhysicalCalc] = useState(false);
  const [denominations, setDenominations] = useState({
    bill100: 0,
    bill50: 0,
    bill20: 0,
    bill10: 0,
    bill5: 0,
    bill2: 0,
    coin1: 0,
    coin050: 0,
    coin025: 0,
    coin010: 0,
    coin005: 0
  });

  const updateDenomination = (denom: keyof typeof denominations, count: number) => {
    const safeCount = Math.max(0, count || 0);
    const updated = { ...denominations, [denom]: safeCount };
    setDenominations(updated);
    const sum = 
      updated.bill100 * 100 +
      updated.bill50 * 50 +
      updated.bill20 * 20 +
      updated.bill10 * 10 +
      updated.bill5 * 5 +
      updated.bill2 * 2 +
      updated.coin1 * 1 +
      updated.coin050 * 0.50 +
      updated.coin025 * 0.25 +
      updated.coin010 * 0.10 +
      updated.coin005 * 0.05;
    setCountedAmountInput(sum.toFixed(2));
  };

  // Instância de Salão Viva no Turno de Caixa (Floor Session State)
  const [floorSession, setFloorSession] = useState<SessaoCaixaSalao>(() => getActiveFloorSession());
  const [selectedInitialLayoutId, setSelectedInitialLayoutId] = useState<string>('tpl_padrao_6');
  const [floorTemplates, setFloorTemplates] = useState<LayoutTemplate[]>(() => getStoredLayoutTemplates());
  
  // Modais de Abertura e Fechamento
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedSaleToPrint, setSelectedSaleToPrint] = useState<Sale | null>(null);

  // Estados para Reabertura & Edição de Pedidos
  const [editingReopenedSale, setEditingReopenedSale] = useState<Sale | null>(null);
  const [diffToPrint, setDiffToPrint] = useState<any>(null);

  // Estados para Cancelamento Seguro de Vendas com Senha
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelPasswordInput, setCancelPasswordInput] = useState('');
  const [cancelReasonInput, setCancelReasonInput] = useState('Desistência do cliente antes do preparo');
  const [cancelNotesInput, setCancelNotesInput] = useState('');
  const [cancelError, setCancelError] = useState('');

  // Teto de Segurança da Gaveta (Alerta Antifraude / Antiassalto)
  const [drawerCashLimit, setDrawerCashLimit] = useState<number>(500);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hum_vicio_drawer_limit');
      if (saved) setDrawerCashLimit(Number(saved) || 500);
    } catch {}
  }, []);

  // Estado para Relatório de Fechamento de Caixa Cego
  const [closingSummary, setClosingSummary] = useState<{
    initial: number;
    cashSales: number;
    suprimentos: number;
    sangrias: number;
    expectedInDrawer: number;
    countedCash: number;
    variance: number;
    operator: string;
    date: string;
  } | null>(null);

  // Alerta sonoro e visual de Pedido Pronto para o Balcão
  const [caixaReadyAlert, setCaixaReadyAlert] = useState<Sale | null>(null);
  const prevCompletedIdsRef = useRef<Set<string>>(new Set());
  const isInitialCaixaMount = useRef(true);

  useEffect(() => {
    const currentCompletedIds = new Set(
      sales
        .filter(s => s.status !== 'cancelled' && s.productionStatus === 'concluido')
        .map(s => s.id)
    );

    if (isInitialCaixaMount.current) {
      isInitialCaixaMount.current = false;
      prevCompletedIdsRef.current = currentCompletedIds;
      return;
    }

    let newlyDoneSale: Sale | undefined;
    currentCompletedIds.forEach(id => {
      if (!prevCompletedIdsRef.current.has(id)) {
        newlyDoneSale = sales.find(s => s.id === id);
      }
    });

    if (newlyDoneSale) {
      playOrderReadyChime();
      setCaixaReadyAlert(newlyDoneSale);
      setTimeout(() => setCaixaReadyAlert(null), 14000);
    }

    prevCompletedIdsRef.current = currentCompletedIds;
  }, [sales]);

  // Form Abertura
  const [initialAmountInput, setInitialAmountInput] = useState('100.00');
  const [operatorOpenInput, setOperatorOpenInput] = useState('');

  // Form Fechamento
  const [countedAmountInput, setCountedAmountInput] = useState('');
  const [operatorCloseInput, setOperatorCloseInput] = useState('');

  // PDV State
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState<'mesa' | 'retirada' | 'delivery'>('mesa');
  const [posCategory, setPosCategory] = useState<'mais_pedidos' | 'hamburgueres' | 'duplos' | 'bebidas' | 'porcoes'>('mais_pedidos');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [saleChannel, setSaleChannel] = useState<'balcao' | 'ifood'>('balcao');
  const [saleMethod, setSaleMethod] = useState('credito');
  const [orderProductionStatus, setOrderProductionStatus] = useState<ProductionStatus>('em_espera');
  const [pendingRemovalFromGrill, setPendingRemovalFromGrill] = useState<{ sale: Sale; action: 'pause' | 'cancel' } | null>(null);

  // Estados de Brindes / Cortesias
  const [giftModalItemIndex, setGiftModalItemIndex] = useState<number | null>(null);
  const [selectedGiftReason, setSelectedGiftReason] = useState<GiftReason>('falta_pedido_anterior');
  const [giftNotesInput, setGiftNotesInput] = useState('');

  // Estados de Taxa de Entrega e Desconto
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');

  // Cupom iFood Custeado pela Loja (Cupom Hits)
  const [hasStoreCoupon, setHasStoreCoupon] = useState(false);
  const [storeCouponInput, setStoreCouponInput] = useState('10.00');

  // Customizer Modal do Hambúrguer
  const [selectedBurgerForConfig, setSelectedBurgerForConfig] = useState<Product | null>(null);
  const [selectedCombo, setSelectedCombo] = useState<'none' | 'batata_bebida' | 'aneis_bebida'>('none');
  const [selectedAdditionals, setSelectedAdditionals] = useState<Record<string, number>>({});
  const [burgerNotes, setBurgerNotes] = useState('');

  // Movement State
  const [movAmount, setMovAmount] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [movType, setMovType] = useState<'sangria' | 'suprimento'>('sangria');

  // Cálculos do Caixa Atual
  const sessionStats = useMemo(() => {
    const initial = activeCashSession?.initialAmount || 0;
    
    // Filtrar vendas em dinheiro após a abertura do turno ativo
    const cashSales = sales
      .filter(s => {
        if (s.status !== 'completed' || s.paymentMethod !== 'dinheiro') return false;
        if (sessionStartTime > 0 && new Date(s.date).getTime() < sessionStartTime) return false;
        return true;
      })
      .reduce((acc, s) => acc + s.total, 0);

    const suprimentos = movements
      .filter(m => m.type === 'suprimento')
      .reduce((acc, m) => acc + m.amount, 0);

    const sangrias = movements
      .filter(m => m.type === 'sangria')
      .reduce((acc, m) => acc + m.amount, 0);

    const expectedInDrawer = initial + cashSales + suprimentos - sangrias;

    return {
      initial,
      cashSales,
      suprimentos,
      sangrias,
      expectedInDrawer
    };
  }, [activeCashSession, sales, movements, sessionStartTime]);

  // Lista dos 18 adicionais oficiais
  const availableAdditionals = useMemo(() => {
    const fromDb = products.filter(p => p.name.startsWith('Adicional:') || p.name.startsWith('Pote Maionese'));
    if (fromDb.length > 0) {
      return fromDb.map(p => ({
        name: p.name.replace('Adicional: ', ''),
        price: p.priceBalcao
      }));
    }
    return [
      { name: 'Bacon Crocante', price: 5 },
      { name: 'Cebola Caramelizada', price: 5 },
      { name: 'Geleia de Pimenta', price: 5 },
      { name: 'Hambúrguer Bovino 180g', price: 13 },
      { name: 'Hambúrguer Costela 180g', price: 15 },
      { name: 'Hamb. Frango Empanado', price: 10 },
      { name: 'Hambúrguer Linguiça 150g', price: 10 },
      { name: 'Hamb. Queijo Minas Empanado', price: 13 },
      { name: 'Hamb. Bovino Recheado Mozarela', price: 15 },
      { name: 'Pote Maionese da Casa 40g', price: 2 },
      { name: 'Pote Maionese de Chimichurri 40g', price: 2 },
      { name: 'Pote Maionese de Ervas 40g', price: 2 },
      { name: 'Onion Rings no Hambúrguer', price: 5 },
      { name: 'Queijo Cheddar', price: 5 },
      { name: 'Queijo Minas Padrão', price: 5 },
      { name: 'Queijo Mozarela', price: 5 },
      { name: 'Queijo Coalho', price: 10 },
      { name: 'Salada (Alface, Tomate, Cebola)', price: 3 },
      { name: 'Sour Cream', price: 5 }
    ];
  }, [products]);

  // Filtrar apenas produtos ativos (respeitando soft delete)
  const activeProducts = useMemo(() => {
    return products.filter(p => p.isActive !== false);
  }, [products]);

  // 9 Itens Mais Pedidos (calculados automaticamente das vendas)
  const top9Products = useMemo(() => {
    const counts: Record<string, number> = {};
    sales.filter(s => s.status === 'completed').forEach(s => {
      s.items?.forEach(i => {
        counts[i.productId] = (counts[i.productId] || 0) + i.quantity;
      });
    });

    const vendaveis = activeProducts.filter(p => 
      !p.name.startsWith('Adicional:') && 
      !p.name.startsWith('Pote Maionese') &&
      p.category !== 'combo'
    );

    const sorted = [...vendaveis].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    return sorted.slice(0, 9);
  }, [activeProducts, sales]);

  // Produtos exibidos por categoria
  const displayedProducts = useMemo(() => {
    switch (posCategory) {
      case 'mais_pedidos':
        return top9Products;
      case 'hamburgueres':
        return activeProducts.filter(p => p.category === 'lanche' && !p.name.toLowerCase().includes('duplo'));
      case 'duplos':
        return activeProducts.filter(p => p.category === 'lanche' && p.name.toLowerCase().includes('duplo'));
      case 'bebidas':
        return activeProducts.filter(p => p.category === 'bebida');
      case 'porcoes':
        return activeProducts.filter(p => p.category === 'porcao' && !p.name.startsWith('Adicional:') && !p.name.startsWith('Pote Maionese'));
      default:
        return activeProducts;
    }
  }, [posCategory, activeProducts, top9Products]);

  // Listagem e Métricas de Contas a Receber (Fiado VIP & Consumo de Equipe)
  const creditMetrics = useMemo(() => {
    let fiadoPending = 0;
    let collabPending = 0;
    let totalPending = 0;
    let totalPaid = 0;
    let pendingCount = 0;

    sales.forEach(s => {
      const isCredit = s.paymentMethod === 'fiado_vip' || s.paymentMethod === 'consumo_funcionario' || s.creditStatus !== undefined;
      if (!isCredit || s.status === 'cancelled') return;

      if (s.creditStatus === 'quitado') {
        totalPaid += s.total;
      } else {
        totalPending += s.total;
        pendingCount++;
        if (s.paymentMethod === 'consumo_funcionario') {
          collabPending += s.total;
        } else {
          fiadoPending += s.total;
        }
      }
    });

    return { fiadoPending, collabPending, totalPending, totalPaid, pendingCount };
  }, [sales]);

  const creditSalesList = useMemo(() => {
    return sales.filter(s => {
      const isCredit = s.paymentMethod === 'fiado_vip' || s.paymentMethod === 'consumo_funcionario' || s.creditStatus !== undefined;
      if (!isCredit || s.status === 'cancelled') return false;

      // Filtro de status/tipo
      if (creditTabFilter === 'pendentes' && s.creditStatus === 'quitado') return false;
      if (creditTabFilter === 'quitados' && s.creditStatus !== 'quitado') return false;
      if (creditTabFilter === 'fiado_vip' && s.paymentMethod !== 'fiado_vip') return false;
      if (creditTabFilter === 'consumo_funcionario' && s.paymentMethod !== 'consumo_funcionario') return false;

      // Filtro de busca
      if (creditSearchQuery.trim()) {
        const q = creditSearchQuery.toLowerCase();
        const matchCust = (s.creditCustomerName || s.customerName || '').toLowerCase().includes(q);
        const matchCollab = (s.collaboratorName || '').toLowerCase().includes(q);
        const matchNotes = (s.creditNotes || '').toLowerCase().includes(q);
        const matchId = s.id.toLowerCase().includes(q);
        if (!matchCust && !matchCollab && !matchNotes && !matchId) return false;
      }

      return true;
    });
  }, [sales, creditTabFilter, creditSearchQuery]);

  // Clique no Produto
  const handleProductClick = (product: Product) => {
    if (product.category === 'lanche') {
      // Abre modal de customização do hambúrguer
      setSelectedBurgerForConfig(product);
      setSelectedCombo('none');
      setSelectedAdditionals({});
      setBurgerNotes('');
    } else {
      // Bebidas ou porções: adiciona direto ao carrinho
      const price = saleChannel === 'ifood' ? product.priceIfood : product.priceBalcao;
      const existing = cart.find(i => i.productId === product.id && !i.combo && (!i.additionals || i.additionals.length === 0) && !i.notes);
      
      if (existing) {
        setCart(cart.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i));
      } else {
        setCart([...cart, {
          id: Math.random().toString(36).substring(2, 9),
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: price
        }]);
      }
    }
  };

  // Confirmar Hambúrguer Customizado
  const handleConfirmBurgerConfig = () => {
    if (!selectedBurgerForConfig) return;

    const basePrice = saleChannel === 'ifood' 
      ? selectedBurgerForConfig.priceIfood 
      : selectedBurgerForConfig.priceBalcao;

    const comboPrice = selectedCombo === 'batata_bebida' ? 14 : selectedCombo === 'aneis_bebida' ? 16 : 0;
    const comboName = selectedCombo === 'batata_bebida' 
      ? 'Combo Batata e Bebida' 
      : selectedCombo === 'aneis_bebida' 
        ? 'Combo Anéis de Cebola e Bebida' 
        : undefined;

    const additionalsList: { name: string; price: number }[] = [];
    let additionalsPrice = 0;

    Object.entries(selectedAdditionals).forEach(([addName, qty]) => {
      if (qty > 0) {
        const item = availableAdditionals.find(a => a.name === addName);
        const unitP = item ? item.price : 5;
        additionalsList.push({
          name: `${qty > 1 ? `${qty}x ` : ''}${addName}`,
          price: unitP * qty
        });
        additionalsPrice += unitP * qty;
      }
    });

    const unitPrice = basePrice + comboPrice + additionalsPrice;

    const newItem: SaleItem = {
      id: Math.random().toString(36).substring(2, 9),
      productId: selectedBurgerForConfig.id,
      productName: selectedBurgerForConfig.name,
      quantity: 1,
      unitPrice,
      combo: comboName,
      comboPrice,
      additionals: additionalsList,
      notes: burgerNotes.trim() || undefined
    };

    setCart([...cart, newItem]);
    setSelectedBurgerForConfig(null);
  };

  const updateCartQty = (itemIndex: number, delta: number) => {
    setCart(cart.map((item, idx) => {
      if (idx === itemIndex) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (itemIndex: number) => {
    setCart(cart.filter((_, idx) => idx !== itemIndex));
  };

  // Funções de Gestão de Brindes / Cortesias
  const handleOpenGiftModal = (index: number) => {
    const item = cart[index];
    if (item.isGift) {
      if (confirm(`Remover condição de brinde de "${item.productName}" e voltar a cobrar normal?`)) {
        setCart(cart.map((it, idx) => idx === index ? {
          ...it,
          isGift: false,
          unitPrice: it.originalPrice !== undefined ? it.originalPrice : it.unitPrice,
          giftReason: undefined,
          giftNotes: undefined
        } : it));
      }
      return;
    }
    setGiftModalItemIndex(index);
    setSelectedGiftReason('falta_pedido_anterior');
    setGiftNotesInput('');
  };

  const handleConfirmGift = () => {
    if (giftModalItemIndex === null) return;
    setCart(cart.map((item, idx) => {
      if (idx === giftModalItemIndex) {
        return {
          ...item,
          isGift: true,
          originalPrice: item.originalPrice !== undefined ? item.originalPrice : item.unitPrice,
          unitPrice: 0,
          giftReason: selectedGiftReason,
          giftNotes: giftNotesInput.trim() || undefined
        };
      }
      return item;
    }));
    setGiftModalItemIndex(null);
  };

  // Cálculos Financeiros da Comanda (Subtotal, Desconto, Taxa de Entrega e Total)
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  }, [cart]);

  const deliveryFeeAmount = useMemo(() => {
    if (orderType !== 'delivery' && saleChannel !== 'ifood') return 0;
    const fee = parseFloat(deliveryFeeInput);
    return isNaN(fee) || fee < 0 ? 0 : fee;
  }, [deliveryFeeInput, orderType, saleChannel]);

  const discountAmount = useMemo(() => {
    if (!discountInput.trim()) return 0;
    if (discountInput.trim().endsWith('%')) {
      const pct = parseFloat(discountInput.replace('%', ''));
      return !isNaN(pct) && pct > 0 ? (cartSubtotal * pct) / 100 : 0;
    }
    const val = parseFloat(discountInput);
    return !isNaN(val) && val > 0 ? Math.min(cartSubtotal, val) : 0;
  }, [discountInput, cartSubtotal]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountAmount + deliveryFeeAmount);
  }, [cartSubtotal, discountAmount, deliveryFeeAmount]);

  const storeCouponSubsidyAmount = useMemo(() => {
    if (saleChannel !== 'ifood' || !hasStoreCoupon) return 0;
    const val = parseFloat(storeCouponInput);
    return !isNaN(val) && val > 0 ? val : 0;
  }, [saleChannel, hasStoreCoupon, storeCouponInput]);

  const waitingOrders = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'cancelled') return false;
      if (s.productionStatus !== 'em_espera' && s.productionStatus !== 'agendado') return false;
      if (sessionStartTime > 0 && new Date(s.date).getTime() < sessionStartTime) return false;
      return true;
    });
  }, [sales, sessionStartTime]);

  const batchBurgersSummary = useMemo(() => {
    const selectedSales = sales.filter(s => selectedOrdersForBatch.includes(s.id));
    let totalBurgers = 0;
    const itemsMap: Record<string, number> = {};

    selectedSales.forEach(s => {
      s.items?.forEach(i => {
        totalBurgers += i.quantity;
        itemsMap[i.productName] = (itemsMap[i.productName] || 0) + i.quantity;
      });
    });

    const summaryList = Object.entries(itemsMap).map(([name, qty]) => `${qty}x ${name}`).join(', ');
    return { totalBurgers, summaryList, count: selectedSales.length };
  }, [sales, selectedOrdersForBatch]);

  const handleStartReopenSale = async (sale: Sale) => {
    // Pedidos em espera podem ser editados imediatamente pelo operador sem trava de senha
    if (sale.productionStatus !== 'em_espera') {
      const pass = prompt('Autorização de Alteração de Pedido em Andamento / Concluído: Digite a senha do Administrador/Supervisor (admin):');
      if (!pass) return;
      if (pass.trim() !== 'admin') {
        alert('Senha incorreta. Apenas o Administrador/Supervisor pode reabrir pedidos em andamento.');
        return;
      }
    }

    const reopened = await reopenOrderForEdit(sale.id, 'Supervisor');
    if (reopened) {
      setEditingReopenedSale(reopened);
      setCart(reopened.items.map(i => ({ ...i })));
      setCustomerName(reopened.customerName || '');
      setOrderType(reopened.orderType || 'mesa');
      setSaleChannel(reopened.channel);
      setOrderProductionStatus(reopened.productionStatus || 'em_espera');
      setDiscountInput(reopened.discount ? reopened.discount.toString() : '');
      setDeliveryFeeInput(reopened.deliveryFee ? reopened.deliveryFee.toString() : '');
      setSaleMethod(reopened.paymentMethod);
      setActiveTab('pdv');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    
    // Validação Mandatória de Caixa Ativo
    if (!isOpen || !activeCashSession) {
      alert('Operação bloqueada: Nenhuma sessão de caixa ativa. É obrigatório abrir o turno informando o fundo de troco.');
      setShowOpenModal(true);
      return;
    }

    // Fluxo de Atualização de Pedido Reaberto
    if (editingReopenedSale) {
      updateReopenedOrder(editingReopenedSale.id, {
        customerName: customerName.trim() || (orderType === 'mesa' ? 'Mesa' : orderType === 'retirada' ? 'Retirada' : 'Delivery'),
        orderType,
        channel: saleChannel,
        subtotal: cartSubtotal,
        discount: discountAmount,
        deliveryFee: deliveryFeeAmount,
        storeCouponSubsidy: storeCouponSubsidyAmount,
        total: cartTotal,
        paymentMethod: saleMethod,
        items: cart,
        productionStatus: orderProductionStatus || editingReopenedSale.productionStatus || 'em_espera'
      }).then(res => {
        if (res.success && res.sale) {
          setDiffToPrint(res.diff);
          setSelectedSaleToPrint(res.sale);
          setEditingReopenedSale(null);
          setCart([]);
          setCustomerName('');
          setDiscountInput('');
          setDeliveryFeeInput('');
          setHasStoreCoupon(false);
          setOrderProductionStatus('em_espera');
          setActiveTab('historico');
          playOrderReadyChime();
        }
      });
      return;
    }

    let finalCustomerName = customerName.trim();
    let collabName: string | undefined = undefined;
    let finalCreditCustomer = creditCustomerInput.trim();

    if (saleMethod === 'consumo_funcionario') {
      if (!selectedCollaboratorId) {
        alert('Por favor, selecione qual colaborador da equipe está realizando o consumo.');
        return;
      }
      const collab = collaboratorsList.find(c => c.id === selectedCollaboratorId);
      collabName = collab?.name || 'Colaborador';
      finalCustomerName = `[Equipe] ${collabName}`;
    } else if (saleMethod === 'fiado_vip') {
      if (!finalCreditCustomer && !finalCustomerName) {
        alert('Por favor, informe o nome do cliente VIP para o registro do fiado.');
        return;
      }
      finalCustomerName = `[Fiado VIP] ${finalCreditCustomer || finalCustomerName}`;
    }

    if (!finalCustomerName) {
      finalCustomerName = (orderType === 'mesa' ? 'Mesa' : orderType === 'retirada' ? 'Retirada' : 'Delivery');
    }

    addSale({
      customerName: finalCustomerName,
      orderType,
      channel: saleChannel,
      subtotal: cartSubtotal,
      discount: discountAmount,
      deliveryFee: deliveryFeeAmount,
      storeCouponSubsidy: storeCouponSubsidyAmount,
      total: cartTotal,
      paymentMethod: saleMethod,
      items: cart,
      productionStatus: orderProductionStatus,
      targetPrepMinutes,
      collaboratorId: saleMethod === 'consumo_funcionario' ? selectedCollaboratorId : undefined,
      collaboratorName: collabName,
      creditCustomerName: saleMethod === 'fiado_vip' ? (finalCreditCustomer || customerName) : undefined,
      creditDueDate: saleMethod === 'fiado_vip' ? (creditDueDateInput || undefined) : undefined,
      creditNotes: saleMethod === 'fiado_vip' ? (creditNotesInput || undefined) : undefined,
      creditStatus: (saleMethod === 'consumo_funcionario' || saleMethod === 'fiado_vip') ? 'pendente' : undefined
    });

    // Se o pedido for de mesa, lança o consumo automaticamente na instância da mesa
    if (orderType === 'mesa' && finalCustomerName) {
      const mesaAlvo = floorSession.mesas.find(
        m => m.numeroIdentificador.toLowerCase() === finalCustomerName.toLowerCase() ||
             m.id === finalCustomerName
      );
      if (mesaAlvo) {
        const updatedFloor = lancarConsumoNaMesa(floorSession, mesaAlvo.id, cartTotal, finalCustomerName, 'Operador');
        setFloorSession(updatedFloor);
      }
    }

    setCart([]);
    setCustomerName('');
    setDiscountInput('');
    setDeliveryFeeInput('');
    setHasStoreCoupon(false);
    setOrderProductionStatus('em_espera');
    setSelectedCollaboratorId('');
    setCreditCustomerInput('');
    setCreditDueDateInput('');
    setCreditNotesInput('');
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movAmount || !movDesc) return;
    const amountNum = Number(movAmount);
    addMovement({ type: movType, amount: amountNum, description: movDesc });

    if (movType === 'sangria') {
      sendOwnerSecurityAlert({
        type: 'SANGRIA',
        title: 'Sangria de Gaveta Realizada',
        message: `Retirada física de R$ ${amountNum.toFixed(2)} da gaveta. Motivo: ${movDesc}. Saldo em espécie restante: R$ ${(sessionStats.expectedInDrawer - amountNum).toFixed(2)}.`,
        operator: activeCashSession?.openedBy || 'Operador do Caixa',
        amount: amountNum,
        details: {
          tipo: 'sangria',
          motivo: movDesc,
          saldoRestante: sessionStats.expectedInDrawer - amountNum
        }
      });
    }

    setMovAmount(''); setMovDesc('');
  };

  const handleConfirmOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorOpenInput.trim()) return;
    await openCaixa(Number(initialAmountInput) || 0, operatorOpenInput.trim());

    // Limpar rotas e seleções em memória para o novo turno
    setDeliveryRoutes([]);
    setDeliveredSaleIds([]);
    setSelectedOrdersForRoute([]);
    setSelectedOrdersForBatch([]);

    // RF02 - Carga Inicial por Turno: Clona o template selecionado para a sessão do salão
    const novaSessao = createInitialSessionFromTemplate(activeCashSession?.id || 'sessao_' + Date.now().toString(36), selectedInitialLayoutId);
    setFloorSession(novaSessao);

    setShowOpenModal(false);
  };

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorCloseInput.trim()) return;
    const counted = Number(countedAmountInput) || 0;
    const expected = sessionStats.expectedInDrawer;
    const variance = counted - expected;
    const operator = operatorCloseInput.trim();

    await closeCaixa(counted, operator, expected);

    // Limpar rotas e seleções em memória ao fechar o turno
    setDeliveryRoutes([]);
    setDeliveredSaleIds([]);
    setSelectedOrdersForRoute([]);
    setSelectedOrdersForBatch([]);

    // Alerta antifraude em caso de quebra ou sobra no fechamento cego
    if (Math.abs(variance) > 0.05) {
      sendOwnerSecurityAlert({
        type: 'FECHAMENTO_CAIXA_DIVERGENCIA',
        title: `Alerta de Fechamento Cego: ${variance < 0 ? 'Quebra de Caixa (Falta)' : 'Sobra de Caixa (Excedente)'}`,
        message: `O operador ${operator} encerrou o turno com divergência de ${variance < 0 ? `- R$ ${Math.abs(variance).toFixed(2)} (Falta)` : `+ R$ ${variance.toFixed(2)} (Sobra)`}. Esperado pelo sistema: R$ ${expected.toFixed(2)} | Contado fisicamente: R$ ${counted.toFixed(2)}.`,
        operator,
        amount: Math.abs(variance),
        details: {
          operador: operator,
          esperado: expected,
          contado: counted,
          divergencia: variance,
          sessaoId: activeCashSession?.id
        }
      });
    }

    setClosingSummary({
      initial: sessionStats.initial,
      cashSales: sessionStats.cashSales,
      suprimentos: sessionStats.suprimentos,
      sangrias: sessionStats.sangrias,
      expectedInDrawer: expected,
      countedCash: counted,
      variance,
      operator,
      date: new Date().toISOString()
    });

    setShowCloseModal(false);
    setCountedAmountInput('');
    setOperatorCloseInput('');
  };

  const handleConfirmCancelSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToCancel) return;

    const validPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin';
    if (cancelPasswordInput.trim() !== validPassword) {
      setCancelError('Senha de supervisor incorreta. O estorno não foi autorizado.');
      return;
    }

    await cancelSale(
      saleToCancel.id, 
      cancelReasonInput, 
      'Admin / Supervisor', 
      cancelNotesInput.trim() || undefined
    );

    sendOwnerSecurityAlert({
      type: 'CANCELAMENTO_VENDA',
      title: `Estorno de Pedido #${saleToCancel.id.slice(0, 5).toUpperCase()}`,
      message: `Venda estornada no valor de R$ ${saleToCancel.total.toFixed(2)}. Motivo: ${cancelReasonInput}. Obs: ${cancelNotesInput.trim() || 'Nenhuma'}`,
      operator: 'Admin / Supervisor',
      amount: saleToCancel.total,
      details: {
        pedidoId: saleToCancel.id,
        cliente: saleToCancel.customerName,
        canal: saleToCancel.channel,
        motivo: cancelReasonInput,
        observacoes: cancelNotesInput.trim()
      }
    });

    setSaleToCancel(null);
    setCancelPasswordInput('');
    setCancelReasonInput('Desistência do cliente antes do preparo');
    setCancelNotesInput('');
    setCancelError('');
  };

  // Atalho rápido de observações
  const toggleQuickNote = (noteText: string) => {
    if (burgerNotes.includes(noteText)) {
      setBurgerNotes(burgerNotes.replace(noteText, '').replace(/,\s*,/g, ',').trim());
    } else {
      setBurgerNotes(prev => prev ? `${prev}, ${noteText}` : noteText);
    }
  };

  // Preço do lanche sendo customizado
  const currentModalPrice = useMemo(() => {
    if (!selectedBurgerForConfig) return 0;
    const base = saleChannel === 'ifood' ? selectedBurgerForConfig.priceIfood : selectedBurgerForConfig.priceBalcao;
    const combo = selectedCombo === 'batata_bebida' ? 14 : selectedCombo === 'aneis_bebida' ? 16 : 0;
    let adds = 0;
    Object.entries(selectedAdditionals).forEach(([name, qty]) => {
      if (qty > 0) {
        const item = availableAdditionals.find(a => a.name === name);
        adds += (item?.price || 5) * qty;
      }
    });
    return base + combo + adds;
  }, [selectedBurgerForConfig, saleChannel, selectedCombo, selectedAdditionals, availableAdditionals]);

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-bold mb-0.5 text-xs">
                <MonitorDot size={16} /> Módulo Frente de Caixa & PDV
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestão de Pedidos</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => {
                setSessionToDeleteId(activeCashSession?.id || (allCashSessions[0]?.id || ''));
                setDeleteSessionPassword('');
                setDeleteSessionError('');
                setShowDeleteTestModal(true);
              }}
              className="px-4 py-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer text-xs uppercase tracking-wider shadow-lg"
              title="Apagar caixa de teste e expurgar vendas da contabilidade"
            >
              <Trash2 size={16} /> Apagar Caixa Teste
            </button>

            {isOpen ? (
              <button 
                onClick={() => {
                  setCountedAmountInput('');
                  setDenominations({
                    bill100: 0, bill50: 0, bill20: 0, bill10: 0, bill5: 0, bill2: 0,
                    coin1: 0, coin050: 0, coin025: 0, coin010: 0, coin005: 0
                  });
                  setUsePhysicalCalc(true);
                  setShowCloseModal(true);
                }}
                className="px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer text-sm"
              >
                <Lock size={16} /> Fechar Caixa (Cego)
              </button>
            ) : (
              <button 
                onClick={() => setShowOpenModal(true)}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer text-sm"
              >
                <Unlock size={16} /> Abrir Caixa
              </button>
            )}
          </div>
        </header>

        {/* Modal de Abertura */}
        {showOpenModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <Unlock className="text-emerald-400" /> Abertura de Caixa
              </h2>
              <p className="text-slate-400 text-sm mb-6">Informe o operador e o fundo de troco inicial.</p>
              
              <form onSubmit={handleConfirmOpen} className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-bold text-sm mb-2">Operador Responsável</label>
                  <input 
                    type="text" 
                    required 
                    value={operatorOpenInput}
                    onChange={e => setOperatorOpenInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-emerald-500"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold text-sm mb-2">Fundo Inicial de Troco (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={initialAmountInput}
                    onChange={e => setInitialAmountInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white font-mono text-xl font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                {/* RF02 - Carga Inicial por Turno: Seleção do Layout Mestre de Salão */}
                <div>
                  <label className="block text-slate-300 font-bold text-sm mb-2 flex items-center gap-1.5">
                    <LayoutGrid size={15} className="text-emerald-400" /> Layout Inicial do Salão (Mesas)
                  </label>
                  <select
                    value={selectedInitialLayoutId}
                    onChange={e => setSelectedInitialLayoutId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {floorTemplates.filter(t => t.ativo).map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nome} ({t.items.length} mesas)
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    O template selecionado será clonado para a sessão viva do turno.
                  </span>
                </div>

                <div className="flex gap-3 pt-4">
                  {isOpen && (
                    <button 
                      type="button" 
                      onClick={() => setShowOpenModal(false)}
                      className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer text-sm"
                  >
                    Confirmar Abertura (R$ {Number(initialAmountInput || 0).toFixed(2)})
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Fechamento Cego */}
        {showCloseModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl animate-fade-in max-h-[92vh] flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Lock className="text-red-400" /> Fechamento Cego de Turno
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-slate-400 text-xs mb-4">
                Conte o dinheiro físico da gaveta. O sistema fará a conferência da quebra ou sobra apenas após a confirmação.
              </p>

              {/* Toggle de Métodos de Contagem */}
              <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setUsePhysicalCalc(true)}
                  className={`flex-1 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    usePhysicalCalc ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🧮 Calculadora de Cédulas & Moedas
                </button>
                <button
                  type="button"
                  onClick={() => setUsePhysicalCalc(false)}
                  className={`flex-1 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    !usePhysicalCalc ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔢 Digitar Total Direto
                </button>
              </div>

              <form onSubmit={handleConfirmClose} className="space-y-4 overflow-y-auto pr-1 flex-1">
                {usePhysicalCalc ? (
                  <div className="space-y-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        💵 Cédulas Físicas:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'bill100', label: 'R$ 100', mult: 100 },
                          { key: 'bill50', label: 'R$ 50', mult: 50 },
                          { key: 'bill20', label: 'R$ 20', mult: 20 },
                          { key: 'bill10', label: 'R$ 10', mult: 10 },
                          { key: 'bill5', label: 'R$ 5', mult: 5 },
                          { key: 'bill2', label: 'R$ 2', mult: 2 }
                        ].map(c => (
                          <div key={c.key} className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-white block">{c.label}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                = R$ {(denominations[c.key as keyof typeof denominations] * c.mult).toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={denominations[c.key as keyof typeof denominations] || ''}
                              onChange={e => updateDenomination(c.key as keyof typeof denominations, parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-center font-mono text-sm text-white font-bold outline-none focus:border-red-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        🪙 Moedas:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'coin1', label: 'R$ 1,00', mult: 1 },
                          { key: 'coin050', label: 'R$ 0,50', mult: 0.50 },
                          { key: 'coin025', label: 'R$ 0,25', mult: 0.25 },
                          { key: 'coin010', label: 'R$ 0,10', mult: 0.10 },
                          { key: 'coin005', label: 'R$ 0,05', mult: 0.05 }
                        ].map(m => (
                          <div key={m.key} className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-white block">{m.label}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                = R$ {(denominations[m.key as keyof typeof denominations] * m.mult).toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={denominations[m.key as keyof typeof denominations] || ''}
                              onChange={e => updateDenomination(m.key as keyof typeof denominations, parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-center font-mono text-sm text-white font-bold outline-none focus:border-red-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Box de Total Contado */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <label className="block text-slate-400 font-bold text-xs">Total Físico em Espécie na Gaveta</label>
                    <span className="text-[10px] text-slate-500">Valor que você está declarando estar presente</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-slate-400 font-mono">R$</span>
                    {usePhysicalCalc ? (
                      <span className="text-2xl font-mono font-black text-emerald-400">
                        {Number(countedAmountInput || 0).toFixed(2)}
                      </span>
                    ) : (
                      <input 
                        type="number" 
                        step="0.01" 
                        required 
                        value={countedAmountInput}
                        onChange={e => setCountedAmountInput(e.target.value)}
                        className="w-32 bg-slate-900 border border-slate-700 rounded-xl p-2 text-right text-emerald-400 font-mono text-xl font-bold outline-none focus:border-red-500"
                        placeholder="0.00"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold text-xs mb-1">Operador Responsável pelo Fechamento</label>
                  <input 
                    type="text" 
                    required 
                    value={operatorCloseInput}
                    onChange={e => setOperatorCloseInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-white outline-none focus:border-red-500 text-sm"
                    placeholder="Seu nome"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowCloseModal(false)}
                    className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all cursor-pointer text-sm"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer text-sm"
                  >
                    Encerrar e Apurar Caixa
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Apagar Caixa de Teste e Expurgar Vendas */}
        {showDeleteTestModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-fade-in">
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <Trash2 size={20} />
                  </span>
                  Apagar Caixa de Teste
                </h2>
                <button
                  type="button"
                  onClick={() => setShowDeleteTestModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 space-y-2 mb-5">
                <p className="font-bold flex items-center gap-1.5 text-rose-300">
                  <ShieldAlert size={16} /> ATENÇÃO: EXPURGO CONTÁBIL TOTAL
                </p>
                <p>
                  Esta ação é exclusiva para turnos e sessões de <strong>teste</strong>. Ao confirmar:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-300/90 pl-1">
                  <li>Todas as comandas e vendas criadas neste caixa serão canceladas e expurgadas.</li>
                  <li>Os valores <strong>não entrarão</strong> no DRE, Faturamento, Contabilidade ou Relatórios.</li>
                  <li>As rotas de entrega deste caixa serão limpas e desvinculadas.</li>
                  <li>A sessão de caixa será encerrada e removida para você iniciar um novo teste do zero.</li>
                </ul>
              </div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!deleteSessionPassword) {
                    setDeleteSessionError('Informe a senha do Administrador.');
                    return;
                  }
                  if (!sessionToDeleteId) {
                    setDeleteSessionError('Nenhuma sessão de caixa encontrada para apagar.');
                    return;
                  }
                  setIsDeletingSession(true);
                  setDeleteSessionError('');
                  try {
                    const res = await deleteCashSession(sessionToDeleteId, deleteSessionPassword);
                    if (res.success) {
                      setDeliveryRoutes([]);
                      setDeliveredSaleIds([]);
                      setSelectedOrdersForRoute([]);
                      setSelectedOrdersForBatch([]);
                      alert(`Caixa de teste apagado com sucesso!\n${res.count} venda(s) de teste foram canceladas e expurgadas da contabilidade.`);
                      setShowDeleteTestModal(false);
                      setDeleteSessionPassword('');
                    } else {
                      setDeleteSessionError(res.error || 'Senha incorreta ou erro ao apagar sessão.');
                    }
                  } catch (err: any) {
                    setDeleteSessionError(err?.message || 'Erro inesperado.');
                  } finally {
                    setIsDeletingSession(false);
                  }
                }} 
                className="space-y-4"
              >
                {/* Seleção de Sessão */}
                <div>
                  <label className="block text-slate-300 font-bold text-xs mb-1.5 uppercase tracking-wider">
                    Sessão de Caixa a Excluir:
                  </label>
                  <select
                    value={sessionToDeleteId}
                    onChange={e => setSessionToDeleteId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-xs font-bold outline-none focus:border-rose-500 cursor-pointer"
                  >
                    {activeCashSession && (
                      <option value={activeCashSession.id}>
                        🟢 CAIXA ATUAL ABERTO (#{activeCashSession.id.slice(0, 6)} - {activeCashSession.openedBy || 'Operador'} - Aberto às {new Date(activeCashSession.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </option>
                    )}
                    {allCashSessions.filter(s => s.id !== activeCashSession?.id).slice(0, 5).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.status === 'open' ? '🟢' : '⚪'} Caixa #{s.id.slice(0, 6)} ({s.openedBy || 'Operador'} - {new Date(s.openedAt).toLocaleDateString('pt-BR')} {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Senha Master */}
                <div>
                  <label className="block text-slate-300 font-bold text-xs mb-1.5 uppercase tracking-wider">
                    Senha do Administrador Master (admin):
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Digite a senha admin"
                    value={deleteSessionPassword}
                    onChange={e => {
                      setDeleteSessionPassword(e.target.value);
                      setDeleteSessionError('');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white font-mono text-base outline-none focus:border-rose-500"
                  />
                  {deleteSessionError && (
                    <p className="text-xs text-rose-400 font-bold mt-1.5 flex items-center gap-1">
                      ⚠️ {deleteSessionError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteTestModal(false)}
                    className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all cursor-pointer text-xs uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isDeletingSession}
                    className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-2xl font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    {isDeletingSession ? 'Expurgando...' : 'Confirmar Expurgo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {!isOpen ? (
          <div className="glass-card rounded-3xl p-16 text-center border border-slate-800 flex flex-col items-center justify-center">
            <Lock size={64} className="text-slate-600 mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">O Caixa está Fechado</h2>
            <p className="text-slate-400 mb-8 max-w-md">
              Abra o caixa informando o fundo de troco para iniciar os lançamentos de pedidos do turno.
            </p>
            <button 
              onClick={() => setShowOpenModal(true)}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold flex items-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer text-lg"
            >
              <Unlock size={22} /> Abrir Turno de Caixa
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Abas Laterais */}
            <div className="lg:col-span-2 space-y-2">
              <button 
                onClick={() => setActiveTab('pdv')} 
                className={`w-full flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                  activeTab === 'pdv' 
                    ? 'bg-surface-elevated text-slate-100 border-surface-borderHover shadow-xs' 
                    : 'bg-surface-card text-slate-400 hover:text-slate-200 border-surface-border'
                }`}
              >
                <CartIcon size={16} className="text-brand-primary" /> Pedidos
              </button>

              <button 
                onClick={() => setActiveTab('mesas')} 
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                  activeTab === 'mesas' 
                    ? 'bg-surface-elevated text-slate-100 border-surface-borderHover shadow-xs' 
                    : 'bg-surface-card text-slate-400 hover:text-slate-200 border-surface-border'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutGrid size={16} className="text-brand-accent" /> Mapa de Mesas
                </div>
                {floorSession.mesas.filter(m => m.statusVisual !== 'GUARDADA' && (m.statusConsumo === 'OCUPADA_ABERTA' || m.statusConsumo === 'PARCIALMENTE_PAGA')).length > 0 && (
                  <span className="px-1.5 py-0.5 bg-status-occupied text-slate-950 text-[10px] font-mono tabular-nums font-bold rounded-full animate-pulse">
                    {floorSession.mesas.filter(m => m.statusVisual !== 'GUARDADA' && (m.statusConsumo === 'OCUPADA_ABERTA' || m.statusConsumo === 'PARCIALMENTE_PAGA')).length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('producao')} 
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                  activeTab === 'producao' 
                    ? 'bg-surface-elevated text-slate-100 border-surface-borderHover shadow-xs' 
                    : 'bg-surface-card text-slate-400 hover:text-slate-200 border-surface-border'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Flame size={16} className="text-status-occupied" /> Produção / KDS
                </div>
                <div className="flex items-center gap-1">
                  {currentSessionSales.filter(s => s.productionStatus === 'concluido').length > 0 && (
                    <span className="px-1.5 py-0.5 bg-status-free text-slate-950 text-[10px] font-mono tabular-nums font-bold rounded-full animate-pulse" title="Pedidos Prontos">
                      🛎️ {currentSessionSales.filter(s => s.productionStatus === 'concluido').length}
                    </span>
                  )}
                  {currentSessionSales.filter(s => s.productionStatus === 'em_espera' || s.productionStatus === 'em_producao').length > 0 && (
                    <span className="px-1.5 py-0.5 bg-status-occupied text-slate-950 text-[10px] font-mono tabular-nums font-bold rounded-full">
                      {currentSessionSales.filter(s => s.productionStatus === 'em_espera' || s.productionStatus === 'em_producao').length}
                    </span>
                  )}
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('rotas')} 
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                  activeTab === 'rotas' 
                    ? 'bg-surface-elevated text-slate-100 border-surface-borderHover shadow-xs' 
                    : 'bg-surface-card text-slate-400 hover:text-slate-200 border-surface-border'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Truck size={16} className="text-cyan-400" /> Rotas & Entregadores
                </div>
                {currentSessionSales.filter(s => s.orderType === 'delivery' || s.channel === 'ifood').length > 0 && (
                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-mono tabular-nums font-bold rounded-full">
                    {currentSessionSales.filter(s => s.orderType === 'delivery' || s.channel === 'ifood').length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('historico')} 
                className={`w-full flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                  activeTab === 'historico' 
                    ? 'bg-surface-elevated text-slate-100 border-surface-borderHover shadow-xs' 
                    : 'bg-surface-card text-slate-400 hover:text-slate-200 border-surface-border'
                }`}
              >
                <History size={16} className="text-brand-accent" /> Histórico ({currentSessionSales.length})
              </button>

              <button 
                onClick={() => setActiveTab('sangria')} 
                className={`w-full flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                  activeTab === 'sangria' 
                    ? 'bg-surface-elevated text-slate-100 border-surface-borderHover shadow-xs' 
                    : 'bg-surface-card text-slate-400 hover:text-slate-200 border-surface-border'
                }`}
              >
                <DollarSign size={16} className="text-status-danger" /> Gaveta
              </button>

              <button 
                onClick={() => setActiveTab('contas_receber')} 
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                  activeTab === 'contas_receber' 
                    ? 'bg-surface-elevated text-slate-100 border-surface-borderHover shadow-xs' 
                    : 'bg-surface-card text-slate-400 hover:text-slate-200 border-surface-border'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Receipt size={16} className="text-amber-400" /> Contas a Receber
                </div>
                {sales.filter(s => (s.paymentMethod === 'fiado_vip' || s.paymentMethod === 'consumo_funcionario') && s.creditStatus !== 'quitado' && s.status === 'completed').length > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono tabular-nums font-bold rounded-full">
                    {sales.filter(s => (s.paymentMethod === 'fiado_vip' || s.paymentMethod === 'consumo_funcionario') && s.creditStatus !== 'quitado' && s.status === 'completed').length}
                  </span>
                )}
              </button>

              {/* Slider de Tempo Dinâmico para a Cozinha Solicitado */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2 mt-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock size={15} className="text-amber-400" /> Meta Cozinha:
                  </span>
                  <span className="font-mono font-black text-amber-400 text-sm">
                    {targetPrepMinutes} min
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="45"
                  step="5"
                  value={targetPrepMinutes}
                  onChange={e => setTargetPrepMinutes(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>10m (Rápido)</span>
                  <span>45m (Pico)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Tempo limite de produção ajustável conforme a demanda da noite.
                </p>
              </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="lg:col-span-10">

              {/* ALERTA DE SEGURANÇA: LIMITE DE GAVETA EXCEDIDO */}
              {sessionStats.expectedInDrawer > drawerCashLimit && (
                <div className="mb-4 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-black shrink-0">
                      <ShieldAlert size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded text-amber-300 border border-amber-500/30">
                          ⚠️ ALERTA DE SEGURANÇA: TETO DE GAVETA EXCEDIDO
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          R$ {sessionStats.expectedInDrawer.toFixed(2)} em dinheiro
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/90 mt-0.5 font-medium">
                        O saldo em espécie ultrapassou o teto seguro de <strong>R$ {drawerCashLimit.toFixed(2)}</strong>. Efetue uma sangria para o cofre seguro agora.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('sangria');
                      setMovType('sangria');
                      setMovAmount((sessionStats.expectedInDrawer - drawerCashLimit).toFixed(2));
                      setMovDesc('Sangria preventiva por excesso de dinheiro em gaveta');
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 shadow-md cursor-pointer transition-all shrink-0"
                  >
                    <DollarSign size={15} /> Sangrar Excedente (R$ {(sessionStats.expectedInDrawer - drawerCashLimit).toFixed(2)})
                  </button>
                </div>
              )}

              {/* ALERTA VISUAL DE PEDIDO PRONTO PARA O BALCÃO BUSCAR */}
              {caixaReadyAlert && (
                <div className="mb-6 p-4 md:p-5 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-2xl border-2 border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-bounce">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-white text-emerald-700 rounded-2xl font-black shadow-lg shrink-0">
                      <CheckCircle2 size={30} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-widest bg-emerald-950/70 px-2.5 py-0.5 rounded-full text-emerald-200">
                          🛎️ PEDIDO PRONTO NA COZINHA!
                        </span>
                        <span className="font-mono font-black text-sm">
                          #{caixaReadyAlert.id.slice(0, 5).toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-lg md:text-xl font-black uppercase mt-1">
                        Buscar Pedido de: {caixaReadyAlert.customerName || 'Cliente'}
                      </h4>
                      <p className="text-xs text-emerald-100 font-medium">
                        Modalidade: {caixaReadyAlert.orderType?.toUpperCase() || 'BALCÃO'} • {caixaReadyAlert.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSaleToPrint(caixaReadyAlert);
                        setCaixaReadyAlert(null);
                      }}
                      className="px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <Printer size={15} /> Imprimir Comanda
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaixaReadyAlert(null)}
                      className="p-2.5 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 hover:text-white rounded-xl cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}
              {activeTab === 'pdv' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[75vh]">
                  
                  {/* Grade de Produtos com Categorias */}
                  <div className="lg:col-span-7 glass-card rounded-3xl p-6 border-t-4 border-blue-500 flex flex-col">
                    
                    {/* Abas de Categorias Solicitadas */}
                    <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setPosCategory('mais_pedidos')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          posCategory === 'mais_pedidos'
                            ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Sparkles size={15} /> Mais Pedidos (Top 9)
                      </button>

                      <button
                        type="button"
                        onClick={() => setPosCategory('hamburgueres')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          posCategory === 'hamburgueres'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <UtensilsCrossed size={15} /> Hambúrgueres
                      </button>

                      <button
                        type="button"
                        onClick={() => setPosCategory('duplos')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          posCategory === 'duplos'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Flame size={15} /> Linha Duplos
                      </button>

                      <button
                        type="button"
                        onClick={() => setPosCategory('bebidas')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          posCategory === 'bebidas'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Coffee size={15} /> Bebidas
                      </button>

                      <button
                        type="button"
                        onClick={() => setPosCategory('porcoes')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          posCategory === 'porcoes'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        🍟 Porções
                      </button>
                    </div>

                    {/* Grid de Cards dos Produtos */}
                    {displayedProducts.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-8">
                        <AlertCircle size={40} className="mb-3 opacity-40 text-blue-400" />
                        <p>Nenhum produto nesta categoria.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto max-h-[62vh] pr-1">
                        {displayedProducts.map(p => {
                          const price = saleChannel === 'ifood' ? p.priceIfood : p.priceBalcao;
                          const isBurger = p.category === 'lanche';

                          return (
                            <button 
                              key={p.id} 
                              onClick={() => handleProductClick(p)} 
                              className={`p-4 rounded-2xl text-left transition-all group flex flex-col justify-between border cursor-pointer ${
                                isBurger 
                                  ? 'bg-slate-950/70 border-slate-800 hover:border-amber-500/80 hover:bg-amber-500/10' 
                                  : 'bg-slate-950/50 border-slate-800 hover:border-emerald-500/80 hover:bg-emerald-500/10'
                              }`}
                            >
                              <div>
                                <span className="font-bold text-slate-200 group-hover:text-white line-clamp-2 text-sm">
                                  {p.name}
                                </span>
                                {isBurger && (
                                  <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">
                                    + Combo & Adicionais
                                  </span>
                                )}
                              </div>
                              <span className="text-base text-emerald-400 mt-3 font-mono font-bold">
                                R$ {price.toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Carrinho de Pedidos */}
                  <div className="lg:col-span-5 glass-card rounded-3xl p-6 border-t-4 border-emerald-500 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <CartIcon size={20} className="text-emerald-400" /> Carrinho do Pedido
                        </h2>
                        
                        <select 
                          value={saleChannel} 
                          onChange={e => {
                            const ch = e.target.value as 'balcao' | 'ifood';
                            setSaleChannel(ch);
                            if (ch === 'ifood') {
                              setSaleMethod('ifood_online');
                              setOrderType('delivery');
                            } else {
                              setSaleMethod('credito');
                            }
                          }} 
                          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-bold outline-none cursor-pointer"
                        >
                          <option value="balcao">🏪 Balcão</option>
                          <option value="ifood">🛵 iFood</option>
                        </select>
                      </div>

                      {/* Modalidade de Consumo Solicitada */}
                      <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Modalidade do Atendimento:
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setOrderType('mesa')}
                            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              orderType === 'mesa'
                                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            🍽️ Mesa
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderType('retirada')}
                            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              orderType === 'retirada'
                                ? 'bg-blue-600 text-white font-extrabold shadow-md'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            🥡 Retirada
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderType('delivery')}
                            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              orderType === 'delivery'
                                ? 'bg-emerald-600 text-white font-extrabold shadow-md'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            🛵 Delivery
                          </button>
                        </div>
                      </div>

                      {/* Nome do Cliente Solicitado */}
                      <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                          <User size={14} className="text-emerald-400" /> 
                          {orderType === 'mesa' ? 'Número da Mesa / Identificação' : orderType === 'retirada' ? 'Nome para Retirada' : 'Nome e Endereço do Cliente'}
                        </label>
                        <input 
                          type="text" 
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder={orderType === 'mesa' ? 'Ex: Mesa 04' : orderType === 'retirada' ? 'Ex: Lucas' : 'Ex: Carlos - Rua das Flores, 123'}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 font-medium placeholder:text-slate-600"
                        />
                      </div>

                      {/* Direcionamento da Produção Solicitado */}
                      <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <Flame size={14} className="text-amber-400" /> Direcionamento da Produção:
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setOrderProductionStatus('em_espera')}
                            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 text-center ${
                              orderProductionStatus === 'em_espera'
                                ? 'bg-amber-600 text-white font-black shadow-md ring-2 ring-amber-400'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            ⏳ Em Espera (Padrão)
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderProductionStatus('em_producao')}
                            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 text-center ${
                              orderProductionStatus === 'em_producao'
                                ? 'bg-emerald-600 text-white font-black shadow-md ring-2 ring-emerald-400'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            🔥 Na Chapa
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderProductionStatus('agendado')}
                            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 text-center ${
                              orderProductionStatus === 'agendado'
                                ? 'bg-purple-600 text-white font-black shadow-md ring-2 ring-purple-400'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            📅 Agendado
                          </button>
                        </div>
                      </div>

                      {/* Banner de Modo de Edição de Pedido Reaberto */}
                      {editingReopenedSale && (
                        <div className="p-3 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-2xl flex items-center justify-between mb-3 animate-fade-in">
                          <div className="flex items-center gap-2 text-xs font-bold">
                            <GitCompare size={16} className="text-amber-400 shrink-0" />
                            <span>MODO EDIÇÃO: Pedido #{editingReopenedSale.id.slice(0, 6).toUpperCase()}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReopenedSale(null);
                              setCart([]);
                              setCustomerName('');
                              setDiscountInput('');
                              setDeliveryFeeInput('');
                              setHasStoreCoupon(false);
                              setOrderProductionStatus('em_espera');
                            }}
                            className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer shrink-0"
                          >
                            Cancelar Edição
                          </button>
                        </div>
                      )}

                      {/* Itens do Carrinho */}
                      <div className="overflow-y-auto space-y-2.5 max-h-[38vh] pr-1">
                        {cart.length === 0 ? (
                          <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                            <CartIcon size={40} className="mb-2 opacity-20" />
                            <p className="text-xs">Selecione os hambúrgueres e bebidas ao lado.</p>
                          </div>
                        ) : (
                          cart.map((item, idx) => (
                            <div key={idx} className={`border p-3.5 rounded-2xl space-y-1.5 transition-all ${
                              item.isGift 
                                ? 'bg-emerald-950/25 border-emerald-500/40' 
                                : 'bg-slate-950/70 border-slate-800/90'
                            }`}>
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-slate-200 text-sm">{item.productName}</p>
                                    {item.isGift && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                        <Gift size={10} /> BRINDE ({
                                          item.giftReason === 'falta_pedido_anterior' ? 'Falta anterior' :
                                          item.giftReason === 'fidelidade_cliente' ? 'Fidelidade' :
                                          item.giftReason === 'atraso_preparo' ? 'Atraso' :
                                          item.giftReason === 'cortesia_casa' ? 'Cortesia' : 'Outro'
                                        })
                                      </span>
                                    )}
                                  </div>
                                  {item.combo && (
                                    <p className="text-[11px] text-amber-400 font-semibold">
                                      + {item.combo}
                                    </p>
                                  )}
                                  {item.additionals && item.additionals.length > 0 && (
                                    <p className="text-[11px] text-blue-400 font-medium">
                                      + {item.additionals.map(a => a.name).join(', ')}
                                    </p>
                                  )}
                                  {item.giftNotes && (
                                    <p className="text-[10px] text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-md inline-block">
                                      Motivo: {item.giftNotes}
                                    </p>
                                  )}
                                  {item.notes && (
                                    <p className="text-[10px] italic text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md inline-block">
                                      Obs: {item.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right font-mono">
                                  {item.isGift ? (
                                    <div>
                                      <span className="line-through text-slate-500 text-xs block">
                                        R$ {((item.originalPrice || 0) * item.quantity).toFixed(2)}
                                      </span>
                                      <span className="font-black text-emerald-400 text-sm">
                                        R$ 0,00
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-bold text-emerald-400 text-sm">
                                      R$ {(item.unitPrice * item.quantity).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex justify-between items-center pt-1 border-t border-slate-900">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 font-mono">
                                    {item.isGift ? 'Cortesia' : `R$ ${item.unitPrice.toFixed(2)} un`}
                                  </span>
                                  {/* Botão de Conceder / Gerenciar Brinde */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenGiftModal(idx)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                      item.isGift
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                        : 'bg-slate-900 text-slate-400 hover:text-emerald-400 border border-slate-800'
                                    }`}
                                    title={item.isGift ? 'Clique para remover ou editar brinde' : 'Marcar este item como Brinde / Cortesia'}
                                  >
                                    <Gift size={11} /> {item.isGift ? 'Remover Brinde' : 'Dar como Brinde'}
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 bg-slate-900 rounded-lg p-1">
                                    <button onClick={() => updateCartQty(idx, -1)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                                      <Minus size={12}/>
                                    </button>
                                    <span className="font-bold text-xs w-4 text-center text-white">{item.quantity}</span>
                                    <button onClick={() => updateCartQty(idx, 1)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                                      <Plus size={12}/>
                                    </button>
                                  </div>
                                  <button onClick={() => removeFromCart(idx)} className="text-slate-500 hover:text-red-400 p-1 cursor-pointer">
                                    <Trash2 size={15}/>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Finalização da Venda */}
                    <div className="pt-4 border-t border-slate-800 space-y-3">
                      
                      {/* Controles Financeiros: Taxa de Entrega, Desconto e Cupom Loja */}
                      <div className="space-y-2">
                        
                        {/* Taxa de Entrega (se Delivery ou iFood) */}
                        {(orderType === 'delivery' || saleChannel === 'ifood') && (
                          <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80 space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                                <Truck size={13} className="text-blue-400" /> Taxa de Entrega:
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-mono text-xs">R$</span>
                                <input
                                  type="number"
                                  step="0.50"
                                  placeholder="0.00"
                                  value={deliveryFeeInput}
                                  onChange={e => setDeliveryFeeInput(e.target.value)}
                                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-mono font-bold text-white outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                            <div className="flex gap-1 justify-end">
                              {[0, 5, 7, 10].map(val => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setDeliveryFeeInput(val === 0 ? '' : val.toFixed(2))}
                                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded text-[10px] font-mono cursor-pointer"
                                >
                                  {val === 0 ? 'Grátis' : `R$ ${val}`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Desconto no Pedido */}
                        <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-300 flex items-center gap-1.5">
                              <Tag size={13} className="text-amber-400" /> Desconto (R$ ou %):
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Ex: 5 ou 10%"
                                value={discountInput}
                                onChange={e => setDiscountInput(e.target.value)}
                                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-mono font-bold text-amber-300 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                          <div className="flex gap-1 justify-end">
                            {['R$ 5', 'R$ 10', '5%', '10%'].map(val => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setDiscountInput(val.replace('R$ ', ''))}
                                className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded text-[10px] font-mono cursor-pointer"
                              >
                                {val}
                              </button>
                            ))}
                            {discountInput && (
                              <button
                                type="button"
                                onClick={() => setDiscountInput('')}
                                className="px-1.5 py-0.5 text-red-400 text-[10px] hover:underline cursor-pointer"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Declaração de Cupom iFood Custeado pela Loja */}
                        {saleChannel === 'ifood' && (
                          <div className="bg-red-950/20 p-2.5 rounded-2xl border border-red-500/30 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-red-200">
                                <input
                                  type="checkbox"
                                  checked={hasStoreCoupon}
                                  onChange={e => setHasStoreCoupon(e.target.checked)}
                                  className="rounded border-red-500 accent-red-600"
                                />
                                <span>Cupom pago pela Loja? (Ex: Hits)</span>
                              </label>
                              {hasStoreCoupon && (
                                <div className="flex items-center gap-1">
                                  <span className="text-red-400 font-mono text-xs font-bold">-R$</span>
                                  <input
                                    type="number"
                                    step="1"
                                    value={storeCouponInput}
                                    onChange={e => setStoreCouponInput(e.target.value)}
                                    className="w-16 bg-slate-900 border border-red-500/50 rounded-lg px-1.5 py-0.5 text-right text-xs font-mono font-black text-red-400 outline-none"
                                  />
                                </div>
                              )}
                            </div>
                            {hasStoreCoupon && (
                              <div className="flex gap-1 justify-end">
                                {[5, 10, 12, 15].map(v => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => setStoreCouponInput(v.toFixed(2))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                                      parseFloat(storeCouponInput) === v 
                                        ? 'bg-red-600 text-white' 
                                        : 'bg-slate-900 text-red-300 hover:bg-slate-800'
                                    }`}
                                  >
                                    R$ {v}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Resumo Discriminado de Valores */}
                      <div className="space-y-1 text-xs pt-1 border-t border-slate-800/80">
                        <div className="flex justify-between text-slate-400">
                          <span>Subtotal Itens:</span>
                          <span className="font-mono text-slate-200">R$ {cartSubtotal.toFixed(2)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-amber-400 font-semibold">
                            <span>Desconto Concedido:</span>
                            <span className="font-mono">- R$ {discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {deliveryFeeAmount > 0 && (
                          <div className="flex justify-between text-blue-400 font-semibold">
                            <span>Taxa de Entrega:</span>
                            <span className="font-mono">+ R$ {deliveryFeeAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                          <span className="text-slate-300 text-sm font-bold">Total a Pagar:</span>
                          <span className="text-2xl font-mono font-extrabold text-emerald-400">
                            R$ {cartTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Forma de Pagamento:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: 'ifood_online', label: 'iFood Online', fee: 'Taxa 33%', isIfood: true },
                            { id: 'ifood_entrega', label: 'iFood Entrega', fee: 'Taxa 23%', isIfood: true },
                            { id: 'credito', label: 'Cartão Crédito', fee: 'Taxa 3%' },
                            { id: 'debito', label: 'Cartão Débito', fee: 'Taxa 1%' },
                            { id: 'pix', label: 'PIX Direto', fee: 'Taxa 0%' },
                            { id: 'dinheiro', label: 'Dinheiro', fee: 'Gaveta' },
                            { id: 'consumo_funcionario', label: 'Consumo Equipe', fee: 'Colaborador', isCollab: true },
                            { id: 'fiado_vip', label: 'Fiado VIP', fee: 'A Receber', isFiado: true }
                          ].map(method => (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => {
                                setSaleMethod(method.id);
                                if (method.isIfood && saleChannel !== 'ifood') {
                                  setSaleChannel('ifood');
                                  setOrderType('delivery');
                                }
                              }}
                              className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                                saleMethod === method.id 
                                  ? method.isCollab 
                                    ? 'bg-purple-600 border-purple-500 text-white shadow-md font-extrabold'
                                    : method.isFiado
                                      ? 'bg-amber-600 border-amber-500 text-white shadow-md font-extrabold'
                                      : 'bg-emerald-600 border-emerald-500 text-white shadow-md font-extrabold' 
                                  : method.isIfood
                                    ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                                    : method.isCollab
                                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                                      : method.isFiado
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-800'
                              }`}
                            >
                              <span className="block text-xs font-bold leading-tight">{method.label}</span>
                              <span className={`text-[10px] font-mono ${saleMethod === method.id ? 'text-white/90' : 'text-slate-400'}`}>
                                {method.fee}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Formulário Condicional: Consumo de Funcionário */}
                        {saleMethod === 'consumo_funcionario' && (
                          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                                <UserCheck size={14} /> Colaborador da Equipe
                              </span>
                              <span className="text-[10px] text-purple-400">Consumo Interno / Folha</span>
                            </div>
                            <select
                              value={selectedCollaboratorId}
                              onChange={e => setSelectedCollaboratorId(e.target.value)}
                              className="w-full bg-slate-950 border border-purple-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                            >
                              <option value="">-- Selecione o Colaborador --</option>
                              {collaboratorsList.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.role === 'caixa' ? 'Caixa' : c.role === 'cozinha' ? 'Cozinha' : c.role === 'gerente' ? 'Gerente' : c.role})
                                </option>
                              ))}
                            </select>
                            {collaboratorsList.length === 0 && (
                              <p className="text-[11px] text-amber-400">
                                Nenhum colaborador cadastrado. Cadastre no módulo Gestão &gt; Colaboradores.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Formulário Condicional: Fiado VIP */}
                        {saleMethod === 'fiado_vip' && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                <CreditCard size={14} /> Registro de Fiado VIP
                              </span>
                              <span className="text-[10px] text-amber-400">Lançamento em Contas a Receber</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Nome do Cliente VIP *</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Dr. Roberto / Carla Vizinha"
                                  value={creditCustomerInput}
                                  onChange={e => setCreditCustomerInput(e.target.value)}
                                  className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Previsão de Quitação</label>
                                <input
                                  type="date"
                                  value={creditDueDateInput}
                                  onChange={e => setCreditDueDateInput(e.target.value)}
                                  className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">Observações / Telefone / Contato</label>
                              <input
                                type="text"
                                placeholder="Ex: Paga todo dia 10 / WhatsApp (11) 99999-8888"
                                value={creditNotesInput}
                                onChange={e => setCreditNotesInput(e.target.value)}
                                className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        type="button"
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className={`w-full py-3.5 ${
                          editingReopenedSale 
                            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 ring-2 ring-amber-400' 
                            : 'bg-brand-primary hover:bg-brand-primaryHover shadow-xs'
                        } disabled:bg-surface-elevated disabled:text-slate-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-sm`}
                      >
                        {editingReopenedSale ? <GitCompare size={16} /> : <Send size={16} />}
                        <span>{editingReopenedSale ? 'Salvar Alterações & Emitir Delta (Diff)' : 'Finalizar Pedido'}</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* ABA MAPA VISUAL INTERATIVO DE MESAS */}
              {activeTab === 'mesas' && (
                <div className="space-y-6">
                  <MapaMesasCanvas
                    floorSession={floorSession}
                    onUpdateSession={setFloorSession}
                    onSelectTableForOrder={(mesa) => {
                      setOrderType('mesa');
                      setCustomerName(mesa.numeroIdentificador);
                      setActiveTab('pdv');
                    }}
                    operatorName="Operador"
                  />
                </div>
              )}

              {/* ABA GESTÃO DE PRODUÇÃO & EXPEDIÇÃO (CONTROLE DO BALCÃO) */}
              {activeTab === 'producao' && (
                <div className="glass-card rounded-3xl p-8 border-t-4 border-amber-500 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                        <Flame className="text-amber-500" /> Fila de Produção & Expedição
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Controle do Balcão: libere os pedidos para a chapa da cozinha conforme rotas de entrega e liberação de mesas.
                      </p>
                    </div>

                    {/* Filtro de Status de Produção */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                      {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'em_espera', label: '⏳ Em Espera' },
                        { id: 'agendado', label: '📅 Agendados' },
                        { id: 'em_producao', label: '🔥 Na Chapa' },
                        { id: 'concluido', label: '✅ Concluídos' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setProductionFilter(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            productionFilter === tab.id
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setActiveTab('rotas')}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                        title="Ir para o Painel de Separação de Rotas por Entregador"
                      >
                        <Truck size={14} /> 🛵 Rotas ({currentSessionSales.filter(s => s.orderType === 'delivery' || s.channel === 'ifood').length})
                      </button>
                    </div>
                  </div>

                  {/* BARRA DE AÇÃO EM LOTE PARA A CHAPA */}
                  {waitingOrders.length > 0 && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 to-orange-950/40 border border-amber-500/40 space-y-3 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <label className="flex items-center gap-2.5 text-xs font-bold text-slate-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selectedOrdersForBatch.length > 0 && selectedOrdersForBatch.length === waitingOrders.length}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedOrdersForBatch(waitingOrders.map(o => o.id));
                              } else {
                                setSelectedOrdersForBatch([]);
                              }
                            }}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-700 cursor-pointer"
                          />
                          <span>Selecionar todos em espera ({waitingOrders.length} pedidos)</span>
                        </label>

                        {selectedOrdersForBatch.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              updateBatchProductionStatus(selectedOrdersForBatch, 'em_producao');
                              setSelectedOrdersForBatch([]);
                            }}
                            className="py-2.5 px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 cursor-pointer transition-all animate-pulse"
                          >
                            <Flame size={16} /> Enviar Remessa em Lote ({selectedOrdersForBatch.length} Pedidos)
                          </button>
                        )}
                      </div>

                      {/* Resumo da Remessa de Hambúrgueres */}
                      {selectedOrdersForBatch.length > 0 && (
                        <div className="pt-2 border-t border-amber-500/20 flex items-start gap-2 text-xs text-amber-300">
                          <Utensils size={15} className="shrink-0 mt-0.5" />
                          <span>
                            <strong>Total da remessa ({batchBurgersSummary.totalBurgers} lanches):</strong> {batchBurgersSummary.summaryList}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de Pedidos de Produção (Apenas do Turno Ativo) */}
                  {currentSessionSales.filter(s => {
                    if (productionFilter === 'todos') return true;
                    return (s.productionStatus || 'em_producao') === productionFilter;
                  }).length === 0 ? (
                    <div className="py-16 text-center text-slate-500">
                      <Flame size={44} className="mx-auto mb-2 opacity-20 text-amber-500" />
                      <p className="text-sm">Nenhum pedido encontrado nesta categoria de produção para o turno ativo.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentSessionSales
                        .filter(s => {
                          if (productionFilter === 'todos') return true;
                          return (s.productionStatus || 'em_producao') === productionFilter;
                        })
                        .map(sale => {
                          const status = sale.productionStatus || 'em_producao';
                          const isWaiting = status === 'em_espera' || status === 'agendado';
                          const isCooking = status === 'em_producao';
                          const isDone = status === 'concluido';

                          return (
                            <div 
                              key={sale.id} 
                              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                                isCooking 
                                  ? 'bg-amber-950/20 border-amber-500/40 shadow-lg' 
                                  : isWaiting 
                                    ? selectedOrdersForBatch.includes(sale.id)
                                      ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/50'
                                      : 'bg-slate-950/70 border-slate-800' 
                                    : 'bg-emerald-950/15 border-emerald-500/30'
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-start pb-3 mb-2 border-b border-slate-800/80">
                                  <div className="flex items-start gap-3">
                                    {isWaiting && (
                                      <input
                                        type="checkbox"
                                        checked={selectedOrdersForBatch.includes(sale.id)}
                                        onChange={() => {
                                          if (selectedOrdersForBatch.includes(sale.id)) {
                                            setSelectedOrdersForBatch(selectedOrdersForBatch.filter(id => id !== sale.id));
                                          } else {
                                            setSelectedOrdersForBatch([...selectedOrdersForBatch, sale.id]);
                                          }
                                        }}
                                        className="w-5 h-5 mt-0.5 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-700 cursor-pointer"
                                      />
                                    )}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-white text-base">
                                          #{sale.id.slice(0, 5).toUpperCase()}
                                        </span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                        isCooking
                                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                                          : isWaiting
                                            ? status === 'agendado' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'
                                            : 'bg-emerald-600 text-white'
                                      }`}>
                                        {isCooking ? '🔥 NA CHAPA' : isWaiting ? (status === 'agendado' ? '📅 AGENDADO' : '⏳ EM ESPERA') : '✅ CONCLUÍDO'}
                                      </span>
                                    </div>
                                    <p className="text-sm font-black text-amber-300 mt-1 uppercase">
                                      {sale.customerName || 'Cliente'}
                                    </p>
                                    <span className="text-[10px] text-slate-400">
                                      Modalidade: {sale.orderType?.toUpperCase() || 'BALCÃO'} • {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedSaleToPrint(sale)}
                                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer"
                                    title="Imprimir Comanda"
                                  >
                                    <Printer size={16} />
                                  </button>
                                </div>

                                {/* Itens do Pedido */}
                                <div className="space-y-1.5 my-2">
                                  {sale.items?.map((i, idx) => (
                                    <div key={idx} className="text-xs text-slate-200 flex justify-between">
                                      <span>[{i.quantity}x] {i.productName}</span>
                                      {i.combo && <span className="text-[10px] text-amber-400 pl-2">+{i.combo}</span>}
                                    </div>
                                  ))}
                                </div>

                                {/* Atraso registrado se houver */}
                                {sale.delayReason && (
                                  <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 mt-2 space-y-0.5">
                                    <p className="font-bold flex items-center gap-1.5">
                                      <AlertOctagon size={13} className="text-red-400" />
                                      Justificativa da Cozinha: {
                                        sale.delayReason === 'erro_producao' ? 'Erro na Produção' :
                                        sale.delayReason === 'falta_insumo' ? 'Falta de Insumo' :
                                        sale.delayReason === 'falta_atencao' ? 'Falta de Atenção' : 'Desperdício'
                                      }
                                    </p>
                                    {sale.delayNotes && <p className="italic text-[10px]">Obs: {sale.delayNotes}</p>}
                                  </div>
                                )}
                              </div>

                              {/* Ações do Balcão */}
                              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2">
                                {isWaiting && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => updateOrderProductionStatus(sale.id, 'em_producao')}
                                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                                    >
                                      <Play size={15} /> Liberar p/ Chapa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartReopenSale(sale)}
                                      className="py-3 px-3.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                                      title="Editar itens ou observações deste pedido em espera"
                                    >
                                      <Edit3 size={15} /> Editar
                                    </button>
                                  </>
                                )}

                                {isCooking && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setPendingRemovalFromGrill({ sale, action: 'pause' })}
                                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                    >
                                      <Pause size={14} /> Pausar p/ Espera
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartReopenSale(sale)}
                                      className="py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                                      title="Modificar pedido em andamento na chapa (alerta a cozinha)"
                                    >
                                      <Edit3 size={14} /> Alterar
                                    </button>
                                  </>
                                )}

                                {isDone && (
                                  <div className="w-full text-center py-2 text-xs font-bold text-emerald-400 bg-emerald-950/40 rounded-xl border border-emerald-500/20">
                                    Pronto para Servir / Rota do Entregador
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA GESTÃO DE ROTAS & EXPEDIÇÃO DE ENTREGADORES */}
              {/* ========================================================================= */}
              {activeTab === 'rotas' && (
                <div className="glass-card rounded-3xl p-6 md:p-8 border-t-4 border-cyan-500 space-y-6 animate-fade-in">
                  {/* Topo / Header da Gestão de Rotas */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Truck size={22} />
                        </span>
                        <h2 className="text-xl lg:text-2xl font-black text-white">
                          Gestão de Rotas & Entregadores
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400">
                        Separe os pedidos de delivery em blocos organizados por entregador, confira os nomes das entregas e envie remessas conjuntas para a chapa.
                      </p>
                    </div>

                    {/* Métricas Rápidas de Delivery */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Sem Rota</span>
                        <span className="text-lg font-mono font-black text-amber-400">
                          {unassignedDeliverySales.length}
                        </span>
                      </div>

                      <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Rotas Ativas</span>
                        <span className="text-lg font-mono font-black text-cyan-400">
                          {deliveryRoutes.filter(r => r.status !== 'entregue').length}
                        </span>
                      </div>

                      <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Em Trânsito</span>
                        <span className="text-lg font-mono font-black text-emerald-400">
                          {deliveryRoutes.filter(r => r.status === 'em_rota').length}
                        </span>
                      </div>

                      <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Concluídas</span>
                        <span className="text-lg font-mono font-black text-blue-400">
                          {deliveryRoutes.filter(r => r.status === 'entregue').length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* FORMULÁRIO DE CRIAÇÃO RÁPIDA DE NOVO BLOCO DE ROTA */}
                  <div className="p-4 md:p-5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                    <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-3">
                      <div className="w-full sm:w-1/3">
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Selecionar Colaborador / Entregador:
                        </label>
                        <select
                          value={newCourierInput}
                          onChange={e => setNewCourierInput(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
                        >
                          <option value="">-- Escolha da Equipe ou Digite ao lado --</option>
                          {collaboratorsList.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.name} ({c.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full sm:w-2/3">
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Ou Digite o Nome do Motoboy / Entregador:
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Carlos (Moto 02) ou Matheus iFood"
                          value={newCourierInput}
                          onChange={e => setNewCourierInput(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const name = newCourierInput.trim();
                        if (!name) {
                          alert('Informe ou selecione o nome do entregador para criar a rota.');
                          return;
                        }
                        const newBlock: DeliveryRouteBlock = {
                          id: `rota_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                          courierName: name,
                          createdAt: new Date().toISOString(),
                          status: 'montando',
                          saleIds: selectedOrdersForRoute
                        };
                        saveDeliveryRoutes([newBlock, ...deliveryRoutes]);
                        setSelectedOrdersForRoute([]);
                        setNewCourierInput('');
                      }}
                      className="w-full md:w-auto py-3 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/25 transition-all shrink-0"
                    >
                      <Plus size={16} /> Criar Bloco de Rota {selectedOrdersForRoute.length > 0 && `(${selectedOrdersForRoute.length} pedidos selecionados)`}
                    </button>
                  </div>

                  {/* GRID PRINCIPAL: 2 COLUNAS (DISPONÍVEIS vs BLOCOS DE ENTREGADORES) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* COLUNA ESQUERDA: PEDIDOS DE DELIVERY DISPONÍVEIS (SEM ROTA) */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-extrabold text-white text-sm uppercase tracking-wide flex items-center gap-2">
                          <CartIcon size={16} className="text-amber-400" />
                          Delivery sem Rota ({unassignedDeliverySales.length})
                        </h3>

                        {/* Ação em lote se houver rotas abertas */}
                        {selectedOrdersForRoute.length > 0 && deliveryRoutes.filter(r => r.status !== 'entregue').length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <select
                              onChange={e => {
                                const targetRouteId = e.target.value;
                                if (!targetRouteId) return;
                                const updated = deliveryRoutes.map(r => {
                                  if (r.id === targetRouteId) {
                                    const combined = Array.from(new Set([...r.saleIds, ...selectedOrdersForRoute]));
                                    return { ...r, saleIds: combined };
                                  }
                                  return r;
                                });
                                saveDeliveryRoutes(updated);
                                setSelectedOrdersForRoute([]);
                                e.target.value = '';
                              }}
                              className="bg-cyan-950 border border-cyan-500 text-cyan-200 text-xs rounded-xl px-2 py-1 outline-none"
                            >
                              <option value="">Atribuir {selectedOrdersForRoute.length} à...</option>
                              {deliveryRoutes.filter(r => r.status !== 'entregue').map(r => (
                                <option key={r.id} value={r.id}>
                                  Rota: {r.courierName} ({r.saleIds.length} pedidos)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Lista de Pedidos Disponíveis */}
                      {(() => {
                        const unassigned = unassignedDeliverySales;

                        if (unassigned.length === 0) {
                          return (
                            <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                              Nenhum pedido de delivery aguardando rota no momento. Todos foram atribuídos ou já foram entregues.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                            {unassigned.map(sale => {
                              const isSelected = selectedOrdersForRoute.includes(sale.id);
                              return (
                                <div
                                  key={sale.id}
                                  className={`p-4 rounded-2xl border transition-all ${
                                    isSelected
                                      ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500'
                                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={e => {
                                          if (e.target.checked) {
                                            setSelectedOrdersForRoute(prev => [...prev, sale.id]);
                                          } else {
                                            setSelectedOrdersForRoute(prev => prev.filter(id => id !== sale.id));
                                          }
                                        }}
                                        className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 bg-slate-900 border-slate-700 cursor-pointer"
                                      />
                                      <div>
                                        <span className="font-mono font-black text-xs text-white">
                                          #{sale.id.slice(0, 5).toUpperCase()}
                                        </span>
                                        <p className="font-bold text-xs text-slate-200 uppercase mt-0.5">
                                          {sale.customerName || 'Cliente Delivery'}
                                        </p>
                                      </div>
                                    </label>

                                    <div className="text-right">
                                      <span className="font-mono font-black text-xs text-emerald-400 block">
                                        R$ {sale.total.toFixed(2)}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block mt-0.5 ${
                                        sale.productionStatus === 'concluido'
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : sale.productionStatus === 'em_producao'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : 'bg-slate-800 text-slate-300'
                                      }`}>
                                        {sale.productionStatus === 'concluido' ? '🛎️ Pronto' : sale.productionStatus === 'em_producao' ? '🔥 Na Chapa' : '⏳ Em Espera'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Resumo de Itens e Endereço */}
                                  <div className="text-[11px] text-slate-400 space-y-1">
                                    <p className="text-slate-300 line-clamp-2">
                                      {sale.items?.map(i => `${i.quantity}x ${i.productName}`).join(' • ')}
                                    </p>
                                    <p className="text-[10px] text-slate-400 italic">
                                      Pagamento: {sale.paymentMethod.toUpperCase()} {sale.deliveryFee ? `• Taxa Entrega: R$ ${sale.deliveryFee.toFixed(2)}` : ''}
                                    </p>
                                  </div>

                                  {/* Ação Rápida de Atribuição Individual */}
                                  {deliveryRoutes.filter(r => r.status !== 'entregue').length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                                      <span className="text-[10px] text-slate-400 font-bold">Enviar para Rota:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {deliveryRoutes.filter(r => r.status !== 'entregue').map(r => (
                                          <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => {
                                              const updated = deliveryRoutes.map(item => {
                                                if (item.id === r.id && !item.saleIds.includes(sale.id)) {
                                                  return { ...item, saleIds: [...item.saleIds, sale.id] };
                                                }
                                                return item;
                                              });
                                              saveDeliveryRoutes(updated);
                                              setSelectedOrdersForRoute(prev => prev.filter(id => id !== sale.id));
                                            }}
                                            className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                                          >
                                            + {r.courierName.split(' ')[0]}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* COLUNA DIREITA: BLOCOS DE ROTAS POR ENTREGADOR */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* Abas Superiores de Filtro de Rotas: Ativas vs Concluídas */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRouteViewTab('ativas')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all ${
                              routeViewTab === 'ativas'
                                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 ring-1 ring-cyan-400'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <Truck size={15} /> Rotas Ativas ({deliveryRoutes.filter(r => r.status !== 'entregue').length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRouteViewTab('entregues')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all ${
                              routeViewTab === 'entregues'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <Check size={15} /> Concluídas / Entregues ({deliveryRoutes.filter(r => r.status === 'entregue').length})
                          </button>
                        </div>

                        {routeViewTab === 'entregues' && deliveryRoutes.some(r => r.status === 'entregue') && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Limpar histórico de rotas já entregues e finalizadas? Os pedidos continuarão registrados como entregues no histórico de vendas e NUNCA retornarão ao delivery sem rota.')) {
                                saveDeliveryRoutes(deliveryRoutes.filter(r => r.status !== 'entregue'));
                              }
                            }}
                            className="text-[11px] text-slate-400 hover:text-red-400 cursor-pointer underline flex items-center gap-1 transition-colors"
                          >
                            <Trash2 size={13} /> Limpar {deliveryRoutes.filter(r => r.status === 'entregue').length} rota(s) entregues
                          </button>
                        )}
                      </div>

                      {/* Conteúdo da Aba 1: ROTAS ATIVAS */}
                      {routeViewTab === 'ativas' && (
                        <>
                          {deliveryRoutes.filter(r => r.status !== 'entregue').length === 0 ? (
                            <div className="glass-card p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
                              <Truck size={36} className="mx-auto text-slate-600 mb-3" />
                              <h4 className="text-base font-extrabold text-white mb-1">Nenhum Bloco de Rota Ativo</h4>
                              <p className="text-xs max-w-md mx-auto">
                                Crie um bloco de rota informando o nome do entregador acima para organizar os pedidos e saber com quem enviar cada entrega.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {deliveryRoutes.filter(r => r.status !== 'entregue').map(route => {
                                const routeSales = route.saleIds.map(id => sales.find(s => s.id === id)).filter(Boolean) as Sale[];
                                const routeTotal = routeSales.reduce((sum, s) => sum + s.total, 0);
                                const waitingInRoute = routeSales.filter(s => s.productionStatus === 'em_espera');
                                const cookingInRoute = routeSales.filter(s => s.productionStatus === 'em_producao');
                                const readyInRoute = routeSales.filter(s => s.productionStatus === 'concluido');

                                return (
                                  <div
                                    key={route.id}
                                    className={`rounded-3xl border-2 p-5 transition-all shadow-xl ${
                                      route.status === 'em_rota'
                                        ? 'bg-slate-900/90 border-cyan-500/80 ring-1 ring-cyan-500/30'
                                        : 'bg-slate-950/90 border-slate-800'
                                    }`}
                                  >
                                    {/* Cabeçalho do Bloco do Entregador */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
                                      <div className="flex items-center gap-2.5">
                                        <div className={`p-2.5 rounded-2xl font-black ${
                                          route.status === 'em_rota' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-cyan-300'
                                        }`}>
                                          <Truck size={20} />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-extrabold text-base text-white uppercase">
                                              Entregador: {route.courierName}
                                            </h4>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                              route.status === 'em_rota' ? 'bg-cyan-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300'
                                            }`}>
                                              {route.status === 'em_rota' ? '🛵 Em Trânsito' : 'Montando Rota'}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-400 mt-0.5">
                                            Criada às {new Date(route.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {route.dispatchedAt && ` • Saiu às ${new Date(route.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
                                        <span className="font-mono font-black text-sm text-emerald-400">
                                          Total: R$ {routeTotal.toFixed(2)}
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-bold">
                                          {routeSales.length} entrega(s)
                                        </span>
                                      </div>
                                    </div>

                                    {/* Status de Produção dos Pedidos desta Rota */}
                                    <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] font-mono">
                                      {waitingInRoute.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          ⏳ {waitingInRoute.length} em espera
                                        </span>
                                      )}
                                      {cookingInRoute.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                          🔥 {cookingInRoute.length} na chapa
                                        </span>
                                      )}
                                      {readyInRoute.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                          🛎️ {readyInRoute.length} pronto p/ entrega
                                        </span>
                                      )}
                                    </div>

                                    {/* Lista de Comandas Atribuídas ao Bloco */}
                                    {routeSales.length === 0 ? (
                                      <div className="p-4 rounded-xl bg-slate-900 border border-dashed border-slate-800 text-center text-xs text-slate-500 my-3">
                                        Nenhum pedido atribuído ainda. Selecione pedidos na coluna esquerda para adicionar a este bloco.
                                      </div>
                                    ) : (
                                      <div className="space-y-2 mb-4">
                                        {routeSales.map((sale, sIdx) => (
                                          <div
                                            key={sale.id}
                                            className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-cyan-400">
                                                  #{sIdx + 1}
                                                </span>
                                                <span className="font-mono font-bold text-slate-300">
                                                  #{sale.id.slice(0, 5).toUpperCase()}
                                                </span>
                                                <strong className="text-white uppercase truncate">
                                                  {sale.customerName || 'Cliente'}
                                                </strong>
                                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                                  sale.productionStatus === 'concluido' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                  {sale.productionStatus === 'concluido' ? 'Pronto' : sale.productionStatus === 'em_producao' ? 'Chapa' : 'Espera'}
                                                </span>
                                              </div>
                                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                {sale.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                                              </p>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="font-mono font-black text-slate-200">
                                                R$ {sale.total.toFixed(2)}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = deliveryRoutes.map(item => {
                                                    if (item.id === route.id) {
                                                      return { ...item, saleIds: item.saleIds.filter(id => id !== sale.id) };
                                                    }
                                                    return item;
                                                  });
                                                  saveDeliveryRoutes(updated);
                                                }}
                                                className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                                title="Remover deste bloco de entrega"
                                              >
                                                <X size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* BARRA DE AÇÕES DO BLOCO DE ENTREGA */}
                                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {/* Botão de Enviar Todos em Espera para a Chapa Conjuntamente */}
                                        {waitingInRoute.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const waitingIds = waitingInRoute.map(s => s.id);
                                              updateBatchProductionStatus(waitingIds, 'em_producao');
                                            }}
                                            className="py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                                          >
                                            <Flame size={14} /> Liberar Rota p/ Chapa ({waitingInRoute.length})
                                          </button>
                                        )}

                                        {/* Botão de Despachar Rota */}
                                        {route.status === 'montando' && routeSales.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = deliveryRoutes.map(item => {
                                                if (item.id === route.id) {
                                                  return { ...item, status: 'em_rota' as const, dispatchedAt: new Date().toISOString() };
                                                }
                                                return item;
                                              });
                                              saveDeliveryRoutes(updated);
                                            }}
                                            className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                                          >
                                            <Truck size={14} /> Despachar c/ Entregador
                                          </button>
                                        )}

                                        {/* Botão de Imprimir Romaneio da Rota */}
                                        {routeSales.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => setSelectedRouteToPrint(route)}
                                            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                          >
                                            <Printer size={14} /> Romaneio
                                          </button>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {route.status === 'em_rota' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = deliveryRoutes.map(item => {
                                                if (item.id === route.id) {
                                                  return { 
                                                    ...item, 
                                                    status: 'entregue' as const,
                                                    deliveredAt: new Date().toISOString()
                                                  };
                                                }
                                                return item;
                                              });
                                              saveDeliveryRoutes(updated);
                                              markSalesAsDelivered(route.saleIds);
                                              updateBatchProductionStatus(route.saleIds, 'concluido');
                                            }}
                                            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                                          >
                                            <Check size={14} /> Concluir Rota
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm(`Desfazer bloco do entregador "${route.courierName}"? Os pedidos retornarão para a fila de disponíveis.`)) {
                                              saveDeliveryRoutes(deliveryRoutes.filter(item => item.id !== route.id));
                                            }
                                          }}
                                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                          title="Desfazer este bloco"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {/* Conteúdo da Aba 2: ROTAS CONCLUÍDAS / ENTREGUES */}
                      {routeViewTab === 'entregues' && (
                        <>
                          {deliveryRoutes.filter(r => r.status === 'entregue').length === 0 ? (
                            <div className="glass-card p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
                              <CheckCircle2 size={36} className="mx-auto text-emerald-600 mb-3" />
                              <h4 className="text-base font-extrabold text-white mb-1">Nenhuma Rota Concluída Ainda</h4>
                              <p className="text-xs max-w-md mx-auto">
                                Quando o motoboy retornar e você clicar em &quot;Concluir Rota&quot;, os blocos finalizados aparecerão aqui para conferência, impressão de romaneio e prestação de contas.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {deliveryRoutes.filter(r => r.status === 'entregue').map(route => {
                                const routeSales = route.saleIds.map(id => sales.find(s => s.id === id)).filter(Boolean) as Sale[];
                                const routeTotal = routeSales.reduce((sum, s) => sum + s.total, 0);

                                return (
                                  <div
                                    key={route.id}
                                    className="rounded-3xl border-2 border-emerald-500/40 bg-slate-950/90 p-5 transition-all shadow-xl"
                                  >
                                    {/* Cabeçalho do Bloco Entregue */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
                                      <div className="flex items-center gap-2.5">
                                        <div className="p-2.5 rounded-2xl font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                          <CheckCircle2 size={20} />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-extrabold text-base text-white uppercase">
                                              Entregador: {route.courierName}
                                            </h4>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                              <Check size={12} /> Entregue
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-400 mt-0.5">
                                            {route.deliveredAt 
                                              ? `Finalizada às ${new Date(route.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                              : `Criada às ${new Date(route.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                            {route.dispatchedAt && ` • Saiu às ${new Date(route.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
                                        <span className="font-mono font-black text-sm text-emerald-400">
                                          Total: R$ {routeTotal.toFixed(2)}
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-bold">
                                          {routeSales.length} entrega(s) concluída(s)
                                        </span>
                                      </div>
                                    </div>

                                    {/* Lista de Comandas Entregues */}
                                    <div className="space-y-2 mb-4">
                                      {routeSales.map((sale, sIdx) => (
                                        <div
                                          key={sale.id}
                                          className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono font-black text-emerald-400">
                                                #{sIdx + 1}
                                              </span>
                                              <span className="font-mono font-bold text-slate-400">
                                                #{sale.id.slice(0, 5).toUpperCase()}
                                              </span>
                                              <strong className="text-slate-200 uppercase truncate">
                                                {sale.customerName || 'Cliente'}
                                              </strong>
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                                                Entregue
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                              {sale.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                                            </p>
                                          </div>

                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="font-mono font-black text-slate-300">
                                              R$ {sale.total.toFixed(2)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Ações da Rota Concluída */}
                                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedRouteToPrint(route)}
                                          className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                        >
                                          <Printer size={14} /> Romaneio
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm(`Reabrir rota do entregador "${route.courierName}" para o status "Em Trânsito"?`)) {
                                              const updated = deliveryRoutes.map(item => {
                                                if (item.id === route.id) {
                                                  return { ...item, status: 'em_rota' as const, deliveredAt: undefined };
                                                }
                                                return item;
                                              });
                                              saveDeliveryRoutes(updated);
                                              setDeliveredSaleIds(prev => prev.filter(id => !route.saleIds.includes(id)));
                                            }
                                          }}
                                          className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                        >
                                          ↩️ Reabrir Rota
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Excluir esta rota concluída do histórico? Os pedidos continuarão registrados como entregues no histórico de vendas e NUNCA voltarão para o delivery sem rota.`)) {
                                            saveDeliveryRoutes(deliveryRoutes.filter(item => item.id !== route.id));
                                          }
                                        }}
                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                        title="Excluir este bloco concluído do histórico"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* ABA HISTÓRICO DE VENDAS */}
              {activeTab === 'historico' && (() => {
                const displayedHistorySales = historyScope === 'turno' ? currentSessionSales : sales;
                return (
                  <div className="glass-card rounded-3xl p-8 border-t-4 border-blue-500">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                      <div>
                        <h2 className="text-2xl font-bold text-white">Histórico de Pedidos</h2>
                        <p className="text-xs text-slate-400 mt-1">
                          Visualize e gerencie as comandas registradas no sistema.
                        </p>
                      </div>

                      {/* Seletor de Escopo: Turno Atual vs Histórico Geral */}
                      <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setHistoryScope('turno')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            historyScope === 'turno'
                              ? 'bg-blue-600 text-white font-black shadow-md'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Turno Atual ({currentSessionSales.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryScope('todos')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            historyScope === 'todos'
                              ? 'bg-blue-600 text-white font-black shadow-md'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Histórico Geral ({sales.length})
                        </button>
                      </div>
                    </div>
                    
                    {displayedHistorySales.length === 0 ? (
                      <p className="text-slate-500 text-center py-12">
                        {historyScope === 'turno' ? 'Nenhuma venda registrada no turno atual.' : 'Nenhuma venda registrada ainda.'}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {displayedHistorySales.map((sale) => (
                        <div key={sale.id} className={`p-5 rounded-2xl border transition-all ${
                          sale.status === 'cancelled' 
                            ? 'bg-red-500/5 border-red-500/20 opacity-70' 
                            : 'bg-slate-950/60 border-slate-800'
                        }`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                                sale.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {sale.status === 'cancelled' ? 'Estornado' : 'Concluído'}
                              </span>
                              {sale.orderType && (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase ${
                                  sale.orderType === 'delivery'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : sale.orderType === 'retirada'
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}>
                                  {sale.orderType === 'delivery' ? '🛵 Delivery' : sale.orderType === 'retirada' ? '🥡 Retirada' : '🍽️ Mesa'}
                                </span>
                              )}
                              {sale.customerName && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-800 text-slate-200 uppercase border border-slate-700">
                                  {sale.customerName}
                                </span>
                              )}
                              <span className="text-xs text-slate-400">
                                {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Canal: <strong className="text-slate-200 uppercase">{sale.channel}</strong> ({sale.paymentMethod})
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <span className={`font-mono text-xl font-bold ${sale.status === 'cancelled' ? 'text-slate-600 line-through' : 'text-emerald-400'}`}>
                                R$ {sale.total.toFixed(2)}
                              </span>
                              {sale.status !== 'cancelled' && (
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => setSelectedSaleToPrint(sale)} 
                                    className="text-slate-400 hover:text-emerald-400 p-2 hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer" 
                                    title="Imprimir Cupom Térmico (Cozinha / Cliente)"
                                  >
                                    <Printer size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleStartReopenSale(sale)} 
                                    className="text-slate-400 hover:text-amber-400 p-2 hover:bg-amber-500/10 rounded-xl transition-all cursor-pointer" 
                                    title="Reabrir Pedido para Edição / Adições (Exige Senha de Supervisor)"
                                  >
                                    <Edit3 size={18} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (sale.productionStatus === 'em_producao') {
                                        setPendingRemovalFromGrill({ sale, action: 'cancel' });
                                      } else {
                                        setSaleToCancel(sale);
                                        setCancelPasswordInput('');
                                        setCancelReasonInput('Desistência do cliente antes do preparo');
                                        setCancelNotesInput('');
                                        setCancelError('');
                                      }
                                    }} 
                                    className="text-slate-500 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer" 
                                    title="Estornar Venda (Requer Senha de Supervisor)"
                                  >
                                    <XCircle size={18} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
                            <ul className="space-y-1">
                              {sale.items?.map((item, idx) => (
                                <li key={idx} className="flex justify-between text-xs text-slate-300">
                                  <span>{item.quantity}x {item.productName}</span>
                                  <span className="font-mono text-slate-400">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

              {/* ABA SANGRIA / GAVETA */}
              {activeTab === 'sangria' && (
                <div className="glass-card rounded-3xl p-8 border-t-4 border-amber-500">
                  <h2 className="text-2xl font-bold text-white mb-6">Controle de Movimentações (Gaveta)</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <p className="text-xs text-slate-400 font-bold mb-1">Fundo Inicial de Troco</p>
                      <p className="text-2xl font-mono font-bold text-slate-200">R$ {sessionStats.initial.toFixed(2)}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <p className="text-xs text-slate-400 font-bold mb-1">Vendas Dinheiro + Suprimentos</p>
                      <p className="text-2xl font-mono font-bold text-emerald-400">
                        + R$ {(sessionStats.cashSales + sessionStats.suprimentos).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <p className="text-xs text-slate-400 font-bold mb-1">Sangrias Realizadas</p>
                      <p className="text-2xl font-mono font-bold text-red-400">- R$ {sessionStats.sangrias.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-4">Lançar Sangria ou Suprimento</h3>
                      <form onSubmit={handleAddMovement} className="space-y-4 bg-slate-950/60 p-6 rounded-2xl border border-slate-800">
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={() => setMovType('sangria')}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              movType === 'sangria' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-900 text-slate-500'
                            }`}
                          >
                            <TrendingDown size={16} /> Sangria (Retirada)
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setMovType('suprimento')}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              movType === 'suprimento' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-900 text-slate-500'
                            }`}
                          >
                            <TrendingUp size={16} /> Suprimento (Entrada)
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 font-bold mb-1">Valor (R$)</label>
                          <input 
                            type="number" step="0.01" required value={movAmount} onChange={e => setMovAmount(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono outline-none focus:border-amber-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 font-bold mb-1">Motivo / Descrição</label>
                          <input 
                            type="text" required value={movDesc} onChange={e => setMovDesc(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-amber-500"
                            placeholder="Ex: Troco inicial ou Pagamento de gelo"
                          />
                        </div>
                        <button type="submit" className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold rounded-xl transition-all cursor-pointer">
                          Confirmar Lançamento
                        </button>
                      </form>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white mb-4">Movimentações Deste Turno</h3>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {movements.length === 0 ? (
                          <p className="text-slate-500 text-sm py-8 text-center">Nenhuma movimentação lançada.</p>
                        ) : (
                          movements.map(m => (
                            <div key={m.id} className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex justify-between items-center text-sm">
                              <div>
                                <span className={`text-xs font-bold uppercase ${m.type === 'sangria' ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {m.type}
                                </span>
                                <p className="text-slate-200 font-medium">{m.description}</p>
                              </div>
                              <span className={`font-mono font-bold ${m.type === 'sangria' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {m.type === 'sangria' ? '-' : '+'} R$ {m.amount.toFixed(2)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA DE CONTAS A RECEBER (FIADO VIP & CONSUMO DE EQUIPE) */}
              {activeTab === 'contas_receber' && (
                <div className="glass-card rounded-3xl p-6 lg:p-8 border border-slate-800 space-y-6 animate-fade-in">
                  
                  {/* Topo / Header da Aba */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Receipt size={20} />
                        </span>
                        <h2 className="text-xl lg:text-2xl font-black text-white">
                          Gestão de Contas a Receber
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400">
                        Controle de crédito para Clientes VIP (Fiado) e Consumo interno de Colaboradores (Folha).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
                        Total Registros: <strong className="text-white font-mono">{creditSalesList.length}</strong>
                      </span>
                    </div>
                  </div>

                  {/* 4 Cards de Métricas em Destaque */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center justify-between text-amber-400 text-xs font-bold mb-1">
                        <span>Total Pendente (Geral)</span>
                        <AlertCircle size={16} />
                      </div>
                      <div className="text-2xl font-mono font-black text-amber-300">
                        R$ {creditMetrics.totalPending.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-amber-400/80 mt-1">
                        {creditMetrics.pendingCount} lançamentos em aberto
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center justify-between text-amber-300 text-xs font-bold mb-1">
                        <span>Fiado VIP Pendente</span>
                        <CreditCard size={16} />
                      </div>
                      <div className="text-2xl font-mono font-black text-white">
                        R$ {creditMetrics.fiadoPending.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Clientes de confiança
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center justify-between text-purple-400 text-xs font-bold mb-1">
                        <span>Consumo Equipe</span>
                        <UserCheck size={16} />
                      </div>
                      <div className="text-2xl font-mono font-black text-purple-300">
                        R$ {creditMetrics.collabPending.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-purple-400/80 mt-1">
                        Desconto em folha / vale
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center justify-between text-emerald-400 text-xs font-bold mb-1">
                        <span>Total Quitado</span>
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="text-2xl font-mono font-black text-emerald-400">
                        R$ {creditMetrics.totalPaid.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-emerald-400/80 mt-1">
                        Valores já recebidos
                      </div>
                    </div>
                  </div>

                  {/* Barra de Filtros e Busca */}
                  <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                      {(
                        [
                          { id: 'pendentes', label: '⏳ Pendentes' },
                          { id: 'quitados', label: '✅ Quitados' },
                          { id: 'fiado_vip', label: '⭐ Fiado VIP' },
                          { id: 'consumo_funcionario', label: '👥 Consumo Equipe' },
                          { id: 'todos', label: 'Todos' }
                        ] as const
                      ).map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setCreditTabFilter(f.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            creditTabFilter === f.id
                              ? 'bg-amber-600 text-slate-950 shadow-sm'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full md:w-72">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar por cliente, colaborador..."
                        value={creditSearchQuery}
                        onChange={e => setCreditSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Tabela de Contas a Receber */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                          <th className="p-3.5">Data / ID</th>
                          <th className="p-3.5">Tipo</th>
                          <th className="p-3.5">Cliente / Colaborador</th>
                          <th className="p-3.5">Itens Consumidos</th>
                          <th className="p-3.5">Previsão / Obs</th>
                          <th className="p-3.5 text-right">Valor Total</th>
                          <th className="p-3.5 text-center">Status</th>
                          <th className="p-3.5 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                        {creditSalesList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-500">
                              Nenhuma conta a receber encontrada com os filtros selecionados.
                            </td>
                          </tr>
                        ) : (
                          creditSalesList.map(sale => {
                            const isCollab = sale.paymentMethod === 'consumo_funcionario';
                            const isPending = sale.creditStatus !== 'quitado';
                            const personName = isCollab 
                              ? (sale.collaboratorName || 'Colaborador') 
                              : (sale.creditCustomerName || sale.customerName || 'Cliente VIP');

                            return (
                              <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="p-3.5 font-mono text-slate-400">
                                  <div>{new Date(sale.date).toLocaleDateString('pt-BR')}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • #{sale.id.slice(0, 5).toUpperCase()}
                                  </div>
                                </td>

                                <td className="p-3.5">
                                  {isCollab ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold text-[10px]">
                                      <UserCheck size={11} /> Equipe
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px]">
                                      <CreditCard size={11} /> Fiado VIP
                                    </span>
                                  )}
                                </td>

                                <td className="p-3.5 font-semibold text-white">
                                  <div className="flex items-center gap-1.5">
                                    {personName}
                                  </div>
                                </td>

                                <td className="p-3.5 text-slate-300 max-w-xs truncate" title={sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}>
                                  {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                                </td>

                                <td className="p-3.5 text-slate-400">
                                  {sale.creditDueDate && (
                                    <div className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                                      <Calendar size={11} /> {new Date(sale.creditDueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </div>
                                  )}
                                  {sale.creditNotes && (
                                    <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={sale.creditNotes}>
                                      {sale.creditNotes}
                                    </div>
                                  )}
                                  {!sale.creditDueDate && !sale.creditNotes && (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>

                                <td className="p-3.5 text-right font-mono font-bold text-white text-sm">
                                  R$ {sale.total.toFixed(2)}
                                </td>

                                <td className="p-3.5 text-center">
                                  {isPending ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                                      ⏳ Pendente
                                    </span>
                                  ) : (
                                    <div className="inline-flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                        <Check size={10} /> Quitado
                                      </span>
                                      {sale.creditPaidAt && (
                                        <span className="text-[9px] text-slate-500 mt-0.5 font-mono">
                                          {new Date(sale.creditPaidAt).toLocaleDateString('pt-BR')} via {sale.creditPaidMethod?.toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                <td className="p-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {isPending && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSaleToSettle(sale);
                                          setSettlementMethod('pix');
                                          setSettlementOperator(activeCashSession?.openedBy || 'Operador');
                                        }}
                                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                                        title="Liquidar / Dar Baixa"
                                      >
                                        <Banknote size={12} /> Liquidar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSaleToPrint(sale)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer transition-all"
                                      title="Imprimir Cupom da Venda"
                                    >
                                      <Printer size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL DE CUSTOMIZAÇÃO DO HAMBÚRGUER (COMBOS, ADICIONAIS & OBSERVAÇÕES) */}
        {selectedBurgerForConfig && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
              
              {/* Header do Modal */}
              <div className="flex justify-between items-start pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Personalização de Hambúrguer
                  </span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                    {selectedBurgerForConfig.name}
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Preço Base: <strong className="text-white font-mono">R$ {(saleChannel === 'ifood' ? selectedBurgerForConfig.priceIfood : selectedBurgerForConfig.priceBalcao).toFixed(2)}</strong>
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedBurgerForConfig(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Corpo com Scroll */}
              <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1">
                
                {/* SEÇÃO 1: COMBOS */}
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    🍟 Selecionar Combo Promocional:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCombo('none')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedCombo === 'none'
                          ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="block text-xs font-bold">Sem Combo</span>
                      <span className="text-xs text-slate-500 font-mono">+ R$ 0,00</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCombo('batata_bebida')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedCombo === 'batata_bebida'
                          ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="block text-xs font-bold">🍟 Batata + Bebida</span>
                      <span className="text-xs text-amber-400 font-mono font-bold">+ R$ 14,00</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCombo('aneis_bebida')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedCombo === 'aneis_bebida'
                          ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="block text-xs font-bold">🧅 Anéis + Bebida</span>
                      <span className="text-xs text-amber-400 font-mono font-bold">+ R$ 16,00</span>
                    </button>
                  </div>
                </div>

                {/* SEÇÃO 2: ADICIONAIS (EXCLUSIVOS PARA HAMBÚRGUERES) */}
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    🧀 Adicionais Exclusivos:
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableAdditionals.map(add => {
                      const currentQty = selectedAdditionals[add.name] || 0;

                      return (
                        <div 
                          key={add.name}
                          className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                            currentQty > 0 
                              ? 'bg-blue-600/20 border-blue-500 text-white' 
                              : 'bg-slate-950/50 border-slate-800/80 text-slate-300'
                          }`}
                        >
                          <div className="mb-2">
                            <span className="text-xs font-semibold block leading-snug">{add.name}</span>
                            <span className="text-[11px] font-mono text-emerald-400 font-bold">+ R$ {add.price.toFixed(2)}</span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                            <span className="text-[11px] text-slate-400 font-mono">Qtd: {currentQty}</span>
                            <div className="flex items-center gap-1">
                              {currentQty > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAdditionals(prev => ({ ...prev, [add.name]: Math.max(0, currentQty - 1) }))}
                                  className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                                >
                                  -
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedAdditionals(prev => ({ ...prev, [add.name]: currentQty + 1 }))}
                                className="w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SEÇÃO 3: PONTO DA CARNE & OBSERVAÇÕES */}
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-blue-400" /> Ponto da Carne & Observações (Para a Cozinha):
                  </h3>

                  {/* Atalhos Rápidos */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {[
                      'Ao ponto', 'Bem passado', 'Ao ponto p/ bem', 
                      'Sem cebola', 'Sem salada', 'Sem molho', 'Molho à parte'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleQuickNote(chip)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          burgerNotes.includes(chip)
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  <input 
                    type="text"
                    value={burgerNotes}
                    onChange={e => setBurgerNotes(e.target.value)}
                    placeholder="Outra observação (ex: pouco sal, cortar ao meio...)"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500"
                  />
                </div>

              </div>

              {/* Rodapé do Modal com Preço Calculado */}
              <div className="pt-4 border-t border-slate-800 flex justify-between items-center gap-4">
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-bold">Total Deste Item:</span>
                  <span className="text-2xl font-mono font-extrabold text-emerald-400">
                    R$ {currentModalPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBurgerForConfig(null)}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBurgerConfig}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={16} /> Adicionar ao Pedido
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Modal de Impressão Térmica */}
        <ReceiptModal 
          sale={selectedSaleToPrint} 
          diff={diffToPrint}
          onClose={() => {
            setSelectedSaleToPrint(null);
            setDiffToPrint(null);
          }} 
        />

        {/* Modal de Romaneio Térmico da Rota */}
        <RouteManifestModal
          route={selectedRouteToPrint}
          sales={sales}
          onClose={() => setSelectedRouteToPrint(null)}
        />

        {/* Modal de Confirmação de Retirada da Chapa */}
        {pendingRemovalFromGrill && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-3xl p-6 md:p-8 max-w-md w-full border-2 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.25)] space-y-6 animate-scale-in">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/30">
                  <AlertOctagon size={36} />
                </div>
                <h3 className="text-2xl font-black text-white">
                  Atenção: Pedido na CHAPA!
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O pedido <strong>#{pendingRemovalFromGrill.sale.id.slice(0, 5).toUpperCase()}</strong> ({pendingRemovalFromGrill.sale.customerName}) já está sendo preparado pela Cozinha.
                </p>
                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs font-bold text-red-300 text-left">
                  ⚠️ <strong>Aviso Obrigatório:</strong> Você deve avisar o chapeiro imediatamente antes de cancelar ou pausar, para evitar desperdício de hambúrguer e insumos na chapa!
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingRemovalFromGrill(null)}
                  className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-all"
                >
                  Manter na Chapa
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { sale, action } = pendingRemovalFromGrill;
                    setPendingRemovalFromGrill(null);
                    if (action === 'pause') {
                      await updateOrderProductionStatus(sale.id, 'em_espera');
                    } else {
                      setSaleToCancel(sale);
                      setCancelPasswordInput('');
                      setCancelReasonInput('Desistência do cliente antes do preparo');
                      setCancelNotesInput('');
                      setCancelError('');
                    }
                  }}
                  className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-red-600/30 transition-all"
                >
                  Confirmar e Avisar Chapa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CANCELAMENTO / ESTORNO SEGURO COM SENHA E MOTIVO OBRIGATÓRIO */}
        {saleToCancel && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-fade-in space-y-5">
              <div className="flex items-center gap-3 text-red-400">
                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Autorização de Estorno</h3>
                  <p className="text-xs text-slate-400">Esta ação exige liberação de supervisor e registro auditável.</p>
                </div>
              </div>

              {/* Detalhes da Comanda a Cancelar */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Comanda / Pedido:</span>
                  <strong className="font-mono text-white text-sm">#{saleToCancel.id.slice(0, 5).toUpperCase()}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Cliente:</span>
                  <strong className="text-amber-400 uppercase">{saleToCancel.customerName || 'Cliente'}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Total da Venda:</span>
                  <strong className="font-mono text-emerald-400 text-sm">R$ {saleToCancel.total.toFixed(2)}</strong>
                </div>
              </div>

              <form onSubmit={handleConfirmCancelSale} className="space-y-4">
                {/* Motivo Obrigatório */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Motivo do Cancelamento <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={cancelReasonInput}
                    onChange={e => setCancelReasonInput(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-semibold outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="Desistência do cliente antes do preparo">Desistência do cliente antes do preparo</option>
                    <option value="Erro de digitação / lançamento no PDV">Erro de digitação / lançamento no PDV</option>
                    <option value="Lanche preparado errado / trocado">Lanche preparado errado / trocado</option>
                    <option value="Problema no pagamento / recusado">Problema no pagamento / recusado</option>
                    <option value="Cliente não aguardou tempo de espera">Cliente não aguardou tempo de espera</option>
                    <option value="Outro motivo">Outro motivo</option>
                  </select>
                </div>

                {/* Observações Opcionais */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Observações Adicionais (opcional)
                  </label>
                  <input
                    type="text"
                    value={cancelNotesInput}
                    onChange={e => setCancelNotesInput(e.target.value)}
                    placeholder="Ex: Cliente trocou pelo combo da mesa 02"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-red-500"
                  />
                </div>

                {/* Senha do Supervisor / Admin */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Senha do Administrador / Supervisor <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={cancelPasswordInput}
                    onChange={e => {
                      setCancelPasswordInput(e.target.value);
                      setCancelError('');
                    }}
                    placeholder="Digite a senha de liberação"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-mono outline-none focus:border-red-500"
                  />
                  {cancelError && (
                    <p className="text-red-400 text-xs font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle size={13} /> {cancelError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSaleToCancel(null)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 cursor-pointer transition-all"
                  >
                    Confirmar Estorno
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* COMPROVANTE DE FECHAMENTO DE CAIXA (APURAÇÃO DE QUEBRA/SOBRA) */}
        {closingSummary && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-fade-in space-y-5">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 mx-auto bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-2 border border-blue-500/20">
                  <Receipt size={28} />
                </div>
                <h3 className="text-2xl font-black text-white">Fechamento de Caixa</h3>
                <p className="text-xs text-slate-400">Apuração de Turno — {new Date(closingSummary.date).toLocaleString('pt-BR')}</p>
                <p className="text-xs text-amber-400 font-bold uppercase">Operador: {closingSummary.operator}</p>
              </div>

              {/* Extrato da Conferência */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Troco Inicial:</span>
                  <span className="font-mono text-slate-200">R$ {closingSummary.initial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Vendas em Dinheiro:</span>
                  <span className="font-mono text-emerald-400 font-bold">+ R$ {closingSummary.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Suprimentos na Gaveta:</span>
                  <span className="font-mono text-blue-400">+ R$ {closingSummary.suprimentos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Sangrias Realizadas:</span>
                  <span className="font-mono text-red-400">- R$ {closingSummary.sangrias.toFixed(2)}</span>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1.5 font-bold">
                  <div className="flex justify-between text-slate-300">
                    <span>Esperado pelo Sistema:</span>
                    <span className="font-mono text-white">R$ {closingSummary.expectedInDrawer.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Informado pelo Operador:</span>
                    <span className="font-mono text-white">R$ {closingSummary.countedCash.toFixed(2)}</span>
                  </div>
                </div>

                {/* Apuração da Diferença */}
                <div className={`mt-3 p-3 rounded-xl border text-center font-black text-sm flex flex-col items-center gap-1 ${
                  Math.abs(closingSummary.variance) < 0.01
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                    : closingSummary.variance < 0
                      ? 'bg-red-950/40 border-red-500/40 text-red-400'
                      : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                }`}>
                  <span className="text-[10px] uppercase tracking-wider">
                    {Math.abs(closingSummary.variance) < 0.01 
                      ? '✅ Caixa Bateu Perfeitamente!' 
                      : closingSummary.variance < 0 
                        ? '⚠️ Quebra de Caixa (Falta)' 
                        : '💡 Sobra de Caixa'}
                  </span>
                  <span className="text-xl font-mono">
                    {closingSummary.variance >= 0 ? '+' : ''} R$ {closingSummary.variance.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Printer size={16} /> Imprimir Comprovante
                </button>
                <button
                  type="button"
                  onClick={() => setClosingSummary(null)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-md"
                >
                  Concluir & Sair
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONCESSÃO DE BRINDE / CORTESIA */}
        {giftModalItemIndex !== null && cart[giftModalItemIndex] && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-fade-in space-y-5">
              <div className="flex items-center gap-3 text-emerald-400">
                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <Gift size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Conceder como Brinde</h3>
                  <p className="text-xs text-slate-400">O valor será zerado para o cliente e auditado pela gerência.</p>
                </div>
              </div>

              {/* Detalhes do Produto */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-1 text-xs">
                <span className="text-slate-500">Item Selecionado:</span>
                <div className="flex justify-between items-center">
                  <p className="text-white font-bold text-sm">{cart[giftModalItemIndex].productName}</p>
                  <span className="font-mono text-emerald-400 font-bold">
                    R$ {((cart[giftModalItemIndex].originalPrice || cart[giftModalItemIndex].unitPrice) * cart[giftModalItemIndex].quantity).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Motivo Obrigatório */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Motivo da Concessão do Brinde <span className="text-emerald-400">*</span>
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'falta_pedido_anterior', label: '🍟 Falta / Esquecimento no pedido anterior', desc: 'Ex: batata esquecida que o cliente combinou de receber hoje' },
                    { id: 'fidelidade_cliente', label: '⭐ Fidelidade / Excelente cliente', desc: 'Mimo de relacionamento para cliente assíduo' },
                    { id: 'atraso_preparo', label: '⏱️ Atraso no preparo / Atendimento', desc: 'Compensação por demora na cozinha ou entrega' },
                    { id: 'cortesia_casa', label: '🎁 Cortesia da casa / Degustação', desc: 'Amigo da casa, degustação ou parceiro' },
                    { id: 'outro', label: '📝 Outro motivo', desc: 'Especifique nas observações' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedGiftReason(opt.id as GiftReason)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedGiftReason === opt.id
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-[10px] text-slate-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Observação Opcional */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Observações Adicionais (opcional)
                </label>
                <input
                  type="text"
                  value={giftNotesInput}
                  onChange={e => setGiftNotesInput(e.target.value)}
                  placeholder="Ex: Cliente Lucas avisou pelo WhatsApp sobre o pedido de ontem..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGiftModalItemIndex(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmGift}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 cursor-pointer transition-all"
                >
                  Confirmar Brinde
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE LIQUIDAÇÃO DE CONTAS A RECEBER */}
        {saleToSettle && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-fade-in space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                    <Banknote size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">Liquidar Conta</h3>
                    <p className="text-xs text-slate-400">Registrar recebimento e quitação do débito</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSaleToSettle(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Informações da Conta */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Devedor / Titular:</span>
                  <strong className="text-white text-sm font-bold">
                    {saleToSettle.creditCustomerName || saleToSettle.collaboratorName || saleToSettle.customerName}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Categoria:</span>
                  <span className={`font-bold ${saleToSettle.paymentMethod === 'consumo_funcionario' ? 'text-purple-400' : 'text-amber-400'}`}>
                    {saleToSettle.paymentMethod === 'consumo_funcionario' ? '👥 Consumo Equipe' : '⭐ Fiado VIP'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/80">
                  <span className="font-bold text-slate-300">Valor a Quitar:</span>
                  <span className="text-xl font-mono font-black text-emerald-400">
                    R$ {saleToSettle.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Forma de Liquidação */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Forma de Pagamento Utilizada <span className="text-emerald-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'dinheiro', label: '💵 Dinheiro', hint: 'Gera suprimento no caixa' },
                    { id: 'pix', label: '⚡ PIX Direto', hint: 'Conta bancária' },
                    { id: 'debito', label: '💳 Cartão Débito', hint: 'Maquininha' },
                    { id: 'credito', label: '💳 Cartão Crédito', hint: 'Maquininha' },
                    { id: 'folha', label: '📄 Desconto em Folha', hint: 'Folha de pagamento' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettlementMethod(m.id)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        settlementMethod === m.id
                          ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">{m.label}</div>
                      <div className="text-[10px] text-slate-400">{m.hint}</div>
                    </button>
                  ))}
                </div>
                {settlementMethod === 'dinheiro' && (
                  <p className="text-[11px] text-emerald-400/90 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                    💡 O valor de <strong>R$ {saleToSettle.total.toFixed(2)}</strong> será registrado como suprimento na gaveta do caixa atual para manter o saldo físico exato.
                  </p>
                )}
              </div>

              {/* Operador Responsável */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Operador Responsável pelo Recebimento
                </label>
                <input
                  type="text"
                  value={settlementOperator}
                  onChange={e => setSettlementOperator(e.target.value)}
                  placeholder="Nome do operador"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleToSettle(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={settling}
                  onClick={async () => {
                    setSettling(true);
                    try {
                      await settleCreditSale(
                        saleToSettle.id, 
                        settlementMethod, 
                        settlementOperator.trim() || activeCashSession?.openedBy || 'Operador'
                      );
                      setSaleToSettle(null);
                    } finally {
                      setSettling(false);
                    }
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 cursor-pointer transition-all disabled:opacity-50"
                >
                  {settling ? 'Liquidando...' : 'Confirmar Quitação'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
