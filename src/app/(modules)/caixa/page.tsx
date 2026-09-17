'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  MonitorDot, Lock, Unlock, DollarSign, History, 
  ShoppingCart as CartIcon, Plus, Trash2, 
  Wallet, AlertCircle, CheckCircle2, User, Printer,
  Sparkles, Coffee, Flame, Check, UtensilsCrossed,
  Receipt, Truck, LayoutGrid, HelpCircle, GraduationCap, 
  RotateCcw, ShieldAlert, Key, Keyboard
} from 'lucide-react';

import { useInventory, Product, SaleItem, Sale, ProductionStatus, GiftReason } from '@/lib/store';
import { 
  ParkedDraft, getParkedDrafts, saveParkedDraft, createNewParkedDraft, 
  deleteParkedDraft, getActiveDraftId, setActiveDraftId, createDefaultDraft 
} from '@/lib/parked-orders';
import { 
  SessaoCaixaSalao, SalaoMesaInstancia, LayoutTemplate,
  getActiveFloorSession, createInitialSessionFromTemplate,
  lancarConsumoNaMesa, getStoredLayoutTemplates,
  resetarMesaParaNovoCliente, sincronizarMesasComCaixa
} from '@/lib/mesas';
import { 
  getStoredFiscalConfig, simulateNfceIssue, formatCpfCnpj 
} from '@/lib/fiscal';
import { sendOwnerSecurityAlert } from '@/lib/notifications';
import type { Collaborator } from '@/lib/collaborators';
import { getOperatorDirectoryAction } from '@/app/(modules)/admin/colaboradores/actions';

// Helpers puros e tipos
import { 
  calculateCartSubtotal, calculateDeliveryFee, calculateDiscount, 
  calculateCartTotal, calculateCashChange, normalizeCartItemNotes,
  calculateStoreCouponSubsidy, recalculateCartPrices
} from '@/lib/pos-financial-helpers';
import { 
  PosTab, PosCategory, DeliveryRouteBlock, CashConferenceValues 
} from '@/lib/caixa-types';

// Design System e Primitives
import { ConfirmDialog, useToast, Badge } from '@/components/ui';
import ReceiptModal from '@/components/ReceiptModal';
import SaleSuccessModal from '@/components/SaleSuccessModal';
import RouteManifestModal from '@/components/RouteManifestModal';
import SyncStatusBar from '@/components/SyncStatusBar';
import TrainingBanner from '@/components/TrainingBanner';
import TrainingExercisesModal from '@/components/TrainingExercisesModal';
import QuickHelpModal from '@/components/QuickHelpModal';
import ParkedOrdersBar from '@/components/ParkedOrdersBar';

// Subcomponentes operacionais das 3 Zonas e Modais
import PosCatalogZone from '@/components/caixa/PosCatalogZone';
import PosCartZone from '@/components/caixa/PosCartZone';
import PosCheckoutZone from '@/components/caixa/PosCheckoutZone';
import PosBurgerCustomizerModal from '@/components/caixa/PosBurgerCustomizerModal';
import PosGiftModal from '@/components/caixa/PosGiftModal';
import PosCashShiftModal from '@/components/caixa/PosCashShiftModal';
import PosCancelSaleModal from '@/components/caixa/PosCancelSaleModal';
import PosSettlementModal from '@/components/caixa/PosSettlementModal';
import PosDeleteTestModal from '@/components/caixa/PosDeleteTestModal';
import PosKeyboardShortcutsDialog from '@/components/caixa/PosKeyboardShortcutsDialog';

// Abas especializadas
import PosMesasTab from '@/components/caixa/tabs/PosMesasTab';
import PosProducaoTab from '@/components/caixa/tabs/PosProducaoTab';
import PosRotasTab from '@/components/caixa/tabs/PosRotasTab';
import PosHistoricoTab from '@/components/caixa/tabs/PosHistoricoTab';
import PosSangriaTab from '@/components/caixa/tabs/PosSangriaTab';
import PosContasReceberTab from '@/components/caixa/tabs/PosContasReceberTab';

// Reexportação para compatibilidade com outros módulos (ex: RouteManifestModal)
export type { DeliveryRouteBlock } from '@/lib/caixa-types';

export default function CaixaPage() {
  const { notify } = useToast();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const { 
    items, products, isOpen, activeCashSession, allCashSessions,
    openCaixa, closeCaixa, deleteCashSession,
    sales, addSale, cancelSale, 
    reopenOrderForEdit, updateReopenedOrder,
    movements, addMovement,
    targetPrepMinutes, updateOrderProductionStatus, updateBatchProductionStatus,
    settleCreditSale, settlePickupPayment, offlineQueueCount, isOnline,
    connectionStatus, isLoaded
  } = useInventory('caixa');

  // Abas operacionais
  const [activeTab, setActiveTab] = useState<PosTab>('pdv');

  // 1. ZONA DE CATÁLOGO (ZONA 1)
  const [posCategory, setPosCategory] = useState<PosCategory>('mais_pedidos');
  const [productSortOrder, setProductSortOrder] = useState<'vendas' | 'alfabetica'>('vendas');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');

  // 2. ZONA DE PEDIDO ATUAL (ZONA 2)
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [saleChannel, setSaleChannel] = useState<'balcao' | 'ifood'>('balcao');
  const [orderType, setOrderType] = useState<'retirada' | 'delivery' | 'mesa'>('retirada');
  const [pickupPaymentTiming, setPickupPaymentTiming] = useState<'retirada' | 'imediato'>('imediato');
  const [selectedTable, setSelectedTable] = useState<{ id: string; numero: string; clienteNome: string } | null>(null);
  const [editingReopenedSale, setEditingReopenedSale] = useState<Sale | null>(null);

  // 3. ZONA DE RESUMO E PAGAMENTO (ZONA 3)
  const [discountInput, setDiscountInput] = useState('');
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');
  const [saleMethod, setSaleMethod] = useState('dinheiro');
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [fiscalCpfInput, setFiscalCpfInput] = useState('');
  const [hasStoreCoupon, setHasStoreCoupon] = useState(false);
  const [storeCouponInput, setStoreCouponInput] = useState('10.00');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('');
  const [creditCustomerInput, setCreditCustomerInput] = useState('');
  const [creditDueDateInput, setCreditDueDateInput] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Modais de Apoio
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showExercisesModal, setShowExercisesModal] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [selectedBurgerForConfig, setSelectedBurgerForConfig] = useState<Product | null>(null);
  const [giftModalItemIndex, setGiftModalItemIndex] = useState<number | null>(null);
  const [cashShiftMode, setCashShiftMode] = useState<'open' | 'close' | 'quick_check' | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('Desistência do cliente antes do preparo');
  const [cancelNotesInput, setCancelNotesInput] = useState('');
  const [cancelPasswordInput, setCancelPasswordInput] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [settlementModal, setSettlementModal] = useState<{ sale: Sale; mode: 'credit' | 'pickup' } | null>(null);
  const [showDeleteTestModal, setShowDeleteTestModal] = useState(false);
  const [selectedSaleToPrint, setSelectedSaleToPrint] = useState<Sale | null>(null);
  const [selectedRouteToPrint, setSelectedRouteToPrint] = useState<DeliveryRouteBlock | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [trocoDetails, setTrocoDetails] = useState<{ valorRecebido: number; troco: number } | null>(null);

  // Diálogos de confirmação acessíveis
  const [isConfirmClearCartOpen, setIsConfirmClearCartOpen] = useState(false);

  // Atendimentos concorrentes (Parked Orders)
  const [parkedDrafts, setParkedDrafts] = useState<ParkedDraft[]>([]);
  const [activeDraftId, setActiveDraftIdState] = useState<string | null>(null);
  const isSwitchingDraftRef = useRef(false);

  // Salão e Mesas
  const [floorTemplates, setFloorTemplates] = useState<LayoutTemplate[]>([]);
  const [selectedInitialLayoutId, setSelectedInitialLayoutId] = useState('');
  const [floorSession, setFloorSession] = useState<SessaoCaixaSalao | null>(null);

  // Colaboradores
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // Formulário Abertura de Caixa
  const [operatorOpenInput, setOperatorOpenInput] = useState('');
  const [initialAmountInput, setInitialAmountInput] = useState('100.00');

  // Formulário Fechamento de Caixa
  const [countedAmountInput, setCountedAmountInput] = useState('');
  const [countedDebitoInput, setCountedDebitoInput] = useState('');
  const [countedCreditoInput, setCountedCreditoInput] = useState('');
  const [countedPixInput, setCountedPixInput] = useState('');
  const [closingNotesInput, setClosingNotesInput] = useState('');

  // Rotas de Delivery
  const [deliveryRoutes, setDeliveryRoutes] = useState<DeliveryRouteBlock[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hum_vicio_delivery_routes');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [deliveredSaleIds, setDeliveredSaleIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hum_vicio_delivered_sales');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Produção e Lotes
  const [productionFilter, setProductionFilter] = useState<'todos' | 'em_espera' | 'agendado' | 'em_producao' | 'concluido'>('todos');
  const [selectedOrdersForBatch, setSelectedOrdersForBatch] = useState<string[]>([]);

  // Carregar dados auxiliares
  useEffect(() => {
    const templates = getStoredLayoutTemplates();
    setFloorTemplates(templates);
    const activeT = templates.find(t => t.ativo) || templates[0];
    if (activeT) setSelectedInitialLayoutId(activeT.id);

    const floor = getActiveFloorSession();
    setFloorSession(floor);

    const drafts = getParkedDrafts();
    setParkedDrafts(drafts);
    const currId = getActiveDraftId();
    setActiveDraftIdState(currId);

    getOperatorDirectoryAction().then(res => {
      if (Array.isArray(res)) {
        setCollaborators(res);
      }
    }).catch(() => {});
  }, []);

  // Salvar rotas em localStorage
  const handleSaveDeliveryRoutes = (routes: DeliveryRouteBlock[]) => {
    setDeliveryRoutes(routes);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hum_vicio_delivery_routes', JSON.stringify(routes)); } catch {}
    }
  };

  // Filtragem estrita de pedidos pelo turno ativo
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

  const allRoutedSaleIds = useMemo(() => {
    const fromRoutes = deliveryRoutes.flatMap(r => r.saleIds);
    return new Set([...fromRoutes, ...deliveredSaleIds]);
  }, [deliveryRoutes, deliveredSaleIds]);

  const unassignedDeliverySales = useMemo(() => {
    return sales.filter(s => 
      s.status !== 'cancelled' && 
      s.orderType === 'delivery' && 
      (sessionStartTime === 0 || new Date(s.date).getTime() >= sessionStartTime) &&
      !allRoutedSaleIds.has(s.id)
    );
  }, [sales, allRoutedSaleIds, sessionStartTime]);

  const waitingOrders = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'cancelled') return false;
      if (s.productionStatus !== 'em_espera' && s.productionStatus !== 'agendado') return false;
      if (sessionStartTime > 0 && new Date(s.date).getTime() < sessionStartTime) return false;
      return true;
    });
  }, [sales, sessionStartTime]);

  // Cálculos financeiros puros do pedido
  const cartSubtotal = useMemo(() => calculateCartSubtotal(cart), [cart]);
  const deliveryFeeAmount = useMemo(() => calculateDeliveryFee(orderType, deliveryFeeInput), [orderType, deliveryFeeInput]);
  const discountAmount = useMemo(() => calculateDiscount(discountInput, cartSubtotal), [discountInput, cartSubtotal]);
  const cartTotal = useMemo(() => calculateCartTotal(cartSubtotal, discountAmount, deliveryFeeAmount), [cartSubtotal, discountAmount, deliveryFeeAmount]);
  const storeCouponSubsidyAmount = useMemo(() => calculateStoreCouponSubsidy(saleChannel, hasStoreCoupon, storeCouponInput), [saleChannel, hasStoreCoupon, storeCouponInput]);

  // Troca dinâmica de canal de vendas com recálculo de preços no carrinho
  const handleSwitchChannel = (newChannel: 'balcao' | 'ifood') => {
    setSaleChannel(newChannel);
    setCart(prev => recalculateCartPrices(prev, newChannel, products));
    if (newChannel === 'ifood') {
      setSaleMethod('ifood_online');
      if (orderType === 'mesa') {
        setOrderType('delivery');
        setSelectedTable(null);
      }
    } else {
      if (saleMethod === 'ifood_online' || saleMethod === 'ifood_entrega') {
        setSaleMethod('dinheiro');
      }
    }
  };

  // Estatísticas financeiras da sessão de caixa
  const sessionStats = useMemo(() => {
    const initial = activeCashSession?.initialAmount || 0;
    let cashSales = 0;
    let pixSales = 0;
    let debitoSales = 0;
    let creditoSales = 0;
    let sangrias = 0;
    let suprimentos = 0;
    let totalSales = 0;

    currentSessionSales.forEach(s => {
      totalSales += s.total;
      const method = s.paidMethod || s.paymentMethod;
      if (method === 'dinheiro') cashSales += s.total;
      else if (method === 'pix') pixSales += s.total;
      else if (method === 'cartao_debito' || method === 'debito') debitoSales += s.total;
      else if (method === 'cartao_credito' || method === 'credito') creditoSales += s.total;
    });

    movements.forEach(m => {
      if (m.type === 'sangria') sangrias += m.amount;
      if (m.type === 'suprimento') suprimentos += m.amount;
    });

    const expectedInDrawer = initial + cashSales + suprimentos - sangrias;
    const expectedTotalRegister = expectedInDrawer + pixSales + debitoSales + creditoSales;

    return {
      initial, cashSales, pixSales, debitoSales, creditoSales,
      sangrias, suprimentos, expectedInDrawer, expectedTotalRegister, totalSales
    };
  }, [activeCashSession, currentSessionSales, movements]);

  // Sincronização e persistência de Atendimentos Concorrentes (Parked Orders)
  useEffect(() => {
    if (isSwitchingDraftRef.current || !activeDraftId) return;

    const timer = setTimeout(() => {
      const draftToSave: ParkedDraft = {
        id: activeDraftId,
        label: customerName.trim() || 'Atendimento',
        customerName,
        saleChannel,
        orderType,
        pickupPaymentTiming,
        cart,
        deliveryFeeInput,
        discountInput,
        saleMethod,
        hasStoreCoupon,
        storeCouponInput,
        cartStep: 'produtos',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveParkedDraft(draftToSave);
      setParkedDrafts(getParkedDrafts());
    }, 250);

    return () => clearTimeout(timer);
  }, [activeDraftId, cart, customerName, saleChannel, orderType, pickupPaymentTiming, deliveryFeeInput, discountInput, saleMethod, hasStoreCoupon, storeCouponInput]);

  const handleSelectDraft = (targetId: string) => {
    if (targetId === activeDraftId) return;
    const currentList = getParkedDrafts();
    const targetDraft = currentList.find(d => d.id === targetId);
    if (targetDraft) {
      isSwitchingDraftRef.current = true;
      setActiveDraftId(targetDraft.id);
      setActiveDraftIdState(targetDraft.id);
      setCart(targetDraft.cart || []);
      setCustomerName(targetDraft.customerName || '');
      setSaleChannel(targetDraft.saleChannel || 'balcao');
      setOrderType(targetDraft.orderType || 'retirada');
      setPickupPaymentTiming(targetDraft.pickupPaymentTiming || 'imediato');
      setDeliveryFeeInput(targetDraft.deliveryFeeInput || '');
      setDiscountInput(targetDraft.discountInput || '');
      setSaleMethod(targetDraft.saleMethod || 'dinheiro');
      setHasStoreCoupon(targetDraft.hasStoreCoupon || false);
      setStoreCouponInput(targetDraft.storeCouponInput || '10.00');
      setTimeout(() => { isSwitchingDraftRef.current = false; }, 60);
    }
  };

  const handleCreateNewDraft = () => {
    const newDraft = createNewParkedDraft();
    setActiveDraftId(newDraft.id);
    setActiveDraftIdState(newDraft.id);
    setCart([]);
    setCustomerName('');
    setSaleChannel('balcao');
    setOrderType('retirada');
    setPickupPaymentTiming('imediato');
    setDeliveryFeeInput('');
    setDiscountInput('');
    setSaleMethod('dinheiro');
    setHasStoreCoupon(false);
    setStoreCouponInput('10.00');
    setParkedDrafts(getParkedDrafts());
    notify({ title: 'Novo Atendimento Iniciado', description: 'Comanda pronta para novos itens.', tone: 'info' });
  };

  const handleDeleteDraft = (draftId: string) => {
    const nextId = deleteParkedDraft(draftId);
    const remaining = getParkedDrafts();
    setParkedDrafts(remaining);
    if (nextId) handleSelectDraft(nextId);
  };

  // Escuta de Atalhos Globais de Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Ajuda / Atalhos
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsDialog(prev => !prev);
        return;
      }
      // F2: Focar busca de produtos
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // F4: Finalizar Pedido
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && !isSubmittingOrder) {
          handleCheckout();
        }
        return;
      }
      // F8: Dinheiro
      if (e.key === 'F8') {
        e.preventDefault();
        setSaleMethod('dinheiro');
        return;
      }
      // F9: PIX
      if (e.key === 'F9') {
        e.preventDefault();
        setSaleMethod('pix');
        return;
      }
      // F10: Cartão Débito
      if (e.key === 'F10') {
        e.preventDefault();
        setSaleMethod('cartao_debito');
        return;
      }
      // F11: Cartão Crédito
      if (e.key === 'F11') {
        e.preventDefault();
        setSaleMethod('cartao_credito');
        return;
      }
      // Alt + N: Novo Atendimento
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleCreateNewDraft();
        return;
      }
      // Alt + L: Limpar carrinho
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (cart.length > 0) setIsConfirmClearCartOpen(true);
        return;
      }
      // Escape: fechar modais
      if (e.key === 'Escape') {
        setShowShortcutsDialog(false);
        setShowHelpModal(false);
        setShowExercisesModal(false);
        setSelectedBurgerForConfig(null);
        setGiftModalItemIndex(null);
        setCashShiftMode(null);
        setSaleToCancel(null);
        setSettlementModal(null);
        setShowDeleteTestModal(false);
        setShowSuccessModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isSubmittingOrder]);

  // Ações do Carrinho
  const handleProductClick = (product: Product) => {
    if (product.category === 'lanche') {
      setSelectedBurgerForConfig(product);
    } else {
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
          unitPrice: price,
        }]);
      }
      notify({ title: `${product.name} adicionado`, tone: 'success', duration: 1500 });
    }
  };

  const handleUpdateCartQty = (index: number, delta: number) => {
    setCart(cart.map((item, idx) => {
      if (idx === index) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const handleRemoveCartItem = (index: number) => {
    setCart(cart.filter((_, idx) => idx !== index));
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountInput('');
    setDeliveryFeeInput('');
    setCashReceivedInput('');
    setSelectedTable(null);
    setIsConfirmClearCartOpen(false);
    notify({ title: 'Comanda limpa', tone: 'info' });
  };

  // CHECKOUT & FINALIZAÇÃO (Prevenção Técnica contra Duplo Checkout)
  const handleCheckout = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;

    if (!isOpen || !activeCashSession) {
      notify({
        title: 'Caixa Fechado',
        description: 'É necessário abrir o turno de caixa informando o fundo de troco antes de registrar vendas.',
        tone: 'danger',
      });
      setCashShiftMode('open');
      return;
    }

    const isPickupPending = orderType === 'retirada' && pickupPaymentTiming === 'retirada' && saleChannel !== 'ifood';
    const cashChange = calculateCashChange(cashReceivedInput, cartTotal);
    if (saleMethod === 'dinheiro' && !isPickupPending && !cashChange.isEnough) {
      notify({
        title: 'Valor Insuficiente',
        description: `O valor recebido em dinheiro é menor que o total da venda. Faltam R$ ${cashChange.missing.toFixed(2)}.`,
        tone: 'warning',
      });
      return;
    }

    const normalizedCart = normalizeCartItemNotes(cart);
    setIsSubmittingOrder(true);

    try {
      const finalCustomerName = customerName.trim() || (
        orderType === 'mesa' ? (selectedTable ? `Mesa ${selectedTable.numero}` : 'Mesa Salão') :
        orderType === 'retirada' ? 'Cliente Balcão' : 'Cliente Delivery'
      );

      // Simulação Fiscal se houver configuração
      let fiscalDataToAttach = {};
      try {
        const fiscalConfig = getStoredFiscalConfig();
        const tempSale: any = {
          id: `tmp_${Date.now()}`,
          customerName: finalCustomerName,
          orderType,
          channel: saleChannel,
          subtotal: cartSubtotal,
          discount: discountAmount,
          deliveryFee: orderType === 'delivery' ? deliveryFeeAmount : 0,
          storeCouponSubsidy: storeCouponSubsidyAmount,
          total: cartTotal,
          paymentMethod: saleMethod,
          items: normalizedCart,
          date: new Date().toISOString(),
          status: 'completed',
        };
        const simulated = simulateNfceIssue(tempSale, fiscalConfig, products, fiscalCpfInput.trim() || undefined);
        fiscalDataToAttach = {
          fiscalCpfCnpj: fiscalCpfInput.trim() || undefined,
          fiscalStatus: simulated.status,
          fiscalNfceNumber: simulated.numero,
          fiscalNfceSeries: simulated.serie,
          fiscalAccessKey: simulated.chaveAcesso,
          fiscalIssuedAt: simulated.dataEmissao,
          fiscalProtocol: simulated.protocolo,
        };
      } catch (err) {
        console.error('Erro na emissão fiscal:', err);
      }

      const finalPaymentStatus: 'pago' | 'pendente_retirada' = (isPickupPending || saleMethod === 'consumo_funcionario' || saleMethod === 'fiado_vip') 
        ? 'pendente_retirada' 
        : 'pago';

      const createdSale = await addSale({
        customerName: finalCustomerName,
        orderType,
        channel: orderType === 'mesa' ? 'balcao' : saleChannel,
        subtotal: cartSubtotal,
        discount: discountAmount,
        deliveryFee: orderType === 'delivery' ? deliveryFeeAmount : 0,
        storeCouponSubsidy: storeCouponSubsidyAmount,
        total: cartTotal,
        paymentMethod: isPickupPending ? 'retirada' : saleMethod,
        paymentStatus: finalPaymentStatus,
        paidAt: finalPaymentStatus === 'pago' ? new Date().toISOString() : undefined,
        paidMethod: finalPaymentStatus === 'pago' ? saleMethod : undefined,
        items: normalizedCart,
        productionStatus: 'em_espera',
        targetPrepMinutes: targetPrepMinutes || 20,
        collaboratorId: saleMethod === 'consumo_funcionario' ? selectedCollaboratorId : undefined,
        collaboratorName: collaborators.find(c => c.id === selectedCollaboratorId)?.name,
        creditCustomerName: saleMethod === 'fiado_vip' ? creditCustomerInput : undefined,
        creditDueDate: saleMethod === 'fiado_vip' ? creditDueDateInput : undefined,
        creditStatus: (saleMethod === 'consumo_funcionario' || saleMethod === 'fiado_vip') ? 'pendente' : undefined,
        ...fiscalDataToAttach,
      });

      // Se for mesa, lança na instância do salão
      if (orderType === 'mesa' && selectedTable && floorSession) {
        const updatedFloor = lancarConsumoNaMesa(
          floorSession, 
          selectedTable.id, 
          cartTotal, 
          finalCustomerName, 
          activeCashSession?.openedBy || 'Operador'
        );
        setFloorSession(updatedFloor);
      }

      // Detalhes de troco
      if (saleMethod === 'dinheiro' && cashChange.isEnough) {
        setTrocoDetails({
          valorRecebido: cashChange.received,
          troco: cashChange.change,
        });
      } else {
        setTrocoDetails(null);
      }

      // Bloquear temporariamente o timer de auto-salvamento de rascunhos para evitar recriação fantasma
      isSwitchingDraftRef.current = true;

      // Limpar campos auxiliares
      setDiscountInput('');
      setDeliveryFeeInput('');
      setCashReceivedInput('');
      setFiscalCpfInput('');
      setSelectedTable(null);
      setCreditCustomerInput('');
      setHasStoreCoupon(false);
      setStoreCouponInput('10.00');

      // Remover atendimento concluído da barra e carregar o próximo (ou o novo Atendimento #1 limpo)
      if (activeDraftId) {
        const nextId = deleteParkedDraft(activeDraftId);
        const updatedList = getParkedDrafts();
        setParkedDrafts(updatedList);
        if (nextId) {
          const nextDraft = updatedList.find(d => d.id === nextId);
          if (nextDraft) {
            setActiveDraftId(nextDraft.id);
            setActiveDraftIdState(nextDraft.id);
            setCart(nextDraft.cart || []);
            setCustomerName(nextDraft.customerName || '');
            setSaleChannel(nextDraft.saleChannel || 'balcao');
            setOrderType(nextDraft.orderType || 'retirada');
            setPickupPaymentTiming(nextDraft.pickupPaymentTiming || 'imediato');
            setDeliveryFeeInput(nextDraft.deliveryFeeInput || '');
            setDiscountInput(nextDraft.discountInput || '');
            setSaleMethod(nextDraft.saleMethod || 'dinheiro');
            setHasStoreCoupon(nextDraft.hasStoreCoupon || false);
            setStoreCouponInput(nextDraft.storeCouponInput || '10.00');
          }
        }
      } else {
        setCart([]);
        setCustomerName('');
      }

      setTimeout(() => {
        isSwitchingDraftRef.current = false;
      }, 150);

      setLastCompletedSale(createdSale);
      setShowSuccessModal(true);
      notify({
        title: 'Venda Concluída com Sucesso!',
        description: `Comanda #${createdSale.id.slice(0, 6).toUpperCase()} • R$ ${createdSale.total.toFixed(2)}`,
        tone: 'success',
      });
    } catch (err: any) {
      notify({
        title: 'Erro ao Finalizar Pedido',
        description: err?.message || 'Houve uma instabilidade. O pedido foi preservado no carrinho.',
        tone: 'danger',
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 pb-12">
      {/* Barra de Status e Conexão Offline */}
      <SyncStatusBar className="sticky top-0 z-40" />

      <div className="max-w-[1720px] w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Cabeçalho Superior do Caixa */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-3xl border border-slate-800 backdrop-blur-md shadow-md">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
              <MonitorDot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">Caixa / PDV</h1>
                <Badge variant={isOpen ? 'success' : 'neutral'}>
                  {isOpen ? 'TURNO ABERTO' : 'CAIXA FECHADO'}
                </Badge>
                {activeCashSession && (
                  <span className="text-xs text-slate-400 font-mono">
                    #{activeCashSession.id.slice(0, 6)} • Operador: <strong className="text-white">{activeCashSession.openedBy}</strong>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Terminal de Operação Ágil • Hamburgueria Artesanal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowShortcutsDialog(true)}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Ver atalhos de teclado [F1]"
            >
              <Keyboard size={15} className="text-amber-400" />
              <span>Atalhos [F1]</span>
            </button>

            {isOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setCashShiftMode('quick_check')}
                  className="px-3 py-2 bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Conferência Rápida
                </button>
                <button
                  type="button"
                  onClick={() => setCashShiftMode('close')}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Lock size={14} /> Fechar Caixa
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setCashShiftMode('open')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Unlock size={14} /> Abrir Caixa
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowDeleteTestModal(true)}
              className="p-2 text-slate-500 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
              title="Apagar caixa de teste e expurgar vendas simuladas"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Barra de Navegação entre Módulos do Caixa */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('pdv')}
            className={`py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'pdv'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CartIcon size={16} /> 1. Balcão & PDV
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mesas')}
            className={`py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'mesas'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid size={16} /> 2. Salão & Mesas
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('producao')}
            className={`py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'producao'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame size={16} /> 3. Produção & Chapa ({waitingOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rotas')}
            className={`py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'rotas'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck size={16} /> 4. Rotas de Entrega ({unassignedDeliverySales.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'historico'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History size={16} /> 5. Histórico ({currentSessionSales.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sangria')}
            className={`py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'sangria'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign size={16} /> 6. Sangrias & Gaveta
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contas_receber')}
            className={`py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'contas_receber'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt size={16} /> 7. Contas a Receber (Fiado)
          </button>
        </div>

        {/* CONTEÚDO PRINCIPAL DAS ABAS */}

        {/* ABA 1: PDV COM 3 ZONAS ESTÁVEIS */}
        {activeTab === 'pdv' && (
          <div className="space-y-3">
            {/* Barra Superior de Atendimentos Concorrentes (Parked Orders) */}
            <ParkedOrdersBar
              drafts={parkedDrafts}
              activeDraftId={activeDraftId}
              onSelectDraft={handleSelectDraft}
              onNewDraft={handleCreateNewDraft}
              onDeleteDraft={handleDeleteDraft}
            />

            {/* As 3 ZONAS ESTÁVEIS: CATÁLOGO -> PEDIDO ATUAL -> RESUMO E FINALIZAÇÃO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[75vh]">
              {/* ZONA 1: CATÁLOGO (col-span-5) */}
              <div className="lg:col-span-5 xl:col-span-5 flex flex-col">
                <PosCatalogZone
                  products={products}
                  sales={sales}
                  saleChannel={saleChannel}
                  posCategory={posCategory}
                  onSelectCategory={setPosCategory}
                  productSortOrder={productSortOrder}
                  onSelectSortOrder={setProductSortOrder}
                  searchQuery={catalogSearchQuery}
                  onSearchChange={setCatalogSearchQuery}
                  searchInputRef={searchInputRef}
                  onProductClick={handleProductClick}
                />
              </div>

              {/* ZONA 2: PEDIDO ATUAL (col-span-4) */}
              <div className="lg:col-span-4 xl:col-span-4 flex flex-col">
                <PosCartZone
                  cart={cart}
                  customerName={customerName}
                  onCustomerNameChange={setCustomerName}
                  saleChannel={saleChannel}
                  onSwitchChannel={handleSwitchChannel}
                  orderType={orderType}
                  onOrderTypeChange={setOrderType}
                  targetMesa={floorSession?.mesas.find(m => m.id === selectedTable?.id) || null}
                  floorMesas={floorSession?.mesas || []}
                  onSelectTable={tableId => {
                    const m = floorSession?.mesas.find(item => item.id === tableId);
                    if (m) setSelectedTable({ id: m.id, numero: m.numeroIdentificador, clienteNome: m.clienteNome || '' });
                    else setSelectedTable(null);
                  }}
                  editingReopenedSale={editingReopenedSale}
                  onCancelEditingReopenedSale={() => setEditingReopenedSale(null)}
                  onUpdateQty={handleUpdateCartQty}
                  onRemoveItem={handleRemoveCartItem}
                  onOpenGiftModal={idx => setGiftModalItemIndex(idx)}
                  onOpenNotesPrompt={idx => {
                    const current = cart[idx]?.notes || '';
                    const note = window.prompt('Observação para a cozinha:', current);
                    if (note !== null) {
                      setCart(cart.map((item, i) => i === idx ? { ...item, notes: note.trim().toUpperCase() || undefined } : item));
                    }
                  }}
                  onCreateNewDraft={handleCreateNewDraft}
                  onClearCart={() => setIsConfirmClearCartOpen(true)}
                  activeDraftLabel={parkedDrafts.find(d => d.id === activeDraftId)?.customerName || `Aba #${parkedDrafts.findIndex(d => d.id === activeDraftId) + 1}`}
                />
              </div>

              {/* ZONA 3: RESUMO E FINALIZAÇÃO (col-span-3) */}
              <div className="lg:col-span-3 xl:col-span-3 flex flex-col">
                <PosCheckoutZone
                  cart={cart}
                  cartSubtotal={cartSubtotal}
                  discountInput={discountInput}
                  onDiscountInputChange={setDiscountInput}
                  discountAmount={discountAmount}
                  deliveryFeeInput={deliveryFeeInput}
                  onDeliveryFeeInputChange={setDeliveryFeeInput}
                  deliveryFeeAmount={deliveryFeeAmount}
                  cartTotal={cartTotal}
                  orderType={orderType}
                  pickupPaymentTiming={pickupPaymentTiming}
                  onPickupPaymentTimingChange={setPickupPaymentTiming}
                  saleMethod={saleMethod}
                  onSaleMethodChange={setSaleMethod}
                  cashReceivedInput={cashReceivedInput}
                  onCashReceivedInputChange={setCashReceivedInput}
                  fiscalCpfInput={fiscalCpfInput}
                  onFiscalCpfInputChange={setFiscalCpfInput}
                  hasStoreCoupon={hasStoreCoupon}
                  onHasStoreCouponChange={setHasStoreCoupon}
                  storeCouponInput={storeCouponInput}
                  onStoreCouponInputChange={setStoreCouponInput}
                  collaborators={collaborators}
                  selectedCollaboratorId={selectedCollaboratorId}
                  onSelectedCollaboratorIdChange={setSelectedCollaboratorId}
                  creditCustomerInput={creditCustomerInput}
                  onCreditCustomerInputChange={setCreditCustomerInput}
                  creditDueDateInput={creditDueDateInput}
                  onCreditDueDateInputChange={setCreditDueDateInput}
                  editingReopenedSale={editingReopenedSale}
                  isSubmittingOrder={isSubmittingOrder}
                  onCheckout={handleCheckout}
                  saleChannel={saleChannel}
                />
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: SALÃO & MESAS */}
        {activeTab === 'mesas' && (
          <PosMesasTab
            floorSession={floorSession}
            onUpdateSession={setFloorSession}
            onSelectTableForOrder={mesa => {
              setSelectedTable({
                id: mesa.id,
                numero: mesa.numeroIdentificador,
                clienteNome: mesa.clienteNome || ''
              });
              setOrderType('mesa');
              setSaleChannel('balcao');
              setCustomerName(mesa.clienteNome || '');
              setActiveTab('pdv');
              notify({ title: `Mesa ${mesa.numeroIdentificador} selecionada`, tone: 'info' });
            }}
            operatorName={activeCashSession?.openedBy || 'Operador'}
          />
        )}

        {/* ABA 3: PRODUÇÃO & CHAPA */}
        {activeTab === 'producao' && (
          <PosProducaoTab
            currentSessionSales={currentSessionSales}
            productionFilter={productionFilter}
            onProductionFilterChange={setProductionFilter}
            selectedOrdersForBatch={selectedOrdersForBatch}
            onSelectedOrdersForBatchChange={setSelectedOrdersForBatch}
            waitingOrders={waitingOrders}
            onUpdateBatchProductionStatus={(ids, status) => {
              updateBatchProductionStatus(ids, status);
              notify({ title: `${ids.length} comanda(s) enviada(s) para a chapa!`, tone: 'success' });
            }}
            onUpdateOrderProductionStatus={(id, status) => {
              updateOrderProductionStatus(id, status);
              notify({ title: 'Status de produção atualizado!', tone: 'success' });
            }}
            onStartReopenSale={sale => {
              reopenOrderForEdit(sale.id, activeCashSession?.openedBy || 'Operador');
              setEditingReopenedSale(sale);
              setCart(sale.items || []);
              setCustomerName(sale.customerName || '');
              setActiveTab('pdv');
              notify({ title: `Pedido #${sale.id.slice(0, 6)} em edição no PDV`, tone: 'info' });
            }}
            onPrintSale={sale => setSelectedSaleToPrint(sale)}
            onSettlePickupPayment={sale => setSettlementModal({ sale, mode: 'pickup' })}
            onPauseGrillOrder={sale => {
              updateOrderProductionStatus(sale.id, 'em_espera');
              notify({ title: 'Comanda pausada para espera', tone: 'warning' });
            }}
            onNavigateToRotas={() => setActiveTab('rotas')}
          />
        )}

        {/* ABA 4: ROTAS DE ENTREGA */}
        {activeTab === 'rotas' && (
          <PosRotasTab
            sales={sales}
            deliveryRoutes={deliveryRoutes}
            onSaveDeliveryRoutes={handleSaveDeliveryRoutes}
            unassignedDeliverySales={unassignedDeliverySales}
            collaboratorsList={collaborators}
            onPrintRouteManifest={route => setSelectedRouteToPrint(route)}
            onUpdateBatchProductionStatus={(ids, status) => updateBatchProductionStatus(ids, status)}
            onMarkSalesAsDelivered={ids => {
              setDeliveredSaleIds(prev => {
                const combined = Array.from(new Set([...prev, ...ids]));
                try { localStorage.setItem('hum_vicio_delivered_sales', JSON.stringify(combined)); } catch {}
                return combined;
              });
            }}
            onRemoveDeliveredSaleIds={ids => {
              setDeliveredSaleIds(prev => prev.filter(id => !ids.includes(id)));
            }}
            onShowToast={(msg, tone) => notify({ title: msg, tone: tone === 'error' ? 'danger' : tone || 'info' })}
          />
        )}

        {/* ABA 5: HISTÓRICO DE VENDAS */}
        {activeTab === 'historico' && (
          <PosHistoricoTab
            sales={sales}
            currentSessionSales={currentSessionSales}
            onPrintSale={sale => setSelectedSaleToPrint(sale)}
            onCancelSaleClick={sale => setSaleToCancel(sale)}
            onStartReopenSale={sale => {
              reopenOrderForEdit(sale.id, activeCashSession?.openedBy || 'Operador');
              setEditingReopenedSale(sale);
              setCart(sale.items || []);
              setCustomerName(sale.customerName || '');
              setActiveTab('pdv');
              notify({ title: `Pedido #${sale.id.slice(0, 6)} em edição no PDV`, tone: 'info' });
            }}
            onSettlePickupPayment={sale => setSettlementModal({ sale, mode: 'pickup' })}
          />
        )}

        {/* ABA 6: SANGRIA E GAVETA */}
        {activeTab === 'sangria' && (
          <PosSangriaTab
            sessionStats={sessionStats}
            movements={movements}
            onAddMovement={(type, amount, desc) => {
              addMovement({ type, amount, description: desc });
            }}
            onShowToast={(msg, tone) => notify({ title: msg, tone: tone === 'error' ? 'danger' : tone || 'info' })}
          />
        )}

        {/* ABA 7: CONTAS A RECEBER (FIADO VIP & EQUIPE) */}
        {activeTab === 'contas_receber' && (
          <PosContasReceberTab
            sales={sales}
            onOpenSettleModal={sale => setSettlementModal({ sale, mode: 'credit' })}
            onPrintSale={sale => setSelectedSaleToPrint(sale)}
          />
        )}
      </div>

      {/* MODAIS GLOBAIS E DIÁLOGOS DE APOIO */}

      {/* Modal de Customização de Hambúrguer */}
      <PosBurgerCustomizerModal
        product={selectedBurgerForConfig}
        products={products}
        items={items}
        saleChannel={saleChannel}
        onClose={() => setSelectedBurgerForConfig(null)}
        onConfirm={newItem => {
          setCart([...cart, newItem]);
          setSelectedBurgerForConfig(null);
          notify({ title: `${newItem.productName} adicionado ao pedido!`, tone: 'success' });
        }}
      />

      {/* Modal de Brinde / Cortesia */}
      <PosGiftModal
        item={giftModalItemIndex !== null ? cart[giftModalItemIndex] : null}
        isOpen={giftModalItemIndex !== null}
        onClose={() => setGiftModalItemIndex(null)}
        onConfirm={(reason, notes) => {
          if (giftModalItemIndex !== null) {
            setCart(cart.map((item, idx) => {
              if (idx === giftModalItemIndex) {
                return {
                  ...item,
                  isGift: true,
                  giftReason: reason,
                  giftNotes: notes.trim() || undefined,
                  originalPrice: item.originalPrice || item.unitPrice,
                  unitPrice: 0,
                };
              }
              return item;
            }));
            setGiftModalItemIndex(null);
            notify({ title: 'Item marcado como brinde (R$ 0,00)', tone: 'success' });
          }
        }}
        onRemoveGift={() => {
          if (giftModalItemIndex !== null) {
            setCart(cart.map((item, idx) => {
              if (idx === giftModalItemIndex) {
                return {
                  ...item,
                  isGift: false,
                  giftReason: undefined,
                  giftNotes: undefined,
                  unitPrice: item.originalPrice || item.unitPrice,
                };
              }
              return item;
            }));
            setGiftModalItemIndex(null);
            notify({ title: 'Condição de brinde removida', tone: 'info' });
          }
        }}
      />

      {/* Modal de Abertura / Fechamento de Turno */}
      <PosCashShiftModal
        mode={cashShiftMode}
        onClose={() => setCashShiftMode(null)}
        operatorOpenInput={operatorOpenInput}
        onOperatorOpenInputChange={setOperatorOpenInput}
        initialAmountInput={initialAmountInput}
        onInitialAmountInputChange={setInitialAmountInput}
        selectedInitialLayoutId={selectedInitialLayoutId}
        onSelectedInitialLayoutIdChange={setSelectedInitialLayoutId}
        floorTemplates={floorTemplates}
        onConfirmOpen={async e => {
          e.preventDefault();
          const amount = parseFloat(initialAmountInput) || 0;
          const operator = operatorOpenInput.trim() || 'Operador';
          openCaixa(amount, operator);
          setCashShiftMode(null);
          notify({ title: 'Turno de Caixa Aberto!', description: `Fundo inicial: R$ ${amount.toFixed(2)}`, tone: 'success' });
        }}
        isBoxOpen={isOpen}
        sessionStats={sessionStats}
        countedAmountInput={countedAmountInput}
        onCountedAmountInputChange={setCountedAmountInput}
        countedDebitoInput={countedDebitoInput}
        onCountedDebitoInputChange={setCountedDebitoInput}
        countedCreditoInput={countedCreditoInput}
        onCountedCreditoInputChange={setCountedCreditoInput}
        countedPixInput={countedPixInput}
        onCountedPixInputChange={setCountedPixInput}
        closingNotesInput={closingNotesInput}
        onClosingNotesInputChange={setClosingNotesInput}
        onConfirmClose={async e => {
          e.preventDefault();
          const cash = parseFloat(countedAmountInput) || 0;
          await closeCaixa(
            cash,
            activeCashSession?.openedBy || 'Operador',
            sessionStats.expectedInDrawer,
            {
              countedCash: cash,
              expectedCash: sessionStats.expectedInDrawer,
              varianceCash: cash - sessionStats.expectedInDrawer,
              countedDebito: parseFloat(countedDebitoInput) || 0,
              expectedDebito: sessionStats.debitoSales,
              varianceDebito: (parseFloat(countedDebitoInput) || 0) - sessionStats.debitoSales,
              countedCredito: parseFloat(countedCreditoInput) || 0,
              expectedCredito: sessionStats.creditoSales,
              varianceCredito: (parseFloat(countedCreditoInput) || 0) - sessionStats.creditoSales,
              countedPix: parseFloat(countedPixInput) || 0,
              expectedPix: sessionStats.pixSales,
              variancePix: (parseFloat(countedPixInput) || 0) - sessionStats.pixSales,
              notes: closingNotesInput,
            }
          );
          setCashShiftMode(null);
          notify({ title: 'Turno de Caixa Encerrado', description: 'Relatório gerencial consolidado.', tone: 'info' });
        }}
      />

      {/* Modal de Cancelamento de Venda com Senha */}
      <PosCancelSaleModal
        sale={saleToCancel}
        isOpen={!!saleToCancel}
        onClose={() => setSaleToCancel(null)}
        reason={cancelReasonInput}
        onReasonChange={setCancelReasonInput}
        notes={cancelNotesInput}
        onNotesChange={setCancelNotesInput}
        password={cancelPasswordInput}
        onPasswordChange={setCancelPasswordInput}
        error={cancelError}
        onConfirm={async e => {
          e.preventDefault();
          if (!saleToCancel) return;
          const res = await cancelSale(saleToCancel.id, cancelReasonInput, undefined, cancelNotesInput.trim() || undefined, cancelPasswordInput.trim());
          if (res.success) {
            setSaleToCancel(null);
            setCancelPasswordInput('');
            setCancelError('');
            notify({ title: 'Venda cancelada com sucesso', tone: 'info' });
          } else {
            setCancelError(res.error || 'Senha incorreta ou estorno não autorizado.');
          }
        }}
      />

      {/* Modal de Quitação de Contas / Retiradas */}
      <PosSettlementModal
        sale={settlementModal?.sale || null}
        mode={settlementModal?.mode || null}
        onClose={() => setSettlementModal(null)}
        defaultOperator={activeCashSession?.openedBy || 'Operador'}
        onConfirmSettleCredit={async (saleId, method, operator) => {
          await settleCreditSale(saleId, method, operator);
          notify({ title: 'Conta a receber quitada com sucesso!', tone: 'success' });
        }}
        onConfirmSettlePickup={async (saleId, method, operator) => {
          await settlePickupPayment(saleId, method, operator);
          notify({ title: 'Pagamento na retirada confirmado!', tone: 'success' });
        }}
      />

      {/* Modal de Expurgo de Caixa de Teste */}
      <PosDeleteTestModal
        isOpen={showDeleteTestModal}
        onClose={() => setShowDeleteTestModal(false)}
        activeCashSession={activeCashSession}
        allCashSessions={allCashSessions}
        onConfirmDelete={deleteCashSession}
        onSuccess={count => {
          notify({ title: 'Caixa de teste expurgado!', description: `${count} venda(s) simulada(s) foram apagadas.`, tone: 'info' });
        }}
      />

      {/* Diálogo de Atalhos de Teclado */}
      <PosKeyboardShortcutsDialog
        isOpen={showShortcutsDialog}
        onClose={() => setShowShortcutsDialog(false)}
      />

      {/* Confirmação de Limpeza de Carrinho */}
      <ConfirmDialog
        open={isConfirmClearCartOpen}
        title="Limpar todos os itens da comanda?"
        description="Esta ação removerá todos os itens e adicionais do pedido atual. Deseja continuar?"
        confirmLabel="Limpar Comanda"
        cancelLabel="Voltar"
        tone="danger"
        onConfirm={handleClearCart}
        onClose={() => setIsConfirmClearCartOpen(false)}
      />

      {/* Impressão Térmica de Cupom */}
      {selectedSaleToPrint && (
        <ReceiptModal
          sale={selectedSaleToPrint}
          onClose={() => setSelectedSaleToPrint(null)}
        />
      )}

      {/* Impressão de Romaneio de Rota */}
      {selectedRouteToPrint && (
        <RouteManifestModal
          route={selectedRouteToPrint}
          onClose={() => setSelectedRouteToPrint(null)}
          sales={sales}
        />
      )}

      {/* Confirmação de Venda Finalizada com Troco */}
      {showSuccessModal && lastCompletedSale && (
        <SaleSuccessModal
          sale={lastCompletedSale}
          trocoInfo={trocoDetails}
          onClose={() => setShowSuccessModal(false)}
          onPrintThermal={() => {
            setShowSuccessModal(false);
            setSelectedSaleToPrint(lastCompletedSale);
          }}
          onNewOrder={() => {
            setShowSuccessModal(false);
            if (cart.length > 0 || customerName.trim().length > 0) {
              handleCreateNewDraft();
            }
          }}
        />
      )}

      {/* Treinamento e Ajuda Rápida */}
      <QuickHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
      <TrainingExercisesModal
        isOpen={showExercisesModal}
        onClose={() => setShowExercisesModal(false)}
      />
    </div>
  );
}
