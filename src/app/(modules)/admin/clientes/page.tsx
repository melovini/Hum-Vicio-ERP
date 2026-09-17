'use client';

import { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { 
  Users, DollarSign, TrendingUp, Clock, AlertTriangle, 
  FileSpreadsheet, RefreshCw, Star, Heart,
  Phone, MapPin, Sparkles, MessageCircle, ExternalLink, Calendar,
  CheckCircle2, Flame, ShieldAlert, Award, Coffee,
  Sun, Moon, ShoppingBag, UtensilsCrossed, ArrowRight,
  TrendingDown
} from 'lucide-react';
import { useInventory } from '@/lib/store';
import { 
  CustomerAnalyticsProfile, 
  extractCustomerAnalytics, 
  generateCustomerWhatsAppMessage, 
  getStoredImportedCustomers, 
  syncImportedCustomers, 
  subscribeToCustomerChanges,
  ImportedCustomer, 
  clearImportedCustomers
} from '@/lib/crm-clientes';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SlidingSheet } from '@/components/ui/SlidingSheet';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { 
  filterAndSortCustomers, 
  formatPhone, 
  type CustomerSegmentFilter, 
  type CustomerChannelFilter, 
  type CustomerSortOption 
} from '@/lib/customer-filters';
import ImportarClientesModal from '@/components/ImportarClientesModal';
import { cn } from '@/lib/cn';

type ActiveTab = 'lucratividade' | 'horarios_ociosos' | 'retencao_churn' | 'base_importada';

export default function ClientesAdminPage() {
  const { sales = [], products = [], getProductCmv, isLoaded } = useInventory();
  const { notify } = useToast();

  // Abas e visualizações
  const [activeTab, setActiveTab] = useState<ActiveTab>('lucratividade');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<CustomerSortOption>('lucro_desc');
  const [channelFilter, setChannelFilter] = useState<CustomerChannelFilter>('todos');
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegmentFilter>('todos');
  const deferredSearch = useDeferredValue(searchTerm);

  // Base importada externa (Cardápio Web / Planilhas)
  const [importedCustomers, setImportedCustomers] = useState<ImportedCustomer[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Cliente Selecionado para Gaveta de Detalhes
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAnalyticsProfile | null>(null);

  // Carrega a base importada do localStorage e sincroniza automaticamente com o Supabase
  useEffect(() => {
    setImportedCustomers(getStoredImportedCustomers());
    setIsSyncingCloud(true);
    setCloudSyncStatus('syncing');

    syncImportedCustomers()
      .then((res) => {
        if (res.customers) {
          setImportedCustomers(res.customers);
          setCloudSyncStatus(res.syncedToCloud ? 'synced' : 'idle');
        }
      })
      .catch((err) => {
        console.warn('Erro ao sincronizar clientes:', err);
        setCloudSyncStatus('error');
      })
      .finally(() => {
        setIsSyncingCloud(false);
      });

    const handleUpdate = () => {
      setImportedCustomers(getStoredImportedCustomers());
    };
    window.addEventListener('crm_customers_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

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
      notify({
        title: 'Nuvem sincronizada com sucesso',
        description: `${res.count} clientes disponíveis em todos os dispositivos.`,
        tone: 'success',
      });
    } catch (err: any) {
      setCloudSyncStatus('error');
      notify({
        title: 'Falha na sincronização',
        description: err?.message || 'Verifique a conexão e tente novamente.',
        tone: 'danger',
      });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Extração analítica dos perfis de clientes do ERP enriquecidos com custo e horários
  const allProfiles = useMemo(() => {
    return extractCustomerAnalytics(sales, products, getProductCmv, importedCustomers);
  }, [sales, products, getProductCmv, importedCustomers]);

  // Perfis filtrados e ordenados
  const filteredProfiles = useMemo(() => {
    let effectiveSegment = segmentFilter;
    if (activeTab === 'horarios_ociosos') effectiveSegment = 'ociosos';
    if (activeTab === 'retencao_churn') effectiveSegment = 'risco';

    return filterAndSortCustomers(
      allProfiles,
      deferredSearch,
      effectiveSegment,
      channelFilter,
      sortBy,
    );
  }, [allProfiles, deferredSearch, segmentFilter, channelFilter, sortBy, activeTab]);

  // Métricas agregadas do CRM
  const metrics = useMemo(() => {
    const totalCustomers = allProfiles.length;
    const totalProfit = allProfiles.reduce((acc, p) => acc + p.totalGrossProfit, 0);
    const totalSpent = allProfiles.reduce((acc, p) => acc + p.totalSpent, 0);
    const avgMargin = totalSpent > 0 ? (totalProfit / totalSpent) * 100 : 0;
    const offPeakHeroCount = allProfiles.filter((p) => p.isOffPeakHero).length;
    const churnRiskCount = allProfiles.filter(
      (p) => p.churnRisk === 'em_risco' || p.churnRisk === 'churn',
    ).length;

    return {
      totalCustomers,
      totalProfit,
      totalSpent,
      avgMargin,
      offPeakHeroCount,
      churnRiskCount,
    };
  }, [allProfiles]);

  if (!isLoaded) {
    return (
      <div role="status" aria-label="Carregando clientes" className="mx-auto max-w-6xl space-y-6 p-6">
        <span className="sr-only">Carregando clientes…</span>
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((id) => (
            <Skeleton key={id} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const clearFilters = () => {
    setSearchTerm('');
    setChannelFilter('todos');
    setSegmentFilter('todos');
    setSortBy('lucro_desc');
  };

  const filtersActive = Boolean(
    searchTerm || channelFilter !== 'todos' || segmentFilter !== 'todos' || sortBy !== 'lucro_desc',
  );

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        <PageHeader
          title="Clientes & CRM"
          eyebrow="Relacionamento e Lucratividade"
          description="Inteligência de clientes: rastreie lucratividade real, hábitos de consumo em horários ociosos e recuperação de churn."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleForceCloudSync}
                loading={isSyncingCloud}
                leadingIcon={<RefreshCw size={16} className={isSyncingCloud ? 'animate-spin' : ''} aria-hidden="true" />}
              >
                {cloudSyncStatus === 'synced' ? 'Nuvem Sincronizada' : 'Sincronizar Nuvem'}
              </Button>
              <Button
                onClick={() => setShowImportModal(true)}
                leadingIcon={<FileSpreadsheet size={18} aria-hidden="true" />}
              >
                Importar base de clientes
              </Button>
            </div>
          }
        />

        {/* KPIs Resumo do CRM */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-dialog border border-border-default bg-surface-card p-5 shadow-elevated">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">
              Base Identificada
            </span>
            <span className="text-2xl font-mono font-bold text-text-primary tabular-nums block">
              {metrics.totalCustomers}
            </span>
            <span className="text-xs text-text-secondary mt-1 block">Clientes com pedidos no ERP</span>
          </div>

          <div className="rounded-dialog border border-emerald-500/30 bg-surface-card p-5 shadow-elevated border-t-4 border-t-emerald-500">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">
              Lucro Bruto Gerado
            </span>
            <span className="text-2xl font-mono font-bold text-emerald-400 tabular-nums block">
              R$ {metrics.totalProfit.toFixed(2)}
            </span>
            <span className="text-xs text-text-secondary mt-1 block">Margem Média: {metrics.avgMargin.toFixed(1)}%</span>
          </div>

          <div className="rounded-dialog border border-amber-500/30 bg-surface-card p-5 shadow-elevated border-t-4 border-t-amber-500">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">
              Heróis de Horários Ociosos
            </span>
            <span className="text-2xl font-mono font-bold text-amber-400 tabular-nums block">
              {metrics.offPeakHeroCount}
            </span>
            <span className="text-xs text-text-secondary mt-1 block">Compram fora do pico de atendimento</span>
          </div>

          <div className="rounded-dialog border border-status-danger/30 bg-surface-card p-5 shadow-elevated border-t-4 border-t-status-danger">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">
              Em Risco de Churn
            </span>
            <span className="text-2xl font-mono font-bold text-status-danger tabular-nums block">
              {metrics.churnRiskCount}
            </span>
            <span className="text-xs text-text-secondary mt-1 block">&gt; 30 dias sem realizar pedidos</span>
          </div>
        </div>

        {/* Abas */}
        <div role="tablist" aria-label="Abas analíticas de clientes" className="flex border-b border-border-default overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'lucratividade'}
            onClick={() => {
              setActiveTab('lucratividade');
              setSegmentFilter('todos');
            }}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'lucratividade'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <DollarSign size={16} aria-hidden="true" />
            <span>Ranking de Lucratividade</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'horarios_ociosos'}
            onClick={() => setActiveTab('horarios_ociosos')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'horarios_ociosos'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <Sun size={16} className="text-amber-400" aria-hidden="true" />
            <span>Horários Ociosos</span>
            {metrics.offPeakHeroCount > 0 && (
              <span className="rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                {metrics.offPeakHeroCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'retencao_churn'}
            onClick={() => setActiveTab('retencao_churn')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'retencao_churn'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <ShieldAlert size={16} className="text-status-danger" aria-hidden="true" />
            <span>Radar de Churn</span>
            {metrics.churnRiskCount > 0 && (
              <span className="rounded-full bg-status-danger/20 text-red-300 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                {metrics.churnRiskCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'base_importada'}
            onClick={() => setActiveTab('base_importada')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'base_importada'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <FileSpreadsheet size={16} aria-hidden="true" />
            <span>Base Importada ({importedCustomers.length})</span>
          </button>
        </div>

        {activeTab !== 'base_importada' ? (
          <>
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchLabel="Buscar clientes"
              placeholder="Nome, telefone ou endereço..."
              resultCount={filteredProfiles.length}
              totalCount={allProfiles.length}
              active={filtersActive}
              onClear={clearFilters}
            >
              <div className="space-y-1.5 sm:w-44">
                <label htmlFor="client-sort-select" className="block text-sm font-medium text-text-secondary">
                  Ordenação
                </label>
                <Select
                  id="client-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as CustomerSortOption)}
                >
                  <option value="lucro_desc">Maior Lucro Bruto</option>
                  <option value="margem_desc">Maior Margem %</option>
                  <option value="receita_desc">Maior Receita Total</option>
                  <option value="pedidos_desc">Mais Pedidos</option>
                  <option value="recencia_desc">Mais Recentes</option>
                </Select>
              </div>

              <div className="space-y-1.5 sm:w-40">
                <label htmlFor="client-channel-select" className="block text-sm font-medium text-text-secondary">
                  Canal Principal
                </label>
                <Select
                  id="client-channel-select"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as CustomerChannelFilter)}
                >
                  <option value="todos">Todos os canais</option>
                  <option value="balcao">Balcão / Salão</option>
                  <option value="ifood">iFood</option>
                </Select>
              </div>
            </FilterBar>

            {filteredProfiles.length === 0 ? (
              <EmptyState
                title={allProfiles.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente registrado'}
                description={
                  allProfiles.length
                    ? 'Tente pesquisar com outro termo ou redefina os filtros para localizar os clientes.'
                    : 'Os clientes serão identificados e analisados automaticamente conforme vendas forem concluídas no Caixa.'
                }
                icon={<Users aria-hidden="true" />}
                action={
                  allProfiles.length ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-dialog border border-border-default bg-surface-card shadow-elevated">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Contato / Endereço</th>
                      <th className="p-4 text-center">Pedidos</th>
                      <th className="p-4 text-right">Receita Total</th>
                      <th className="p-4 text-right">Lucro Bruto</th>
                      <th className="p-4 text-center">Margem %</th>
                      <th className="p-4 text-center">Segmentação</th>
                      <th className="p-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50 text-sm">
                    {filteredProfiles.map((customer) => {
                      const isVip = customer.badges.includes('vip_lucro');
                      const isHero = customer.isOffPeakHero;
                      const isRisk = customer.churnRisk === 'em_risco' || customer.churnRisk === 'churn';

                      return (
                        <tr
                          key={customer.id}
                          className={cn(
                            'hover:bg-surface-elevated/40 transition-colors',
                            isVip && 'bg-brand-primary/5',
                            isRisk && 'bg-status-danger/5',
                          )}
                        >
                          <td className="p-4 font-medium text-text-primary">
                            <div className="space-y-0.5">
                              <span className="font-semibold block">{customer.name}</span>
                              <span className="text-xs text-text-muted flex items-center gap-1 font-mono">
                                <Calendar size={12} /> {customer.daysSinceLastOrder === 0 ? 'Hoje' : `${customer.daysSinceLastOrder} dias atrás`}
                              </span>
                            </div>
                          </td>

                          <td className="p-4 text-text-secondary text-xs">
                            <div className="space-y-0.5">
                              {customer.phone ? (
                                <span className="flex items-center gap-1 font-mono">
                                  <Phone size={12} className="text-emerald-400" />
                                  {formatPhone(customer.phone)}
                                </span>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                              {customer.address && (
                                <span className="truncate block max-w-xs text-text-muted">
                                  {customer.address}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-4 text-center font-mono font-semibold tabular-nums">
                            {customer.totalOrders}
                          </td>

                          <td className="p-4 text-right font-mono tabular-nums text-text-secondary">
                            R$ {customer.totalSpent.toFixed(2)}
                          </td>

                          <td className="p-4 text-right font-mono font-bold tabular-nums text-emerald-400">
                            R$ {customer.totalGrossProfit.toFixed(2)}
                          </td>

                          <td className="p-4 text-center font-mono tabular-nums">
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 text-xs font-bold',
                                customer.profitMargin >= 55
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : customer.profitMargin >= 40
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-status-danger/15 text-red-300',
                              )}
                            >
                              {customer.profitMargin.toFixed(1)}%
                            </span>
                          </td>

                          <td className="p-4 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {isVip && (
                                <Badge variant="warning" dot>
                                  VIP Lucro
                                </Badge>
                              )}
                              {isHero && (
                                <Badge variant="neutral">
                                  ☀️ Horário Ocioso
                                </Badge>
                              )}
                              {isRisk && (
                                <Badge variant="danger" dot>
                                  Risco Churn
                                </Badge>
                              )}
                              {!isVip && !isHero && !isRisk && (
                                <Badge variant="neutral">Ativo</Badge>
                              )}
                            </div>
                          </td>

                          <td className="p-4 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedCustomer(customer)}
                            >
                              Ver Perfil
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* Aba: Base Importada Externa */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 rounded-dialog border border-border-default bg-surface-card p-5 shadow-elevated">
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Base Externa de Clientes (Cardápio Web / Planilhas)
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Estes clientes enriquecem instantaneamente o autocomplete no PDV/Caixa com telefones e endereços.
                </p>
              </div>

              {importedCustomers.length > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm('Deseja realmente limpar toda a base importada de clientes?')) {
                      clearImportedCustomers();
                      setImportedCustomers([]);
                      notify({
                        title: 'Base importada limpa',
                        description: 'Todos os registros de planilhas foram removidos.',
                        tone: 'info',
                      });
                    }
                  }}
                >
                  Limpar base importada
                </Button>
              )}
            </div>

            {importedCustomers.length === 0 ? (
              <EmptyState
                title="Nenhum cliente importado"
                description="Importe planilhas de pedidos ou do Cardápio Web (.xlsx) para enriquecer o banco de dados."
                icon={<FileSpreadsheet aria-hidden="true" />}
                action={
                  <Button onClick={() => setShowImportModal(true)}>
                    Importar primeira planilha
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-dialog border border-border-default bg-surface-card shadow-elevated">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <th className="p-4">Nome</th>
                      <th className="p-4">Telefone</th>
                      <th className="p-4">Endereço Completo</th>
                      <th className="p-4 text-center">Pedidos Anteriores</th>
                      <th className="p-4 text-right">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50 text-sm">
                    {importedCustomers.slice(0, 100).map((imp) => (
                      <tr key={imp.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="p-4 font-medium text-text-primary">{imp.name}</td>
                        <td className="p-4 font-mono text-xs text-text-secondary">
                          {formatPhone(imp.phone) || '—'}
                        </td>
                        <td className="p-4 text-xs text-text-muted">
                          {imp.fullAddress || imp.address || '—'}
                        </td>
                        <td className="p-4 text-center font-mono font-bold tabular-nums">
                          {imp.totalOrders}
                        </td>
                        <td className="p-4 text-right">
                          <span className="rounded bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary border border-border-default">
                            {imp.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SlidingSheet: Detalhes Completos do Cliente & Ações de CRM */}
        <SlidingSheet
          isOpen={Boolean(selectedCustomer)}
          onClose={() => setSelectedCustomer(null)}
          title={selectedCustomer?.name || 'Perfil do Cliente'}
          description="Histórico de consumo, lucratividade real e mensagens contextuais para WhatsApp."
        >
          {selectedCustomer && (
            <div className="space-y-6 pb-6">
              {/* Card Resumo */}
              <div className="rounded-xl border border-border-default bg-surface-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{selectedCustomer.name}</h3>
                    {selectedCustomer.phone && (
                      <span className="text-sm font-mono text-emerald-400 block">
                        {formatPhone(selectedCustomer.phone)}
                      </span>
                    )}
                  </div>

                  {selectedCustomer.phone && (
                    <a
                      href={generateCustomerWhatsAppMessage(selectedCustomer, 'livre').url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                    >
                      <MessageCircle size={15} /> WhatsApp
                    </a>
                  )}
                </div>

                {selectedCustomer.address && (
                  <p className="text-xs text-text-muted flex items-start gap-1.5 pt-2 border-t border-border-default">
                    <MapPin size={14} className="flex-shrink-0 mt-0.5 text-text-secondary" />
                    <span>{selectedCustomer.address}</span>
                  </p>
                )}
              </div>

              {/* Métricas Financeiras */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border-default bg-surface-card p-3">
                  <span className="text-xs text-text-muted block">Lucro Bruto Total:</span>
                  <span className="text-lg font-mono font-bold text-emerald-400 block tabular-nums">
                    R$ {selectedCustomer.totalGrossProfit.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-text-muted">Margem: {selectedCustomer.profitMargin.toFixed(1)}%</span>
                </div>

                <div className="rounded-xl border border-border-default bg-surface-card p-3">
                  <span className="text-xs text-text-muted block">Ticket Médio:</span>
                  <span className="text-lg font-mono font-bold text-text-primary block tabular-nums">
                    R$ {selectedCustomer.averageTicket.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-text-muted">{selectedCustomer.totalOrders} pedidos realizados</span>
                </div>
              </div>

              {/* Produtos Favoritos */}
              {selectedCustomer.topProducts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Produtos Mais Pedidos
                  </h4>
                  <div className="space-y-1.5">
                    {selectedCustomer.topProducts.map((prod, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-border-default/60 bg-surface-card p-2.5 text-xs"
                      >
                        <span className="font-semibold text-text-primary">{prod.name}</span>
                        <div className="flex items-center gap-3 font-mono tabular-nums">
                          <span className="text-text-muted">{prod.count}x</span>
                          <span className="font-bold text-emerald-400">R$ {prod.totalProfit.toFixed(2)} lucro</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico Recente de Pedidos */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Histórico de Pedidos ({selectedCustomer.orders.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedCustomer.orders.map((ord, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border-default bg-surface-card p-3 text-xs space-y-1.5"
                    >
                      <div className="flex justify-between font-mono font-bold">
                        <span className="text-text-primary">
                          {new Date(ord.date).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(ord.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-emerald-400">R$ {ord.total.toFixed(2)}</span>
                      </div>
                      <p className="text-text-secondary">
                        {ord.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SlidingSheet>

        {/* Modal de Importação de Clientes */}
        <ImportarClientesModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={(newlyImported) => {
            setImportedCustomers(newlyImported);
            notify({
              title: 'Importação concluída com sucesso',
              description: `${newlyImported.length} clientes agora estão disponíveis na base.`,
              tone: 'success',
            });
          }}
        />
      </div>
    </div>
  );
}
