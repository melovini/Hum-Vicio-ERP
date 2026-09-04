'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useInventory, Sale, DelayReason, InventoryItem, ChecklistTask } from '@/lib/store';
import { 
  ChefHat, AlertTriangle, CheckCircle, Trash2, 
  Flame, Clock, Calendar, AlertOctagon,
  Eye, Check, ListChecks, MessageSquare, Utensils,
  Volume2, BellRing, User, X, Play
} from 'lucide-react';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import { playKitchenChime, playCancellationWarning } from '@/lib/audio';
import { getActiveCollaborators, Collaborator } from '@/lib/collaborators';

export default function CozinhaKDSPage() {
  const { 
    sales, items, updateStatus, isLoaded, 
    checklist, toggleChecklistTask, signChecklist,
    targetPrepMinutes, completeOrderProduction, updateOrderProductionStatus, updateBatchProductionStatus,
    acknowledgeOrderModification,
    activeCashSession, isOpen
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'chapa' | 'previsao' | 'faltas' | 'checklist'>('chapa');
  const [now, setNow] = useState(Date.now());

  // Horário de abertura do turno ativo para isolamento estrito
  const sessionStartTime = useMemo(() => {
    if (!activeCashSession || !isOpen) return 0;
    return new Date(activeCashSession.openedAt).getTime();
  }, [activeCashSession, isOpen]);

  // Atribuição de Colaboradores em Tarefas do Checklist
  const [selectedTaskForAssignment, setSelectedTaskForAssignment] = useState<ChecklistTask | null>(null);
  const [collaboratorsList, setCollaboratorsList] = useState<Collaborator[]>([]);

  useEffect(() => {
    setCollaboratorsList(getActiveCollaborators());
  }, []);

  // Alerta Sonoro & Visual na Cozinha
  const [kitchenAlert, setKitchenAlert] = useState<{ type: 'new_order' | 'cancelled'; message: string } | null>(null);
  const prevProductionIdsRef = useRef<Set<string>>(new Set());
  const prevModifiedOrdersRef = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);

  // Modal de Justificativa de Atraso
  const [selectedDelayedSale, setSelectedDelayedSale] = useState<Sale | null>(null);
  const [selectedReason, setSelectedReason] = useState<DelayReason>('erro_producao');
  const [delayNotes, setDelayNotes] = useState('');
  const [isSubmittingDelay, setIsSubmittingDelay] = useState(false);

  // Timer ao vivo para o cronômetro da chapa (atualiza a cada segundo)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitorar novas remessas liberadas para a chapa, cancelamentos e alterações em pedidos no fogo
  useEffect(() => {
    if (!activeCashSession || !isOpen || sessionStartTime === 0) {
      prevProductionIdsRef.current = new Set();
      prevModifiedOrdersRef.current = new Set();
      return;
    }

    const currentProductionIds = new Set(
      sales
        .filter(s => s.status !== 'cancelled' && s.productionStatus === 'em_producao' && new Date(s.date).getTime() >= sessionStartTime)
        .map(s => s.id)
    );

    const currentModifiedCookingIds = new Set(
      sales
        .filter(s => s.status !== 'cancelled' && s.productionStatus === 'em_producao' && s.isModifiedInKitchen && new Date(s.date).getTime() >= sessionStartTime)
        .map(s => s.id)
    );

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevProductionIdsRef.current = currentProductionIds;
      prevModifiedOrdersRef.current = currentModifiedCookingIds;
      return;
    }

    // 1. Verificar se novos pedidos entraram na chapa (nova remessa ou remessa em lote)
    const newlyAddedOrders: Sale[] = [];
    currentProductionIds.forEach(id => {
      if (!prevProductionIdsRef.current.has(id)) {
        const found = sales.find(s => s.id === id);
        if (found) newlyAddedOrders.push(found);
      }
    });

    if (newlyAddedOrders.length > 0) {
      playKitchenChime();
      let totalNewBurgers = 0;
      newlyAddedOrders.forEach(o => {
        o.items?.forEach(i => { totalNewBurgers += i.quantity; });
      });

      if (newlyAddedOrders.length === 1) {
        setKitchenAlert({
          type: 'new_order',
          message: `🔔 NOVA REMESSA NA CHAPA: Pedido #${newlyAddedOrders[0].id.slice(0, 5).toUpperCase()} (${newlyAddedOrders[0].customerName || 'Cliente'}) - ${totalNewBurgers} lanche(s)!`
        });
      } else {
        setKitchenAlert({
          type: 'new_order',
          message: `🔔 REMESSA EM LOTE: ${newlyAddedOrders.length} PEDIDOS LIBERADOS COM ${totalNewBurgers} HAMBÚRGUERES NO FOGO!`
        });
      }
      setTimeout(() => setKitchenAlert(null), 8000);
    }

    // 2. Verificar se algum pedido que estava na chapa foi cancelado ou pausado
    let removedOrder: Sale | undefined;
    prevProductionIdsRef.current.forEach(prevId => {
      if (!currentProductionIds.has(prevId)) {
        const found = sales.find(s => s.id === prevId);
        if (found && (found.status === 'cancelled' || found.productionStatus === 'em_espera')) {
          removedOrder = found;
        }
      }
    });

    if (removedOrder) {
      playCancellationWarning();
      setKitchenAlert({
        type: 'cancelled',
        message: `⚠️ ATENÇÃO CHAPA: Pedido #${removedOrder.id.slice(0, 5).toUpperCase()} (${removedOrder.customerName || 'Cliente'}) foi RETIRADO / CANCELADO pelo Balcão! Não preparar!`
      });
      setTimeout(() => setKitchenAlert(null), 10000);
    }

    // 3. Verificar se algum pedido atualmente em produção sofreu alteração no caixa
    const newlyModifiedOrders: Sale[] = [];
    currentModifiedCookingIds.forEach(id => {
      if (!prevModifiedOrdersRef.current.has(id)) {
        const found = sales.find(s => s.id === id);
        if (found) newlyModifiedOrders.push(found);
      }
    });

    if (newlyModifiedOrders.length > 0) {
      playCancellationWarning();
      const firstMod = newlyModifiedOrders[0];
      setKitchenAlert({
        type: 'cancelled',
        message: `⚠️ PEDIDO ALTERADO NA CHAPA: Comanda #${firstMod.id.slice(0, 5).toUpperCase()} (${firstMod.customerName || 'Cliente'}) sofreu alterações no Caixa! Verifique o card destacado!`
      });
      setTimeout(() => setKitchenAlert(null), 12000);
    }

    prevProductionIdsRef.current = currentProductionIds;
    prevModifiedOrdersRef.current = currentModifiedCookingIds;
  }, [sales, activeCashSession, isOpen, sessionStartTime]);

  // 1. Pedidos Ativos na Chapa (Em Produção - Apenas do Turno de Caixa Ativo)
  const productionOrders = useMemo(() => {
    if (!activeCashSession || !isOpen) return [];
    return sales
      .filter(s => {
        if (s.status !== 'completed' || s.productionStatus !== 'em_producao') return false;
        if (sessionStartTime > 0 && new Date(s.date).getTime() < sessionStartTime) return false;
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.productionStartedAt || a.date).getTime();
        const timeB = new Date(b.productionStartedAt || b.date).getTime();
        return timeA - timeB; // Mais antigos primeiro
      });
  }, [sales, activeCashSession, isOpen, sessionStartTime]);

  // Resumo de Hambúrgueres na Chapa no Momento
  const currentGrillBurgersSummary = useMemo(() => {
    let total = 0;
    const map: Record<string, number> = {};
    productionOrders.forEach(o => {
      o.items?.forEach(i => {
        total += i.quantity;
        map[i.productName] = (map[i.productName] || 0) + i.quantity;
      });
    });
    return {
      total,
      items: Object.entries(map).map(([name, qty]) => `${qty}x ${name}`).join(' • ')
    };
  }, [productionOrders]);

  // 2. Pedidos em Espera ou Agendados (Previsão de Demanda - Apenas do Turno de Caixa Ativo)
  const queueOrders = useMemo(() => {
    if (!activeCashSession || !isOpen) return [];
    return sales
      .filter(s => {
        if (s.status !== 'completed') return false;
        if (s.productionStatus !== 'em_espera' && s.productionStatus !== 'agendado') return false;
        if (sessionStartTime > 0 && new Date(s.date).getTime() < sessionStartTime) return false;
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, activeCashSession, isOpen, sessionStartTime]);

  // 2b. Pedidos que PODEM ser puxados para a chapa automaticamente:
  //     Apenas mesa e retirada. Delivery fica em espera aguardando rota do entregador.
  const pullableQueueOrders = useMemo(() => {
    return queueOrders.filter(s => s.orderType === 'mesa' || s.orderType === 'retirada');
  }, [queueOrders]);

  // 3. Previsão Agregada de Insumos/Molhos dos Próximos Pedidos
  const upcomingPrepSummary = useMemo(() => {
    const productCounts: Record<string, number> = {};
    const additionalsCounts: Record<string, number> = {};
    const notesSummary: string[] = [];

    queueOrders.forEach(o => {
      o.items?.forEach(item => {
        productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity;
        
        item.additionals?.forEach(add => {
          additionalsCounts[add.name] = (additionalsCounts[add.name] || 0) + item.quantity;
        });

        if (item.notes) {
          notesSummary.push(`[${o.customerName || 'Cliente'}]: ${item.notes}`);
        }
      });
    });

    return {
      productCounts,
      additionalsCounts,
      notesSummary,
      totalBurgers: Object.values(productCounts).reduce((a, b) => a + b, 0)
    };
  }, [queueOrders]);

  // 4. Concluir pedido com verificação de atraso
  const handleConcludeClick = (sale: Sale, isDelayed: boolean) => {
    if (isDelayed) {
      setSelectedDelayedSale(sale);
      setSelectedReason('erro_producao');
      setDelayNotes('');
    } else {
      completeOrderProduction(sale.id);
    }
  };

  const handleConfirmDelayAndComplete = async () => {
    if (!selectedDelayedSale) return;
    setIsSubmittingDelay(true);
    await completeOrderProduction(selectedDelayedSale.id, selectedReason, delayNotes.trim() || undefined);
    setIsSubmittingDelay(false);
    setSelectedDelayedSale(null);
  };

  // Atalhos de Teclado Físicos (Bumper Bar Industrial / Operação sem mouse ou com luvas sujas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em input ou textarea
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      // [Espaço]: Puxa o pedido mais antigo da fila (Mesa/Retirada) para a chapa
      // Delivery fica bloqueado pois aguarda rota do entregador
      if (e.code === 'Space') {
        e.preventDefault();
        if (pullableQueueOrders.length > 0) {
          const nextOrder = pullableQueueOrders[0];
          updateOrderProductionStatus(nextOrder.id, 'em_producao');
          playKitchenChime();
        }
        return;
      }

      // [1] a [9]: Conclui o lanche correspondente na chapa
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        if (index < productionOrders.length) {
          e.preventDefault();
          const targetOrder = productionOrders[index];
          const startTime = new Date(targetOrder.productionStartedAt || targetOrder.date).getTime();
          const elapsedMinutes = Math.floor(Math.max(0, Date.now() - startTime) / 60000);
          const targetMin = targetOrder.targetPrepMinutes || targetPrepMinutes || 20;
          handleConcludeClick(targetOrder, elapsedMinutes >= targetMin);
        }
        return;
      }

      // [P] ou [p]: Atalho para Lançar Perda / Descarte
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        window.location.href = '/cozinha/perdas';
        return;
      }

      // [T] ou [t]: Alternar abas
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setActiveTab(prev => {
          if (prev === 'chapa') return 'previsao';
          if (prev === 'previsao') return 'faltas';
          if (prev === 'faltas') return 'checklist';
          return 'chapa';
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueOrders, productionOrders, updateOrderProductionStatus, completeOrderProduction, targetPrepMinutes]);

  // Agrupar itens do Painel de Faltas
  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      let rawCat = (item.category || 'Geral').trim().toLowerCase();
      const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, InventoryItem[]>);
  }, [items]);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 select-none">
      
      {/* HEADER KDS TABLET */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
        
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Flame size={28} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg md:text-xl tracking-wider uppercase text-white">
                HUM VÍCIO HAMBURGUERIA
              </span>
              <span className="px-2 py-0.5 bg-red-600 text-white font-black text-[10px] rounded uppercase tracking-widest">
                KDS CHAPA
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <p className="text-xs text-slate-400">
                Tempo Alvo: <strong className="text-amber-400 font-mono">{targetPrepMinutes} min</strong> • {productionOrders.length} na chapa
              </p>
              {isOpen && activeCashSession ? (
                <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Turno Aberto: {activeCashSession.openedBy || 'Balcão'} ({new Date(activeCashSession.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-rose-950/80 text-rose-300 border border-rose-500/40 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Caixa Fechado (Aguardando Abertura)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE MÓDULOS DA COZINHA */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('chapa')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'chapa'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Flame size={16} /> Chapa Ativa ({productionOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('previsao')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'previsao'
                ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Eye size={16} /> Fila Futura & Previsão ({queueOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faltas')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'faltas'
                ? 'bg-amber-600 text-white font-black shadow-lg shadow-amber-600/30'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <AlertTriangle size={16} /> Faltas de Insumos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'checklist'
                ? 'bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <ListChecks size={16} /> Checklist
          </button>

          <Link
            href="/cozinha/perdas"
            className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all"
          >
            <Trash2 size={16} /> Lançar Perdas
          </Link>

          <button
            type="button"
            onClick={() => playKitchenChime()}
            className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            title="Clique para testar o som do KDS e habilitar áudio no navegador"
          >
            <Volume2 size={15} /> Som KDS
          </button>

          <LogoutButton />
        </div>

      </header>

      {/* ALERTA VISUAL DE NOVA REMESSA OU CANCELAMENTO NA CHAPA */}
      {kitchenAlert && (
        <div className={`mb-6 p-4 md:p-5 rounded-2xl border-2 flex items-center justify-between gap-4 animate-bounce shadow-2xl ${
          kitchenAlert.type === 'new_order'
            ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-500/30'
            : 'bg-red-950/95 border-red-500 text-red-100 shadow-red-500/40 ring-4 ring-red-500/50'
        }`}>
          <div className="flex items-center gap-3">
            {kitchenAlert.type === 'new_order' ? (
              <BellRing size={30} className="text-emerald-400 animate-pulse shrink-0" />
            ) : (
              <AlertOctagon size={34} className="text-red-400 animate-pulse shrink-0" />
            )}
            <div>
              <p className="font-black text-sm md:text-base uppercase tracking-wide">
                {kitchenAlert.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setKitchenAlert(null)}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold cursor-pointer shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* BARRA DE ATALHOS INDUSTRIAIS (BUMPER BAR) */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-2.5 px-4 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <span>⌨️ Bumper Bar Industrial (Operação sem Mouse):</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-slate-300 text-[11px]">
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-black">ESPAÇO</kbd>
            Puxar p/ Chapa ({queueOrders.length})
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-black">1..9</kbd>
            Concluir Lanche da Chapa
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-red-400 font-black">P</kbd>
            Lançar Descarte
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-black">T</kbd>
            Alternar Abas
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: CHAPA ATIVA (KDS TEMPO REAL) */}
      {/* ========================================================================= */}
      {activeTab === 'chapa' && (
        <div>
          {/* BANNER TOUCH AMIGÁVEL P/ TABLET: PEDIDOS NA FILA DE ESPERA / PRÓXIMOS */}
          {queueOrders.length > 0 && (
            <div className="mb-6 p-4 md:p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-red-500/20 border-2 border-amber-500/50 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl font-black shrink-0 shadow-lg shadow-amber-500/30">
                  <Clock size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white text-base md:text-lg">
                      {queueOrders.length} pedido(s) aguardando na fila
                    </span>
                    {pullableQueueOrders.length > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-black text-xs rounded-full animate-pulse">
                        {pullableQueueOrders.length} p/ chapa
                      </span>
                    )}
                    {queueOrders.filter(o => o.orderType === 'delivery').length > 0 && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-bold text-xs rounded-full border border-blue-500/40">
                        🛵 {queueOrders.filter(o => o.orderType === 'delivery').length} aguardando rota
                      </span>
                    )}
                  </div>
                  {pullableQueueOrders.length > 0 && (
                    <p className="text-xs text-amber-200 mt-1 font-semibold">
                      Próximo: #{pullableQueueOrders[0].id.slice(0, 5).toUpperCase()} — {pullableQueueOrders[0].customerName || 'Cliente'} • {pullableQueueOrders[0].items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {pullableQueueOrders.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        updateOrderProductionStatus(pullableQueueOrders[0].id, 'em_producao');
                        playKitchenChime();
                      }}
                      className="flex-1 md:flex-initial py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-95 transition-all"
                    >
                      <Flame size={18} /> Puxar Próximo p/ Chapa
                    </button>
                    {pullableQueueOrders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          updateBatchProductionStatus(pullableQueueOrders.map(o => o.id), 'em_producao');
                          playKitchenChime();
                        }}
                        className="flex-1 md:flex-initial py-3 px-4 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <Play size={16} /> Puxar Mesa/Retirada ({pullableQueueOrders.length})
                      </button>
                    )}
                  </>
                ) : (
                  <div className="px-4 py-2.5 bg-blue-950/50 border border-blue-500/30 text-blue-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                    🛵 Todos os pedidos na fila são delivery — aguardam rota
                  </div>
                )}
              </div>
            </div>
          )}

          {!isOpen || !activeCashSession ? (
            <div className="glass-card rounded-3xl p-16 text-center border border-rose-500/30 bg-rose-950/10 my-8 shadow-2xl">
              <div className="w-20 h-20 mx-auto bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mb-4">
                <AlertOctagon size={44} />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-2">Caixa Fechado</h2>
              <p className="text-slate-400 max-w-lg mx-auto text-sm">
                Nenhum turno de caixa aberto no momento. Abra o caixa no terminal do Balcão/PDV para iniciar novos pedidos e liberar a chapa da cozinha.
              </p>
            </div>
          ) : productionOrders.length === 0 ? (
            <div className="glass-card rounded-3xl p-16 text-center border border-slate-800 my-8">
              <div className="w-20 h-20 mx-auto bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={44} />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-2">Chapa Limpa & Organizada!</h2>
              <p className="text-slate-400 max-w-md mx-auto text-sm">
                Nenhum pedido aguardando preparo na chapa neste momento. Aproveite para conferir a aba de <strong>Fila Futura & Previsão</strong> para adiantar maioneses e porções.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumo Consolidado de Carnes para a Chapa */}
              <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-red-500/20 border-2 border-amber-500/40 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl font-black shrink-0 shadow-lg shadow-amber-500/30">
                    <Flame size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-base md:text-xl uppercase tracking-wide">
                        Total na Chapa: {currentGrillBurgersSummary.total} Hambúrgueres
                      </span>
                      <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 font-black text-xs rounded-full">
                        {productionOrders.length} comanda(s)
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-amber-200 mt-1 font-semibold">
                      {currentGrillBurgersSummary.items || 'Nenhum lanche'}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-300 font-bold bg-slate-950/70 px-4 py-2.5 rounded-2xl border border-slate-800 shrink-0 text-center">
                  🍔 Jogue as carnes na chapa conforme o total acima!
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {productionOrders.map((order, orderIdx) => {
                const startTime = new Date(order.productionStartedAt || order.date).getTime();
                const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
                const elapsedMinutes = Math.floor(elapsedSeconds / 60);
                const secondsRemainder = elapsedSeconds % 60;
                const formattedTimer = `${String(elapsedMinutes).padStart(2, '0')}:${String(secondsRemainder).padStart(2, '0')}`;

                const target = order.targetPrepMinutes || targetPrepMinutes || 20;
                const isDelayed = elapsedMinutes >= target;
                const isWarning = !isDelayed && elapsedMinutes >= Math.floor(target * 0.75);

                return (
                  <div
                    key={order.id}
                    className={`rounded-3xl p-5 border-2 flex flex-col justify-between transition-all shadow-xl ${
                      isDelayed
                        ? 'bg-red-950/40 border-red-500 ring-2 ring-red-500/50 animate-pulse'
                        : isWarning
                          ? 'bg-amber-950/25 border-amber-500/70'
                          : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Topo do Card: Pedido #, Modalidade e Cronômetro */}
                      <div className="flex justify-between items-start pb-3 mb-3 border-b border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xl text-white">
                              #{order.id.slice(0, 5).toUpperCase()}
                            </span>
                            {orderIdx < 9 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700 font-mono font-black text-[11px]" title={`Pressione a tecla ${orderIdx + 1} para concluir`}>
                                [{orderIdx + 1}]
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              order.orderType === 'delivery' 
                                ? 'bg-blue-600 text-white' 
                                : order.orderType === 'retirada' 
                                  ? 'bg-amber-600 text-white' 
                                  : 'bg-emerald-600 text-white'
                            }`}>
                              {order.orderType === 'delivery' 
                                ? (order.channel === 'ifood' ? '🛵 IFOOD ENTREGA' : '🛵 DELIVERY') 
                                : order.orderType === 'retirada' 
                                  ? (order.channel === 'ifood' ? '🥡 IFOOD RETIRADA' : '🥡 RETIRADA') 
                                  : '🍽️ MESA'}
                            </span>
                            {order.isModifiedInKitchen ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white animate-pulse border border-red-400 shadow-md">
                                ⚠️ ALTERAÇÃO PENDENTE
                              </span>
                            ) : order.orderDiff ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-amber-300 border border-amber-500/30">
                                📝 MODIFICADO (CIENTE)
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm font-extrabold text-amber-300 mt-1 uppercase">
                            {order.customerName || 'Cliente'}
                          </p>
                        </div>

                        {/* Cronômetro */}
                        <div className={`text-right px-3 py-1.5 rounded-2xl font-mono ${
                          isDelayed
                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/50'
                            : isWarning
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'bg-slate-800 text-slate-200'
                        }`}>
                          <div className="flex items-center gap-1.5 text-lg font-black tracking-wider">
                            <Clock size={16} /> {formattedTimer}
                          </div>
                          <span className="text-[10px] font-bold block uppercase tracking-tighter">
                            {isDelayed ? `ATRASADO (+${elapsedMinutes - target}m)` : `Meta: ${target}m`}
                          </span>
                        </div>
                      </div>

                      {/* NOME DO CLIENTE EM DESTAQUE MÁXIMO PARA IDENTIFICAÇÃO NA EMBALAGEM */}
                      <div className="mb-3.5 p-3 rounded-2xl bg-amber-500/15 border-2 border-amber-500/60 shadow-inner flex items-center gap-3">
                        <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-black shrink-0 shadow-md">
                          <User size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 block">
                            Escrever na Embalagem:
                          </span>
                          <p className="text-lg md:text-xl font-black text-white uppercase tracking-wide truncate">
                            {order.customerName || 'CLIENTE BALCÃO'}
                          </p>
                        </div>
                      </div>

                      {/* Callout de Pedido Modificado (Delta Diff) */}
                      {order.orderDiff && (
                        <div className="mb-3.5 p-3.5 rounded-2xl bg-amber-950/40 border-2 border-amber-500/60 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-amber-300 uppercase tracking-wider block text-[11px]">
                              ⚠️ ALTERAÇÕES NO PEDIDO (DIFF):
                            </span>
                            {order.isModifiedInKitchen && (
                              <button
                                type="button"
                                onClick={() => acknowledgeOrderModification(order.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase rounded-lg shadow-md cursor-pointer transition-all flex items-center gap-1 shrink-0"
                              >
                                <Check size={12} /> Ciente da Alteração
                              </button>
                            )}
                          </div>
                          {order.orderDiff.added.length > 0 && (
                            <div className="text-emerald-300 font-bold">
                              {order.orderDiff.added.map((item, i) => (
                                <p key={i}>+ {item.quantity}x {item.productName} (ADICIONADO)</p>
                              ))}
                            </div>
                          )}
                          {order.orderDiff.removed.length > 0 && (
                            <div className="text-red-400 font-bold line-through">
                              {order.orderDiff.removed.map((item, i) => (
                                <p key={i}>- {item.quantity}x {item.productName} (CANCELADO)</p>
                              ))}
                            </div>
                          )}
                          {order.orderDiff.modified.length > 0 && (
                            <div className="text-amber-200 font-medium">
                              {order.orderDiff.modified.map((m, i) => (
                                <p key={i}>* {m.item.quantity}x {m.item.productName}: {m.newNotes || 'Sem obs'}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lista de Itens da Comanda */}
                      <div className="space-y-3 mb-4">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="font-extrabold text-base text-white">
                                [{item.quantity}x] {item.productName}
                              </span>
                            </div>

                            {item.combo && (
                              <p className="text-xs font-bold text-amber-400 pl-2">
                                + COMBO: {item.combo.toUpperCase()}
                              </p>
                            )}

                            {item.additionals && item.additionals.length > 0 && (
                              <p className="text-xs font-semibold text-emerald-300 pl-2">
                                + ADICIONAIS: {item.additionals.map(a => a.name.toUpperCase()).join(', ')}
                              </p>
                            )}

                            {item.notes && (
                              <div className="mt-1 p-1.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs font-black text-amber-200 flex items-center gap-1.5 uppercase">
                                <AlertOctagon size={14} className="text-amber-400 shrink-0" />
                                <span>OBS: {item.notes}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botão de Concluir Pedido */}
                    <button
                      type="button"
                      onClick={() => handleConcludeClick(order, isDelayed)}
                      className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-95 ${
                        isDelayed
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      }`}
                    >
                      <Check size={20} /> Concluir Pedido
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: FILA FUTURA & PREVISÃO DE INSUMOS */}
      {/* ========================================================================= */}
      {activeTab === 'previsao' && (
        <div className="space-y-6">
          {/* Banner Explicativo */}
          <div className="glass-card rounded-3xl p-6 border border-blue-500/30 bg-blue-950/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-blue-400 flex items-center gap-2">
                  <Eye size={24} /> Fila Futura & Previsão de Demanda
                </h2>
                <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                  Estes pedidos estão <strong>Em Espera</strong> (aguardando rota do entregador ou liberação da mesa) ou <strong>Agendados</strong> pelo Balcão.
                  A cozinha pode consultar esta previsão para <strong>adiantar porções, carnes e maioneses</strong> antes de entrarem na chapa!
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-center">
                  <span className="text-xs text-blue-300 font-bold block uppercase">Na Fila Futura</span>
                  <strong className="text-2xl font-mono text-white">{queueOrders.length} pedidos</strong>
                </div>
                {pullableQueueOrders.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      updateBatchProductionStatus(pullableQueueOrders.map(o => o.id), 'em_producao');
                      playKitchenChime();
                      setActiveTab('chapa');
                    }}
                    className="py-3 px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 cursor-pointer active:scale-95 transition-all"
                  >
                    <Flame size={18} /> Puxar Mesa+Retirada p/ Chapa ({pullableQueueOrders.length})
                  </button>
                ) : queueOrders.length > 0 ? (
                  <div className="px-4 py-2.5 bg-blue-950/50 border border-blue-500/30 text-blue-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                    🛵 Todos aguardam rota de entregador
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {queueOrders.length === 0 ? (
            <div className="glass-card rounded-3xl p-16 text-center border border-slate-800 my-8">
              <div className="w-16 h-16 mx-auto bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-4">
                <Clock size={36} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Fila Futura Vazia</h3>
              <p className="text-slate-400 max-w-md mx-auto text-sm">
                {!isOpen || !activeCashSession 
                  ? 'O caixa está fechado. Quando um turno for aberto e novos pedidos entrarem no PDV, eles aparecerão aqui.'
                  : 'Nenhum pedido em espera ou agendado no momento para este turno.'}
              </p>
            </div>
          ) : (
            <>
              {/* Resumo de Insumos e Pré-Preparos Necessários */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Lanches Previstos */}
                <div className="glass-card rounded-3xl p-6 border border-slate-800">
                  <h3 className="font-extrabold text-base text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Utensils size={18} /> Lanches nos Próximos Pedidos ({upcomingPrepSummary.totalBurgers} un)
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(upcomingPrepSummary.productCounts).map(([name, qty]) => (
                      <div key={name} className="flex justify-between items-center p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="font-bold text-white text-sm">{name}</span>
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 font-mono font-black text-sm rounded-lg">
                          {qty}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Maioneses e Adicionais dos Próximos */}
                <div className="glass-card rounded-3xl p-6 border border-slate-800">
                  <h3 className="font-extrabold text-base text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    🥫 Adicionais & Maioneses Solicitadas
                  </h3>
                  {Object.keys(upcomingPrepSummary.additionalsCounts).length === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">Nenhum adicional específico nos próximos pedidos.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(upcomingPrepSummary.additionalsCounts).map(([name, qty]) => (
                        <div key={name} className="flex justify-between items-center p-3 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="font-bold text-slate-200 text-sm">{name}</span>
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-mono font-black text-sm rounded-lg">
                            {qty}x
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Cards dos Pedidos em Espera */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {queueOrders.map(order => {
                  const isDelivery = order.orderType === 'delivery';
                  return (
                    <div key={order.id} className={`rounded-3xl p-5 border flex flex-col justify-between ${
                      isDelivery
                        ? 'border-blue-500/30 bg-blue-950/20'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}>
                      <div>
                        <div className="flex justify-between items-start pb-3 mb-3 border-b border-slate-800">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-lg text-slate-300">
                                #{order.id.slice(0, 5).toUpperCase()}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                order.productionStatus === 'agendado' ? 'bg-purple-600 text-white' : 'bg-amber-600 text-white'
                              }`}>
                                {order.productionStatus === 'agendado' ? '📅 AGENDADO' : '⏳ EM ESPERA'}
                              </span>
                              {isDelivery && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-600 text-white">
                                  🛵 DELIVERY
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-white mt-1 uppercase">
                              {order.customerName || 'Cliente'}
                            </p>
                          </div>

                          <span className={`text-[11px] font-mono px-2 py-1 rounded-lg ${
                            isDelivery
                              ? 'text-blue-300 bg-blue-950 border border-blue-500/30'
                              : 'text-slate-400 bg-slate-800'
                          }`}>
                            {order.channel === 'ifood' ? 'iFood' : (order.orderType === 'mesa' ? 'Mesa' : 'Balcão')}
                          </span>
                        </div>

                        <div className="space-y-2 mb-3">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="text-xs text-slate-300 bg-slate-950/60 p-2 rounded-xl">
                              <span className="font-bold text-white">[{item.quantity}x] {item.productName}</span>
                              {item.combo && <p className="text-[10px] text-amber-400">+ Combo: {item.combo}</p>}
                              {item.additionals && item.additionals.length > 0 && (
                                <p className="text-[10px] text-emerald-300">+ Adicionais: {item.additionals.map(a => a.name).join(', ')}</p>
                              )}
                              {item.notes && <p className="text-[10px] text-amber-200 italic">Obs: {item.notes}</p>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {isDelivery ? (
                        <div className="w-full py-3 px-4 bg-blue-950/60 border border-blue-500/30 text-blue-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 select-none">
                          🛵 Aguardando Rota — não pode ir para a chapa ainda
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            updateOrderProductionStatus(order.id, 'em_producao');
                            playKitchenChime();
                            setActiveTab('chapa');
                          }}
                          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 cursor-pointer active:scale-95 transition-all"
                        >
                          <Flame size={16} /> 🔥 Puxar para a Chapa Agora
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: PAINEL DE FALTAS & RUPTURAS */}
      {/* ========================================================================= */}
      {activeTab === 'faltas' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 border border-slate-800">
            <h2 className="text-2xl font-bold text-slate-100 mb-1 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" /> Sinalização de Rupturas e Estoque Crítico
            </h2>
            <p className="text-slate-400 text-xs">
              Sinalize quando um ingrediente estiver acabando ou zerado. O alerta reflete imediatamente para a Gestão de Compras.
            </p>
          </div>

          {Object.entries(groupedItems).map(([catName, catItems]) => (
            <div key={catName} className="mb-8">
              <h3 className="text-xl font-bold text-slate-200 mb-4 px-3 border-l-4 border-amber-500 uppercase tracking-wider">
                {catName}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catItems.map(item => (
                  <div key={item.id} className={`p-5 rounded-2xl border transition-all ${
                    item.status === 'zerado' ? 'bg-red-500/10 border-red-500/30' :
                    item.status === 'acabando' ? 'bg-amber-500/10 border-amber-500/30' :
                    'bg-slate-900 border-slate-800'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-white">{item.name}</h4>
                        <p className="text-slate-400 text-xs mt-0.5">Estoque: {item.currentStock} {item.unit}</p>
                      </div>
                      
                      {item.status !== 'ok' && (
                        <button 
                          onClick={() => updateStatus(item.id, 'ok')}
                          className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle size={14} /> Normalizar
                        </button>
                      )}
                    </div>

                    {item.status === 'ok' ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const qty = prompt(`Quantos ${item.unit} restam de ${item.name}?`);
                            if (qty !== null) updateStatus(item.id, 'acabando', Number(qty));
                          }}
                          className="flex-1 py-3 bg-amber-600/20 hover:bg-amber-500/30 text-amber-400 rounded-xl font-bold text-xs border border-amber-500/20 transition-all flex justify-center items-center gap-1.5 cursor-pointer"
                        >
                          <AlertTriangle size={15} /> Acabando
                        </button>
                        <button 
                          onClick={() => updateStatus(item.id, 'zerado', 0)}
                          className="flex-1 py-3 bg-red-600/20 hover:bg-red-500/30 text-red-400 rounded-xl font-bold text-xs border border-red-500/20 transition-all flex justify-center items-center gap-1.5 cursor-pointer"
                        >
                          Zerado!
                        </button>
                      </div>
                    ) : (
                      <div className={`p-3 rounded-xl flex items-center gap-2 font-bold text-xs ${
                        item.status === 'zerado' ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950 font-black'
                      }`}>
                        <AlertTriangle size={16} />
                        ALERTA ATIVO NA GESTÃO
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: CHECKLIST OPERACIONAL */}
      {/* ========================================================================= */}
      {activeTab === 'checklist' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="glass-card rounded-3xl p-6 border border-slate-800">
            <h2 className="text-2xl font-bold text-slate-100 mb-1 flex items-center gap-2">
              <ListChecks className="text-emerald-400" /> Checklist Operacional Diário
            </h2>
            <p className="text-slate-400 text-xs">
              Realize a conferência diária de rotina da cozinha.
            </p>
          </div>

          {checklist && (
            <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-3">
              {checklist.tasks.map(task => (
                <div 
                  key={task.id} 
                  onClick={() => {
                    if (task.checked) {
                      // Toggle bidirecional: desmarca imediatamente e reverte para PENDENTE
                      toggleChecklistTask(task.id);
                    } else {
                      // Abre popover/modal rápido para atribuir o colaborador executor
                      setSelectedTaskForAssignment(task);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    task.checked 
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200 hover:bg-emerald-950/30' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                      task.checked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 hover:border-emerald-400'
                    }`}>
                      {task.checked && <Check size={16} />}
                    </div>
                    <div>
                      <span className="font-semibold text-sm block">{task.label}</span>
                      <span className="text-[10px] text-slate-500">
                        {task.checked ? 'Clique para desmarcar (reverter p/ pendente)' : 'Clique para atribuir quem executou'}
                      </span>
                    </div>
                  </div>
                  {task.checked && (
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 font-bold">
                        Executado por: {task.executedByName || task.checkedBy || 'Equipe'}
                      </span>
                      {task.completedAt && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-4 flex justify-between items-center border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  Assinado por: <strong className="text-white">{checklist.signedBy || 'Pendente'}</strong>
                </span>
                {!checklist.signedBy && (
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt('Nome do responsável pelo fechamento:');
                      if (name) signChecklist(name);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Assinar Checklist de Hoje
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPOVER / MODAL RÁPIDO DE ATRIBUIÇÃO DE COLABORADOR NA TAREFA */}
      {/* ========================================================================= */}
      {selectedTaskForAssignment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-800 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Concluir Tarefa Operacional
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {selectedTaskForAssignment.label}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedTaskForAssignment(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Selecione qual colaborador realizou o trabalho para registrar na auditoria:
            </p>

            {/* Lista Rápida de Colaboradores Cadastrados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[45vh] overflow-y-auto pr-1">
              {collaboratorsList.map(colab => (
                <button
                  key={colab.id}
                  type="button"
                  onClick={() => {
                    toggleChecklistTask(selectedTaskForAssignment.id, colab.name, colab.id, 'Operador');
                    setSelectedTaskForAssignment(null);
                  }}
                  className="p-3 rounded-2xl bg-slate-900/80 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/40 text-left transition-all cursor-pointer group"
                >
                  <p className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">
                    {colab.name}
                  </p>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">
                    {colab.role}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const customName = prompt('Nome do colaborador:');
                  if (customName && customName.trim()) {
                    toggleChecklistTask(selectedTaskForAssignment.id, customName.trim(), undefined, 'Operador');
                    setSelectedTaskForAssignment(null);
                  }
                }}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-800 cursor-pointer transition-all"
              >
                Outro Nome...
              </button>
              <button
                type="button"
                onClick={() => setSelectedTaskForAssignment(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL TOUCH DE JUSTIFICATIVA DE ATRASO (> TARGET PREP MINUTES) */}
      {/* ========================================================================= */}
      {selectedDelayedSale && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 md:p-8 max-w-lg w-full border-2 border-red-500/60 shadow-[0_0_50px_rgba(239,68,68,0.2)] space-y-6 animate-scale-in">
            
            <div className="text-center space-y-1 pb-4 border-b border-slate-800">
              <div className="w-16 h-16 mx-auto bg-red-600/20 text-red-400 rounded-2xl flex items-center justify-center border border-red-500/30 mb-2">
                <AlertOctagon size={36} />
              </div>
              <h3 className="text-2xl font-black text-white">
                Justificativa de Atraso na Chapa
              </h3>
              <p className="text-xs text-slate-400">
                Pedido <strong>#{selectedDelayedSale.id.slice(0, 5).toUpperCase()}</strong> ultrapassou a meta de {selectedDelayedSale.targetPrepMinutes || targetPrepMinutes} min do balcão.
                Selecione o motivo para fins de gestão:
              </p>
            </div>

            {/* 4 OPÇÕES OBRIGATÓRIAS SOLICITADAS PELO USUÁRIO */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'erro_producao', label: 'Erro na Produção', icon: '⚠️' },
                { id: 'falta_insumo', label: 'Falta de Insumo', icon: '📦' },
                { id: 'falta_atencao', label: 'Falta de Atenção', icon: '👁️' },
                { id: 'desperdicio', label: 'Desperdício', icon: '🗑️' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedReason(opt.id as DelayReason)}
                  className={`p-4 rounded-2xl font-extrabold text-sm flex flex-col items-center justify-center gap-2 border transition-all cursor-pointer ${
                    selectedReason === opt.id
                      ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/40 ring-2 ring-red-400'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Observações Opcionais */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Observação Adicional (Opcional):
              </label>
              <input
                type="text"
                placeholder="Ex: Refeito hambúrguer por queima do queijo, etc."
                value={delayNotes}
                onChange={e => setDelayNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs outline-none focus:border-red-500"
              />
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDelayedSale(null)}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-all"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmittingDelay}
                onClick={handleConfirmDelayAndComplete}
                className="flex-2 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-red-600/30"
              >
                <Check size={16} /> Salvar & Concluir Pedido
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
