'use client';
import { useEffect } from 'react';
import { ParkedDraft } from '@/lib/parked-orders';
import { Plus, X, PauseCircle, Clock, ShoppingBag } from 'lucide-react';

interface ParkedOrdersBarProps {
  drafts: ParkedDraft[];
  activeDraftId: string | null;
  onSelectDraft: (draftId: string) => void;
  onNewDraft: () => void;
  onDeleteDraft: (draftId: string) => void;
}

export default function ParkedOrdersBar({
  drafts,
  activeDraftId,
  onSelectDraft,
  onNewDraft,
  onDeleteDraft,
}: ParkedOrdersBarProps) {
  // Atalhos de Teclado Globais: Alt+N (Novo Atendimento), Alt+1..6 (Alternar Abas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + N: Novo Atendimento
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        onNewDraft();
        return;
      }

      // Alt + 1..6: Alternar abas
      if (e.altKey && /^[1-6]$/.test(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < drafts.length) {
          e.preventDefault();
          onSelectDraft(drafts[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drafts, onNewDraft, onSelectDraft]);

  if (drafts.length <= 1 && drafts.every(d => d.cart.length === 0 && !d.customerName)) {
    // Se só existe uma aba vazia, exibe apenas a barra com botão para novo atendimento contextual
    return (
      <div className="mb-3 flex items-center justify-between gap-2 p-2 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-400 pl-2">
          <ShoppingBag size={14} className="text-emerald-400" />
          <span className="font-bold">Atendimento Atual (Balcão / Online)</span>
        </div>
        <button
          type="button"
          onClick={onNewDraft}
          className="px-3 py-2 min-h-[38px] bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Abrir novo atendimento concorrente (Ex: cliente chegou no balcão enquanto atendia online) [Alt+N]"
        >
          <Plus size={14} className="text-amber-400" />
          <span>+ Novo Atendimento</span>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Alt+N</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 p-2 bg-slate-950/80 rounded-2xl border border-slate-800/90 shadow-md">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
          <PauseCircle size={15} className="text-amber-400" />
          <span>Atendimentos Concorrentes</span>
          {drafts.length > 1 && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black rounded-full">
              {drafts.length} abas abertas
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onNewDraft}
          disabled={drafts.length >= 6}
          className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
            drafts.length >= 6
              ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] active:scale-95'
          }`}
          title={drafts.length >= 6 ? 'Limite máximo de 6 atendimentos simultâneos atingido' : 'Iniciar novo pedido em paralelo sem perder o atual [Alt+N]'}
        >
          <Plus size={14} />
          <span>+ Novo Atendimento</span>
          <span className="text-[10px] opacity-80 font-mono hidden sm:inline">Alt+N</span>
        </button>
      </div>

      {/* Carrossel / Lista de Abas de Atendimento */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {drafts.map((draft, idx) => {
          const isActive = draft.id === activeDraftId;
          const itemCount = draft.cart.reduce((sum, item) => sum + item.quantity, 0);
          const totalEstimate = draft.cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
          const hasItems = itemCount > 0;

          return (
            <div
              key={draft.id}
              className={`flex items-center rounded-xl transition-all shrink-0 border select-none ${
                isActive
                  ? 'bg-amber-500/15 border-amber-500/80 text-white shadow-lg ring-1 ring-amber-500/50'
                  : 'bg-slate-900/90 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDraft(draft.id)}
                className="px-3 py-2 min-h-[44px] text-left flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-amber-400 rounded-l-xl"
                title={`Alternar para ${draft.label} [Alt+${idx + 1}]`}
              >
                <span className={`w-5 h-5 rounded-full text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {idx + 1}
                </span>

                <div className="max-w-[150px] sm:max-w-[190px] truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate">
                      {draft.customerName ? draft.customerName : `Atendimento #${idx + 1}`}
                    </span>
                    {draft.saleChannel === 'ifood' ? (
                      <span className="text-[10px] text-red-400 font-extrabold shrink-0">iFood</span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-extrabold shrink-0">Balcão</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                    {hasItems ? (
                      <>
                        <span className="text-amber-300 font-bold">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">R$ {totalEstimate.toFixed(2)}</span>
                      </>
                    ) : (
                      <span className="text-slate-500 italic">Vazio</span>
                    )}
                  </div>
                </div>

                {!isActive && hasItems && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="Pedido em espera com itens preenchidos" />
                )}
              </button>

              {/* Botão de Fechar / Descartar Atendimento Individual */}
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDraft(draft.id);
                  }}
                  className="p-2 mr-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Descartar este atendimento"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
