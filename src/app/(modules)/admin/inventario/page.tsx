'use client';
import { useState, useMemo } from 'react';
import { useInventory, StockAuditItem } from '@/lib/store';
import { 
  ArrowLeft, ClipboardCheck, AlertTriangle, CheckCircle2, 
  TrendingDown, TrendingUp, History, User, Save, RefreshCw, Layers 
} from 'lucide-react';
import Link from 'next/link';

export default function InventarioFisicoPage() {
  const { items, isLoaded, saveStockAudit, stockAudits } = useInventory();
  
  // Estado das contagens físicas inseridas pelo gestor: { [itemId]: string }
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [auditorName, setAuditorName] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Inicializar contagens se ainda não tiverem sido preenchidas
  const handleCountChange = (itemId: string, value: string) => {
    setCounts(prev => ({ ...prev, [itemId]: value }));
  };

  // Preencher todos com o estoque teórico atual (útil para auditoria rápida de conferência)
  const fillAllWithSystemStock = () => {
    const initial: Record<string, string> = {};
    items.forEach(i => {
      initial[i.id] = i.currentStock.toString();
    });
    setCounts(initial);
  };

  // Limpar todas as contagens
  const resetCounts = () => {
    setCounts({});
  };

  // Cálculo das divergências
  const auditAnalysis = useMemo(() => {
    let totalMissingCost = 0; // Faltas (Prejuízo / Quebra / Desvio)
    let totalSurplusCost = 0; // Sobras
    const auditedList: StockAuditItem[] = [];

    items.forEach(item => {
      const countedStr = counts[item.id];
      const hasCount = countedStr !== undefined && countedStr !== '';
      const counted = hasCount ? Number(countedStr) : item.currentStock;
      const diff = counted - item.currentStock;
      const varianceCost = diff * item.costPerUnit;

      if (diff < 0) {
        totalMissingCost += Math.abs(varianceCost);
      } else if (diff > 0) {
        totalSurplusCost += varianceCost;
      }

      auditedList.push({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        costPerUnit: item.costPerUnit,
        systemStock: item.currentStock,
        countedStock: counted,
        diff,
        varianceCost
      });
    });

    const netVarianceCost = totalSurplusCost - totalMissingCost;

    return {
      auditedList,
      totalMissingCost,
      totalSurplusCost,
      netVarianceCost
    };
  }, [items, counts]);

  if (!isLoaded) return null;

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditorName.trim() || saving) return;

    // Apenas itens que foram contados e tiveram diferença
    const itemsWithDivergence = auditAnalysis.auditedList.filter(i => counts[i.id] !== undefined);
    
    if (itemsWithDivergence.length === 0) {
      alert('Nenhum insumo teve contagem física digitada.');
      return;
    }

    const changedCount = itemsWithDivergence.filter(i => i.diff !== 0).length;
    if (!confirm(`Deseja efetivar a auditoria de inventário? ${changedCount} insumos terão seus saldos ajustados no sistema.`)) {
      return;
    }

    setSaving(true);
    setSuccessMsg('');

    const res = await saveStockAudit(
      auditorName.trim(),
      itemsWithDivergence,
      auditAnalysis.netVarianceCost
    );

    setSaving(false);

    if (res.success) {
      setSuccessMsg(`Inventário auditado com sucesso! Saldos de estoque sincronizados.`);
      setCounts({});
      setAuditorName('');
      setTimeout(() => setSuccessMsg(''), 6000);
    } else {
      alert(`Erro ao salvar auditoria: ${res.error}`);
    }
  };

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-bold mb-1">
                <ClipboardCheck size={20} /> Módulo Gestão Executiva
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Auditoria de Inventário Físico</h1>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={fillAllWithSystemStock}
              className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
              title="Preenche todos os campos com o estoque do sistema como ponto de partida"
            >
              <RefreshCw size={16} /> Preencher com Saldo Atual
            </button>
            {Object.keys(counts).length > 0 && (
              <button 
                type="button" 
                onClick={resetCounts}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-red-400 rounded-2xl font-bold text-xs transition-all cursor-pointer"
              >
                Limpar Contagens
              </button>
            )}
          </div>
        </header>

        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 font-semibold animate-fade-in">
            <CheckCircle2 size={24} className="flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Cards de Divergência Apurada */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card rounded-3xl p-6 border-t-4 border-red-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Faltas Apuradas (Furo / Quebra)</p>
                <p className="text-3xl font-mono font-bold text-red-400">
                  - R$ {auditAnalysis.totalMissingCost.toFixed(2)}
                </p>
              </div>
              <TrendingDown size={28} className="text-red-500/60" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Diferença negativa entre contagem física e sistema</p>
          </div>

          <div className="glass-card rounded-3xl p-6 border-t-4 border-amber-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Sobras Apuradas</p>
                <p className="text-3xl font-mono font-bold text-amber-400">
                  + R$ {auditAnalysis.totalSurplusCost.toFixed(2)}
                </p>
              </div>
              <TrendingUp size={28} className="text-amber-500/60" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Mais produto na prateleira do que no sistema</p>
          </div>

          <div className={`glass-card rounded-3xl p-6 border-t-4 ${auditAnalysis.netVarianceCost >= 0 ? 'border-emerald-500' : 'border-red-500'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Saldo Líquido da Auditoria</p>
                <p className={`text-3xl font-mono font-bold ${auditAnalysis.netVarianceCost >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {auditAnalysis.netVarianceCost >= 0 ? '+' : ''} R$ {auditAnalysis.netVarianceCost.toFixed(2)}
                </p>
              </div>
              <Layers size={28} className="text-slate-500/60" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Impacto no patrimônio da hamburgueria</p>
          </div>
        </div>

        {/* Formulário de Auditoria & Tabela de Confronto */}
        <form onSubmit={handleSaveAudit} className="space-y-8 mb-12">
          <div className="glass-card rounded-3xl p-8 border border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">Confronto: Estoque do Sistema x Contagem Física</h2>
                <p className="text-xs text-slate-400 mt-1">Digite a quantidade real que você contou fisicamente no freezer ou estoque.</p>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-300 font-bold flex items-center gap-1.5 whitespace-nowrap">
                  <User size={16} className="text-slate-400" /> Auditor Responsável:
                </label>
                <input 
                  type="text" 
                  required 
                  value={auditorName} 
                  onChange={e => setAuditorName(e.target.value)}
                  placeholder="Seu Nome"
                  className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                    <th className="pb-3 font-semibold">Insumo</th>
                    <th className="pb-3 font-semibold">Categoria</th>
                    <th className="pb-3 font-semibold text-right">Estoque Teórico</th>
                    <th className="pb-3 font-semibold text-center w-36">Contagem Real</th>
                    <th className="pb-3 font-semibold text-right">Diferença</th>
                    <th className="pb-3 font-semibold text-right">Divergência (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditAnalysis.auditedList.map(item => {
                    const countedStr = counts[item.id] ?? '';
                    const isEdited = countedStr !== '';

                    return (
                      <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 font-bold text-slate-200">
                          {item.name}
                          <span className="text-[11px] text-slate-500 block font-normal">
                            Custo: R$ {item.costPerUnit.toFixed(2)} / {item.unit}
                          </span>
                        </td>
                        <td className="py-3.5 text-xs text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-right text-slate-300 font-semibold">
                          {item.systemStock} {item.unit}
                        </td>
                        <td className="py-3.5 text-center">
                          <input 
                            type="number" 
                            step="0.01" 
                            value={countedStr}
                            onChange={e => handleCountChange(item.id, e.target.value)}
                            placeholder={item.systemStock.toString()}
                            className={`w-28 text-center bg-slate-950 border rounded-xl py-2 px-3 font-mono font-bold text-sm outline-none transition-all ${
                              isEdited 
                                ? item.diff === 0 
                                  ? 'border-emerald-500/50 text-white' 
                                  : item.diff < 0 
                                    ? 'border-red-500 text-red-300 bg-red-500/10' 
                                    : 'border-amber-500 text-amber-300 bg-amber-500/10'
                                : 'border-slate-700 text-slate-400 focus:border-emerald-500'
                            }`}
                          />
                        </td>
                        <td className="py-3.5 font-mono text-right text-xs">
                          {isEdited ? (
                            item.diff === 0 ? (
                              <span className="text-emerald-400 font-bold">Sem desvio</span>
                            ) : item.diff < 0 ? (
                              <span className="text-red-400 font-bold">{item.diff.toFixed(2)} {item.unit}</span>
                            ) : (
                              <span className="text-amber-400 font-bold">+{item.diff.toFixed(2)} {item.unit}</span>
                            )
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3.5 font-mono text-right font-bold text-sm">
                          {isEdited ? (
                            item.varianceCost === 0 ? (
                              <span className="text-slate-500">R$ 0,00</span>
                            ) : item.varianceCost < 0 ? (
                              <span className="text-red-400">- R$ {Math.abs(item.varianceCost).toFixed(2)}</span>
                            ) : (
                              <span className="text-amber-400">+ R$ {item.varianceCost.toFixed(2)}</span>
                            )
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-500">
                Ao clicar em "Efetivar Ajuste", os saldos reais digitados substituirão os estoques do sistema e o histórico de auditoria será arquivado.
              </p>
              
              <button 
                type="submit" 
                disabled={saving || !auditorName.trim()}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Save size={18} />
                {saving ? 'Ajustando Saldos...' : 'Efetivar Ajuste de Inventário'}
              </button>
            </div>
          </div>
        </form>

        {/* Histórico de Auditorias Anteriores */}
        <div className="glass-card rounded-3xl p-8 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <History size={22} className="text-emerald-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Histórico de Auditorias de Estoque</h2>
              <p className="text-slate-400 text-sm">Relatório dos inventários passados e apuração de divergências.</p>
            </div>
          </div>

          <div className="space-y-4">
            {stockAudits.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhuma auditoria de inventário físico realizada ainda.</p>
            ) : (
              stockAudits.map(audit => (
                <div key={audit.id} className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-800/80">
                    <div>
                      <span className="text-sm font-bold text-white">
                        Auditoria de {new Date(audit.createdAt).toLocaleDateString('pt-BR')} às {new Date(audit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <p className="text-xs text-slate-400">Responsável: <strong className="text-slate-300">{audit.auditedBy}</strong></p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Impacto Total:</span>
                      <span className={`font-mono font-bold text-sm ${audit.totalVarianceCost >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {audit.totalVarianceCost >= 0 ? '+' : ''} R$ {audit.totalVarianceCost.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {audit.items.filter(i => i.diff !== 0).map((item, idx) => (
                      <span key={idx} className={`text-[11px] px-2.5 py-1 rounded-lg font-mono font-medium ${
                        item.diff < 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {item.name}: {item.diff > 0 ? '+' : ''}{item.diff} {item.unit} ({item.varianceCost >= 0 ? '+' : ''}R$ {item.varianceCost.toFixed(2)})
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
