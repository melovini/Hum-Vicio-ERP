'use client';

import { useDeferredValue, useState } from 'react';
import { useInventory } from '@/lib/store';
import { 
  ClipboardCheck, 
  History, 
  RefreshCw, 
  Save, 
  TrendingDown, 
  TrendingUp, 
  Scale, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Boxes
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { 
  calculateAuditAnalysis, 
  filterAuditItems, 
  type AuditFilterMode 
} from '@/lib/inventory-audit-helpers';
import { cn } from '@/lib/cn';

export default function InventarioFisicoPage() {
  const { items, isLoaded, saveStockAudit, stockAudits } = useInventory();
  const { notify } = useToast();

  // Estado das contagens: { [itemId]: string }
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [auditorName, setAuditorName] = useState('');
  const [auditorNameError, setAuditorNameError] = useState('');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<AuditFilterMode>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);

  // Modal de confirmação
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Abas: "Auditoria Ativa" ou "Histórico de Auditorias"
  const [activeTab, setActiveTab] = useState<'audit' | 'history'>('audit');

  if (!isLoaded) {
    return (
      <div role="status" aria-label="Carregando inventário" className="mx-auto max-w-6xl space-y-6 p-6">
        <span className="sr-only">Carregando inventário…</span>
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((id) => (
            <Skeleton key={id} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  // Análise em tempo real de contagem, progresso e divergências
  const analysis = calculateAuditAnalysis(items, counts);

  // Itens filtrados para a tabela
  const filteredList = filterAuditItems(
    analysis.auditedList,
    deferredSearch,
    filterMode,
    categoryFilter,
  );

  // Categorias disponíveis
  const categories = [
    ...new Set(items.map((i) => (i.category || 'Geral').trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filtersActive = Boolean(searchTerm || categoryFilter || filterMode !== 'all');

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setFilterMode('all');
  };

  const handleCountChange = (itemId: string, val: string) => {
    setCounts((prev) => ({ ...prev, [itemId]: val }));
  };

  const fillAllWithSystemStock = () => {
    const initial: Record<string, string> = {};
    items.forEach((i) => {
      if (i.isActive !== false) {
        initial[i.id] = i.currentStock.toString();
      }
    });
    setCounts(initial);
    notify({
      title: 'Saldos teóricos preenchidos',
      description: 'Todos os insumos ativos foram pré-preenchidos como base de conferência.',
      tone: 'info',
    });
  };

  const resetCounts = () => {
    setCounts({});
    notify({
      title: 'Contagens limpas',
      description: 'Todos os campos de contagem física foram resetados.',
      tone: 'info',
    });
  };

  const handleOpenConfirm = () => {
    if (!auditorName.trim()) {
      setAuditorNameError('Informe o nome do auditor responsável.');
      notify({
        title: 'Nome do auditor obrigatório',
        description: 'Digite quem realizou a conferência antes de efetivar o ajuste.',
        tone: 'danger',
      });
      return;
    }
    setAuditorNameError('');

    const itemsCounted = analysis.auditedList.filter((i) => counts[i.id] !== undefined && counts[i.id].trim() !== '');
    if (itemsCounted.length === 0) {
      notify({
        title: 'Nenhuma contagem digitada',
        description: 'Preencha a contagem física de pelo menos um insumo antes de salvar.',
        tone: 'danger',
      });
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmSaveAudit = async () => {
    setIsSaving(true);
    const itemsCounted = analysis.auditedList.filter((i) => counts[i.id] !== undefined && counts[i.id].trim() !== '');

    try {
      const res = await saveStockAudit(
        auditorName.trim(),
        itemsCounted,
        analysis.netVarianceCost,
      );

      if (res.success) {
        notify({
          title: 'Inventário físico auditado com sucesso',
          description: `${itemsCounted.length} insumos conferidos e saldos de estoque sincronizados.`,
          tone: 'success',
        });
        setCounts({});
        setIsConfirmOpen(false);
      } else {
        notify({
          title: 'Não foi possível salvar o inventário',
          description: res.error || 'Verifique a conexão e tente novamente.',
          tone: 'danger',
        });
      }
    } catch {
      notify({
        title: 'Erro inesperado ao sincronizar',
        description: 'Os dados foram preservados. Tente novamente em instantes.',
        tone: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const changedItemsCount = analysis.auditedList.filter(
    (i) => counts[i.id] !== undefined && counts[i.id].trim() !== '' && i.diff !== 0,
  ).length;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        <PageHeader
          title="Inventário Físico"
          eyebrow="Auditoria de Estoque"
          description="Contagem presencial mobile-first: confronte quantidades físicas com o estoque teórico e apure sobras ou faltas."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={fillAllWithSystemStock}
                leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
                title="Preenche todos os campos com o saldo teórico como ponto de partida"
              >
                Preencher com saldo atual
              </Button>
              {analysis.countedItemsCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={resetCounts}
                  leadingIcon={<RotateCcw size={16} aria-hidden="true" />}
                >
                  Limpar contagens
                </Button>
              )}
            </div>
          }
        />

        {/* Abas */}
        <div className="flex border-b border-border-default">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer',
              activeTab === 'audit'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <ClipboardCheck size={16} aria-hidden="true" />
            <span>Auditoria Ativa</span>
            {analysis.countedItemsCount > 0 && (
              <span className="rounded-full bg-brand-primary/20 text-brand-primary px-2 py-0.5 font-mono text-[11px] font-bold">
                {analysis.progressPercentage}%
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer',
              activeTab === 'history'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <History size={16} aria-hidden="true" />
            <span>Histórico de Auditorias</span>
            {stockAudits.length > 0 && (
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-mono text-[11px] text-text-secondary">
                {stockAudits.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'audit' ? (
          <>
            {/* Cartão de Auditor Responsável e Progresso de Digitação Mobile-First */}
            <div className="rounded-dialog border border-border-default bg-surface-card p-6 shadow-elevated space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
                <FormField
                  label="Auditor Responsável"
                  required
                  error={auditorNameError}
                  hint="Nome do operador que executou a conferência física nas prateleiras e freezers."
                >
                  <Input
                    value={auditorName}
                    onChange={(e) => {
                      setAuditorName(e.target.value);
                      if (auditorNameError) setAuditorNameError('');
                    }}
                    placeholder="Ex: João Silva"
                  />
                </FormField>

                <div className="space-y-2 sm:border-l sm:border-border-default sm:pl-6">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-text-secondary">Progresso da Contagem:</span>
                    <span className="font-mono text-text-primary">
                      {analysis.countedItemsCount} de {analysis.totalActiveCount} insumos ({analysis.progressPercentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-elevated border border-border-default">
                    <div
                      className="h-full bg-brand-primary transition-all duration-300"
                      style={{ width: `${analysis.progressPercentage}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-text-muted block">
                    {analysis.totalActiveCount - analysis.countedItemsCount === 0
                      ? 'Todos os insumos ativos foram contados!'
                      : `${analysis.totalActiveCount - analysis.countedItemsCount} insumos pendentes de conferência.`}
                  </span>
                </div>
              </div>
            </div>

            {/* KPIs de Divergência Apurada */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-dialog border border-status-danger/30 bg-surface-card p-5 shadow-elevated border-t-4 border-t-status-danger">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">
                      Faltas Apuradas (Furo / Desvio)
                    </span>
                    <span className="text-2xl font-mono font-bold text-status-danger tabular-nums block">
                      - R$ {analysis.totalMissingCost.toFixed(2)}
                    </span>
                  </div>
                  <TrendingDown size={24} className="text-status-danger/70" aria-hidden="true" />
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Saldo físico menor que o registrado no sistema.
                </p>
              </div>

              <div className="rounded-dialog border border-status-warning/30 bg-surface-card p-5 shadow-elevated border-t-4 border-t-status-warning">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">
                      Sobras Apuradas
                    </span>
                    <span className="text-2xl font-mono font-bold text-amber-400 tabular-nums block">
                      + R$ {analysis.totalSurplusCost.toFixed(2)}
                    </span>
                  </div>
                  <TrendingUp size={24} className="text-amber-400/70" aria-hidden="true" />
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Quantidade encontrada maior que o teórico.
                </p>
              </div>

              <div
                className={cn(
                  'rounded-dialog border bg-surface-card p-5 shadow-elevated border-t-4',
                  analysis.netVarianceCost >= 0
                    ? 'border-emerald-500/30 border-t-emerald-500'
                    : 'border-status-danger/30 border-t-status-danger',
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">
                      Variação Líquida do Inventário
                    </span>
                    <span
                      className={cn(
                        'text-2xl font-mono font-bold tabular-nums block',
                        analysis.netVarianceCost >= 0 ? 'text-emerald-400' : 'text-status-danger',
                      )}
                    >
                      {analysis.netVarianceCost >= 0 ? '+' : ''} R$ {analysis.netVarianceCost.toFixed(2)}
                    </span>
                  </div>
                  <Scale size={24} className="text-text-muted" aria-hidden="true" />
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Impacto patrimonial direto no fechamento de estoque.
                </p>
              </div>
            </div>

            {/* Barra de Filtros */}
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchLabel="Buscar insumo na auditoria"
              placeholder="Nome ou categoria..."
              resultCount={filteredList.length}
              totalCount={analysis.totalActiveCount}
              active={filtersActive}
              onClear={clearFilters}
            >
              <div className="space-y-1.5 sm:w-44">
                <label htmlFor="audit-category-filter" className="block text-sm font-medium text-text-secondary">
                  Categoria
                </label>
                <Select
                  id="audit-category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-6">
                <button
                  type="button"
                  onClick={() => setFilterMode(filterMode === 'pending' ? 'all' : 'pending')}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-1.5 rounded-control border px-3 text-xs font-semibold transition-colors cursor-pointer',
                    filterMode === 'pending'
                      ? 'border-brand-primary/40 bg-brand-primary/15 text-brand-primary'
                      : 'border-border-default bg-surface-elevated text-text-secondary hover:text-text-primary',
                  )}
                >
                  <span>Pendentes ({analysis.totalActiveCount - analysis.countedItemsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode(filterMode === 'divergent' ? 'all' : 'divergent')}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-1.5 rounded-control border px-3 text-xs font-semibold transition-colors cursor-pointer',
                    filterMode === 'divergent'
                      ? 'border-status-danger/40 bg-status-danger/15 text-red-300'
                      : 'border-border-default bg-surface-elevated text-text-secondary hover:text-text-primary',
                  )}
                >
                  <AlertTriangle size={14} className={analysis.divergentCount > 0 ? 'text-status-danger' : ''} />
                  <span>Com divergência ({analysis.divergentCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode(filterMode === 'matching' ? 'all' : 'matching')}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-1.5 rounded-control border px-3 text-xs font-semibold transition-colors cursor-pointer',
                    filterMode === 'matching'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-border-default bg-surface-elevated text-text-secondary hover:text-text-primary',
                  )}
                >
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>Sem desvio ({analysis.matchingCount})</span>
                </button>
              </div>
            </FilterBar>

            {/* Tabela de Confronto */}
            {filteredList.length === 0 ? (
              <EmptyState
                title={items.length ? 'Nenhum item corresponde ao filtro' : 'Nenhum insumo ativo para auditar'}
                description={
                  items.length
                    ? 'Altere a busca ou redefina os filtros para localizar os insumos desejados.'
                    : 'Cadastre insumos no estoque para iniciar a rotina de inventário físico.'
                }
                icon={<Boxes aria-hidden="true" />}
                action={
                  items.length ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-dialog border border-border-default bg-surface-card shadow-elevated">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                        <th className="p-4">Insumo</th>
                        <th className="p-4">Categoria</th>
                        <th className="p-4 text-right">Estoque Teórico</th>
                        <th className="p-4 text-center w-40">Contagem Física</th>
                        <th className="p-4 text-right">Diferença</th>
                        <th className="p-4 text-right">Divergência (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default/50 text-sm">
                      {filteredList.map((item) => {
                        const countStr = counts[item.id] ?? '';
                        const hasCount = item.isCounted;

                        return (
                          <tr
                            key={item.id}
                            className={cn(
                              'hover:bg-surface-elevated/40 transition-colors',
                              hasCount && item.diff < 0 && 'bg-status-danger/5',
                              hasCount && item.diff > 0 && 'bg-status-warning/5',
                              hasCount && item.diff === 0 && 'bg-emerald-500/5',
                            )}
                          >
                            <td className="p-4 font-medium text-text-primary">
                              <span>{item.name}</span>
                              <span className="block text-xs font-mono tabular-nums text-text-muted font-normal mt-0.5">
                                Custo: R$ {item.costPerUnit.toFixed(2)} / {item.unit}
                              </span>
                            </td>
                            <td className="p-4 text-text-secondary text-xs">
                              <span className="rounded bg-surface-elevated px-2 py-0.5 border border-border-default">
                                {item.category}
                              </span>
                            </td>
                            <td className="p-4 text-right font-mono tabular-nums font-semibold text-text-secondary">
                              {item.systemStock} {item.unit}
                            </td>
                            <td className="p-4 text-center">
                              <div className="inline-flex justify-center w-full">
                                <input
                                  type="number"
                                  step="0.01"
                                  aria-label={`Contagem física de ${item.name}`}
                                  value={countStr}
                                  onChange={(e) => handleCountChange(item.id, e.target.value)}
                                  placeholder={item.systemStock.toString()}
                                  className={cn(
                                    'w-32 min-h-11 rounded-control border px-3 py-2 text-center font-mono font-bold text-sm outline-none transition-colors duration-150',
                                    hasCount
                                      ? item.diff === 0
                                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                                        : item.diff < 0
                                          ? 'border-status-danger/60 bg-status-danger/10 text-red-300'
                                          : 'border-status-warning/60 bg-status-warning/10 text-amber-300'
                                      : 'border-border-default bg-surface-elevated text-text-primary focus:border-brand-primary',
                                  )}
                                />
                              </div>
                            </td>
                            <td className="p-4 text-right font-mono tabular-nums text-xs">
                              {hasCount ? (
                                item.diff === 0 ? (
                                  <Badge variant="success">Sem desvio</Badge>
                                ) : item.diff < 0 ? (
                                  <span className="font-bold text-status-danger">
                                    {item.diff} {item.unit}
                                  </span>
                                ) : (
                                  <span className="font-bold text-amber-400">
                                    +{item.diff} {item.unit}
                                  </span>
                                )
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                            <td className="p-4 text-right font-mono tabular-nums font-bold text-sm">
                              {hasCount ? (
                                item.varianceCost === 0 ? (
                                  <span className="text-text-muted">R$ 0.00</span>
                                ) : item.varianceCost < 0 ? (
                                  <span className="text-status-danger">
                                    - R$ {Math.abs(item.varianceCost).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-amber-400">
                                    + R$ {item.varianceCost.toFixed(2)}
                                  </span>
                                )
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Barra de Ação Inferior */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-dialog border border-border-default bg-surface-card p-6 shadow-elevated">
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="text-sm font-semibold text-text-primary">
                      Pronto para efetivar a auditoria?
                    </p>
                    <p className="text-xs text-text-muted">
                      Os saldos reais digitados substituirão os estoques vigentes e uma trilha de auditoria será gerada.
                    </p>
                  </div>

                  <Button
                    onClick={handleOpenConfirm}
                    disabled={analysis.countedItemsCount === 0}
                    leadingIcon={<Save size={18} aria-hidden="true" />}
                  >
                    Efetivar ajuste de inventário
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Aba: Histórico de Auditorias */
          <div className="space-y-4">
            {stockAudits.length === 0 ? (
              <EmptyState
                title="Nenhum relatório de auditoria"
                description="Os inventários físicos finalizados e confrontados serão arquivados aqui para controle contábil e fiscal."
                icon={<History aria-hidden="true" />}
                action={
                  <Button onClick={() => setActiveTab('audit')}>
                    Iniciar auditoria física
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {stockAudits.map((audit) => {
                  const auditDate = audit.createdAt
                    ? new Date(audit.createdAt).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : '—';

                  const changedItems = audit.items.filter((i) => i.diff !== 0);

                  return (
                    <div
                      key={audit.id}
                      className="rounded-dialog border border-border-default bg-surface-card p-5 shadow-elevated space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-border-default">
                        <div>
                          <span className="text-sm font-bold text-text-primary block">
                            Auditoria em {auditDate}
                          </span>
                          <span className="text-xs text-text-secondary">
                            Auditor: <strong className="text-text-primary">{audit.auditedBy}</strong>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-text-muted block">Impacto Financeiro Líquido:</span>
                          <span
                            className={cn(
                              'font-mono font-bold text-sm tabular-nums',
                              audit.totalVarianceCost >= 0 ? 'text-emerald-400' : 'text-status-danger',
                            )}
                          >
                            {audit.totalVarianceCost < 0
                              ? `- R$ ${Math.abs(audit.totalVarianceCost).toFixed(2)}`
                              : audit.totalVarianceCost > 0
                                ? `+ R$ ${audit.totalVarianceCost.toFixed(2)}`
                                : 'R$ 0.00'}
                          </span>
                        </div>
                      </div>

                      {changedItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {changedItems.map((item, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                'text-xs px-2.5 py-1 rounded-control font-mono font-medium tabular-nums border',
                                item.diff < 0
                                  ? 'bg-status-danger/10 text-red-300 border-status-danger/30'
                                  : 'bg-status-warning/10 text-amber-300 border-status-warning/30',
                              )}
                            >
                              {item.name}: {item.diff > 0 ? '+' : ''}
                              {item.diff} {item.unit} (
                              {item.varianceCost < 0
                                ? `- R$ ${Math.abs(item.varianceCost).toFixed(2)}`
                                : item.varianceCost > 0
                                  ? `+ R$ ${item.varianceCost.toFixed(2)}`
                                  : 'R$ 0.00'}
                              )
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted">Todos os itens conferidos bateram com o saldo teórico.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal de Confirmação de Ajuste de Inventário */}
        <ConfirmDialog
          open={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleConfirmSaveAudit}
          loading={isSaving}
          title="Efetivar ajuste de inventário?"
          description={`A auditoria realizada por ${auditorName.trim()} atualizará os saldos teóricos do sistema com as contagens físicas.`}
          details={`${changedItemsCount} insumos sofrerão alteração direta no estoque com impacto líquido de R$ ${analysis.netVarianceCost.toFixed(2)}.`}
          confirmLabel="Efetivar ajuste"
          tone={analysis.netVarianceCost < 0 ? 'danger' : 'warning'}
        />
      </div>
    </div>
  );
}
