'use client';
import { useInventory, InventoryItem } from '@/lib/store';
import { ShoppingCart, ArrowLeft, TrendingUp, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function GestaoComprasPage() {
  const { items, registerPurchase, isLoaded, sales } = useInventory();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');

  if (!isLoaded) return null;

  const alerts = items.filter(i => i.status !== 'ok');
  const okItems = items.filter(i => i.status === 'ok');

  // ALGORITMO: Inteligência de Compras (Cruza vendas com estoque)
  const predictiveAlerts = items.filter(item => {
    const totalSoldRecently = sales.length * 0.5; 
    return item.status === 'ok' && item.currentStock < 15 && totalSoldRecently > 2;
  });
  
  const handlePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItem && quantity && cost) {
      registerPurchase(selectedItem.id, Number(quantity), Number(cost));
      setQuantity('');
      setCost('');
      setSelectedItem(null);
    }
  };

  // Agrupar itens para exibição nas categorias
  const groupedAlerts = alerts.reduce((acc, item) => {
    const cat = item.category || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const groupedOkItems = okItems.reduce((acc, item) => {
    const cat = item.category || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-blue-400 font-bold mb-1">
                <ShoppingCart size={20} /> Módulo Gestão
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Gestão de Compras</h1>
            </div>
          </div>
        </header>

        {predictiveAlerts.length > 0 && (
          <div className="mb-8 p-6 glass-card border border-amber-500/50 rounded-3xl bg-amber-500/5 flex items-start gap-4">
            <AlertCircle className="text-amber-500 mt-1" size={28} />
            <div>
              <h3 className="text-xl font-bold text-amber-500 mb-2">Inteligência de Compras (Preditiva)</h3>
              <p className="text-amber-200/80 mb-4">Baseado no ritmo das últimas vendas do PDV, os seguintes itens correm o risco de ruptura nos próximos 3 dias:</p>
              <div className="flex flex-wrap gap-3">
                {predictiveAlerts.map(i => (
                  <span key={i.id} className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-xl font-bold text-sm">
                    {i.name} (Restam {i.currentStock} {i.unit})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Lista de Faltas (Sinalizadas pela Cozinha) */}
          <div className="lg:col-span-2 glass-card rounded-3xl p-8 border border-slate-800">
            <h2 className="text-2xl font-bold text-white mb-2">Lista de Compras (Urgentes)</h2>
            <p className="text-slate-500 mb-6">Itens sinalizados pela operação da cozinha.</p>
            
            {alerts.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
                <Check className="mx-auto text-emerald-500 mb-2" size={32} />
                <p className="text-emerald-400 font-bold">Tudo sob controle!</p>
                <p className="text-slate-500 text-sm">Nenhum item sinalizado pela cozinha.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedAlerts).map(([catName, items]) => (
                  <div key={catName}>
                    <h3 className="text-lg font-bold text-slate-300 mb-3 border-b border-slate-800 pb-2">{catName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map(item => (
                        <div key={item.id} className={`p-4 rounded-2xl border flex justify-between items-center ${
                          item.status === 'zerado' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
                        }`}>
                          <div>
                            <span className="font-bold text-slate-200 block">{item.name}</span>
                            <span className="text-sm text-slate-400">Estoque atual: {item.currentStock} {item.unit}</span>
                          </div>
                          <button 
                            onClick={() => setSelectedItem(item)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                          >
                            Dar Baixa
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <h2 className="text-xl font-bold text-white mt-12 mb-4">Estoque Regular</h2>
            <div className="space-y-6">
              {Object.entries(groupedOkItems).map(([catName, items]) => (
                <div key={catName}>
                  <h3 className="text-md font-bold text-slate-400 mb-2">{catName}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {items.map(item => (
                      <button key={item.id} onClick={() => setSelectedItem(item)} className="p-3 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-colors">
                        <span className="text-slate-300 text-sm block font-bold">{item.name}</span>
                        <span className="text-slate-500 text-xs">{item.currentStock} {item.unit} em estoque</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Registro de Compra */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-3xl p-6 border-t-4 border-blue-500 sticky top-8">
              <h2 className="text-xl font-bold text-white mb-6">Registrar Compra</h2>
              
              {!selectedItem ? (
                <p className="text-slate-500 text-center py-8">Selecione um item da lista ao lado para registrar a compra.</p>
              ) : (
                <form onSubmit={handlePurchase} className="space-y-4">
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 mb-6">
                    <span className="text-sm text-slate-400 block mb-1">Comprando:</span>
                    <span className="font-bold text-lg text-slate-200">{selectedItem.name}</span>
                    <span className="text-sm text-slate-500 block">Estoque Atual: {selectedItem.currentStock} {selectedItem.unit}</span>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 font-bold mb-2">Quantidade Comprada ({selectedItem.unit})</label>
                    <input 
                      type="number" step="0.01" required value={quantity} onChange={e => setQuantity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/50 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-400 font-bold mb-2">Novo Custo Unitário (R$)</label>
                    <input 
                      type="number" step="0.01" required value={cost} onChange={e => setCost(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/50 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                      placeholder={`Último: R$ ${selectedItem.costPerUnit.toFixed(2)}`}
                    />
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button type="button" onClick={() => setSelectedItem(null)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-800 rounded-xl transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                      <TrendingUp size={18} /> Atualizar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
