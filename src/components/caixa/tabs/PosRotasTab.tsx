'use client';
import React, { useState } from 'react';
import { Sale, ProductionStatus } from '@/lib/store';
import { DeliveryRouteBlock } from '@/lib/caixa-types';
import type { Collaborator } from '@/lib/collaborators';
import { ConfirmDialog } from '@/components/ui';
import { 
  Truck, Plus, Trash2, Check, CheckCircle2, 
  Flame, Printer, X, ShoppingCart as CartIcon 
} from 'lucide-react';

interface PosRotasTabProps {
  sales: Sale[];
  deliveryRoutes: DeliveryRouteBlock[];
  onSaveDeliveryRoutes: (routes: DeliveryRouteBlock[]) => void;
  unassignedDeliverySales: Sale[];
  collaboratorsList: Collaborator[];
  onPrintRouteManifest: (route: DeliveryRouteBlock) => void;
  onUpdateBatchProductionStatus: (ids: string[], status: ProductionStatus) => void;
  onMarkSalesAsDelivered: (ids: string[]) => void;
  onRemoveDeliveredSaleIds: (ids: string[]) => void;
  onShowToast: (msg: string, variant?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function PosRotasTab({
  sales,
  deliveryRoutes,
  onSaveDeliveryRoutes,
  unassignedDeliverySales,
  collaboratorsList,
  onPrintRouteManifest,
  onUpdateBatchProductionStatus,
  onMarkSalesAsDelivered,
  onRemoveDeliveredSaleIds,
  onShowToast,
}: PosRotasTabProps) {
  const [routeViewTab, setRouteViewTab] = useState<'ativas' | 'entregues'>('ativas');
  const [newCourierInput, setNewCourierInput] = useState('');
  const [selectedOrdersForRoute, setSelectedOrdersForRoute] = useState<string[]>([]);

  // Modais de confirmação acessíveis
  const [confirmDeleteRoute, setConfirmDeleteRoute] = useState<DeliveryRouteBlock | null>(null);
  const [confirmClearDelivered, setConfirmClearDelivered] = useState(false);
  const [confirmReopenRoute, setConfirmReopenRoute] = useState<DeliveryRouteBlock | null>(null);

  const handleCreateRoute = () => {
    const name = newCourierInput.trim();
    if (!name) {
      onShowToast('Informe ou selecione o nome do entregador para criar o bloco de rota.', 'warning');
      return;
    }

    const newBlock: DeliveryRouteBlock = {
      id: `rota_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      courierName: name,
      createdAt: new Date().toISOString(),
      status: 'montando',
      saleIds: selectedOrdersForRoute,
    };

    onSaveDeliveryRoutes([newBlock, ...deliveryRoutes]);
    setSelectedOrdersForRoute([]);
    setNewCourierInput('');
    onShowToast(`Bloco de rota criado para ${name}!`, 'success');
  };

  return (
    <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 space-y-6 shadow-lg">
      {/* Topo / Métricas Rápidas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Truck size={20} />
            </span>
            <h2 className="text-xl font-bold text-white">
              Gestão de Rotas & Entregadores
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Separe entregas por entregador, confira status de produção e despache viagens.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[9px] text-slate-400 uppercase font-black block">Sem Rota</span>
            <span className="text-base font-mono font-black text-amber-400">{unassignedDeliverySales.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[9px] text-slate-400 uppercase font-black block">Ativas</span>
            <span className="text-base font-mono font-black text-cyan-400">
              {deliveryRoutes.filter(r => r.status !== 'entregue').length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[9px] text-slate-400 uppercase font-black block">Em Trânsito</span>
            <span className="text-base font-mono font-black text-emerald-400">
              {deliveryRoutes.filter(r => r.status === 'em_rota').length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[9px] text-slate-400 uppercase font-black block">Concluídas</span>
            <span className="text-base font-mono font-black text-blue-400">
              {deliveryRoutes.filter(r => r.status === 'entregue').length}
            </span>
          </div>
        </div>
      </div>

      {/* Formulário de Criação de Bloco */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-2.5">
          <div className="w-full sm:w-1/3">
            <select
              value={newCourierInput}
              onChange={e => setNewCourierInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
            >
              <option value="">-- Escolha da Equipe ou Digite --</option>
              {collaboratorsList.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-2/3">
            <input
              type="text"
              placeholder="Ou digite o nome do entregador (ex: Carlos Moto 02)..."
              value={newCourierInput}
              onChange={e => setNewCourierInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateRoute}
          className="w-full md:w-auto py-2.5 px-5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all shrink-0"
        >
          <Plus size={15} /> Criar Bloco {selectedOrdersForRoute.length > 0 && `(${selectedOrdersForRoute.length} pedidos)`}
        </button>
      </div>

      {/* 2 Colunas: Sem Rota vs Blocos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Coluna Esquerda: Sem Rota */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wide flex items-center gap-1.5">
              <CartIcon size={15} className="text-amber-400" />
              Delivery sem Rota ({unassignedDeliverySales.length})
            </h3>
          </div>

          {unassignedDeliverySales.length === 0 ? (
            <div className="p-6 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-500 text-xs">
              Nenhum pedido de delivery aguardando rota no momento.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {unassignedDeliverySales.map(sale => {
                const isSelected = selectedOrdersForRoute.includes(sale.id);
                return (
                  <div
                    key={sale.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-xs'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 pb-2 mb-1.5 border-b border-slate-800/80">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedOrdersForRoute(prev => [...prev, sale.id]);
                            } else {
                              setSelectedOrdersForRoute(prev => prev.filter(id => id !== sale.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                        <div>
                          <span className="font-mono font-bold text-xs text-white">
                            #{sale.id.slice(0, 6).toUpperCase()}
                          </span>
                          <p className="font-bold text-xs text-slate-200 uppercase mt-0.5 truncate">
                            {sale.customerName || 'Cliente'}
                          </p>
                        </div>
                      </label>

                      <div className="text-right">
                        <span className="font-mono font-black text-xs text-emerald-400 block">
                          R$ {sale.total.toFixed(2)}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase inline-block ${
                          sale.productionStatus === 'concluido'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : sale.productionStatus === 'em_producao'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-300'
                        }`}>
                          {sale.productionStatus === 'concluido' ? '🛎️ Pronto' : sale.productionStatus === 'em_producao' ? '🔥 Chapa' : '⏳ Espera'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {sale.items?.map(i => `${i.quantity}x ${i.productName}`).join(' • ')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna Direita: Blocos de Rotas */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRouteViewTab('ativas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  routeViewTab === 'ativas'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Truck size={14} className="inline mr-1" /> Ativas ({deliveryRoutes.filter(r => r.status !== 'entregue').length})
              </button>
              <button
                type="button"
                onClick={() => setRouteViewTab('entregues')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  routeViewTab === 'entregues'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Check size={14} className="inline mr-1" /> Entregues ({deliveryRoutes.filter(r => r.status === 'entregue').length})
              </button>
            </div>

            {routeViewTab === 'entregues' && deliveryRoutes.some(r => r.status === 'entregue') && (
              <button
                type="button"
                onClick={() => setConfirmClearDelivered(true)}
                className="text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer underline flex items-center gap-1"
              >
                <Trash2 size={12} /> Limpar entregues
              </button>
            )}
          </div>

          {/* Lista de Rotas */}
          <div className="space-y-3">
            {deliveryRoutes
              .filter(r => routeViewTab === 'ativas' ? r.status !== 'entregue' : r.status === 'entregue')
              .map(route => {
                const routeSales = route.saleIds.map(id => sales.find(s => s.id === id)).filter(Boolean) as Sale[];
                const routeTotal = routeSales.reduce((sum, s) => sum + s.total, 0);

                return (
                  <div
                    key={route.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      route.status === 'em_rota'
                        ? 'bg-slate-900 border-cyan-500/70 shadow-md'
                        : route.status === 'entregue'
                          ? 'bg-slate-950/90 border-emerald-500/40'
                          : 'bg-slate-950/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                      <div>
                        <h4 className="font-bold text-sm text-white uppercase flex items-center gap-1.5">
                          <Truck size={16} className="text-cyan-400" /> {route.courierName}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {route.saleIds.length} comanda(s) • Total: R$ {routeTotal.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPrintRouteManifest(route)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                          title="Imprimir romaneio da rota"
                        >
                          <Printer size={13} /> Romaneio
                        </button>

                        {route.status === 'montando' && routeSales.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = deliveryRoutes.map(item => 
                                item.id === route.id ? { ...item, status: 'em_rota' as const, dispatchedAt: new Date().toISOString() } : item
                              );
                              onSaveDeliveryRoutes(updated);
                              onShowToast(`Rota de ${route.courierName} despachada com sucesso!`, 'success');
                            }}
                            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Despachar
                          </button>
                        )}

                        {route.status === 'em_rota' && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = deliveryRoutes.map(item => 
                                item.id === route.id ? { ...item, status: 'entregue' as const, deliveredAt: new Date().toISOString() } : item
                              );
                              onSaveDeliveryRoutes(updated);
                              onMarkSalesAsDelivered(route.saleIds);
                              onUpdateBatchProductionStatus(route.saleIds, 'concluido');
                              onShowToast(`Rota de ${route.courierName} finalizada com sucesso!`, 'success');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            <Check size={13} className="inline mr-1" /> Concluir
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoute(route)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer"
                          title="Excluir ou desfazer rota"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Comandas na rota */}
                    <div className="space-y-1">
                      {routeSales.map(sale => (
                        <div key={sale.id} className="flex justify-between items-center text-xs text-slate-300 py-1 border-b border-slate-900">
                          <span className="font-mono">#{sale.id.slice(0, 6).toUpperCase()} - {sale.customerName}</span>
                          <span className="font-mono font-bold text-emerald-400">R$ {sale.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* ConfirmDialog para Desfazer Rota */}
      <ConfirmDialog
        open={!!confirmDeleteRoute}
        title="Desfazer ou Excluir Bloco de Rota?"
        description={`Deseja desfazer a rota do entregador "${confirmDeleteRoute?.courierName}"? Os pedidos voltarão para a fila de disponíveis.`}
        confirmLabel="Confirmar Exclusão"
        cancelLabel="Voltar"
        tone="danger"
        onConfirm={() => {
          if (confirmDeleteRoute) {
            onSaveDeliveryRoutes(deliveryRoutes.filter(r => r.id !== confirmDeleteRoute.id));
            setConfirmDeleteRoute(null);
            onShowToast('Bloco de rota removido.', 'info');
          }
        }}
        onClose={() => setConfirmDeleteRoute(null)}
      />

      {/* ConfirmDialog para Limpar Entregues */}
      <ConfirmDialog
        open={confirmClearDelivered}
        title="Limpar Histórico de Rotas Entregues?"
        description="As rotas concluídas serão removidas desta lista. Os pedidos continuarão registrados como entregues no histórico contábil."
        confirmLabel="Limpar Entregues"
        cancelLabel="Cancelar"
        tone="warning"
        onConfirm={() => {
          onSaveDeliveryRoutes(deliveryRoutes.filter(r => r.status !== 'entregue'));
          setConfirmClearDelivered(false);
          onShowToast('Histórico de rotas concluídas limpo.', 'info');
        }}
        onClose={() => setConfirmClearDelivered(false)}
      />
    </div>
  );
}
