'use client';
import { useInventory, InventoryItem } from '@/lib/store';
import { ChefHat, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CozinhaPage() {
  const { items, updateStatus, isLoaded } = useInventory();

  if (!isLoaded) return null;

  // Agrupar itens por categoria
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-3 bg-slate-900 rounded-2xl hover:bg-slate-800 text-slate-400 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-2 flex items-center gap-3">
              <ChefHat className="text-amber-500" /> Operação Cozinha
            </h1>
            <p className="text-slate-500 text-lg">Sinalize rupturas de estoque imediatamente para a Gestão de Compras.</p>
          </div>
        </header>

        {Object.entries(groupedItems).map(([catName, catItems]) => (
          <div key={catName} className="mb-12">
            <h2 className="text-2xl font-bold text-slate-200 mb-6 px-2 border-l-4 border-amber-500 uppercase tracking-wider">{catName}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {catItems.map(item => (
                <div key={item.id} className={`p-6 rounded-3xl border transition-all ${
                  item.status === 'zerado' ? 'bg-red-500/10 border-red-500/30' :
                  item.status === 'acabando' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-200">{item.name}</h3>
                      <p className="text-slate-500 mt-1">Estoque atual: {item.currentStock} {item.unit}</p>
                    </div>
                    
                    {item.status !== 'ok' && (
                      <button 
                        onClick={() => updateStatus(item.id, 'ok')}
                        className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center gap-2"
                      >
                        <CheckCircle size={16} /> Desfazer Alerta
                      </button>
                    )}
                  </div>

                  {item.status === 'ok' ? (
                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          const qty = prompt(`Quantos ${item.unit} restam de ${item.name}?`);
                          if (qty !== null) updateStatus(item.id, 'acabando', Number(qty));
                        }}
                        className="flex-1 py-4 bg-amber-600/20 hover:bg-amber-500/30 text-amber-500 rounded-2xl font-bold border border-amber-500/20 transition-all flex justify-center items-center gap-2"
                      >
                        <AlertTriangle size={20} /> Acabando
                      </button>
                      <button 
                        onClick={() => updateStatus(item.id, 'zerado', 0)}
                        className="flex-1 py-4 bg-red-600/20 hover:bg-red-500/30 text-red-500 rounded-2xl font-bold border border-red-500/20 transition-all flex justify-center items-center gap-2"
                      >
                        Zerado!
                      </button>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold ${
                      item.status === 'zerado' ? 'bg-red-500 text-white' : 'bg-amber-500 text-amber-950'
                    }`}>
                      <AlertTriangle size={24} />
                      ALERTA ENVIADO À GESTÃO
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
