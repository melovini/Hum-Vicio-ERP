'use client';
import React from 'react';
import { Dialog } from '@/components/ui';
import { LayoutTemplate } from '@/lib/mesas';
import { 
  Unlock, Lock, AlertCircle, CheckCircle2, TrendingDown, 
  TrendingUp, LayoutGrid, Banknote, CreditCard, DollarSign 
} from 'lucide-react';

interface PosCashShiftModalProps {
  mode: 'open' | 'close' | 'quick_check' | null;
  onClose: () => void;
  // Abertura
  operatorOpenInput: string;
  onOperatorOpenInputChange: (val: string) => void;
  initialAmountInput: string;
  onInitialAmountInputChange: (val: string) => void;
  selectedInitialLayoutId: string;
  onSelectedInitialLayoutIdChange: (val: string) => void;
  floorTemplates: LayoutTemplate[];
  onConfirmOpen: (e: React.FormEvent) => void;
  isBoxOpen: boolean;
  // Fechamento / Conferência
  sessionStats: {
    initial: number;
    cashSales: number;
    pixSales: number;
    debitoSales: number;
    creditoSales: number;
    sangrias: number;
    suprimentos: number;
    expectedInDrawer: number;
    expectedTotalRegister: number;
    totalSales: number;
  };
  countedAmountInput: string;
  onCountedAmountInputChange: (val: string) => void;
  countedDebitoInput: string;
  onCountedDebitoInputChange: (val: string) => void;
  countedCreditoInput: string;
  onCountedCreditoInputChange: (val: string) => void;
  countedPixInput: string;
  onCountedPixInputChange: (val: string) => void;
  closingNotesInput: string;
  onClosingNotesInputChange: (val: string) => void;
  onConfirmClose: (e: React.FormEvent) => void;
}

export default function PosCashShiftModal({
  mode,
  onClose,
  operatorOpenInput,
  onOperatorOpenInputChange,
  initialAmountInput,
  onInitialAmountInputChange,
  selectedInitialLayoutId,
  onSelectedInitialLayoutIdChange,
  floorTemplates,
  onConfirmOpen,
  isBoxOpen,
  sessionStats,
  countedAmountInput,
  onCountedAmountInputChange,
  countedDebitoInput,
  onCountedDebitoInputChange,
  countedCreditoInput,
  onCountedCreditoInputChange,
  countedPixInput,
  onCountedPixInputChange,
  closingNotesInput,
  onClosingNotesInputChange,
  onConfirmClose,
}: PosCashShiftModalProps) {
  if (!mode) return null;

  if (mode === 'open') {
    return (
      <Dialog
        open={true}
        onClose={onClose}
        title="Abertura de Turno de Caixa"
        description="Informe o operador e o fundo de troco inicial para registrar no sistema."
        size="md"
        preventClose={!isBoxOpen}
      >
        <form onSubmit={onConfirmOpen} className="space-y-4 py-2">
          <div>
            <label className="block text-slate-300 font-bold text-xs mb-1.5">
              Operador Responsável:
            </label>
            <input
              type="text"
              required
              value={operatorOpenInput}
              onChange={e => onOperatorOpenInputChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs outline-none focus:border-emerald-500"
              placeholder="Ex: Carlos Oliveira"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold text-xs mb-1.5">
              Fundo Inicial de Troco na Gaveta (R$):
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={initialAmountInput}
              onChange={e => onInitialAmountInputChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-lg font-bold outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold text-xs mb-1.5 flex items-center gap-1.5">
              <LayoutGrid size={14} className="text-emerald-400" /> Layout Inicial do Salão (Mesas):
            </label>
            <select
              value={selectedInitialLayoutId}
              onChange={e => onSelectedInitialLayoutIdChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
            >
              {floorTemplates.filter(t => t.ativo).map(t => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({t.items.length} mesas)
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              O layout selecionado será clonado para a sessão operacional do salão.
            </span>
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-800">
            {isBoxOpen && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
            >
              Confirmar Abertura (R$ {Number(initialAmountInput || 0).toFixed(2)})
            </button>
          </div>
        </form>
      </Dialog>
    );
  }

  // Modo Fechamento ou Conferência Rápida
  const numDebito = parseFloat(countedDebitoInput.replace(',', '.')) || 0;
  const numCredito = parseFloat(countedCreditoInput.replace(',', '.')) || 0;
  const numPix = parseFloat(countedPixInput.replace(',', '.')) || 0;
  const numCash = parseFloat(countedAmountInput.replace(',', '.')) || 0;

  const diffDebito = numDebito - sessionStats.debitoSales;
  const diffCredito = numCredito - sessionStats.creditoSales;
  const diffPix = numPix - sessionStats.pixSales;
  const diffCash = numCash - sessionStats.expectedInDrawer;

  const totalCounted = numDebito + numCredito + numPix + numCash;
  const totalExpected = sessionStats.expectedTotalRegister;
  const totalDiff = totalCounted - totalExpected;

  const isQuickCheck = mode === 'quick_check';

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={isQuickCheck ? 'Conferência Parcial de Maquininhas & Gaveta' : 'Fechamento & Conferência do Turno'}
      description={isQuickCheck 
        ? 'Verifique os valores passados nas maquininhas e na gaveta sem encerrar o turno.' 
        : 'Confira as receitas por método de pagamento para consolidar o relatório final.'}
      size="lg"
    >
      <form onSubmit={onConfirmClose} className="space-y-4 py-2">
        {/* Resumo do Sistema */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Fundo Inicial</span>
            <span className="font-mono text-white font-bold">R$ {sessionStats.initial.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Vendas Dinheiro</span>
            <span className="font-mono text-emerald-400 font-bold">+ R$ {sessionStats.cashSales.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Sangrias / Retiradas</span>
            <span className="font-mono text-rose-400 font-bold">- R$ {sessionStats.sangrias.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Esperado Gaveta</span>
            <span className="font-mono text-amber-400 font-bold">R$ {sessionStats.expectedInDrawer.toFixed(2)}</span>
          </div>
        </div>

        {/* Inputs de Conferência por Meio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Dinheiro */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1"><Banknote size={14} className="text-emerald-400" /> Dinheiro em Gaveta (R$):</span>
              <span className="text-[10px] text-slate-500 font-mono">Esperado: R$ {sessionStats.expectedInDrawer.toFixed(2)}</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={countedAmountInput}
              onChange={e => onCountedAmountInputChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm outline-none"
            />
            {countedAmountInput && (
              <div className="text-[11px] font-mono flex justify-between">
                <span className="text-slate-500">Diferença:</span>
                <span className={`font-bold ${diffCash === 0 ? 'text-emerald-400' : diffCash > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                  {diffCash === 0 ? 'Bateu Exato (R$ 0,00)' : diffCash > 0 ? `+ R$ ${diffCash.toFixed(2)} (Sobra)` : `- R$ ${Math.abs(diffCash).toFixed(2)} (Quebra)`}
                </span>
              </div>
            )}
          </div>

          {/* PIX */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1"><DollarSign size={14} className="text-emerald-400" /> Relatório PIX (R$):</span>
              <span className="text-[10px] text-slate-500 font-mono">Esperado: R$ {sessionStats.pixSales.toFixed(2)}</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={countedPixInput}
              onChange={e => onCountedPixInputChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm outline-none"
            />
            {countedPixInput && (
              <div className="text-[11px] font-mono flex justify-between">
                <span className="text-slate-500">Diferença:</span>
                <span className={`font-bold ${diffPix === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diffPix === 0 ? 'Bateu Exato' : `Diferença: R$ ${diffPix.toFixed(2)}`}
                </span>
              </div>
            )}
          </div>

          {/* Cartão Débito */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1"><CreditCard size={14} className="text-blue-400" /> Total Débito Maquininhas:</span>
              <span className="text-[10px] text-slate-500 font-mono">Esperado: R$ {sessionStats.debitoSales.toFixed(2)}</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={countedDebitoInput}
              onChange={e => onCountedDebitoInputChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm outline-none"
            />
            {countedDebitoInput && (
              <div className="text-[11px] font-mono flex justify-between">
                <span className="text-slate-500">Diferença:</span>
                <span className={`font-bold ${diffDebito === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diffDebito === 0 ? 'Bateu Exato' : `Diferença: R$ ${diffDebito.toFixed(2)}`}
                </span>
              </div>
            )}
          </div>

          {/* Cartão Crédito */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1"><CreditCard size={14} className="text-purple-400" /> Total Crédito Maquininhas:</span>
              <span className="text-[10px] text-slate-500 font-mono">Esperado: R$ {sessionStats.creditoSales.toFixed(2)}</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={countedCreditoInput}
              onChange={e => onCountedCreditoInputChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm outline-none"
            />
            {countedCreditoInput && (
              <div className="text-[11px] font-mono flex justify-between">
                <span className="text-slate-500">Diferença:</span>
                <span className={`font-bold ${diffCredito === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diffCredito === 0 ? 'Bateu Exato' : `Diferença: R$ ${diffCredito.toFixed(2)}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Observações de Fechamento */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Observações Gerais da Conferência:
          </label>
          <input
            type="text"
            value={closingNotesInput}
            onChange={e => onClosingNotesInputChange(e.target.value)}
            placeholder="Ex: Quebra de R$ 2,00 por falta de moedas no balcão..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs outline-none"
          />
        </div>

        {/* Total Geral de Diferença */}
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
          <div>
            <span className="text-slate-400 block font-bold">Balanço Total de Conferência:</span>
            <span className="text-[11px] text-slate-500 font-mono">
              Contado: R$ {totalCounted.toFixed(2)} / Esperado: R$ {totalExpected.toFixed(2)}
            </span>
          </div>
          <span className={`font-mono text-base font-black ${totalDiff === 0 ? 'text-emerald-400' : totalDiff > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            {totalDiff === 0 ? 'Tudo Conferido (R$ 0,00)' : totalDiff > 0 ? `+ R$ ${totalDiff.toFixed(2)} (Sobra)` : `- R$ ${Math.abs(totalDiff).toFixed(2)} (Quebra)`}
          </span>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            {isQuickCheck ? 'Fechar Conferência' : 'Voltar ao Caixa'}
          </button>
          {!isQuickCheck && (
            <button
              type="submit"
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Lock size={14} /> Confirmar Fechamento do Turno
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
