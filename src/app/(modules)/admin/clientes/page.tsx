'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Users, DollarSign, TrendingUp, Clock, AlertTriangle, 
  Search, Filter, FileSpreadsheet, RefreshCw, Star, Heart,
  Phone, MapPin, Sparkles, MessageCircle, ExternalLink, Calendar,
  ChevronRight, CheckCircle2, Flame, ShieldAlert, Award, Coffee,
  Sun, Moon, ShoppingBag, UtensilsCrossed, X, Download
} from 'lucide-react';
import Link from 'next/link';
import { useInventory, Sale, Product } from '@/lib/store';
import { 
  CustomerAnalyticsProfile, extractCustomerAnalytics, 
  generateCustomerWhatsAppMessage, getStoredImportedCustomers, 
  fetchImportedCustomersAsync, syncImportedCustomers, subscribeToCustomerChanges,
  ImportedCustomer, saveImportedCustomers, clearImportedCustomers
} from '@/lib/crm-clientes';
import ImportarClientesModal from '@/components/ImportarClientesModal';

type ActiveTab = 'lucratividade' | 'horarios_ociosos' | 'retencao_churn' | 'base_importada';
type SortOption = 'lucro_desc' | 'margem_desc' | 'receita_desc' | 'pedidos_desc' | 'horario_ocioso_desc' | 'recencia_desc';

export default function ClientesAdminPage() {
  const { sales = [], products = [], getProductCmv, isLoaded } = useInventory();

  // Abas e visualizações
  const [activeTab, setActiveTab] = useState<ActiveTab>('lucratividade');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('lucro_desc');
  const [channelFilter, setChannelFilter] = useState<'todos' | 'balcao' | 'ifood'>('todos');

  // Base importada externa (Cardápio Web / Planilhas)
  const [importedCustomers, setImportedCustomers] = useState<ImportedCustomer[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [crmToast, setCrmToast] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Cliente Selecionado para Gaveta de Detalhes
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAnalyticsProfile | null>(null);

  // Carrega a base importada do localStorage e sincroniza automaticamente com o Supabase/Nuvem
  useEffect(() => {
    setImportedCustomers(getStoredImportedCustomers());
    setIsSyncingCloud(true);
    setCloudSyncStatus('syncing');

    syncImportedCustomers().then(res => {
      if (res.customers) {
        setImportedCustomers(res.customers);
        setCloudSyncStatus(res.syncedToCloud ? 'synced' : 'idle');
      }
    }).catch(err => {
      console.warn('Erro ao sincronizar clientes:', err);
      setCloudSyncStatus('error');
    }).finally(() => {
      setIsSyncingCloud(false);
    });

    const handleUpdate = () => {
      setImportedCustomers(getStoredImportedCustomers());
    };
    window.addEventListener('crm_customers_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Escuta alterações em tempo real via Supabase Realtime
    const unsubscribe = subscribeToCustomerChanges((updated) => {
      setImportedCustomers(updated);
      setCloudSyncStatus('synced');
    });

    return () => {
      window.removeEventListener('crm_customers_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      unsubscribe();
    };
  }, []);

  // Forçar envio e sincronização com a Nuvem Supabase
  const handleForceCloudSync = async () => {
    setIsSyncingCloud(true);
    setCloudSyncStatus('syncing');
    try {
      const res = await syncImportedCustomers({ forcePushLocal: true });
      setImportedCustomers(res.customers);
      setCloudSyncStatus('synced');
      setCrmToast(`✓ Nuvem sincronizada com sucesso! ${res.count} clientes disponíveis em todos os dispositivos.`);
      setTimeout(() => setCrmToast(null), 5000);
    } catch (err: any) {
      console.error('Erro na sincronização manual:', err);
      setCloudSyncStatus('error');
      setCrmToast(`Erro ao sincronizar: ${err?.message || 'Falha de conexão com a nuvem'}`);
      setTimeout(() => setCrmToast(null), 5000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Extração analítica dos perfis de clientes do ERP enriquecidos com custo e horários
  const customerProfiles = useMemo(() => {
    return extractCustomerAnalytics(sales, products, getProductCmv, importedCustomers);
  }, [sales, products, getProductCmv, importedCustomers]);

  // Cálculos de KPIs Globais
  const globalKpis = useMemo(() => {
    const totalIdentified = customerProfiles.length;
    const totalSpentAll = customerProfiles.reduce((acc, c) => acc + c.totalSpent, 0);
    const totalCmvAll = customerProfiles.reduce((acc, c) => acc + c.totalCmv, 0);
    const totalGrossProfitAll = totalSpentAll - totalCmvAll;
    const avgMarginAll = totalSpentAll > 0 ? (totalGrossProfitAll / totalSpentAll) * 100 : 0;
    const totalOrdersAll = customerProfiles.reduce((acc, c) => acc + c.totalOrders, 0);
    const avgTicketAll = totalOrdersAll > 0 ? totalSpentAll / totalOrdersAll : 0;

    const offPeakHeroesCount = customerProfiles.filter(c => c.isOffPeakHero).length;
    const churnRiskCount = customerProfiles.filter(c => c.churnRisk === 'em_risco' || c.churnRisk === 'churn').length;
    const highMarginCustomersCount = customerProfiles.filter(c => c.profitMargin >= 65).length;

    return {
      totalIdentified,
      totalSpentAll,
      totalGrossProfitAll,
      avgMarginAll,
      avgTicketAll,
      offPeakHeroesCount,
      churnRiskCount,
      highMarginCustomersCount,
      importedCount: importedCustomers.length
    };
  }, [customerProfiles, importedCustomers]);

  // Filtragem e Ordenação da Lista
  const displayedCustomers = useMemo(() => {
    let list = [...customerProfiles];

    // Filtro por Aba
    if (activeTab === 'horarios_ociosos') {
      list = list.filter(c => c.offPeakOrdersCount > 0);
    } else if (activeTab === 'retencao_churn') {
      list = list.filter(c => c.churnRisk === 'em_risco' || c.churnRisk === 'churn');
    }

    // Filtro por Canal
    if (channelFilter !== 'todos') {
      list = list.filter(c => c.preferredChannel === channelFilter);
    }

    // Filtro por Busca
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        c.topProducts.some(p => p.name.toLowerCase().includes(q))
      );
    }

    // Ordenação
    list.sort((a, b) => {
      if (sortBy === 'lucro_desc') return b.totalGrossProfit - a.totalGrossProfit;
      if (sortBy === 'margem_desc') return b.profitMargin - a.profitMargin;
      if (sortBy === 'receita_desc') return b.totalSpent - a.totalSpent;
      if (sortBy === 'pedidos_desc') return b.totalOrders - a.totalOrders;
      if (sortBy === 'horario_ocioso_desc') return b.offPeakOrdersCount - a.offPeakOrdersCount;
      if (sortBy === 'recencia_desc') return b.daysSinceLastOrder - a.daysSinceLastOrder;
      return 0;
    });

    return list;
  }, [customerProfiles, activeTab, channelFilter, searchTerm, sortBy]);

  // Dispara mensagem WhatsApp
  const handleOpenWhatsApp = (customer: CustomerAnalyticsProfile, campaign: 'horario_ocioso' | 'reativacao_churn' | 'vip_agradecimento' | 'livre') => {
    const { url } = generateCustomerWhatsAppMessage(customer, campaign);
    window.open(url, '_blank');
  };

  // Limpeza de base externa
  const handleClearExternalBase = () => {
    if (confirm('Tem certeza que deseja apagar os clientes importados do Cardápio Web? Os pedidos do ERP não serão afetados.')) {
      clearImportedCustomers();
      setImportedCustomers([]);
      setCrmToast('Base importada externa limpa com sucesso.');
      setTimeout(() => setCrmToast(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* TOPO: Cabeçalho com Navegação e Ações */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shadow-xs"
              title="Voltar para a Página Inicial"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} /> CRM & Inteligência de Negócio
                </span>
                <span className="text-slate-500 text-xs">•</span>
                <span className="text-xs text-slate-400 font-medium">Gestão Hum Vício</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-0.5">
                Inteligência de <span className="text-amber-400">Clientes & Lucratividade</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              disabled={isSyncingCloud}
              onClick={handleForceCloudSync}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Sincronizar base de clientes com o banco em nuvem Supabase"
            >
              <RefreshCw size={14} className={isSyncingCloud ? 'animate-spin text-cyan-400' : 'text-slate-400'} />
              <span>{isSyncingCloud ? 'Sincronizando Nuvem...' : 'Sincronizar Nuvem'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black flex items-center gap-2 shadow-lg hover:shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} /> Importar Planilha (.xlsx)
            </button>
            <Link
              href="/admin/dashboard"
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              DRE & Dashboard
            </Link>
          </div>
        </div>

        {/* CARDS DE KPIS GLOBAIS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          
          {/* Card 1: Base Total */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Clientes Identificados</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Users size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">{globalKpis.totalIdentified}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <span>+ {globalKpis.importedCount} no Cardápio Web</span>
              </div>
            </div>
          </div>

          {/* Card 2: Lucro Bruto Total */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-xs bg-gradient-to-br from-emerald-950/20 to-slate-900/90">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">Lucro Bruto Real (R$)</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-400">
                R$ {globalKpis.totalGrossProfitAll.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Receita: R$ {globalKpis.totalSpentAll.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Card 3: Margem Real Média */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Margem Média dos Clientes</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-cyan-400">
                {globalKpis.avgMarginAll.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {globalKpis.highMarginCustomersCount} clientes com margem &gt; 65%
              </div>
            </div>
          </div>

          {/* Card 4: Heróis de Horários Ociosos */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-xs bg-gradient-to-br from-amber-950/20 to-slate-900/90">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400">Clientes de Horário Vazio</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Sun size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-400">
                {globalKpis.offPeakHeroesCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Compram em tardes e terças/quartas
              </div>
            </div>
          </div>

          {/* Card 5: Clientes em Risco de Churn */}
          <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-xs bg-gradient-to-br from-rose-950/20 to-slate-900/90 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400">Alerta de Churn / Inativos</span>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-rose-400">
                {globalKpis.churnRiskCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Sem pedir há mais de 20 dias
              </div>
            </div>
          </div>

        </div>

        {/* NAVEGAÇÃO DE ABAS TEMÁTICAS */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('lucratividade')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'lucratividade'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <DollarSign size={14} /> Ranking de Lucratividade & Margem
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('horarios_ociosos')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'horarios_ociosos'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Sun size={14} /> Inteligência de Horários Vazios / Vales
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('retencao_churn')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'retencao_churn'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <AlertTriangle size={14} /> Prevenção de Churn & Retenção
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('base_importada')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'base_importada'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileSpreadsheet size={14} /> Base Externa Cardápio Web ({importedCustomers.length})
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        {activeTab !== 'base_importada' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
            {/* Input de Busca */}
            <div className="relative w-full md:w-96">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, telefone, endereço ou produto..."
                className="w-full bg-slate-950 border border-slate-700/70 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-amber-500 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Seletores de Ordenação e Canal */}
            <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <Filter size={13} className="text-slate-400" />
                <span className="text-slate-400 font-medium">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
                >
                  <option value="lucro_desc" className="bg-slate-900">💰 Maior Lucro Bruto (R$)</option>
                  <option value="margem_desc" className="bg-slate-900">📈 Maior Margem Real (%)</option>
                  <option value="receita_desc" className="bg-slate-900">👑 Maior Faturamento (R$)</option>
                  <option value="pedidos_desc" className="bg-slate-900">🔄 Mais Pedidos</option>
                  <option value="horario_ocioso_desc" className="bg-slate-900">☀️ Mais Pedidos em Horários Vazios</option>
                  <option value="recencia_desc" className="bg-slate-900">⚠️ Mais Dias Sem Pedir</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Canal:</span>
                <select
                  value={channelFilter}
                  onChange={e => setChannelFilter(e.target.value as any)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
                >
                  <option value="todos" className="bg-slate-900">Todos</option>
                  <option value="balcao" className="bg-slate-900">Balcão / Salão</option>
                  <option value="ifood" className="bg-slate-900">Delivery / iFood</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL: TABELAS E LISTAS */}
        {activeTab !== 'base_importada' ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 pl-5">Cliente & Segmento</th>
                    <th className="p-3.5">Pedidos / Faturamento</th>
                    <th className="p-3.5 text-right">Lucro Bruto (R$)</th>
                    <th className="p-3.5 text-right">Margem Real (%)</th>
                    <th className="p-3.5">Hábito de Horário</th>
                    <th className="p-3.5">Último Pedido / Churn</th>
                    <th className="p-3.5 pr-5 text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {displayedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        Nenhum cliente encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    displayedCustomers.map((cust, idx) => (
                      <tr key={cust.id} className="hover:bg-slate-800/40 transition-colors group">
                        
                        {/* Coluna 1: Cliente & Badges */}
                        <td className="p-3.5 pl-5">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center font-black text-xs shrink-0 border border-slate-700/70">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-white text-sm group-hover:text-amber-300 transition-colors">
                                  {cust.name}
                                </span>

                                {/* Badges Estratégicas */}
                                {cust.badges.includes('vip_lucro') && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30 flex items-center gap-1">
                                    <Award size={10} /> VIP Lucro
                                  </span>
                                )}
                                {cust.badges.includes('alta_margem') && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 flex items-center gap-1">
                                    <TrendingUp size={10} /> Alta Margem
                                  </span>
                                )}
                                {cust.badges.includes('horario_vazio') && (
                                  <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-black border border-orange-500/30 flex items-center gap-1">
                                    <Sun size={10} /> Horário Vazio
                                  </span>
                                )}
                              </div>

                              {cust.phone && (
                                <p className="text-[11px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                                  <Phone size={10} /> {cust.phone}
                                </p>
                              )}

                              {cust.topProducts.length > 0 && (
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                                  Mais pedido: <strong className="text-slate-200">{cust.topProducts[0].name}</strong> ({cust.topProducts[0].count}x)
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Coluna 2: Pedidos & Faturamento */}
                        <td className="p-3.5">
                          <div className="text-white font-bold">
                            R$ {cust.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {cust.totalOrders} pedido{cust.totalOrders > 1 ? 's' : ''} • Méd: R$ {cust.averageTicket.toFixed(2)}
                          </div>
                        </td>

                        {/* Coluna 3: Lucro Bruto */}
                        <td className="p-3.5 text-right">
                          <div className="text-emerald-400 font-black text-sm">
                            R$ {cust.totalGrossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            CMV: R$ {cust.totalCmv.toFixed(2)}
                          </div>
                        </td>

                        {/* Coluna 4: Margem Real % */}
                        <td className="p-3.5 text-right">
                          <div className={`font-black text-sm ${cust.profitMargin >= 65 ? 'text-emerald-400' : cust.profitMargin >= 50 ? 'text-cyan-400' : 'text-amber-400'}`}>
                            {cust.profitMargin.toFixed(1)}%
                          </div>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full ml-auto mt-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${cust.profitMargin >= 65 ? 'bg-emerald-500' : cust.profitMargin >= 50 ? 'bg-cyan-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, cust.profitMargin))}%` }}
                            />
                          </div>
                        </td>

                        {/* Coluna 5: Hábito de Horário */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-200">
                            {cust.isOffPeakHero ? (
                              <span className="text-amber-400 flex items-center gap-1">
                                <Sun size={12} /> {cust.preferredHourStr}
                              </span>
                            ) : (
                              <span className="text-slate-300 flex items-center gap-1">
                                <Moon size={12} className="text-slate-500" /> {cust.preferredHourStr}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {cust.preferredDayOfWeekStr} • {cust.offPeakOrdersCount}x em vale ocioso
                          </div>
                        </td>

                        {/* Coluna 6: Último Pedido & Churn */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              cust.churnRisk === 'ativo' ? 'bg-emerald-500' :
                              cust.churnRisk === 'regular' ? 'bg-cyan-500' :
                              cust.churnRisk === 'em_risco' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                            }`} />
                            <span className="font-bold text-slate-200">
                              {cust.daysSinceLastOrder === 0 ? 'Hoje' : `${cust.daysSinceLastOrder} dias atrás`}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {cust.churnRisk === 'ativo' && <span className="text-emerald-400">Cliente Ativo</span>}
                            {cust.churnRisk === 'regular' && <span className="text-slate-400">Recorrência Normal</span>}
                            {cust.churnRisk === 'em_risco' && <span className="text-amber-400 font-bold">Risco de Perda</span>}
                            {cust.churnRisk === 'churn' && <span className="text-rose-400 font-bold">Cliente Inativo</span>}
                          </div>
                        </td>

                        {/* Coluna 7: Ações */}
                        <td className="p-3.5 pr-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(cust)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                              title="Ver histórico e produtos favoritos"
                            >
                              Ver Detalhes
                            </button>

                            {cust.phone && (
                              <button
                                type="button"
                                onClick={() => handleOpenWhatsApp(
                                  cust, 
                                  cust.churnRisk === 'em_risco' || cust.churnRisk === 'churn' 
                                    ? 'reativacao_churn' 
                                    : cust.isOffPeakHero 
                                    ? 'horario_ocioso' 
                                    : 'vip_agradecimento'
                                )}
                                className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
                                title="Enviar mensagem no WhatsApp com 1 clique"
                              >
                                <MessageCircle size={15} />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ABA 4: GESTÃO DA BASE IMPORTADA DO CARDÁPIO WEB (.xlsx) */
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <FileSpreadsheet className="text-cyan-400" size={20} />
                    Base Sincronizada do Cardápio Web & Planilhas
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Estes contatos alimentam o autocomplete do Caixa/PDV automaticamente sem sobrecarregar os operadores.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={handleForceCloudSync}
                    className="px-3.5 py-2 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    title="Forçar envio e sincronização de todos os clientes com o banco em nuvem Supabase"
                  >
                    <RefreshCw size={13} className={isSyncingCloud ? 'animate-spin text-emerald-400' : ''} />
                    <span>{isSyncingCloud ? 'Sincronizando Nuvem...' : 'Sincronizar com a Nuvem'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <FileSpreadsheet size={14} /> Importar Nova Planilha
                  </button>
                  {importedCustomers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearExternalBase}
                      className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Limpar Base Importada
                    </button>
                  )}
                </div>
              </div>

              {importedCustomers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                    <FileSpreadsheet size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-white">Nenhuma base externa importada ainda</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Arraste a planilha de clientes exportada do Cardápio Web (.xlsx) para que o sistema reconheça nomes, telefones e endereços no PDV.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      <FileSpreadsheet size={15} /> Selecionar Arquivo .xlsx
                    </button>
                    <button
                      type="button"
                      disabled={isSyncingCloud}
                      onClick={handleForceCloudSync}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={isSyncingCloud ? 'animate-spin text-cyan-400' : ''} />
                      <span>Buscar da Nuvem</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400">Total de Contatos:</span>
                      <p className="text-lg font-black text-white mt-0.5">{importedCustomers.length} clientes</p>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400">Com WhatsApp/Telefone:</span>
                      <p className="text-lg font-black text-emerald-400 mt-0.5">
                        {importedCustomers.filter(i => i.phone).length} contatos
                      </p>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400">Com Endereço de Entrega:</span>
                      <p className="text-lg font-black text-cyan-400 mt-0.5">
                        {importedCustomers.filter(i => i.fullAddress).length} contatos
                      </p>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400">Nuvem Multi-Dispositivos:</span>
                      <p className="text-sm font-bold mt-1 flex items-center gap-1.5">
                        {isSyncingCloud ? (
                          <span className="text-amber-400 flex items-center gap-1 font-bold">
                            <RefreshCw size={12} className="animate-spin" /> Sincronizando...
                          </span>
                        ) : cloudSyncStatus === 'synced' ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-bold">
                            <CheckCircle2 size={13} /> Nuvem Ativa & Pronta
                          </span>
                        ) : (
                          <span className="text-slate-300 flex items-center gap-1">
                            <CheckCircle2 size={13} className="text-emerald-400" /> Sincronizado
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Tabela de visualização da base importada */}
                  <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold sticky top-0 z-10 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5 pl-4">Nome</th>
                          <th className="p-2.5">Telefone</th>
                          <th className="p-2.5">Endereço</th>
                          <th className="p-2.5">Bairro / Cidade</th>
                          <th className="p-2.5 pr-4 text-right">Pedidos Históricos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {importedCustomers.slice(0, 100).map(c => (
                          <tr key={c.id} className="hover:bg-slate-800/30">
                            <td className="p-2.5 pl-4 font-bold text-white">{c.name}</td>
                            <td className="p-2.5 text-emerald-400 font-mono">{c.phone || '-'}</td>
                            <td className="p-2.5 text-slate-300">{c.address ? `${c.address}${c.number ? `, ${c.number}` : ''}` : '-'}</td>
                            <td className="p-2.5 text-slate-400">{c.neighborhood || c.city || '-'}</td>
                            <td className="p-2.5 pr-4 text-right font-black text-amber-400">{c.totalOrders || 1}x</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importedCustomers.length > 100 && (
                    <p className="text-[11px] text-slate-500 text-center">
                      Mostrando os primeiros 100 de {importedCustomers.length} contatos. Todos estão integrados ao autocomplete do Caixa.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL / GAVETA DE DETALHES DO CLIENTE */}
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              
              {/* Topo do Modal */}
              <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white">{selectedCustomer.name}</span>
                    {selectedCustomer.badges.includes('vip_lucro') && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-black rounded-md border border-amber-500/30">
                        VIP Lucro
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedCustomer.phone ? `WhatsApp: ${selectedCustomer.phone}` : 'Sem telefone cadastrado'}
                    {selectedCustomer.address ? ` • ${selectedCustomer.address}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Corpo com Métricas Detalhadas */}
              <div className="p-5 overflow-y-auto space-y-5 divide-y divide-slate-800 text-xs">
                
                {/* Métricas Financeiras */}
                <div className="grid grid-cols-4 gap-2.5 text-center">
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Total Gasto</span>
                    <p className="text-base font-black text-white mt-0.5">
                      R$ {selectedCustomer.totalSpent.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-2xl border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">Lucro Real</span>
                    <p className="text-base font-black text-emerald-400 mt-0.5">
                      R$ {selectedCustomer.totalGrossProfit.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-2xl border border-cyan-500/30">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase">Margem %</span>
                    <p className="text-base font-black text-cyan-400 mt-0.5">
                      {selectedCustomer.profitMargin.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Ticket Médio</span>
                    <p className="text-base font-black text-amber-400 mt-0.5">
                      R$ {selectedCustomer.averageTicket.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Produtos Favoritos & Margem */}
                <div className="pt-4 space-y-2">
                  <h3 className="font-extrabold text-slate-300 flex items-center gap-1.5 text-xs">
                    <Flame size={14} className="text-amber-400" /> Produtos Mais Pedidos & Margem Individual
                  </h3>
                  <div className="space-y-1.5">
                    {selectedCustomer.topProducts.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{p.name}</span>
                            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-black text-slate-300">
                              {p.count}x pedido
                            </span>
                            {p.isHighMargin && (
                              <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded border border-emerald-500/30">
                                Alta Margem
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Total Gasto: R$ {p.totalSpent.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-400 text-xs">
                            Lucro: R$ {p.totalProfit.toFixed(2)}
                          </span>
                          <span className="block text-[10px] text-cyan-400 font-bold">
                            Margem: {p.marginPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Histórico dos Pedidos */}
                <div className="pt-4 space-y-2">
                  <h3 className="font-extrabold text-slate-300 flex items-center gap-1.5 text-xs">
                    <Clock size={14} className="text-cyan-400" /> Histórico de Pedidos ({selectedCustomer.orders.length})
                  </h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedCustomer.orders.map((o, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {new Date(o.date).toLocaleDateString('pt-BR')} às {new Date(o.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 uppercase">
                              {o.orderType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {o.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                          </p>
                        </div>
                        <span className="font-black text-amber-400">
                          R$ {o.total.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disparo WhatsApp Personalizado */}
                {selectedCustomer.phone && (
                  <div className="pt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">Ação de Relacionamento:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsApp(selectedCustomer, 'horario_ocioso')}
                        className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-xl text-xs font-bold border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Sun size={12} /> WhatsApp (Horário Ocioso)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsApp(selectedCustomer, 'reativacao_churn')}
                        className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-bold border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Heart size={12} /> WhatsApp (Reativação)
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

        {/* MODAL DE IMPORTAÇÃO CARDÁPIO WEB (.XLSX) */}
        <ImportarClientesModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={(newImported) => {
            setImportedCustomers(newImported);
            setCrmToast(`${newImported.length} clientes importados com sucesso!`);
            setTimeout(() => setCrmToast(null), 5000);
          }}
        />

        {/* TOAST FEEDBACK */}
        {crmToast && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-emerald-600 text-white rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-200">
            <CheckCircle2 size={16} />
            <span>{crmToast}</span>
          </div>
        )}

      </div>
    </div>
  );
}
