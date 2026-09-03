'use client';
import { useState } from 'react';
import { useInventory, Product } from '@/lib/store';
import { ArrowLeft, PackagePlus, Calculator, Trash2, Store, Smartphone, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ComboItem {
  id: string;
  name: string;
  cmv: number;
}

export default function SimuladorCombosPage() {
  const { products, getProductCmv, isLoaded } = useInventory();
  const [combo, setCombo] = useState<ComboItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [targetMargin, setTargetMargin] = useState('50'); // 50% margem desejada

  if (!isLoaded) return null;

  const handleAdd = () => {
    const p = products.find(x => x.id === selectedId);
    if (p) {
      const realCmv = getProductCmv(p.recipe);
      setCombo([...combo, {
        id: p.id,
        name: p.name,
        cmv: realCmv > 0 ? realCmv : (p.priceBalcao * 0.30)
      }]);
      setSelectedId('');
    }
  };

  const removeProduct = (idx: number) => {
    setCombo(combo.filter((_, i) => i !== idx));
  };

  const totalCmv = combo.reduce((acc, p) => acc + p.cmv, 0);
  
  // Margem Desejada
  const marginDecimal = Number(targetMargin) / 100;
  
  // Sugestão Balcão (considerando 3% de taxa média de cartão)
  // Preço * (1 - taxa - margem) = CMV  =>  Preço = CMV / (1 - taxa - margem)
  const balcaoRate = 0.03;
  const suggestedBalcao = (1 - balcaoRate - marginDecimal) > 0 
    ? totalCmv / (1 - balcaoRate - marginDecimal) 
    : 0;

  // Sugestão iFood (considerando 30% taxa iFood + R$ 0.99)
  const ifoodRate = 0.30;
  const ifoodFixed = 0.99;
  const suggestedIfood = (1 - ifoodRate - marginDecimal) > 0 
    ? (totalCmv + ifoodFixed) / (1 - ifoodRate - marginDecimal) 
    : 0;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-purple-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-purple-400 font-bold mb-1">
                <Calculator size={20} /> Módulo Gestão Executiva
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Simulador Estratégico de Combos</h1>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Montar Combo */}
          <div className="lg:col-span-7 glass-card rounded-3xl p-8 border border-slate-800">
            <h2 className="text-2xl font-bold text-white mb-2">Montagem do Pacote Promocional</h2>
            <p className="text-slate-400 text-sm mb-6">
              Selecione lanches, bebidas e porções reais do seu cardápio para calcular a viabilidade financeira.
            </p>
            
            <div className="flex gap-3 mb-6">
              <select 
                value={selectedId} 
                onChange={e => setSelectedId(e.target.value)}
                className="flex-1 bg-slate-950/70 border border-slate-700/60 rounded-2xl p-4 text-slate-200 outline-none focus:border-purple-500 text-sm appearance-none"
              >
                <option value="" disabled>Selecione um produto do cardápio...</option>
                {products.map(p => {
                  const cmv = getProductCmv(p.recipe);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} (CMV Ficha Técnica: R$ {cmv > 0 ? cmv.toFixed(2) : (p.priceBalcao * 0.3).toFixed(2)})
                    </option>
                  );
                })}
              </select>
              <button 
                onClick={handleAdd} 
                disabled={!selectedId}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-6 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] cursor-pointer flex items-center justify-center"
              >
                <PackagePlus size={22} />
              </button>
            </div>

            <div className="space-y-3">
              {combo.map((item, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800/70 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-200 text-base">{item.name}</p>
                    <p className="text-xs text-slate-500">Item do Cardápio Oficial</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-amber-400 font-mono font-bold text-sm">CMV: R$ {item.cmv.toFixed(2)}</span>
                    <button onClick={() => removeProduct(idx)} className="text-slate-500 hover:text-red-500 p-1 cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              
              {combo.length === 0 && (
                <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  <p>Nenhum item adicionado ao combo ainda.</p>
                  <p className="text-xs text-slate-600 mt-1">Adicione os itens no campo acima para ver a sugestão de preço.</p>
                </div>
              )}
            </div>
          </div>

          {/* Resultados e Sugestão de Preço */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-3xl p-8 border-t-4 border-purple-500">
              <h2 className="text-xl font-bold text-white mb-4">Parâmetros de Lucro</h2>
              
              <div className="bg-slate-950/60 rounded-2xl p-5 border border-slate-800/80 mb-6">
                <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">CMV Total dos Insumos</p>
                <p className="text-3xl font-mono font-bold text-amber-400">R$ {totalCmv.toFixed(2)}</p>
              </div>

              <div className="mb-6">
                <label className="block text-xs text-slate-300 font-bold mb-2 uppercase tracking-wider">
                  Margem de Lucro Bruta Desejada (%)
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="10"
                    max="90"
                    value={targetMargin} 
                    onChange={e => setTargetMargin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3.5 px-4 text-white font-mono text-2xl outline-none focus:border-purple-500"
                  />
                  <span className="text-2xl font-bold text-slate-400">%</span>
                </div>
              </div>

              {/* Sugestões por Canal */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                {/* Balcão */}
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase">
                      <Store size={14} /> Preço Sugerido no Balcão
                    </span>
                    <span className="text-[10px] text-slate-400">(Taxa 3%)</span>
                  </div>
                  <p className="text-3xl font-mono font-extrabold text-white">
                    R$ {suggestedBalcao > 0 ? suggestedBalcao.toFixed(2) : '0.00'}
                  </p>
                </div>

                {/* iFood */}
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase">
                      <Smartphone size={14} /> Preço Sugerido no iFood
                    </span>
                    <span className="text-[10px] text-slate-400">(Taxa 30% + R$0.99)</span>
                  </div>
                  <p className="text-3xl font-mono font-extrabold text-white">
                    R$ {suggestedIfood > 0 ? suggestedIfood.toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
