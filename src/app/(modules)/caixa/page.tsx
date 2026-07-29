'use client';
import { useState } from 'react';
import { useInventory, Product, SaleItem } from '@/lib/store';
import { MonitorDot, ArrowLeft, Lock, Unlock, DollarSign, History, Send, XCircle, ShoppingCart as CartIcon, Plus, Minus, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function CaixaPage() {
  const { products, isLoaded, isOpen, toggleCaixa, sales, addSale, cancelSale, movements, addMovement } = useInventory();
  const [activeTab, setActiveTab] = useState<'pdv' | 'historico' | 'sangria'>('pdv');
  
  // PDV Cart State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [saleChannel, setSaleChannel] = useState<'balcao' | 'ifood'>('balcao');
  const [saleMethod, setSaleMethod] = useState('credito');

  // Movement State
  const [movAmount, setMovAmount] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [movType, setMovType] = useState<'sangria' | 'suprimento'>('sangria');

  if (!isLoaded) return null;

  const handleOpenClose = () => toggleCaixa(!isOpen);

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

  // Recalculate prices if channel changes
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

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-bold mb-1">
                <MonitorDot size={20} /> Módulo Frente de Loja
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Caixa e PDV</h1>
            </div>
          </div>
          
          <button onClick={handleOpenClose} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${isOpen ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' : 'bg-emerald-500 text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105'}`}>
            {isOpen ? <><Lock size={20} /> Fechar Caixa</> : <><Unlock size={20} /> Abrir Caixa</>}
          </button>
        </header>

        {!isOpen ? (
          <div className="glass-card rounded-3xl p-16 text-center border border-slate-800 flex flex-col items-center justify-center">
            <Lock size={64} className="text-slate-600 mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">O Caixa está Fechado</h2>
            <p className="text-slate-400 mb-8">Abra o caixa para iniciar os lançamentos de vendas do dia.</p>
            <button onClick={handleOpenClose} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all">
              Abrir Caixa Agora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar / Tabs */}
            <div className="lg:col-span-3 xl:col-span-2 space-y-4">
              <button onClick={() => setActiveTab('pdv')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left ${activeTab === 'pdv' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'}`}>
                <CartIcon size={20} /> PDV
              </button>
              <button onClick={() => setActiveTab('historico')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left ${activeTab === 'historico' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'}`}>
                <History size={20} /> Histórico
              </button>
              <button onClick={() => setActiveTab('sangria')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all text-left ${activeTab === 'sangria' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-slate-800/50'}`}>
                <DollarSign size={20} /> Sangria
              </button>
            </div>

            {/* Main Area */}
            <div className="lg:col-span-9 xl:col-span-10">
              {activeTab === 'pdv' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[70vh]">
                  
                  {/* Grade de Produtos */}
                  <div className="glass-card rounded-3xl p-6 border-t-4 border-blue-500 overflow-y-auto">
                    <h2 className="text-xl font-bold text-white mb-6">Cardápio</h2>
                    
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                      {products.map(p => (
                        <button key={p.id} onClick={() => addToCart(p)} className="bg-slate-950/50 border border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 p-4 rounded-2xl text-left transition-all group flex flex-col h-full">
                          <span className="font-bold text-slate-200 group-hover:text-emerald-400 line-clamp-2 flex-1">{p.name}</span>
                          <span className="text-sm text-slate-500 mt-2 font-mono">
                            R$ {(saleChannel === 'ifood' ? p.priceIfood : p.priceBalcao).toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
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
                    
                    <div className="flex-1 overflow-y-auto space-y-2 mb-6">
                      {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                          <CartIcon size={48} className="mb-4 opacity-20" />
                          <p>Adicione lanches para iniciar a venda</p>
                        </div>
                      ) : (
                        cart.map((item) => (
                          <div key={item.productId} className="flex justify-between items-center bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                            <div className="flex-1">
                              <p className="font-bold text-slate-200 text-sm truncate">{item.productName}</p>
                              <p className="font-mono text-xs text-slate-500">R$ {item.unitPrice.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1">
                                <button onClick={() => updateCartQty(item.productId, -1)} className="text-slate-400 hover:text-white p-1"><Minus size={14}/></button>
                                <span className="font-bold text-sm w-4 text-center text-white">{item.quantity}</span>
                                <button onClick={() => updateCartQty(item.productId, 1)} className="text-slate-400 hover:text-white p-1"><Plus size={14}/></button>
                              </div>
                              <span className="font-mono font-bold text-emerald-400 w-16 text-right">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                              <button onClick={() => removeFromCart(item.productId)} className="text-slate-600 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-slate-400 font-bold uppercase text-sm">Total a Pagar</span>
                        <span className="text-4xl font-mono font-extrabold text-white">R$ {cartTotal.toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <select value={saleMethod} onChange={e => setSaleMethod(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-slate-200 outline-none focus:border-emerald-500 appearance-none">
                          {saleChannel === 'ifood' ? (
                            <option value="ifood_online">iFood Online</option>
                          ) : (
                            <>
                              <option value="credito">Crédito</option>
                              <option value="debito">Débito</option>
                              <option value="pix">Pix</option>
                              <option value="dinheiro">Dinheiro</option>
                            </>
                          )}
                        </select>
                        <button onClick={handleCheckout} disabled={cart.length === 0} className={`w-full py-4 rounded-2xl font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all flex justify-center items-center gap-2 ${cart.length === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                          <Send size={20} /> Finalizar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'historico' && (
                <div className="glass-card rounded-3xl p-8 border-t-4 border-blue-500">
                  <h2 className="text-2xl font-bold text-white mb-6">Histórico e Conferência</h2>
                  {sales.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Nenhuma venda lançada neste caixa.</p>
                  ) : (
                    <div className="space-y-4">
                      {sales.map(sale => (
                        <div key={sale.id} className={`flex flex-col p-4 rounded-2xl border ${sale.status === 'cancelled' ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-950/50 border-slate-800/50'} transition-colors`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`px-2 py-1 text-xs font-bold rounded-md ${sale.channel === 'ifood' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                  {sale.channel.toUpperCase()}
                                </span>
                                <span className="text-slate-300 font-medium">Ref: #{sale.id.toUpperCase()}</span>
                                {sale.status === 'cancelled' && <span className="text-red-500 text-xs font-bold px-2 py-1 bg-red-500/10 rounded">ESTORNADO</span>}
                              </div>
                              <p className="text-sm text-slate-500">{new Date(sale.date).toLocaleTimeString()} • {sale.paymentMethod.toUpperCase()}</p>
                            </div>
                            <div className="flex items-center gap-6">
                              <span className={`font-mono text-2xl font-bold ${sale.status === 'cancelled' ? 'text-slate-600 line-through' : 'text-emerald-400'}`}>
                                R$ {sale.total.toFixed(2)}
                              </span>
                              {sale.status !== 'cancelled' && (
                                <button onClick={() => cancelSale(sale.id)} className="text-slate-600 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-xl transition-all" title="Estornar">
                                  <XCircle size={24} />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Detalhes do Recibo */}
                          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800/50">
                            <p className="text-xs text-slate-500 font-bold mb-2 uppercase">Itens Vendidos</p>
                            <ul className="space-y-1">
                              {sale.items?.map((item, idx) => (
                                <li key={idx} className="flex justify-between text-sm text-slate-300">
                                  <span>{item.quantity}x {item.productName}</span>
                                  <span className="font-mono text-slate-400">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                                </li>
                              ))}
                              {(!sale.items || sale.items.length === 0) && (
                                <li className="text-sm text-slate-500 italic">Venda registrada via versão anterior (valor avulso).</li>
                              )}
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
                  <h2 className="text-2xl font-bold text-white mb-6">Movimentação de Caixa</h2>
                  
                  <div className="flex gap-4 mb-8">
                    <button onClick={() => setMovType('sangria')} className={`flex-1 py-4 rounded-2xl font-bold transition-all ${movType === 'sangria' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
                      SANGRIA (Retirada)
                    </button>
                    <button onClick={() => setMovType('suprimento')} className={`flex-1 py-4 rounded-2xl font-bold transition-all ${movType === 'suprimento' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
                      SUPRIMENTO (Entrada)
                    </button>
                  </div>

                  <form onSubmit={handleAddMovement} className="space-y-6">
                    <div>
                      <label className="block text-sm text-slate-400 font-bold mb-3">Valor (R$)</label>
                      <input 
                        type="number" step="0.01" required value={movAmount} onChange={e => setMovAmount(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-700/50 rounded-2xl py-4 px-6 text-white font-mono text-2xl outline-none focus:border-amber-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 font-bold mb-3">Motivo / Descrição</label>
                      <input 
                        type="text" required value={movDesc} onChange={e => setMovDesc(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-700/50 rounded-2xl py-4 px-6 text-white outline-none focus:border-amber-500"
                        placeholder="Ex: Compra de gelo"
                      />
                    </div>
                    <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all">
                      Registrar Movimentação
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
