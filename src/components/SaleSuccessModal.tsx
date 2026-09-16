'use client';
import React, { useEffect } from 'react';
import { Sale } from '@/lib/store';
import { CheckCircle2, Printer, Plus, X, Flame, Utensils, Truck, ShoppingBag, AlertCircle } from 'lucide-react';

interface SaleSuccessModalProps {
  sale: Sale;
  trocoInfo?: { valorRecebido: number; troco: number } | null;
  onClose: () => void;
  onPrintThermal?: () => void;
  onNewOrder: () => void;
  onViewHistory?: () => void;
}

export default function SaleSuccessModal({
  sale,
  trocoInfo,
  onClose,
  onPrintThermal,
  onNewOrder,
  onViewHistory
}: SaleSuccessModalProps) {
  // Atalhos de teclado: Enter / Space para Novo Atendimento, P para Imprimir, Esc para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (onPrintThermal) onPrintThermal();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onNewOrder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrintThermal, onNewOrder]);

  const shortId = sale.id.slice(0, 6).toUpperCase();
  const isPickupPending = sale.paymentStatus === 'pendente_retirada' || sale.paymentMethod === 'retirada';
  const totalBurgers = (sale.items || []).reduce((acc, i) => acc + i.quantity, 0);

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'dinheiro': return 'Dinheiro (Gaveta)';
      case 'pix': return 'PIX Instantâneo';
      case 'debito': return 'Cartão de Débito';
      case 'credito': return 'Cartão de Crédito';
      case 'ifood_online': return 'iFood Pago Online';
      case 'ifood_entrega': return 'iFood Cobrar Entrega';
      case 'consumo_funcionario': return 'Consumo de Equipe';
      case 'fiado_vip': return 'Fiado VIP (A Receber)';
      case 'retirada': return 'Pagar ao Retirar';
      default: return method.toUpperCase();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X size={18} />
        </button>

        {/* Topo / Header */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 size={32} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 block">
            Venda Concluída com Sucesso!
          </span>
          <h2 className="text-3xl font-black text-white font-mono tracking-tight">
            PEDIDO #{shortId}
          </h2>
        </div>

        {/* Identificação & Modalidade */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
              Modalidade
            </span>
            <span className="font-extrabold text-white flex items-center gap-1.5">
              {sale.orderType === 'mesa' && <><Utensils size={14} className="text-amber-400" /> Mesa</>}
              {sale.orderType === 'retirada' && <><ShoppingBag size={14} className="text-blue-400" /> Retirada</>}
              {sale.orderType === 'delivery' && <><Truck size={14} className="text-emerald-400" /> Delivery</>}
            </span>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
              Destino / Cliente
            </span>
            <span className="font-extrabold text-amber-300 truncate block">
              {sale.customerName || 'Balcão'}
            </span>
          </div>
        </div>

        {/* Informações Financeiras & Troco */}
        <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-slate-400 font-bold uppercase">Total do Pedido:</span>
            <span className="text-2xl font-black font-mono text-emerald-400">
              R$ {sale.total.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800/80 text-slate-300">
            <span>Forma de Pagamento:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">
              {getMethodLabel(sale.paidMethod || sale.paymentMethod)}
            </span>
          </div>

          {/* Destaque de Troco quando dinheiro */}
          {sale.paymentMethod === 'dinheiro' && trocoInfo && trocoInfo.troco >= 0 && (
            <div className="mt-2 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                  Valor Recebido: R$ {trocoInfo.valorRecebido.toFixed(2)}
                </span>
                <span className="text-xs font-black text-emerald-400">
                  DEVOLVER DE TROCO:
                </span>
              </div>
              <span className="text-2xl font-black font-mono text-emerald-300">
                R$ {trocoInfo.troco.toFixed(2)}
              </span>
            </div>
          )}

          {/* Alerta de Pagamento Pendente para Retirada */}
          {isPickupPending && (
            <div className="mt-2 p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-300">
              <AlertCircle size={18} className="shrink-0 text-amber-400" />
              <div>
                <strong className="block uppercase font-black tracking-wide">Pagamento Pendente</strong>
                <span>Cobrar <strong>R$ {sale.total.toFixed(2)}</strong> do cliente no momento da entrega.</span>
              </div>
            </div>
          )}
        </div>

        {/* Resumo de Produção (KDS) */}
        <div className="flex items-center justify-between text-xs px-3 py-2 bg-slate-950/50 rounded-xl border border-slate-800/60 text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Flame size={14} className="text-amber-400" /> Cozinha (KDS):
          </span>
          <span className="font-bold text-amber-300">
            {sale.productionStatus === 'em_producao' ? '🔥 Direto na Chapa' : '⏳ Na Fila da Cozinha'} ({totalBurgers} item/itens)
          </span>
        </div>

        {/* Ações Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          {onPrintThermal && (
            <button
              type="button"
              onClick={onPrintThermal}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-md"
              title="Atalho: Tecla P"
            >
              <Printer size={16} className="text-cyan-400" /> Imprimir Comanda (P)
            </button>
          )}

          <button
            type="button"
            onClick={onNewOrder}
            className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            title="Atalho: Tecla Enter"
          >
            <Plus size={16} /> Novo Atendimento (Enter)
          </button>
        </div>

        {onViewHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="w-full py-1.5 text-center text-slate-500 hover:text-slate-300 text-xs font-semibold cursor-pointer transition-colors block"
          >
            Ver Detalhes no Histórico de Vendas
          </button>
        )}
      </div>
    </div>
  );
}
