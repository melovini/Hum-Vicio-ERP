'use client';
import React, { useMemo } from 'react';
import { Sale, ProductionStatus } from '@/lib/store';
import { 
  Flame, Truck, Utensils, Printer, Play, 
  Pause, Edit3, DollarSign, AlertOctagon 
} from 'lucide-react';

interface PosProducaoTabProps {
  currentSessionSales: Sale[];
  productionFilter: 'todos' | 'em_espera' | 'agendado' | 'em_producao' | 'concluido';
  onProductionFilterChange: (filter: 'todos' | 'em_espera' | 'agendado' | 'em_producao' | 'concluido') => void;
  selectedOrdersForBatch: string[];
  onSelectedOrdersForBatchChange: (ids: string[]) => void;
  waitingOrders: Sale[];
  onUpdateBatchProductionStatus: (ids: string[], status: ProductionStatus) => void;
  onUpdateOrderProductionStatus: (id: string, status: ProductionStatus) => void;
  onStartReopenSale: (sale: Sale) => void;
  onPrintSale: (sale: Sale) => void;
  onSettlePickupPayment: (sale: Sale) => void;
  onPauseGrillOrder: (sale: Sale) => void;
  onNavigateToRotas: () => void;
}

export default function PosProducaoTab({
  currentSessionSales,
  productionFilter,
  onProductionFilterChange,
  selectedOrdersForBatch,
  onSelectedOrdersForBatchChange,
  waitingOrders,
  onUpdateBatchProductionStatus,
  onUpdateOrderProductionStatus,
  onStartReopenSale,
  onPrintSale,
  onSettlePickupPayment,
  onPauseGrillOrder,
  onNavigateToRotas,
}: PosProducaoTabProps) {
  const batchBurgersSummary = useMemo(() => {
    const selectedSales = currentSessionSales.filter(s => selectedOrdersForBatch.includes(s.id));
    let totalBurgers = 0;
    const itemsMap: Record<string, number> = {};

    selectedSales.forEach(s => {
      s.items?.forEach(i => {
        totalBurgers += i.quantity;
        itemsMap[i.productName] = (itemsMap[i.productName] || 0) + i.quantity;
      });
    });

    const summaryList = Object.entries(itemsMap)
      .map(([name, qty]) => `${qty}x ${name}`)
      .join(' • ');

    return { totalBurgers, summaryList };
  }, [currentSessionSales, selectedOrdersForBatch]);

  const filteredSales = useMemo(() => {
    return currentSessionSales.filter(s => {
      if (productionFilter === 'todos') return true;
      return (s.productionStatus || 'em_producao') === productionFilter;
    });
  }, [currentSessionSales, productionFilter]);

  return (
    <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 space-y-5 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Flame className="text-amber-500" /> Fila de Produção & Expedição
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Libere pedidos para a chapa da cozinha conforme as rotas e mesas.
          </p>
        </div>

        {/* Filtros de Produção */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'em_espera', label: '⏳ Em Espera' },
            { id: 'agendado', label: '📅 Agendados' },
            { id: 'em_producao', label: '🔥 Na Chapa' },
            { id: 'concluido', label: '✅ Concluídos' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onProductionFilterChange(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                productionFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onNavigateToRotas}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-all ml-1"
            title="Ir para o painel de rotas de entregadores"
          >
            <Truck size={14} /> Rotas ({currentSessionSales.filter(s => s.orderType === 'delivery').length})
          </button>
        </div>
      </div>

      {/* Remessa em Lote */}
      {waitingOrders.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedOrdersForBatch.length > 0 && selectedOrdersForBatch.length === waitingOrders.length}
                onChange={e => {
                  if (e.target.checked) {
                    onSelectedOrdersForBatchChange(waitingOrders.map(o => o.id));
                  } else {
                    onSelectedOrdersForBatchChange([]);
                  }
                }}
                className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
              <span>Selecionar todos em espera ({waitingOrders.length} pedidos)</span>
            </label>

            {selectedOrdersForBatch.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onUpdateBatchProductionStatus(selectedOrdersForBatch, 'em_producao');
                  onSelectedOrdersForBatchChange([]);
                }}
                className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                <Flame size={15} /> Enviar Remessa ({selectedOrdersForBatch.length} Pedidos)
              </button>
            )}
          </div>

          {selectedOrdersForBatch.length > 0 && (
            <div className="pt-2 border-t border-amber-500/20 flex items-start gap-2 text-xs text-amber-300">
              <Utensils size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>Total da remessa ({batchBurgersSummary.totalBurgers} lanches):</strong> {batchBurgersSummary.summaryList}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Grid de Pedidos */}
      {filteredSales.length === 0 ? (
        <div className="py-14 text-center text-slate-500">
          <Flame size={40} className="mx-auto mb-2 opacity-20 text-amber-500" />
          <p className="text-xs">Nenhum pedido nesta etapa de produção no turno ativo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredSales.map(sale => {
            const status = sale.productionStatus || 'em_producao';
            const isWaiting = status === 'em_espera' || status === 'agendado';
            const isCooking = status === 'em_producao';
            const isDone = status === 'concluido';

            return (
              <div
                key={sale.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isCooking
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-md'
                    : isWaiting
                      ? selectedOrdersForBatch.includes(sale.id)
                        ? 'bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/50'
                        : 'bg-slate-950/70 border-slate-800'
                      : 'bg-emerald-950/15 border-emerald-500/30'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start pb-2 mb-2 border-b border-slate-800/80">
                    <div className="flex items-start gap-2.5">
                      {isWaiting && (
                        <input
                          type="checkbox"
                          checked={selectedOrdersForBatch.includes(sale.id)}
                          onChange={() => {
                            if (selectedOrdersForBatch.includes(sale.id)) {
                              onSelectedOrdersForBatchChange(selectedOrdersForBatch.filter(id => id !== sale.id));
                            } else {
                              onSelectedOrdersForBatchChange([...selectedOrdersForBatch, sale.id]);
                            }
                          }}
                          className="w-4 h-4 mt-0.5 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-white text-sm">
                            #{sale.id.slice(0, 6).toUpperCase()}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            isCooking
                              ? 'bg-amber-500 text-slate-950'
                              : isWaiting
                                ? status === 'agendado' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'
                                : 'bg-emerald-600 text-white'
                          }`}>
                            {isCooking ? '🔥 NA CHAPA' : isWaiting ? (status === 'agendado' ? '📅 AGENDADO' : '⏳ EM ESPERA') : '✅ CONCLUÍDO'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-amber-300 mt-0.5 uppercase">
                          {sale.customerName || 'Cliente'}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {sale.orderType?.toUpperCase() || 'BALCÃO'} • {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onPrintSale(sale)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer"
                      title="Imprimir comanda"
                    >
                      <Printer size={14} />
                    </button>
                  </div>

                  {/* Itens */}
                  <div className="space-y-1 my-1.5">
                    {sale.items?.map((i, idx) => (
                      <div key={idx} className="text-xs text-slate-200 flex justify-between">
                        <span>[{i.quantity}x] {i.productName}</span>
                        {i.combo && <span className="text-[10px] text-amber-400 pl-2">+{i.combo}</span>}
                      </div>
                    ))}
                  </div>

                  {sale.delayReason && (
                    <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-300 mt-2">
                      <p className="font-bold flex items-center gap-1">
                        <AlertOctagon size={12} className="text-rose-400" />
                        Justificativa: {sale.delayReason}
                      </p>
                      {sale.delayNotes && <p className="italic text-[10px]">{sale.delayNotes}</p>}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="pt-2 border-t border-slate-800/80 flex gap-1.5">
                  {isWaiting && (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateOrderProductionStatus(sale.id, 'em_producao')}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                      >
                        <Play size={13} /> Liberar p/ Chapa
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartReopenSale(sale)}
                        className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all shrink-0"
                        title="Editar pedido"
                      >
                        <Edit3 size={13} /> Editar
                      </button>
                    </>
                  )}

                  {isCooking && (
                    <>
                      <button
                        type="button"
                        onClick={() => onPauseGrillOrder(sale)}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <Pause size={13} /> Pausar p/ Espera
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartReopenSale(sale)}
                        className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all shrink-0"
                        title="Alterar pedido"
                      >
                        <Edit3 size={13} /> Alterar
                      </button>
                    </>
                  )}

                  {isDone && (
                    <div className="w-full space-y-1.5">
                      <div className="w-full text-center py-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/40 rounded-xl border border-emerald-500/20">
                        {sale.orderType === 'retirada' ? '🥡 Pronto no Balcão' : 'Pronto para Servir / Despacho'}
                      </div>
                      {sale.orderType === 'retirada' && sale.paymentStatus === 'pendente_retirada' && (
                        <button
                          type="button"
                          onClick={() => onSettlePickupPayment(sale)}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-all"
                        >
                          <DollarSign size={13} /> Receber Pagamento (R$ {sale.total.toFixed(2)})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
