'use client';
import React, { useState } from 'react';
import { Dialog } from '@/components/ui';
import { Sale } from '@/lib/store';
import { Banknote, DollarSign } from 'lucide-react';

interface PosSettlementModalProps {
  sale: Sale | null;
  mode: 'credit' | 'pickup' | null;
  onClose: () => void;
  defaultOperator: string;
  onConfirmSettleCredit: (saleId: string, method: string, operator: string) => Promise<void>;
  onConfirmSettlePickup: (saleId: string, method: string, operator: string) => Promise<void>;
}

export default function PosSettlementModal({
  sale,
  mode,
  onClose,
  defaultOperator,
  onConfirmSettleCredit,
  onConfirmSettlePickup,
}: PosSettlementModalProps) {
  const [method, setMethod] = useState('pix');
  const [operator, setOperator] = useState(defaultOperator);
  const [loading, setLoading] = useState(false);

  if (!sale || !mode) return null;

  const isCredit = mode === 'credit';
  const personName = isCredit
    ? (sale.creditCustomerName || sale.collaboratorName || sale.customerName || 'Cliente')
    : (sale.customerName || 'Balcão');

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (isCredit) {
        await onConfirmSettleCredit(sale.id, method, operator.trim() || defaultOperator || 'Operador');
      } else {
        await onConfirmSettlePickup(sale.id, method, operator.trim() || defaultOperator || 'Operador');
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={isCredit ? 'Liquidar Conta a Receber' : 'Receber Pagamento na Retirada'}
      description={`Comanda #${sale.id.slice(0, 6).toUpperCase()} • Titular: ${personName}`}
      size="md"
    >
      <div className="space-y-4 py-2">
        {/* Resumo da Cobrança */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Valor a Quitar:</span>
            <span className="text-xl font-mono font-black text-emerald-400">
              R$ {sale.total.toFixed(2)}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-bold font-mono text-[10px]">
            {isCredit ? (sale.paymentMethod === 'consumo_funcionario' ? 'Consumo Equipe' : 'Fiado VIP') : 'Retirada Balcão'}
          </span>
        </div>

        {/* Seleção do Método */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block">
            Forma de Pagamento Recebida: <span className="text-emerald-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {[
              { id: 'dinheiro', label: '💵 Dinheiro', hint: 'Entra na gaveta' },
              { id: 'pix', label: '⚡ PIX Direto', hint: 'Conta bancária' },
              { id: 'cartao_debito', label: '💳 Débito', hint: 'Maquininha' },
              { id: 'cartao_credito', label: '💳 Crédito', hint: 'Maquininha' },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  method === m.id
                    ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">{m.label}</div>
                <div className="text-[10px] text-slate-400">{m.hint}</div>
              </button>
            ))}
          </div>
          {method === 'dinheiro' && (
            <p className="text-[10px] text-emerald-400 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 mt-1">
              💡 R$ {sale.total.toFixed(2)} entrará como suprimento na gaveta do caixa atual.
            </p>
          )}
        </div>

        {/* Operador Responsável */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1">
            Operador Responsável pelo Recebimento:
          </label>
          <input
            type="text"
            value={operator}
            onChange={e => setOperator(e.target.value)}
            placeholder="Nome do operador"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs outline-none focus:border-emerald-500"
          />
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? 'Confirmando...' : 'Confirmar Quitação'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
