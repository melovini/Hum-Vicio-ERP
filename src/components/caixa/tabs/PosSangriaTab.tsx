'use client';
import React, { useState } from 'react';
import { CashMovement } from '@/lib/store';
import { TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

interface PosSangriaTabProps {
  sessionStats: {
    initial: number;
    cashSales: number;
    suprimentos: number;
    sangrias: number;
    expectedInDrawer: number;
  };
  movements: CashMovement[];
  onAddMovement: (type: 'sangria' | 'suprimento', amount: number, description: string) => void;
  onShowToast: (msg: string, variant?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function PosSangriaTab({
  sessionStats,
  movements,
  onAddMovement,
  onShowToast,
}: PosSangriaTabProps) {
  const [movType, setMovType] = useState<'sangria' | 'suprimento'>('sangria');
  const [movAmount, setMovAmount] = useState('');
  const [movDesc, setMovDesc] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(movAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      onShowToast('Informe um valor válido maior que zero.', 'warning');
      return;
    }
    if (!movDesc.trim()) {
      onShowToast('Informe o motivo ou descrição da movimentação.', 'warning');
      return;
    }

    onAddMovement(movType, val, movDesc.trim());
    setMovAmount('');
    setMovDesc('');
    onShowToast(`${movType === 'sangria' ? 'Sangria' : 'Suprimento'} de R$ ${val.toFixed(2)} registrado com sucesso!`, 'success');
  };

  return (
    <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 space-y-6 shadow-lg">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="text-amber-500" /> Controle de Movimentações (Gaveta)
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Lançamento de retiradas (sangrias) e reforços de troco (suprimentos) no turno ativo.
        </p>
      </div>

      {/* Cards de Métricas da Gaveta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <p className="text-xs text-slate-400 font-bold mb-1">Fundo Inicial de Troco</p>
          <p className="text-xl font-mono font-bold text-slate-200">
            R$ {sessionStats.initial.toFixed(2)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <p className="text-xs text-slate-400 font-bold mb-1">Vendas Dinheiro + Suprimentos</p>
          <p className="text-xl font-mono font-bold text-emerald-400">
            + R$ {(sessionStats.cashSales + sessionStats.suprimentos).toFixed(2)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <p className="text-xs text-slate-400 font-bold mb-1">Sangrias Realizadas</p>
          <p className="text-xl font-mono font-bold text-rose-400">
            - R$ {sessionStats.sangrias.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de Lançamento */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white">Lançar Sangria ou Suprimento</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMovType('sangria')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  movType === 'sangria'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <TrendingDown size={15} /> Sangria (Retirada)
              </button>
              <button
                type="button"
                onClick={() => setMovType('suprimento')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  movType === 'suprimento'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp size={15} /> Suprimento (Entrada)
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-bold mb-1">Valor (R$):</label>
              <input
                type="number"
                step="0.01"
                required
                value={movAmount}
                onChange={e => setMovAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm outline-none focus:border-amber-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-bold mb-1">Motivo / Descrição:</label>
              <input
                type="text"
                required
                value={movDesc}
                onChange={e => setMovDesc(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs outline-none focus:border-amber-500"
                placeholder="Ex: Pagamento de fornecedor de gelo ou reforço de moedas"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs transition-all cursor-pointer shadow-md"
            >
              Confirmar Lançamento na Gaveta
            </button>
          </form>
        </div>

        {/* Histórico de Movimentações */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-white">Movimentações deste Turno</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {movements.length === 0 ? (
              <p className="text-slate-500 text-xs py-8 text-center">Nenhuma movimentação avulsa registrada.</p>
            ) : (
              movements.map(m => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 flex justify-between items-center text-xs"
                >
                  <div>
                    <span className={`text-[10px] font-black uppercase ${
                      m.type === 'sangria' ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {m.type === 'sangria' ? 'Sangria' : 'Suprimento'}
                    </span>
                    <p className="text-slate-200 font-medium text-xs mt-0.5">{m.description}</p>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className={`font-mono font-bold text-sm ${
                    m.type === 'sangria' ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {m.type === 'sangria' ? '-' : '+'} R$ {m.amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
