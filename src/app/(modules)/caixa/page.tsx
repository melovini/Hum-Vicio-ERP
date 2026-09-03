'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useInventory, Product, SaleItem, Sale, ProductionStatus } from '@/lib/store';
import { 
  MonitorDot, ArrowLeft, Lock, Unlock, DollarSign, History, 
  Send, XCircle, ShoppingCart as CartIcon, Plus, Minus, Trash2, 
  Wallet, TrendingDown, TrendingUp, AlertCircle, CheckCircle2, User, Printer,
  Sparkles, Coffee, Flame, Check, X, MessageSquare, UtensilsCrossed, Utensils,
  Clock, Play, Pause, AlertOctagon, Bell
} from 'lucide-react';
import Link from 'next/link';
import ReceiptModal from '@/components/ReceiptModal';
import { playOrderReadyChime } from '@/lib/audio';

export default function CaixaPage() {
  const { 
    products, items, isOpen, activeCashSession, 
    openCaixa, closeCaixa, sales, addSale, cancelSale, 
    movements, addMovement,
    targetPrepMinutes, setTargetPrepMinutes, updateOrderProductionStatus, updateBatchProductionStatus 
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'pdv' | 'producao' | 'historico' | 'sangria'>('pdv');
  const [productionFilter, setProductionFilter] = useState<'todos' | 'em_espera' | 'agendado' | 'em_producao' | 'concluido'>('todos');
  const [selectedOrdersForBatch, setSelectedOrdersForBatch] = useState<string[]>([]);
  
  // Modais de Abertura e Fechamento
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedSaleToPrint, setSelectedSaleToPrint] = useState<Sale | null>(null);

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
    
    // Filtrar vendas em dinheiro após a abertura
    const cashSales = sales
      .filter(s => s.status === 'completed' && s.paymentMethod === 'dinheiro')
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
  }, [activeCashSession, sales, movements]);

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

  // 9 Itens Mais Pedidos (calculados automaticamente das vendas)
  const top9Products = useMemo(() => {
    const counts: Record<string, number> = {};
    sales.filter(s => s.status === 'completed').forEach(s => {
      s.items?.forEach(i => {
        counts[i.productId] = (counts[i.productId] || 0) + i.quantity;
      });
    });

    const vendaveis = products.filter(p => 
      !p.name.startsWith('Adicional:') && 
      !p.name.startsWith('Pote Maionese') &&
      p.category !== 'combo'
    );

    const sorted = [...vendaveis].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    return sorted.slice(0, 9);
  }, [products, sales]);

  // Produtos exibidos por categoria
  const displayedProducts = useMemo(() => {
    switch (posCategory) {
      case 'mais_pedidos':
        return top9Products;
      case 'hamburgueres':
        return products.filter(p => p.category === 'lanche' && !p.name.toLowerCase().includes('duplo'));
      case 'duplos':
        return products.filter(p => p.category === 'lanche' && p.name.toLowerCase().includes('duplo'));
      case 'bebidas':
        return products.filter(p => p.category === 'bebida');
      case 'porcoes':
        return products.filter(p => p.category === 'porcao' && !p.name.startsWith('Adicional:') && !p.name.startsWith('Pote Maionese'));
      default:
        return products;
    }
  }, [posCategory, products, top9Products]);

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

  const cartTotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);

  const waitingOrders = useMemo(() => {
    return sales.filter(s => s.status !== 'cancelled' && (s.productionStatus === 'em_espera' || s.productionStatus === 'agendado'));
  }, [sales]);

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

  const handleCheckout = () => {
    if (cart.length === 0) return;
    
    addSale({
      customerName: customerName.trim() || (orderType === 'mesa' ? 'Mesa' : orderType === 'retirada' ? 'Retirada' : 'Delivery'),
      orderType,
      channel: saleChannel,
      total: cartTotal,
      paymentMethod: saleMethod,
      items: cart,
      productionStatus: orderProductionStatus,
      targetPrepMinutes
    });

    setCart([]);
    setCustomerName('');
    setOrderProductionStatus('em_espera');
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movAmount || !movDesc) return;
    addMovement({ type: movType, amount: Number(movAmount), description: movDesc });
    setMovAmount(''); setMovDesc('');
  };

  const handleConfirmOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorOpenInput.trim()) return;
    await openCaixa(Number(initialAmountInput) || 0, operatorOpenInput.trim());
    setShowOpenModal(false);
  };

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorCloseInput.trim()) return;
    await closeCaixa(Number(countedAmountInput) || 0, operatorCloseInput.trim());
    setShowCloseModal(false);
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
            {isOpen ? (
              <button 
                onClick={() => {
                  setCountedAmountInput(sessionStats.expectedInDrawer.toFixed(2));
                  setShowCloseModal(true);
                }}
                className="px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer text-sm"
              >
                <Lock size={16} /> Fechar Caixa
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
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowOpenModal(false)}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    Confirmar Abertura
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Fechamento */}
        {showCloseModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <Lock className="text-red-400" /> Fechamento de Caixa
              </h2>
              <p className="text-slate-400 text-sm mb-6">Confira os valores na gaveta e encerre o turno.</p>

              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 mb-6 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Troco Inicial:</span>
                  <span className="font-mono text-slate-200">R$ {sessionStats.initial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Vendas em Dinheiro:</span>
                  <span className="font-mono text-emerald-400 font-bold">+ R$ {sessionStats.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Suprimentos:</span>
                  <span className="font-mono text-blue-400">+ R$ {sessionStats.suprimentos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Sangrias:</span>
                  <span className="font-mono text-red-400">- R$ {sessionStats.sangrias.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-200 font-bold pt-2 border-t border-slate-800 text-base">
                  <span>Esperado na Gaveta:</span>
                  <span className="font-mono text-amber-400">R$ {sessionStats.expectedInDrawer.toFixed(2)}</span>
                </div>
              </div>

              <form onSubmit={handleConfirmClose} className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-bold text-sm mb-2">Valor Real Contado na Gaveta (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={countedAmountInput}
                    onChange={e => setCountedAmountInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white font-mono text-xl font-bold outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold text-sm mb-2">Operador Responsável pelo Fechamento</label>
                  <input 
                    type="text" 
                    required 
                    value={operatorCloseInput}
                    onChange={e => setOperatorCloseInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-red-500"
                    placeholder="Seu nome"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowCloseModal(false)}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                  >
                    Encerrar e Salvar
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
            <div className="lg:col-span-2 space-y-3">
              <button 
                onClick={() => setActiveTab('pdv')} 
                className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'pdv' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg' 
                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'
                }`}
              >
                <CartIcon size={20} /> Pedidos
              </button>

              <button 
                onClick={() => setActiveTab('producao')} 
                className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'producao' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg' 
                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Flame size={20} /> Produção / KDS
                </div>
                <div className="flex items-center gap-1.5">
                  {sales.filter(s => s.status !== 'cancelled' && s.productionStatus === 'concluido').length > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 text-[10px] font-black rounded-full animate-pulse" title="Pedidos Prontos">
                      🛎️ {sales.filter(s => s.status !== 'cancelled' && s.productionStatus === 'concluido').length} prontos
                    </span>
                  )}
                  {sales.filter(s => s.status !== 'cancelled' && (s.productionStatus === 'em_espera' || s.productionStatus === 'em_producao')).length > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full">
                      {sales.filter(s => s.status !== 'cancelled' && (s.productionStatus === 'em_espera' || s.productionStatus === 'em_producao')).length}
                    </span>
                  )}
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('historico')} 
                className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'historico' 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg' 
                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'
                }`}
              >
                <History size={20} /> Histórico ({sales.filter(s => s.status === 'completed').length})
              </button>

              <button 
                onClick={() => setActiveTab('sangria')} 
                className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'sangria' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg' 
                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'
                }`}
              >
                <DollarSign size={20} /> Gaveta
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
                            ⏳ Em Espera
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
                          <button
                            type="button"
                            onClick={() => setOrderProductionStatus('em_producao')}
                            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 text-center ${
                              orderProductionStatus === 'em_producao'
                                ? 'bg-emerald-600 text-white font-black shadow-md ring-2 ring-emerald-400'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            🟢 Chapa / Agora
                          </button>
                        </div>
                      </div>

                      {/* Itens do Carrinho */}
                      <div className="overflow-y-auto space-y-2.5 max-h-[38vh] pr-1">
                        {cart.length === 0 ? (
                          <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                            <CartIcon size={40} className="mb-2 opacity-20" />
                            <p className="text-xs">Selecione os hambúrgueres e bebidas ao lado.</p>
                          </div>
                        ) : (
                          cart.map((item, idx) => (
                            <div key={idx} className="bg-slate-950/70 border border-slate-800/90 p-3.5 rounded-2xl space-y-1.5">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-slate-200 text-sm">{item.productName}</p>
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
                                  {item.notes && (
                                    <p className="text-[10px] italic text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md mt-1 inline-block">
                                      Obs: {item.notes}
                                    </p>
                                  )}
                                </div>
                                <span className="font-mono font-bold text-emerald-400 text-sm">
                                  R$ {(item.unitPrice * item.quantity).toFixed(2)}
                                </span>
                              </div>

                              <div className="flex justify-between items-center pt-1 border-t border-slate-900">
                                <span className="text-xs text-slate-500 font-mono">
                                  R$ {item.unitPrice.toFixed(2)} un
                                </span>
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
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm font-bold">Total do Pedido:</span>
                        <span className="text-2xl font-mono font-extrabold text-emerald-400">
                          R$ {cartTotal.toFixed(2)}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Forma de Pagamento:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { id: 'ifood_online', label: 'iFood Online', fee: 'Taxa 33%', isIfood: true },
                            { id: 'ifood_entrega', label: 'iFood Entrega', fee: 'Taxa 23%', isIfood: true },
                            { id: 'credito', label: 'Cartão Crédito', fee: 'Taxa 3%' },
                            { id: 'debito', label: 'Cartão Débito', fee: 'Taxa 1%' },
                            { id: 'pix', label: 'PIX Direto', fee: 'Taxa 0%' },
                            { id: 'dinheiro', label: 'Dinheiro', fee: 'Gaveta' }
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
                                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-md font-extrabold' 
                                  : method.isIfood
                                    ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-800'
                              }`}
                            >
                              <span className="block text-xs font-bold leading-tight">{method.label}</span>
                              <span className={`text-[10px] font-mono ${saleMethod === method.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                                {method.fee}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        type="button"
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
                      >
                        <Send size={18} /> Finalizar Pedido
                      </button>
                    </div>
                  </div>

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

                  {/* Lista de Pedidos de Produção */}
                  {sales.filter(s => {
                    if (s.status === 'cancelled') return false;
                    if (productionFilter === 'todos') return true;
                    return (s.productionStatus || 'em_producao') === productionFilter;
                  }).length === 0 ? (
                    <div className="py-16 text-center text-slate-500">
                      <Flame size={44} className="mx-auto mb-2 opacity-20 text-amber-500" />
                      <p className="text-sm">Nenhum pedido encontrado nesta categoria de produção.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sales
                        .filter(s => {
                          if (s.status === 'cancelled') return false;
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
                              <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                                {isWaiting && (
                                  <button
                                    type="button"
                                    onClick={() => updateOrderProductionStatus(sale.id, 'em_producao')}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                                  >
                                    <Play size={15} /> Liberar para Produção na Chapa
                                  </button>
                                )}

                                {isCooking && (
                                  <button
                                    type="button"
                                    onClick={() => setPendingRemovalFromGrill({ sale, action: 'pause' })}
                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                  >
                                    <Pause size={14} /> Pausar / Voltar para Espera
                                  </button>
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

              {/* ABA HISTÓRICO DE VENDAS */}
              {activeTab === 'historico' && (
                <div className="glass-card rounded-3xl p-8 border-t-4 border-blue-500">
                  <h2 className="text-2xl font-bold text-white mb-6">Histórico de Pedidos</h2>
                  
                  {sales.length === 0 ? (
                    <p className="text-slate-500 text-center py-12">Nenhuma venda registrada ainda.</p>
                  ) : (
                    <div className="space-y-4">
                      {sales.map((sale) => (
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
                                    onClick={() => {
                                      if (sale.productionStatus === 'em_producao') {
                                        setPendingRemovalFromGrill({ sale, action: 'cancel' });
                                      } else if (confirm('Deseja estornar esta venda? Os insumos voltarão automaticamente ao estoque.')) {
                                        cancelSale(sale.id);
                                      }
                                    }} 
                                    className="text-slate-500 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer" 
                                    title="Estornar Venda"
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
              )}

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
          onClose={() => setSelectedSaleToPrint(null)} 
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
                    if (action === 'pause') {
                      await updateOrderProductionStatus(sale.id, 'em_espera');
                    } else {
                      await cancelSale(sale.id);
                    }
                    setPendingRemovalFromGrill(null);
                  }}
                  className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-red-600/30 transition-all"
                >
                  Confirmar e Avisar Chapa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
