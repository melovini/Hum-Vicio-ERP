'use client';
import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui';
import { SaleItem, GiftReason } from '@/lib/store';
import { Gift } from 'lucide-react';

interface PosGiftModalProps {
  item: SaleItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: GiftReason, notes: string) => void;
  onRemoveGift: () => void;
}

const REASONS: { id: GiftReason; label: string; desc: string }[] = [
  { id: 'falta_pedido_anterior', label: '🍟 Falta no Pedido Anterior', desc: 'Item esquecido em pedido anterior que o cliente combinou receber hoje' },
  { id: 'fidelidade_cliente', label: '⭐ Fidelidade / Cliente VIP', desc: 'Mimo de relacionamento para cliente assíduo' },
  { id: 'atraso_preparo', label: '⏱️ Atraso no Preparo / Atendimento', desc: 'Compensação por demora na cozinha ou entrega' },
  { id: 'cortesia_casa', label: '🎁 Cortesia da Casa / Degustação', desc: 'Amigo da casa, degustação ou influenciador parceiro' },
  { id: 'outro', label: '📝 Outro Motivo', desc: 'Especifique nas observações' },
];

export default function PosGiftModal({
  item,
  isOpen,
  onClose,
  onConfirm,
  onRemoveGift,
}: PosGiftModalProps) {
  const [selectedReason, setSelectedReason] = useState<GiftReason>('fidelidade_cliente');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) {
      setSelectedReason(item.giftReason || 'fidelidade_cliente');
      setNotes(item.giftNotes || '');
    }
  }, [item]);

  if (!item) return null;

  const originalPrice = (item.originalPrice || item.unitPrice) * item.quantity;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Conceder Cortesia / Brinde"
      description="O valor deste item será zerado no total da comanda e registrado para auditoria."
      size="md"
    >
      <div className="space-y-4 py-2">
        {/* Detalhes do Item */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Item Selecionado:</span>
            <p className="text-white font-bold text-xs">{item.productName}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Preço de Tabela:</span>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              R$ {originalPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Motivo Obrigatório */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block">
            Motivo da Concessão: <span className="text-emerald-400">*</span>
          </label>
          <div className="space-y-1.5">
            {REASONS.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedReason(r.id)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  selectedReason === r.id
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-xs font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold">{r.label}</div>
                <div className="text-[10px] text-slate-500">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1">
            Observações Adicionais (opcional):
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Combinado com cliente via WhatsApp devido a atraso..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs outline-none focus:border-emerald-500"
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 pt-2 border-t border-slate-800">
          {item.isGift && (
            <button
              type="button"
              onClick={onRemoveGift}
              className="py-2.5 px-3 bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Remover Brinde
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedReason, notes)}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Gift size={14} /> Confirmar Brinde
          </button>
        </div>
      </div>
    </Dialog>
  );
}
