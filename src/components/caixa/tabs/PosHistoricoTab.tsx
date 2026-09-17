'use client';
import React, { useState, useMemo } from 'react';
import { Sale } from '@/lib/store';
import { 
  Printer, XCircle, Edit3, DollarSign, 
  FileCheck2, AlertCircle, ShoppingBag 
} from 'lucide-react';

interface PosHistoricoTabProps {
  sales: Sale[];
  currentSessionSales: Sale[];
  onPrintSale: (sale: Sale) => void;
  onCancelSaleClick: (sale: Sale) => void;
  onStartReopenSale: (sale: Sale) => void;
  onSettlePickupPayment: (sale: Sale) => void;
}

export default function PosHistoricoTab({
  sales,
  currentSessionSales,
  onPrintSale,
  onCancelSaleClick,
  onStartReopenSale,
  onSettlePickupPayment,
}: PosHistoricoTabProps) {
  const [historyScope, setHistoryScope] = useState<'turno' | 'todos'>('turno');
  const [historyLimit, setHistoryLimit] = useState(30);

  const fullHistorySales = useMemo(() => {
    return historyScope === 'turno' ? currentSessionSales : sales;
  }, [historyScope, currentSessionSales, sales]);

  const displayedHistorySales = useMemo(() => {
    return fullHistorySales.slice(0, historyLimit);
  }, [fullHistorySales, historyLimit]);

  return (
    <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 space-y-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="text-blue-400" /> Histórico de Pedidos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Visualize, reimprima comandas ou solicite cancelamento com senha gerencial.
          </p>
        </div>

        {/* Escopo: Turno vs Geral */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setHistoryScope('turno');
              setHistoryLimit(30);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              historyScope === 'turno'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Turno Atual ({currentSessionSales.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setHistoryScope('todos');
              setHistoryLimit(30);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              historyScope === 'todos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Histórico Geral ({sales.length})
          </button>
        </div>
      </div>

      {displayedHistorySales.length === 0 ? (
        <div className="py-14 text-center text-slate-500">
          <p className="text-xs">
            {historyScope === 'turno' ? 'Nenhum pedido no turno ativo até agora.' : 'Nenhuma comanda registrada no sistema.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedHistorySales.map(sale => {
            const isCancelled = sale.status === 'cancelled';
            return (
              <div
                key={sale.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isCancelled
                    ? 'bg-rose-950/10 border-rose-500/20 opacity-70'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2 pb-2 border-b border-slate-900">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                      isCancelled ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isCancelled ? 'Estornado' : 'Concluído'}
                    </span>
                    <span className="font-mono font-bold text-xs text-white">
                      #{sale.id.slice(0, 6).toUpperCase()}
                    </span>
                    <span className="font-bold text-xs text-amber-300 uppercase">
                      {sale.customerName || 'Cliente Balcão'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                      {sale.orderType?.toUpperCase() || 'BALCÃO'}
                    </span>
                    {sale.fiscalNfceNumber && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 flex items-center gap-1">
                        <FileCheck2 size={11} /> NFC-e #{sale.fiscalNfceNumber}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-emerald-400">
                      R$ {sale.total.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.paymentMethod}
                    </span>
                  </div>
                </div>

                {/* Itens */}
                <div className="text-xs text-slate-300 space-y-0.5 py-1">
                  {sale.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.quantity}x {item.productName}</span>
                      <span className="font-mono text-slate-400">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Ações */}
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPrintSale(sale)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Reimprimir comanda"
                    >
                      <Printer size={13} /> Reimprimir
                    </button>
                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => onStartReopenSale(sale)}
                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Reabrir pedido para edição de itens"
                      >
                        <Edit3 size={13} /> Editar
                      </button>
                    )}
                    {sale.orderType === 'retirada' && sale.paymentStatus === 'pendente_retirada' && (
                      <button
                        type="button"
                        onClick={() => onSettlePickupPayment(sale)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black uppercase flex items-center gap-1 cursor-pointer"
                      >
                        <DollarSign size={13} /> Receber
                      </button>
                    )}
                  </div>

                  {!isCancelled && (
                    <button
                      type="button"
                      onClick={() => onCancelSaleClick(sale)}
                      className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <XCircle size={13} /> Estornar
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {fullHistorySales.length > historyLimit && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setHistoryLimit(prev => prev + 30)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Carregar Mais Comandas ({fullHistorySales.length - historyLimit} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
