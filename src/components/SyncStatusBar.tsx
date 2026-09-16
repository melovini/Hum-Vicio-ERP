'use client';
import React, { useState } from 'react';
import { 
  Wifi, WifiOff, ServerOff, RefreshCw, AlertCircle, 
  CheckCircle2, Clock, ShieldAlert, FileText, ChevronRight, X, Sparkles
} from 'lucide-react';
import { useInventory, Sale, ConnectionStatus } from '@/lib/store';

interface SyncStatusBarProps {
  className?: string;
  compact?: boolean;
}

export default function SyncStatusBar({ className = '', compact = false }: SyncStatusBarProps) {
  const { 
    connectionStatus, 
    lastServerSync, 
    offlineQueueCount, 
    offlineSalesList, 
    syncOfflineQueueNow, 
    checkServerHealth 
  } = useInventory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncOfflineQueueNow();
      if (res.syncedCount > 0) {
        setSyncFeedback(`Sucesso: ${res.syncedCount} pedido(s) sincronizado(s) com o servidor!`);
      } else if (res.errorsCount > 0) {
        setSyncFeedback(`Atenção: O servidor ainda está inacessível. Os pedidos continuam salvos com segurança neste aparelho.`);
      } else {
        setSyncFeedback(`Fila vazia. Todos os pedidos estão 100% atualizados no servidor.`);
      }
    } catch {
      setSyncFeedback(`Falha de comunicação com o servidor. A fila será retentada automaticamente.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckHealth = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const status = await checkServerHealth();
      if (status === 'connected') {
        setSyncFeedback('Conexão ativa e estável com o servidor e banco de dados.');
      } else if (status === 'server_unreachable') {
        setSyncFeedback('Computador conectado à rede, mas o servidor do ERP não respondeu.');
      } else {
        setSyncFeedback('Sem conexão com a internet neste aparelho.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const formattedLastSync = lastServerSync 
    ? new Date(lastServerSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Ainda não registrada';

  return (
    <>
      {/* BADGE VISUAL NO TOPO */}
      <div className={`flex items-center gap-2 ${className}`}>
        {connectionStatus === 'connected' && offlineQueueCount === 0 ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold flex items-center gap-2 text-xs transition-colors cursor-pointer"
            title={`Conectado ao Servidor • Última sincronização: ${formattedLastSync}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Wifi size={14} className="text-emerald-400" />
            {!compact && <span>Online</span>}
            <span className="text-[10px] text-emerald-300/80 font-mono hidden sm:inline">
              ({formattedLastSync})
            </span>
          </button>
        ) : connectionStatus === 'offline' ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 rounded-xl font-extrabold flex items-center gap-2 text-xs animate-pulse cursor-pointer shadow-lg shadow-rose-950/40"
            title="Clique para abrir o painel de contingência operacional"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <WifiOff size={14} className="text-rose-300" />
            <span>Sem Internet ({offlineQueueCount} na fila)</span>
            <span className="px-1.5 py-0.2 bg-rose-950/80 border border-rose-400/40 rounded text-[9px] uppercase tracking-wider">
              Contingência
            </span>
          </button>
        ) : connectionStatus === 'server_unreachable' ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-xl font-extrabold flex items-center gap-2 text-xs animate-pulse cursor-pointer shadow-lg shadow-amber-950/40"
            title="Clique para abrir o painel de contingência operacional"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <ServerOff size={14} className="text-amber-300" />
            <span>Servidor Inacessível ({offlineQueueCount} na fila)</span>
            <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-400/40 rounded text-[9px] uppercase tracking-wider">
              Contingência
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl font-bold flex items-center gap-2 text-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className="animate-spin text-amber-300" />
            <span>Sincronizando ({offlineQueueCount} pendentes)</span>
          </button>
        )}
      </div>

      {/* MODAL DE CONTINGÊNCIA & SINCRONIZAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${
                  connectionStatus === 'connected' && offlineQueueCount === 0
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : connectionStatus === 'offline'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {connectionStatus === 'connected' && offlineQueueCount === 0 ? (
                    <CheckCircle2 size={24} />
                  ) : connectionStatus === 'offline' ? (
                    <WifiOff size={24} />
                  ) : (
                    <ServerOff size={24} />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    Contingência & Sincronização
                  </h2>
                  <p className="text-xs text-slate-400">
                    Última confirmação do servidor: <strong className="text-slate-200">{formattedLastSync}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
              
              {/* Feedback Alert */}
              {syncFeedback && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-400 shrink-0" />
                    <span>{syncFeedback}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSyncFeedback(null)}
                    className="text-blue-400 hover:text-white text-xs font-bold underline cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              )}

              {/* Status Breakdown Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Comunicação com o Sistema
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-emerald-400' :
                      connectionStatus === 'offline' ? 'bg-rose-400' : 'bg-amber-400'
                    }`} />
                    <span className="font-extrabold text-white text-base">
                      {connectionStatus === 'connected' ? 'Conectado ao Servidor' :
                       connectionStatus === 'offline' ? 'Sem Conexão (Offline)' : 'Servidor Inacessível'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {connectionStatus === 'connected' 
                      ? 'Todas as operações estão sincronizadas em tempo real.'
                      : connectionStatus === 'offline'
                        ? 'Seu computador está sem rede. Os dados estão salvos localmente.'
                        : 'Você tem internet, mas o servidor central demorou a responder.'}
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Fila de Envio Pendente
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-2xl text-white">
                      {offlineQueueCount} <span className="text-xs font-normal text-slate-400">pedido(s)</span>
                    </span>
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={handleManualSync}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                      <span>{isSyncing ? 'Enviando...' : 'Sincronizar'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {offlineQueueCount === 0 
                      ? 'Nenhum pedido pendente de sincronização.' 
                      : 'Serão reenviados automaticamente assim que a conexão restabelecer.'}
                  </p>
                </div>
              </div>

              {/* Lista de Pedidos na Fila */}
              {offlineSalesList.length > 0 && (
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                    <Clock size={14} /> Pedidos Salvos Neste Aparelho Aguardando Envio
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {offlineSalesList.map(sale => (
                      <div 
                        key={sale.id}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-amber-400">
                            #{sale.id.slice(0, 6).toUpperCase()}
                          </span>
                          <span className="font-bold text-slate-200">
                            {sale.customerName || 'Balcão'}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            ({new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-400">
                            R$ {sale.total.toFixed(2)}
                          </span>
                          {sale.syncStatus === 'failed' ? (
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded text-[10px] font-bold" title={sale.syncError}>
                              ❌ Falha: {sale.syncError || 'Erro'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold">
                              ⏳ Salvo Localmente
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PROCEDIMENTO OPERACIONAL DE CONTINGÊNCIA */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                  <AlertCircle size={16} /> Procedimento Operacional em Caso de Falha de Conexão
                </div>
                
                <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
                  <li>
                    <strong className="text-white">Não interrompa o atendimento:</strong> Novos pedidos continuam sendo registrados normalmente e com segurança neste aparelho.
                  </li>
                  <li>
                    <strong className="text-white">Imprima ou anote a Comanda:</strong> Ao finalizar a venda, imprima o comprovante ou anote o código do pedido (<span className="font-mono text-amber-300">#C-XXXX</span>).
                  </li>
                  <li>
                    <strong className="text-white">Entregue a via física para a Cozinha:</strong> Caso a tela da chapa não receba o pedido imediatamente pela rede, o chapeiro preparará o lanche utilizando a via impressa.
                  </li>
                  <li>
                    <strong className="text-white">Sincronização sem risco de duplicidade:</strong> Assim que a conexão for restabelecida, o ERP sincronizará os pedidos pendentes com proteção de idempotência (nenhuma venda ou estoque será duplicado).
                  </li>
                </ol>
              </div>

              {/* REGRAS DE PERMISSÃO OFFLINE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                    <CheckCircle2 size={14} /> Permitido no Modo Offline
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1">
                    <li>• Lançar vendas no PDV e balcão</li>
                    <li>• Imprimir comandas e comprovantes</li>
                    <li>• Receber pagamentos locais</li>
                    <li>• Consultar itens e cardápio</li>
                  </ul>
                </div>

                <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
                    <ShieldAlert size={14} /> Bloqueado (Exige Conexão)
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1">
                    <li>• Fechamento oficial de caixa (trava contábil)</li>
                    <li>• Cancelamento de pedido com senha do gerente</li>
                    <li>• Alteração de senhas e dados de colaboradores</li>
                  </ul>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCheckHealth}
                disabled={isSyncing}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                <span>Testar Comunicação</span>
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Entendi / Fechar
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
