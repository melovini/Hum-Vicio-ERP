'use client';
import { useState, useMemo } from 'react';
import { useInventory, Product, SaleItem, Sale } from '@/lib/store';
import { 
  MonitorDot, ArrowLeft, Lock, Unlock, DollarSign, History, 
  Send, XCircle, ShoppingCart as CartIcon, Plus, Minus, Trash2, 
  Wallet, TrendingDown, TrendingUp, AlertCircle, CheckCircle2, User, Printer 
} from 'lucide-react';
import Link from 'next/link';
import ReceiptModal from '@/components/ReceiptModal';

export default function CaixaPage() {
  const { 
    products, isLoaded, isOpen, activeCashSession, 
    openCaixa, closeCaixa, sales, addSale, cancelSale, 
    movements, addMovement 
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'pdv' | 'historico' | 'sangria'>('pdv');
  
  // Modais de Abertura e Fechamento
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedSaleToPrint, setSelectedSaleToPrint] = useState<Sale | null>(null);

  // Form Abertura
  const [initialAmountInput, setInitialAmountInput] = useState('100.00');
  const [operatorOpenInput, setOperatorOpenInput] = useState('');

  // Form Fechamento
  const [countedAmountInput, setCountedAmountInput] = useState('');
  const [operatorCloseInput, setOperatorCloseInput] = useState('');

  // PDV Cart State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [saleChannel, setSaleChannel] = useState<'balcao' | 'ifood'>('balcao');
  const [saleMethod, setSaleMethod] = useState('credito');

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

  if (!isLoaded) return null;

  // Cart Functions
  const addToCart = (product: Product) => {
    const price = saleChannel === 'ifood' ? product.priceIfood : product.priceBalcao;
    const existing = cart.find(i => i.productId === product.id);
    if (existing) {
      setCart(cart.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1, unitPrice: price } : i));
    } else {
      setCart([...cart, { productId: product.id, productName: product.name, quantity: 1, unitPrice: price }]);
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(cart.map(i => {
      if (i.productId === productId) {
        const newQty = i.quantity + delta;
        return newQty > 0 ? { ...i, quantity: newQty } : i;
      }
      return i;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(i => i.productId !== productId));
  };

  const handleChannelChange = (channel: 'balcao' | 'ifood') => {
    setSaleChannel(channel);
    setCart(cart.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      return { ...item, unitPrice: p ? (channel === 'ifood' ? p.priceIfood : p.priceBalcao) : item.unitPrice };
    }));
    if (channel === 'ifood') setSaleMethod('ifood_online');
    else setSaleMethod('credito');
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    addSale({
      channel: saleChannel,
      total: cartTotal,
      paymentMethod: saleMethod,
      items: cart
    });
    setCart([]);
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

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-bold mb-1">
                <MonitorDot size={20} /> Módulo Frente de Loja (Sincronizado na Nuvem)
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Caixa e PDV</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isOpen && (
              <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Wallet size={16} className="text-emerald-400" />
                <span>Na Gaveta: <strong className="text-emerald-400 font-mono text-sm">R$ {sessionStats.expectedInDrawer.toFixed(2)}</strong></span>
                <span className="text-slate-600">|</span>
                <span>Operador: <strong className="text-white">{activeCashSession?.openedBy}</strong></span>
              </div>
            )}

            <button 
              onClick={() => {
                if (isOpen) setShowCloseModal(true);
                else setShowOpenModal(true);
              }} 
              className={`px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isOpen 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                  : 'bg-emerald-500 text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105'
              }`}
            >
              {isOpen ? <><Lock size={20} /> Encerrar Caixa</> : <><Unlock size={20} /> Abrir Caixa</>}
            </button>
          </div>
        </header>

        {/* Modal de Abertura de Caixa */}
        {showOpenModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
              <div className="flex items-center gap-3 text-emerald-400 mb-4">
                <Unlock size={28} />
                <h2 className="text-2xl font-extrabold text-white">Abertura de Caixa</h2>
              </div>
              <p className="text-slate-400 text-sm mb-6">
                Informe o fundo de troco inicial e o operador responsável pelo turno.
              </p>
              
              <form onSubmit={handleConfirmOpen} className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-bold text-sm mb-2">Fundo de Troco Inicial (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={initialAmountInput}
                    onChange={e => setInitialAmountInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white font-mono text-2xl outline-none focus:border-emerald-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold text-sm mb-2">Nome do Operador do Caixa</label>
                  <input 
                    type="text" 
                    required 
                    value={operatorOpenInput}
                    onChange={e => setOperatorOpenInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-emerald-500"
                    placeholder="Ex: Maria Clara"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowOpenModal(false)}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Fechamento de Caixa */}
        {showCloseModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-fade-in">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <Lock size={28} />
                <h2 className="text-2xl font-extrabold text-white">Fechamento de Caixa</h2>
              </div>
              
              {/* Resumo da Sessão */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 mb-6 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Fundo Inicial:</span>
                  <span className="font-mono text-slate-200">R$ {sessionStats.initial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>(+) Vendas em Dinheiro:</span>
                  <span className="font-mono text-emerald-400">+ R$ {sessionStats.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>(+) Suprimentos (Entradas):</span>
                  <span className="font-mono text-emerald-400">+ R$ {sessionStats.suprimentos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>(-) Sangrias (Retiradas):</span>
                  <span className="font-mono text-red-400">- R$ {sessionStats.sangrias.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-base">
                  <span className="text-slate-200">Esperado na Gaveta:</span>
                  <span className="font-mono text-emerald-400 text-lg">R$ {sessionStats.expectedInDrawer.toFixed(2)}</span>
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white font-mono text-2xl outline-none focus:border-red-500"
                    placeholder="0.00"
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
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all"
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
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer hover:scale-105"
            >
              Abrir Caixa Agora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar / Tabs */}
            <div className="lg:col-span-3 xl:col-span-2 space-y-4">
              <button onClick={() => setActiveTab('pdv')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left cursor-pointer ${activeTab === 'pdv' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'}`}>
                <CartIcon size={20} /> PDV
              </button>
              <button onClick={() => setActiveTab('historico')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left cursor-pointer ${activeTab === 'historico' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'}`}>
                <History size={20} /> Histórico ({sales.filter(s => s.status === 'completed').length})
              </button>
              <button onClick={() => setActiveTab('sangria')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left cursor-pointer ${activeTab === 'sangria' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'}`}>
                <DollarSign size={20} /> Sangria / Caixa
              </button>
            </div>

            {/* Main Area */}
            <div className="lg:col-span-9 xl:col-span-10">
              {activeTab === 'pdv' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[70vh]">
                  
                  {/* Grade de Produtos */}
                  <div className="glass-card rounded-3xl p-6 border-t-4 border-blue-500 flex flex-col">
                    <h2 className="text-xl font-bold text-white mb-6">Cardápio</h2>
                    
                    {products.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-8">
                        <AlertCircle size={40} className="mb-3 opacity-40 text-blue-400" />
                        <p>Nenhum produto cadastrado no Cardápio.</p>
                        <p className="text-xs text-slate-600 mt-1">Acesse a Ficha Técnica na Gestão para cadastrar lanches.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh] pr-1">
                        {products.map(p => (
                          <button 
                            key={p.id} 
                            onClick={() => addToCart(p)} 
                            className="bg-slate-950/60 border border-slate-800 hover:border-emerald-500 hover:bg-emerald-500/10 p-4 rounded-2xl text-left transition-all group flex flex-col h-full cursor-pointer"
                          >
                            <span className="font-bold text-slate-200 group-hover:text-emerald-400 line-clamp-2 flex-1 text-sm">{p.name}</span>
                            <span className="text-sm text-slate-400 mt-2 font-mono font-bold">
                              R$ {(saleChannel === 'ifood' ? p.priceIfood : p.priceBalcao).toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Carrinho de Compras */}
                  <div className="glass-card rounded-3xl p-6 border-t-4 border-emerald-500 flex flex-col">
                    <h2 className="text-xl font-bold text-white mb-4 flex justify-between items-center">
                      Carrinho Atual
                      <select value={saleChannel} onChange={e => handleChannelChange(e.target.value as any)} className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-300 outline-none">
                        <option value="balcao">Venda Balcão</option>
                        <option value="ifood">Venda iFood</option>
                      </select>
                    </h2>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 mb-6 max-h-[40vh] pr-1">
                      {cart.length === 0 ? (
                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-slate-500">
                          <CartIcon size={48} className="mb-4 opacity-20" />
                          <p className="text-sm">Clique nos produtos para adicionar ao pedido</p>
                        </div>
                      ) : (
                        cart.map((item) => (
                          <div key={item.productId} className="flex justify-between items-center bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                            <div className="flex-1">
                              <p className="font-bold text-slate-200 text-sm truncate">{item.productName}</p>
                              <p className="font-mono text-xs text-slate-400">R$ {item.unitPrice.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1">
                                <button onClick={() => updateCartQty(item.productId, -1)} className="text-slate-400 hover:text-white p-1 cursor-pointer"><Minus size={14}/></button>
                                <span className="font-bold text-sm w-4 text-center text-white">{item.quantity}</span>
                                <button onClick={() => updateCartQty(item.productId, 1)} className="text-slate-400 hover:text-white p-1 cursor-pointer"><Plus size={14}/></button>
                              </div>
                              <span className="font-mono font-bold text-emerald-400 w-16 text-right text-sm">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                              <button onClick={() => removeFromCart(item.productId)} className="text-slate-600 hover:text-red-500 p-1 cursor-pointer"><Trash2 size={16}/></button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-slate-400 font-bold uppercase text-xs">Total do Pedido</span>
                        <span className="text-3xl font-mono font-extrabold text-white">R$ {cartTotal.toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <select value={saleMethod} onChange={e => setSaleMethod(e.target.value)} className="w-full bg-slate-950/80 border border-slate-700 rounded-2xl p-4 text-slate-200 outline-none focus:border-emerald-500 text-sm font-semibold">
                          <option value="credito">Cartão de Crédito</option>
                          <option value="debito">Cartão de Débito</option>
                          <option value="pix">Pix</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="ifood_online">iFood Online</option>
                        </select>
                        <button 
                          onClick={handleCheckout} 
                          disabled={cart.length === 0} 
                          className={`w-full py-4 rounded-2xl font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all flex justify-center items-center gap-2 cursor-pointer ${
                            cart.length === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <Send size={20} /> Concluir Venda
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'historico' && (
                <div className="glass-card rounded-3xl p-8 border-t-4 border-blue-500">
                  <h2 className="text-2xl font-bold text-white mb-6">Histórico e Conferência de Vendas</h2>
                  {sales.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Nenhuma venda lançada no sistema.</p>
                  ) : (
                    <div className="space-y-4">
                      {sales.map(sale => (
                        <div key={sale.id} className={`flex flex-col p-5 rounded-2xl border ${sale.status === 'cancelled' ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-950/50 border-slate-800/50'} transition-colors`}>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${sale.channel === 'ifood' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                  {sale.channel.toUpperCase()}
                                </span>
                                <span className="text-slate-300 font-mono text-sm font-semibold">#{sale.id.slice(0, 8).toUpperCase()}</span>
                                {sale.status === 'cancelled' && <span className="text-red-500 text-xs font-bold px-2 py-0.5 bg-red-500/10 rounded">ESTORNADO / ESTOQUE DEVOLVIDO</span>}
                              </div>
                              <p className="text-xs text-slate-400">{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Pagamento: <strong className="text-slate-200">{sale.paymentMethod.toUpperCase()}</strong></p>
                            </div>
                            <div className="flex items-center gap-6">
                              <span className={`font-mono text-2xl font-bold ${sale.status === 'cancelled' ? 'text-slate-600 line-through' : 'text-emerald-400'}`}>
                                R$ {sale.total.toFixed(2)}
                              </span>
                              {sale.status !== 'cancelled' && (
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => setSelectedSaleToPrint(sale)} 
                                    className="text-slate-400 hover:text-emerald-400 p-2 hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer" 
                                    title="Imprimir Cupom Térmico (Cozinha / Cliente)"
                                  >
                                    <Printer size={20} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (confirm('Deseja estornar esta venda? Os insumos da receita voltarão automaticamente para o estoque.')) {
                                        cancelSale(sale.id);
                                      }
                                    }} 
                                    className="text-slate-500 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer" 
                                    title="Estornar Venda e Devolver Estoque"
                                  >
                                    <XCircle size={20} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Detalhes do Recibo */}
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

              {activeTab === 'sangria' && (
                <div className="glass-card rounded-3xl p-8 border-t-4 border-amber-500">
                  <h2 className="text-2xl font-bold text-white mb-6">Controle de Movimentações (Gaveta)</h2>
                  
                  {/* Resumo da Gaveta */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <p className="text-xs text-slate-400 font-bold mb-1">Fundo Inicial de Troco</p>
                      <p className="text-2xl font-mono font-bold text-slate-200">R$ {sessionStats.initial.toFixed(2)}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <p className="text-xs text-slate-400 font-bold mb-1">Vendas Dinheiro + Suprimentos</p>
                      <p className="text-2xl font-mono font-bold text-emerald-400">+ R$ {(sessionStats.cashSales + sessionStats.suprimentos).toFixed(2)}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <p className="text-xs text-slate-400 font-bold mb-1">Total de Sangrias Realizadas</p>
                      <p className="text-2xl font-mono font-bold text-red-400">- R$ {sessionStats.sangrias.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Form de Sangria / Suprimento */}
                    <div>
                      <div className="flex gap-4 mb-6">
                        <button 
                          type="button" 
                          onClick={() => setMovType('sangria')} 
                          className={`flex-1 py-3.5 rounded-2xl font-bold transition-all cursor-pointer ${movType === 'sangria' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}
                        >
                          SANGRIA (Retirar)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setMovType('suprimento')} 
                          className={`flex-1 py-3.5 rounded-2xl font-bold transition-all cursor-pointer ${movType === 'suprimento' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}
                        >
                          SUPRIMENTO (Entrar)
                        </button>
                      </div>

                      <form onSubmit={handleAddMovement} className="space-y-4">
                        <div>
                          <label className="block text-xs text-slate-400 font-bold mb-2">Valor da Operação (R$)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            required 
                            value={movAmount} 
                            onChange={e => setMovAmount(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3.5 px-5 text-white font-mono text-2xl outline-none focus:border-amber-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 font-bold mb-2">Motivo / Finalidade da Retirada ou Entrada</label>
                          <input 
                            type="text" 
                            required 
                            value={movDesc} 
                            onChange={e => setMovDesc(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-amber-500 text-sm"
                            placeholder="Ex: Pagamento do entregador / Troco do banco"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="w-full bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-2xl font-bold text-base shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all cursor-pointer"
                        >
                          Salvar Movimentação no Banco
                        </button>
                      </form>
                    </div>

                    {/* Histórico de Movimentações */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col">
                      <h3 className="text-sm font-bold text-slate-300 mb-3">Últimas Movimentações na Nuvem</h3>
                      <div className="space-y-2 overflow-y-auto max-h-[260px] pr-1 flex-1">
                        {movements.length === 0 ? (
                          <p className="text-slate-500 text-xs text-center py-6">Nenhuma movimentação registrada.</p>
                        ) : (
                          movements.map(m => (
                            <div key={m.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                              <div>
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${m.type === 'sangria' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                  {m.type}
                                </span>
                                <p className="text-xs text-slate-300 mt-1 font-medium">{m.description}</p>
                              </div>
                              <span className={`font-mono font-bold text-sm ${m.type === 'sangria' ? 'text-red-400' : 'text-emerald-400'}`}>
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

        {/* Modal de Impressão Térmica */}
        <ReceiptModal 
          sale={selectedSaleToPrint} 
          onClose={() => setSelectedSaleToPrint(null)} 
        />
      </div>
    </div>
  );
}
