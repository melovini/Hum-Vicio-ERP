'use client';
import { useState } from 'react';
import { ArrowLeft, PackagePlus, Calculator } from 'lucide-react';
import Link from 'next/link';

interface ProductMock {
  id: string;
  name: string;
  cmv: number;
}

const dbProducts: ProductMock[] = [
  { id: '1', name: 'Smash Burger (1 Carne)', cmv: 8.50 },
  { id: '2', name: 'Double Smash', cmv: 12.00 },
  { id: '3', name: 'Batata Frita P', cmv: 2.50 },
  { id: '4', name: 'Refrigerante Lata', cmv: 3.00 },
];

export default function SimuladorCombosPage() {
  const [combo, setCombo] = useState<ProductMock[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [targetMargin, setTargetMargin] = useState('50'); // 50% margem desejada

  const handleAdd = () => {
    const p = dbProducts.find(x => x.id === selectedId);
    if (p) {
      setCombo([...combo, p]);
      setSelectedId('');
    }
  };

  const removeProduct = (idx: number) => {
    setCombo(combo.filter((_, i) => i !== idx));
  };

  const totalCmv = combo.reduce((acc, p) => acc + p.cmv, 0);
  
  // Se Margem = 50%, Preço = CMV / (1 - 0.50)
  const marginDecimal = Number(targetMargin) / 100;
  const suggestedPrice = marginDecimal < 1 ? totalCmv / (1 - marginDecimal) : 0;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-purple-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-purple-400 font-bold mb-1">
                <Calculator size={20} /> Módulo Gestão
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Simulador de Combos</h1>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="glass-card rounded-3xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Montar Pacote</h2>
            
            <div className="flex gap-4 mb-8">
              <select 
                value={selectedId} onChange={e => setSelectedId(e.target.value)}
                className="flex-1 bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-slate-200 outline-none focus:border-purple-500 appearance-none"
              >
                <option value="" disabled>Selecione um produto...</option>
                {dbProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (CMV: R$ {p.cmv.toFixed(2)})</option>
                ))}
              </select>
              <button onClick={handleAdd} className="bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                <PackagePlus size={24} />
              </button>
            </div>

            <div className="space-y-3">
              {combo.map((item, idx) => (
                <div key={idx} className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-4 flex justify-between items-center">
                  <span className="font-bold text-slate-200">{item.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-amber-400 font-mono">R$ {item.cmv.toFixed(2)}</span>
                    <button onClick={() => removeProduct(idx)} className="text-slate-600 hover:text-red-500">X</button>
                  </div>
                </div>
              ))}
              {combo.length === 0 && <p className="text-slate-500 text-center py-8">Pacote vazio.</p>}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8 border-t-4 border-purple-500 h-fit">
            <h2 className="text-xl font-bold text-white mb-6">Sugestão de Preço</h2>
            
            <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800 mb-6">
              <p className="text-sm text-slate-500 font-bold mb-1">CMV Somado do Combo</p>
              <p className="text-3xl font-mono font-bold text-amber-400">R$ {totalCmv.toFixed(2)}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-400 font-bold mb-3">Margem Bruta Desejada (%)</label>
              <input 
                type="number" value={targetMargin} onChange={e => setTargetMargin(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/50 rounded-2xl py-4 px-4 text-white font-mono text-2xl outline-none focus:border-purple-500"
              />
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <p className="text-sm text-slate-400 font-bold mb-2">Preço de Venda Mínimo Sugerido</p>
              <p className="text-5xl font-mono font-extrabold text-emerald-400">
                R$ {suggestedPrice > 0 ? suggestedPrice.toFixed(2) : '0.00'}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
