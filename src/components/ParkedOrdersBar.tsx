'use client';
import { useEffect } from 'react';
import { ParkedDraft } from '@/lib/parked-orders';
import { Plus, X, PauseCircle, Layers, ShoppingBag } from 'lucide-react';

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

  // Se a lista estiver vazia (antes da hidratação completa), exibimos fallback com 1 aba
  const effectiveDrafts = drafts && drafts.length > 0 ? drafts : [
    {
      id: activeDraftId || 'draft_default',
      label: 'Atendimento #1',
      customerName: '',
      saleChannel: 'balcao' as const,
      orderType: 'retirada' as const,
      pickupPaymentTiming: 'antecipado' as const,
      cart: [],
      deliveryFeeInput: '',
      discountInput: '',
      saleMethod: 'dinheiro' as const,
      cartStep: 'produtos' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  ];

  const activeId = activeDraftId || effectiveDrafts[0]?.id;

  return (
    <div className="p-3.5 bg-slate-950/90 rounded-2xl border-2 border-slate-800 shadow-xl space-y-2.5">
      {/* Barra de Título & Ação Principal */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Atendimentos Simultâneos / Pedidos em Espera
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-bold rounded-full border border-slate-700">
                {effectiveDrafts.length} {effectiveDrafts.length === 1 ? 'aba ativa' : 'abas abertas'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Alterne entre clientes no balcão e pedidos online (WhatsApp / iFood) sem perder itens.
            </p>
          </div>
        </div>

        {/* BOTÃO EM DESTAQUE MÁXIMO: + NOVO ATENDIMENTO */}
        <button
          type="button"
          onClick={onNewDraft}
          disabled={effectiveDrafts.length >= 6}
          className={`px-4 py-2 min-h-[42px] rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
            effectiveDrafts.length >= 6
              ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
          }`}
          title={effectiveDrafts.length >= 6 ? 'Limite máximo de 6 atendimentos simultâneos atingido' : 'Iniciar novo pedido em paralelo sem perder o atual [Alt+N]'}
        >
          <Plus size={16} className="text-white shrink-0" />
          <span>+ Novo Atendimento</span>
          <span className="text-[10px] bg-emerald-800/80 px-1.5 py-0.5 rounded font-mono hidden md:inline">Alt+N</span>
        </button>
      </div>

      {/* Lista de Abas de Atendimentos Abertos */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin pt-1">
        {effectiveDrafts.map((draft, idx) => {
          const isActive = draft.id === activeId;
          const itemCount = (draft.cart || []).reduce((sum, item) => sum + item.quantity, 0);
          const totalEstimate = (draft.cart || []).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
          const hasItems = itemCount > 0;

          return (
            <div
              key={draft.id}
              className={`flex items-center rounded-xl transition-all shrink-0 border select-none ${
                isActive
                  ? 'bg-amber-500/15 border-amber-400 text-white shadow-lg ring-2 ring-amber-400/40'
                  : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDraft(draft.id)}
                className="px-3.5 py-2.5 min-h-[46px] text-left flex items-center gap-2.5 cursor-pointer focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-amber-400 rounded-l-xl"
                title={`Alternar para ${draft.label || `Atendimento #${idx + 1}`} [Alt+${idx + 1}]`}
              >
                <span className={`w-5 h-5 rounded-full text-[11px] font-mono font-black flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                }`}>
                  {idx + 1}
                </span>

                <div className="max-w-[170px] sm:max-w-[220px] truncate">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-black truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {draft.customerName ? draft.customerName : `Atendimento #${idx + 1}`}
                    </span>
                    {draft.saleChannel === 'ifood' ? (
                      <span className="text-[10px] text-red-400 font-extrabold shrink-0 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/40">
                        🛵 iFood
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-extrabold shrink-0 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        🏪 Balcão
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono mt-0.5">
                    {hasItems ? (
                      <>
                        <span className="text-amber-300 font-bold">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-400 font-bold">R$ {totalEstimate.toFixed(2)}</span>
                      </>
                    ) : (
                      <span className="text-slate-500 italic">Vazio (Novo)</span>
                    )}
                  </div>
                </div>

                {!isActive && hasItems && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" title="Pedido em espera com itens preenchidos" />
                )}
              </button>

              {/* Botão de Fechar / Descartar Atendimento Individual */}
              {effectiveDrafts.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDraft(draft.id);
                  }}
                  className="p-2 mr-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                  title="Descartar este atendimento"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
