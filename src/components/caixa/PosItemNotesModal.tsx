'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Button } from '@/components/ui';
import { SaleItem } from '@/lib/store';
import { MessageSquare, Sparkles, X, Check, Trash2 } from 'lucide-react';

interface PosItemNotesModalProps {
  item: SaleItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string | undefined) => void;
}

const QUICK_SUGGESTIONS = [
  'SEM CEBOLA',
  'SEM MAIONESE',
  'MOLHO À PARTE',
  'BEM PASSADO',
  'AO PONTO',
  'MAL PASSADO',
  'CAPRICHA NO BACON',
  'EMBALAR SEPARADO',
  'SEM SAL NA BATATA',
  'ALÉRGICO A LACTOSE',
  'ALÉRGICO A GLÚTEN',
];

export default function PosItemNotesModal({
  item,
  isOpen,
  onClose,
  onSaveNotes,
}: PosItemNotesModalProps) {
  const [notes, setNotes] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && item) {
      setNotes(item.notes || '');
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 50);
    }
  }, [isOpen, item]);

  if (!item) return null;

  const handleApplySuggestion = (suggestion: string) => {
    const trimmed = notes.trim();
    if (!trimmed) {
      setNotes(suggestion);
    } else {
      const parts = trimmed.split(',').map(s => s.trim().toUpperCase());
      if (!parts.includes(suggestion)) {
        setNotes(`${trimmed}, ${suggestion}`);
      }
    }
  };

  const handleSave = () => {
    const cleanNotes = notes.trim().toUpperCase();
    onSaveNotes(cleanNotes || undefined);
    onClose();
  };

  const handleClear = () => {
    setNotes('');
    onSaveNotes(undefined);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Observação para a Cozinha"
      description="Esta anotação será exibida com destaque visual no KDS e impressa na comanda."
      size="md"
    >
      <div className="space-y-4 py-2">
        {/* Identificação do Item */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-2">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">
              Item Selecionado:
            </span>
            <p className="text-white font-black text-sm truncate">
              [{item.quantity}x] {item.productName}
            </p>
          </div>
          {item.notes && (
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase shrink-0">
              Possui Obs
            </span>
          )}
        </div>

        {/* Campo de Texto para Observação */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block flex justify-between items-center">
            <span>Texto da Observação:</span>
            <span className="text-[10px] font-normal text-slate-500">Pressione ENTER para salvar</span>
          </label>
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={e => setNotes(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Ex: POUCO MOLHO, CARNE BEM TOSTADA, ETC..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl p-3 text-sm text-white placeholder-slate-600 font-bold uppercase transition-all resize-none outline-none"
          />
        </div>

        {/* Sugestões Rápidas de Balcão */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-amber-400">
            <Sparkles size={12} />
            <span>Sugestões Rápidas (Toque para Inserir):</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {QUICK_SUGGESTIONS.map(s => {
              const isActive = notes.toUpperCase().includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleApplySuggestion(s)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-amber-500/25 border-amber-500/60 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white active:scale-95'
                  }`}
                >
                  + {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ações do Rodapé */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
          {item.notes ? (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              title="Apagar observação deste item"
            >
              <Trash2 size={13} />
              <span>Remover Obs</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              className="text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Check size={14} />
              Salvar Observação
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
