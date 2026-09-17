'use client';

import { useDeferredValue, useState } from 'react';
import Link from 'next/link';
import { 
  useInventory, 
  type InventoryItem 
} from '@/lib/store';
import { 
  ShoppingCart, 
  Truck, 
  Plus, 
  ArrowRight, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  PackageCheck,
  History,
  Info
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { 
  filterPurchaseItems, 
  calculatePurchaseTotals, 
  isItemUrgent, 
  isItemPredictive,
  type PurchaseFilterMode 
} from '@/lib/purchase-filters';
import { cn } from '@/lib/cn';

export default function GestaoComprasPage() {
  const { 
    items, 
    recordPurchaseWithSupplier, 
    suppliers, 
    isLoaded, 
    sales,
    purchaseRecords 
  } = useInventory();
  
  const { notify } = useToast();

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<PurchaseFilterMode>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);

  // Modal / Fluxo de Compra
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [costError, setCostError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tabs da tela: "Planejamento e Insumos" ou "Histórico de Compras"
  const [activeTab, setActiveTab] = useState<'items' | 'history'>('items');

  if (!isLoaded) {
    return (
      <div role="status" aria-label="Carregando compras" className="mx-auto max-w-6xl space-y-6 p-6">
        <span className="sr-only">Carregando compras…</span>
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

  const salesCount = sales?.length || 0;

  // Itens filtrados
  const filteredItems = filterPurchaseItems(
    items,
    deferredSearch,
    filterMode,
    categoryFilter,
    salesCount,
  ).sort((a, b) => {
    // Ordena: urgentes primeiro, depois preditivos, depois alfabético
    const aUrgent = isItemUrgent(a);
    const bUrgent = isItemUrgent(b);
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;

    const aPred = isItemPredictive(a, salesCount);
    const bPred = isItemPredictive(b, salesCount);
    if (aPred && !bPred) return -1;
    if (!aPred && bPred) return 1;

    return a.name.localeCompare(b.name, 'pt-BR');
  });

  // Contagens para os botões de filtro
  const urgentCount = items.filter(isItemUrgent).length;
  const predictiveCount = items.filter((i) => isItemPredictive(i, salesCount)).length;

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

  // Insumo selecionado para a compra no modal
  const selectedItem = items.find((i) => i.id === selectedItemId);

  // Cálculos dinâmicos em tempo real de conferência
  const parsedQty = parseFloat(quantityInput) || 0;
  const parsedCost = parseFloat(costInput) || (selectedItem ? selectedItem.costPerUnit : 0);
  const calculations = selectedItem
    ? calculatePurchaseTotals(parsedQty, parsedCost, selectedItem.costPerUnit, selectedItem.currentStock)
    : { totalCost: 0, newStock: 0, costDiffPercentage: 0 };

  const openPurchaseModal = (item?: InventoryItem) => {
    if (item) {
      setSelectedItemId(item.id);
      setCostInput(item.costPerUnit > 0 ? item.costPerUnit.toString() : '');
    } else {
      setSelectedItemId(items[0]?.id || '');
      setCostInput(items[0]?.costPerUnit ? items[0].costPerUnit.toString() : '');
    }
    setSelectedSupplierId('');
    setQuantityInput('');
    setQuantityError('');
    setCostError('');
    setIsModalOpen(true);
  };

  const handleItemSelectChange = (newId: string) => {
    setSelectedItemId(newId);
    const newItem = items.find((i) => i.id === newId);
    if (newItem && (!costInput || costInput === '0')) {
      setCostInput(newItem.costPerUnit > 0 ? newItem.costPerUnit.toString() : '');
    }
  };

  const handleConfirmPurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItemId || !selectedItem) {
      notify({
        title: 'Selecione um insumo',
        description: 'É necessário informar qual item de estoque receberá a entrada.',
        tone: 'danger',
      });
      return;
    }

    if (parsedQty <= 0) {
      setQuantityError('Informe uma quantidade maior que zero.');
      return;
    }
    setQuantityError('');

    if (parsedCost < 0) {
      setCostError('O custo unitário não pode ser negativo.');
      return;
    }
    setCostError('');

    setIsSubmitting(true);
    const sup = suppliers.find((s) => s.id === selectedSupplierId);

    try {
      await recordPurchaseWithSupplier(
        selectedItemId,
        parsedQty,
        parsedCost,
        selectedSupplierId || undefined,
        sup?.name,
      );

      notify({
        title: 'Entrada confirmada no estoque',
        description: `${parsedQty} ${selectedItem.unit} de ${selectedItem.name} adicionados com sucesso.`,
        tone: 'success',
      });

      setIsModalOpen(false);
      setQuantityInput('');
      setCostInput('');
    } catch {
      notify({
        title: 'Não foi possível registrar a compra',
        description: 'Verifique a conexão com o servidor. Os dados foram preservados para nova tentativa.',
        tone: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        <PageHeader
          title="Compras"
          eyebrow="Estoque e Suprimentos"
          description="Fluxo completo de aquisição: selecione fornecedores, confira custos e dê entrada de insumos no estoque."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/fornecedores"
                className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-border-default bg-action-secondary px-4 text-sm font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-action-secondary-hover"
              >
                <Truck size={16} aria-hidden="true" />
                <span>Painel de Fornecedores</span>
              </Link>
              <Button
                onClick={() => openPurchaseModal()}
                leadingIcon={<Plus size={18} aria-hidden="true" />}
              >
                Registrar compra
              </Button>
            </div>
          }
        />

        {/* Abas de visualização */}
        <div className="flex border-b border-border-default">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer',
              activeTab === 'items'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <ShoppingCart size={16} aria-hidden="true" />
            <span>Planejamento e Insumos</span>
            {urgentCount > 0 && (
              <span className="rounded-full bg-status-danger px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                {urgentCount}
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
            <span>Histórico de Entradas</span>
            {purchaseRecords.length > 0 && (
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-mono text-[11px] text-text-secondary">
                {purchaseRecords.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'items' ? (
          <>
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchLabel="Buscar insumos para compra"
              placeholder="Nome do insumo ou categoria..."
              resultCount={filteredItems.length}
              totalCount={items.length}
              active={filtersActive}
              onClear={clearFilters}
            >
              <div className="space-y-1.5 sm:w-44">
                <label htmlFor="purchase-category-filter" className="block text-sm font-medium text-text-secondary">
                  Categoria
                </label>
                <Select
                  id="purchase-category-filter"
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
                  onClick={() => setFilterMode(filterMode === 'urgent' ? 'all' : 'urgent')}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-2 rounded-control border px-3 text-xs font-semibold transition-colors cursor-pointer',
                    filterMode === 'urgent'
                      ? 'border-status-danger/40 bg-status-danger/15 text-red-300'
                      : 'border-border-default bg-surface-elevated text-text-secondary hover:text-text-primary',
                  )}
                  title="Itens com estoque baixo, acabando ou zerado"
                >
                  <AlertTriangle size={14} className={urgentCount > 0 ? 'text-status-danger animate-pulse' : ''} />
                  <span>Urgentes ({urgentCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode(filterMode === 'predictive' ? 'all' : 'predictive')}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-2 rounded-control border px-3 text-xs font-semibold transition-colors cursor-pointer',
                    filterMode === 'predictive'
                      ? 'border-status-warning/40 bg-status-warning/15 text-amber-300'
                      : 'border-border-default bg-surface-elevated text-text-secondary hover:text-text-primary',
                  )}
                  title="Itens com consumo acelerado segundo as vendas recentes"
                >
                  <Clock size={14} className="text-amber-400" />
                  <span>Sugestão preditiva ({predictiveCount})</span>
                </button>
              </div>
            </FilterBar>

            {filteredItems.length === 0 ? (
              <EmptyState
                title={items.length ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
                description={
                  items.length
                    ? 'Ajuste a busca ou limpe os filtros para visualizar outros insumos disponíveis.'
                    : 'Cadastre insumos no estoque para registrar pedidos e compras com fornecedores.'
                }
                icon={<ShoppingCart aria-hidden="true" />}
                action={
                  items.length ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  ) : (
                    <Link
                      href="/admin/insumos"
                      className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control bg-brand-primary px-4 text-sm font-semibold text-text-inverse transition-colors hover:bg-brand-primary-hover"
                    >
                      Cadastrar insumos
                    </Link>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-dialog border border-border-default bg-surface-card shadow-elevated">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <th className="p-4">Insumo</th>
                      <th className="p-4">Categoria</th>
                      <th className="p-4 text-right">Estoque Atual</th>
                      <th className="p-4 text-right">Ponto Reposição</th>
                      <th className="p-4 text-right">Último Custo</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50 text-sm">
                    {filteredItems.map((item) => {
                      const urgent = isItemUrgent(item);
                      const predictive = isItemPredictive(item, salesCount);

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            'hover:bg-surface-elevated/40 transition-colors',
                            urgent && 'bg-status-danger/5',
                            predictive && !urgent && 'bg-status-warning/5',
                          )}
                        >
                          <td className="p-4 font-medium text-text-primary">
                            <span>{item.name}</span>
                          </td>
                          <td className="p-4 text-text-secondary text-xs">
                            <span className="rounded bg-surface-elevated px-2 py-0.5 border border-border-default">
                              {item.category || 'Geral'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono tabular-nums">
                            <span className={cn('font-bold', urgent ? 'text-status-danger' : 'text-text-primary')}>
                              {item.currentStock} {item.unit}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono tabular-nums text-text-muted">
                            {item.minStock && item.minStock > 0 ? (
                              <span>
                                {item.minStock} {item.unit}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono tabular-nums text-text-secondary">
                            R$ {item.costPerUnit.toFixed(2)} / {item.unit}
                          </td>
                          <td className="p-4 text-center">
                            {urgent ? (
                              <Badge variant="danger" dot>
                                Repor Urgente
                              </Badge>
                            ) : predictive ? (
                              <Badge variant="warning" dot>
                                Risco Ruptura
                              </Badge>
                            ) : (
                              <Badge variant="success" dot>
                                Regular
                              </Badge>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              size="sm"
                              variant={urgent ? 'primary' : 'secondary'}
                              onClick={() => openPurchaseModal(item)}
                              leadingIcon={<PackageCheck size={14} aria-hidden="true" />}
                            >
                              Dar entrada
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
          /* Aba: Histórico de Entradas */
          <div className="space-y-4">
            {purchaseRecords.length === 0 ? (
              <EmptyState
                title="Nenhum registro de compra"
                description="As compras e entradas no estoque lançadas aparecerão aqui com o histórico detalhado por fornecedor."
                icon={<History aria-hidden="true" />}
                action={
                  <Button onClick={() => openPurchaseModal()}>
                    Registrar primeira compra
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-dialog border border-border-default bg-surface-card shadow-elevated">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <th className="p-4">Data / Hora</th>
                      <th className="p-4">Insumo</th>
                      <th className="p-4">Fornecedor</th>
                      <th className="p-4 text-right">Quantidade</th>
                      <th className="p-4 text-right">Custo Unitário</th>
                      <th className="p-4 text-right">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50 text-sm font-mono tabular-nums">
                    {purchaseRecords.map((record) => {
                      const formattedDate = record.createdAt
                        ? new Date(record.createdAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—';

                      return (
                        <tr key={record.id} className="hover:bg-surface-elevated/40 transition-colors">
                          <td className="p-4 text-text-muted text-xs font-sans">{formattedDate}</td>
                          <td className="p-4 font-sans font-medium text-text-primary">{record.ingredientName}</td>
                          <td className="p-4 font-sans text-text-secondary text-xs">
                            <span className="inline-flex items-center gap-1">
                              <Truck size={12} className="text-text-muted" />
                              {record.supplierName || 'Diversos'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-text-primary">
                            +{record.quantity} {record.unit}
                          </td>
                          <td className="p-4 text-right text-text-secondary">
                            R$ {record.costPerUnit.toFixed(2)}
                          </td>
                          <td className="p-4 text-right font-bold text-emerald-400">
                            R$ {record.totalCost.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Fluxo de Entrada de Compra (Fornecedor → Itens → Conferência → Entrada) */}
        <Dialog
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          preventClose={isSubmitting}
          title="Registrar entrada de compra"
          description="Selecione o fornecedor, insira a quantidade e confira o impacto no saldo e custo médio."
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="purchase-entry-form"
                loading={isSubmitting}
                leadingIcon={<PackageCheck size={16} aria-hidden="true" />}
              >
                Confirmar entrada no estoque
              </Button>
            </>
          }
        >
          <form id="purchase-entry-form" onSubmit={handleConfirmPurchase} className="space-y-4">
            {/* Etapa 1: Insumo e Fornecedor */}
            <div className="space-y-4 rounded-xl border border-border-default/60 bg-surface-elevated/40 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary block">
                1. Fornecedor e Insumo
              </span>

              <FormField label="Insumo para entrada" required>
                <Select
                  value={selectedItemId}
                  onChange={(e) => handleItemSelectChange(e.target.value)}
                  data-autofocus="true"
                  required
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.category || 'Geral'}) — Atual: {i.currentStock} {i.unit}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField 
                label="Fornecedor da compra" 
                hint="Associe o fornecedor para rastreamento de cotações e histórico."
              >
                <Select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">Diversos / Não Informado</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {/* Etapa 2: Quantidades e Custos */}
            <div className="space-y-4 rounded-xl border border-border-default/60 bg-surface-elevated/40 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary block">
                2. Quantidade e Valores
              </span>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={`Quantidade comprada (${selectedItem?.unit || 'un'})`}
                  required
                  error={quantityError}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={quantityInput}
                    onChange={(e) => {
                      setQuantityInput(e.target.value);
                      if (quantityError) setQuantityError('');
                    }}
                    placeholder="Ex: 10"
                  />
                </FormField>

                <FormField
                  label="Novo custo unitário (R$)"
                  required
                  error={costError}
                  hint={selectedItem ? `Anterior: R$ ${selectedItem.costPerUnit.toFixed(2)}` : undefined}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={costInput}
                    onChange={(e) => {
                      setCostInput(e.target.value);
                      if (costError) setCostError('');
                    }}
                    placeholder="0.00"
                  />
                </FormField>
              </div>
            </div>

            {/* Etapa 3: Conferência Visual */}
            {selectedItem && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                  <Info size={14} />
                  <span>3. Conferência de Entrada</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-surface-card p-3 border border-border-default">
                    <span className="text-text-muted block mb-1">Impacto no Estoque:</span>
                    <div className="flex items-center gap-2 font-mono font-bold text-sm">
                      <span className="text-text-secondary">{selectedItem.currentStock} {selectedItem.unit}</span>
                      <ArrowRight size={14} className="text-text-muted" />
                      <span className="text-emerald-400">{calculations.newStock} {selectedItem.unit}</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-surface-card p-3 border border-border-default">
                    <span className="text-text-muted block mb-1">Total do Pedido:</span>
                    <span className="font-mono font-bold text-sm text-text-primary block">
                      R$ {calculations.totalCost.toFixed(2)}
                    </span>
                  </div>
                </div>

                {calculations.costDiffPercentage !== 0 && (
                  <div className="flex items-center justify-between text-xs px-1 text-text-secondary">
                    <span>Variação de custo unitário:</span>
                    <span
                      className={cn(
                        'font-mono font-bold flex items-center gap-1',
                        calculations.costDiffPercentage > 0 ? 'text-amber-400' : 'text-emerald-400',
                      )}
                    >
                      {calculations.costDiffPercentage > 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      {calculations.costDiffPercentage > 0 ? '+' : ''}
                      {calculations.costDiffPercentage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </form>
        </Dialog>
      </div>
    </div>
  );
}
