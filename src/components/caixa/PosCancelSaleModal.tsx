'use client';
import React from 'react';
import { Dialog } from '@/components/ui';
import { Sale } from '@/lib/store';
import { ShieldAlert, AlertCircle } from 'lucide-react';

interface PosCancelSaleModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  onReasonChange: (val: string) => void;
  notes: string;
  onNotesChange: (val: string) => void;
  password: string;
  onPasswordChange: (val: string) => void;
  error: string;
  onConfirm: (e: React.FormEvent) => void;
}

export default function PosCancelSaleModal({
  sale,
  isOpen,
  onClose,
  reason,
  onReasonChange,
  notes,
  onNotesChange,
  password,
  onPasswordChange,
  error,
  onConfirm,
}: PosCancelSaleModalProps) {
  if (!sale) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Autorização de Estorno / Cancelamento"
      description="Esta ação estorna a venda, remove os lançamentos e exige senha gerencial auditável."
      size="md"
    >
      <form onSubmit={onConfirm} className="space-y-4 py-2">
        {/* Resumo da Venda */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Comanda / Pedido:</span>
            <strong className="font-mono text-white text-sm">#{sale.id.slice(0, 6).toUpperCase()}</strong>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Cliente:</span>
            <strong className="text-amber-400 uppercase">{sale.customerName || 'Consumidor'}</strong>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Total da Venda:</span>
            <strong className="font-mono text-emerald-400 text-sm">R$ {sale.total.toFixed(2)}</strong>
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Motivo do Cancelamento: <span className="text-rose-400">*</span>
          </label>
          <select
            value={reason}
            onChange={e => onReasonChange(e.target.value)}
            required
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-semibold outline-none focus:border-rose-500 cursor-pointer"
          >
            <option value="Desistência do cliente antes do preparo">Desistência do cliente antes do preparo</option>
            <option value="Erro de digitação / lançamento no PDV">Erro de digitação / lançamento no PDV</option>
            <option value="Lanche preparado errado / trocado">Lanche preparado errado / trocado</option>
            <option value="Problema no pagamento / recusado">Problema no pagamento / recusado</option>
            <option value="Cliente não aguardou tempo de espera">Cliente não aguardou tempo de espera</option>
            <option value="Outro motivo">Outro motivo</option>
          </select>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Observações Adicionais (opcional):
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Ex: Cliente solicitou reembolso imediato via PIX..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs outline-none focus:border-rose-500"
          />
        </div>

        {/* Senha do Supervisor */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Senha do Administrador / Supervisor: <span className="text-rose-400">*</span>
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            placeholder="Digite a senha de liberação"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-mono outline-none focus:border-rose-500"
          />
        </div>

        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-xs font-bold">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Voltar
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldAlert size={15} /> Confirmar Cancelamento
          </button>
        </div>
      </form>
    </Dialog>
  );
}
