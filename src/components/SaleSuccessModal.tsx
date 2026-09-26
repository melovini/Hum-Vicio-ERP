'use client';
import React, { useEffect, useState } from 'react';
import { Sale } from '@/lib/store';
import { CheckCircle2, Printer, Plus, X, Flame, Utensils, Truck, ShoppingBag, AlertCircle, Eye, Check } from 'lucide-react';

interface SaleSuccessModalProps {
  sale: Sale;
  trocoInfo?: { valorRecebido: number; troco: number } | null;
  onClose: () => void;
  onPrintThermal?: () => void; // Ação rápida: Imprime cozinha diretamente (1 clique / P)
  onViewReceipt?: () => void; // Ação secundária: Visualizar Cupom / Outras Vias
  onNewOrder: () => void;
  onViewHistory?: () => void;
  isQuickPrinting?: boolean;
  quickPrintSuccess?: boolean;
}

export default function SaleSuccessModal({
  sale,
  trocoInfo,
  onClose,
  onPrintThermal,
  onViewReceipt,
  onNewOrder,
  onViewHistory,
  isQuickPrinting = false,
  quickPrintSuccess = false,
}: SaleSuccessModalProps) {
  const [hasTriggeredPrint, setHasTriggeredPrint] = useState(false);

  // Atalhos de teclado: P para Imprimir Cozinha, V para Visualizar, Enter para Novo Atendimento, Esc para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (onPrintThermal && !isQuickPrinting && !hasTriggeredPrint) {
          setHasTriggeredPrint(true);
          onPrintThermal();
        }
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        if (onViewReceipt) onViewReceipt();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onNewOrder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrintThermal, onViewReceipt, onNewOrder, isQuickPrinting, hasTriggeredPrint]);

  const handleQuickPrint = () => {
    if (isQuickPrinting || hasTriggeredPrint) return;
    setHasTriggeredPrint(true);
    onPrintThermal?.();
  };

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

        {/* Ações Principais (Despacho Rápido por 1 Botão & Novo Atendimento) */}
        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {onPrintThermal && (
              <button
                type="button"
                onClick={handleQuickPrint}
                disabled={isQuickPrinting || hasTriggeredPrint}
                className={`py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border transition-all shadow-md ${
                  quickPrintSuccess || hasTriggeredPrint
                    ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 cursor-default'
                    : isQuickPrinting
                      ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-wait'
                      : 'bg-slate-800 hover:bg-slate-700 hover:border-cyan-400 text-white border-slate-700 cursor-pointer'
                }`}
                title="Atalho: Tecla P"
              >
                {quickPrintSuccess || hasTriggeredPrint ? (
                  <>
                    <Check size={16} className="text-cyan-400" /> Comanda Despachada!
                  </>
                ) : isQuickPrinting ? (
                  <>
                    <Printer size={16} className="text-cyan-400 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Printer size={16} className="text-cyan-400" /> Imprimir Cozinha (P)
                  </>
                )}
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

          {/* Ação Secundária: Visualizar Cupom / Imprimir Outras Vias */}
          {onViewReceipt && (
            <button
              type="button"
              onClick={onViewReceipt}
              className="w-full py-2 px-3 bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Atalho: Tecla V"
            >
              <Eye size={14} className="text-slate-400" />
              <span>Visualizar Cupom / Imprimir Cliente (V)</span>
            </button>
          )}
        </div>

        {onViewHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="w-full py-1 text-center text-slate-500 hover:text-slate-400 text-xs font-semibold cursor-pointer transition-colors block"
          >
            Ver Detalhes no Histórico de Vendas
          </button>
        )}
      </div>
    </div>
  );
}
