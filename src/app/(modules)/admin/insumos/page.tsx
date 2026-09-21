'use client';

import { useDeferredValue, useState } from 'react';
import { useInventory, type InventoryItem, type KitchenStation, type RecipeProductionStation, type RecipeProductionKind } from '@/lib/store';
import { 
  Plus, Edit2, Trash2, AlertTriangle, RotateCcw, Boxes
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { filterInventoryItems } from '@/lib/inventory-filters';
import { cn } from '@/lib/cn';

const PRODUCTION_STATIONS: Array<{ value: RecipeProductionStation; label: string }> = [
  { value: 'none', label: 'Não vai à cozinha (Sem preparo)' },
  { value: 'grill', label: 'Chapa' },
  { value: 'fryer', label: 'Fritadeira' },
  { value: 'oven', label: 'Forno' },
  { value: 'cold', label: 'Preparo frio' },
  { value: 'assembly', label: 'Montagem' },
  { value: 'other', label: 'Outra operação' },
];

const PRODUCTION_KINDS: Array<{ value: RecipeProductionKind; label: string }> = [
  { value: 'none', label: 'Não contar (Somente na praça)' },
  { value: 'beef_patty', label: 'Carne bovina (Hambúrguer)' },
  { value: 'egg', label: 'Ovo' },
  { value: 'bacon', label: 'Bacon' },
  { value: 'breaded_chicken', label: 'Frango empanado' },
  { value: 'breaded_cheese', label: 'Queijo empanado' },
  { value: 'fries', label: 'Porção de batata' },
  { value: 'onion_rings', label: 'Porção de anéis de cebola' },
  { value: 'other', label: 'Outro item produzido' },
];

const stationLabels: Record<KitchenStation, { label: string; icon: string }> = {
  nenhuma: { label: 'Montagem', icon: '🍽️' },
  chapa: { label: 'Chapa', icon: '🔥' },
  fritadeira_frango: { label: 'Frango Empanado', icon: '🍗' },
  fritadeira_queijo: { label: 'Queijo Empanado', icon: '🧀' },
  fritadeira_batata: { label: 'Batatas', icon: '🍟' },
  fritadeira_onion: { label: 'Anéis de Cebola', icon: '🧅' },
};

export default function GestaoInsumosPage() {
  const { items, kitchenComponents, addInventoryItem, updateInventoryItem, removeInventoryItem, isLoaded } = useInventory();
  const { notify } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const deferredSearch = useDeferredValue(searchTerm);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Deactivate State
  const [itemToDeactivate, setItemToDeactivate] = useState<InventoryItem | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [category, setCategory] = useState('Geral');
  const [unit, setUnit] = useState('kg');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [station, setStation] = useState<KitchenStation>('nenhuma');
  const [kitchenComponentId, setKitchenComponentId] = useState('');
  const [productionStation, setProductionStation] = useState<RecipeProductionStation>('none');
  const [productionKind, setProductionKind] = useState<RecipeProductionKind>('none');
  const [portionWeight, setPortionWeight] = useState('');

  if (!isLoaded) {
    return (
      <div role="status" aria-label="Carregando insumos" className="mx-auto max-w-6xl space-y-6 p-6">
        <span className="sr-only">Carregando insumos…</span>
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((id) => (
            <Skeleton key={id} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setNameError('');
    setCategory('Geral');
    setUnit('kg');
    setCost('');
    setStock('');
    setMinStock('');
    setStation('nenhuma');
    setKitchenComponentId('');
    setProductionStation('none');
    setProductionKind('none');
    setPortionWeight('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setNameError('');
    setCategory(item.category || 'Geral');
    setUnit(item.unit);
    setCost(item.costPerUnit.toString());
    setStock(item.currentStock.toString());
    setMinStock(item.minStock !== undefined ? item.minStock.toString() : '');
    setStation(item.station || 'nenhuma');
    setKitchenComponentId(item.kitchenComponentId === 'cmp-no-prep' ? '' : item.kitchenComponentId || '');
    setProductionStation(item.productionStation || 'none');
    setProductionKind(item.productionKind || 'none');
    setPortionWeight(item.portionWeight !== undefined && item.portionWeight !== null ? item.portionWeight.toString() : '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Informe o nome do insumo.');
      return;
    }
    setNameError('');
    setIsSaving(true);

    const minStockNum = minStock.trim() ? Number(minStock) : undefined;
    const costNum = Number(cost) || 0;
    const stockNum = Number(stock) || 0;
    const portionWeightNum = portionWeight.trim() ? Number(portionWeight.replace(',', '.')) : undefined;

    try {
      if (editingItem) {
        await updateInventoryItem(editingItem.id, {
          name: name.trim(),
          category: category.trim() || 'Geral',
          unit,
          costPerUnit: costNum,
          currentStock: stockNum,
          minStock: minStockNum,
          station,
          kitchenComponentId: kitchenComponentId || 'cmp-no-prep',
          productionStation,
          productionKind: productionStation === 'none' ? 'none' : productionKind,
          portionWeight: portionWeightNum,
          portionUnit: unit,
        });
        notify({
          title: 'Insumo atualizado',
          description: `${name.trim()} salvo com sucesso.`,
          tone: 'success',
        });
      } else {
        await addInventoryItem({
          name: name.trim(),
          category: category.trim() || 'Geral',
          unit,
          costPerUnit: costNum,
          currentStock: stockNum,
          status: 'ok',
          minStock: minStockNum,
          station,
          kitchenComponentId: kitchenComponentId || 'cmp-no-prep',
          productionStation,
          productionKind: productionStation === 'none' ? 'none' : productionKind,
          portionWeight: portionWeightNum,
          portionUnit: unit,
        });
        notify({
          title: 'Insumo cadastrado',
          description: `${name.trim()} já está disponível para fichas técnicas.`,
          tone: 'success',
        });
      }
      setIsModalOpen(false);
    } catch {
      notify({
        title: 'Não foi possível salvar o insumo',
        description: 'Verifique a conexão e tente novamente. Os campos foram preservados.',
        tone: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!itemToDeactivate) return;
    setIsDeactivating(true);
    try {
      const targetName = itemToDeactivate.name;
      await removeInventoryItem(itemToDeactivate.id);
      setItemToDeactivate(null);
      notify({
        title: 'Insumo desativado',
        description: `${targetName} foi desativado do estoque diário.`,
        tone: 'success',
      });
    } catch {
      notify({
        title: 'Não foi possível desativar',
        description: 'O insumo foi mantido. Tente novamente.',
        tone: 'danger',
      });
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async (item: InventoryItem) => {
    try {
      await updateInventoryItem(item.id, { isActive: true });
      notify({
        title: 'Insumo reativado',
        description: `${item.name} voltou a ficar visível nas operações.`,
        tone: 'success',
      });
    } catch {
      notify({
        title: 'Não foi possível reativar',
        description: 'Verifique a conexão e tente novamente.',
        tone: 'danger',
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setFilterLowStock(false);
    setShowInactive(false);
  };

  // Itens filtrados
  const filteredItems = filterInventoryItems(
    items,
    deferredSearch,
    categoryFilter,
    filterLowStock,
    showInactive,
  ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  // Contagem de reposição
  const lowStockCount = items.filter(
    (i) => i.isActive !== false && (i.minStock || 0) > 0 && i.currentStock <= (i.minStock || 0),
  ).length;

  // Categorias disponíveis
  const categories = [
    ...new Set(items.map((item) => (item.category || 'Geral').trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filtersActive = Boolean(searchTerm || categoryFilter || filterLowStock || showInactive);

  // Agrupamento por categoria
  const groupedItems = filteredItems.reduce((acc, item) => {
    const rawCat = (item.category || 'Geral').trim();
    const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        <PageHeader
          title="Insumos"
          eyebrow="Estoque"
          description="Controle matérias-primas, saldos atuais, custos unitários e pontos de reposição."
          actions={
            <Button onClick={openAddModal} leadingIcon={<Plus size={18} aria-hidden="true" />}>
              Cadastrar insumo
            </Button>
          }
        />

        <FilterBar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchLabel="Buscar insumos"
          placeholder="Nome, categoria ou estação..."
          resultCount={filteredItems.length}
          totalCount={items.length}
          active={filtersActive}
          onClear={clearFilters}
        >
          <div className="space-y-1.5 sm:w-48">
            <label htmlFor="inventory-category-filter" className="block text-sm font-medium text-text-secondary">
              Categoria
            </label>
            <Select
              id="inventory-category-filter"
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
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-control border px-3 text-xs font-semibold transition-colors cursor-pointer',
                filterLowStock
                  ? 'border-status-danger/40 bg-status-danger/15 text-red-300'
                  : 'border-border-default bg-surface-elevated text-text-secondary hover:text-text-primary',
              )}
              title="Filtrar itens no ponto de reposição (estoque baixo)"
            >
              <AlertTriangle size={14} className={lowStockCount > 0 ? 'text-status-danger animate-pulse' : ''} />
              <span>Ponto de reposição</span>
              {lowStockCount > 0 && (
                <span className="rounded-full bg-status-danger px-1.5 py-0.2 font-mono text-[10px] font-bold text-white">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowInactive(!showInactive)}
              className={cn(
                'inline-flex min-h-10 items-center gap-1.5 rounded-control border px-3 text-xs font-semibold transition-colors cursor-pointer',
                showInactive
                  ? 'border-status-warning/40 bg-status-warning/15 text-amber-300'
                  : 'border-border-default bg-surface-elevated text-text-secondary hover:text-text-primary',
              )}
            >
              <span>{showInactive ? 'Ocultar desativados' : 'Ver desativados'}</span>
            </button>
          </div>
        </FilterBar>

        {filteredItems.length === 0 ? (
          <EmptyState
            title={items.length ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
            description={
              items.length
                ? 'Tente alterar a busca ou limpar os filtros para consultar outros itens de estoque.'
                : 'Cadastre as matérias-primas que compõem suas fichas técnicas para calcular custos e CMV em tempo real.'
            }
            icon={<Boxes aria-hidden="true" />}
            action={
              items.length ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={openAddModal}>Cadastrar primeiro insumo</Button>
              )
            }
          />
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedItems).map(([catName, catItems]) => (
              <section key={catName} className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary px-1 border-l-4 border-brand-primary pl-3">
                  {catName}
                </h2>
                <div className="overflow-x-auto rounded-dialog border border-border-default bg-surface-card shadow-elevated">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                        <th className="p-4">Insumo</th>
                        <th className="p-4">Estação (KDS)</th>
                        <th className="p-4 text-right">Custo Unitário</th>
                        <th className="p-4 text-right">Estoque Atual</th>
                        <th className="p-4 text-right">Ponto Reposição</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default/50 text-sm">
                      {catItems.map((item) => {
                        const isLowStock =
                          item.isActive !== false &&
                          (item.minStock || 0) > 0 &&
                          item.currentStock <= (item.minStock || 0);
                        const stationInfo = stationLabels[item.station || 'nenhuma'] || stationLabels.nenhuma;

                        return (
                          <tr
                            key={item.id}
                            className={cn(
                              'hover:bg-surface-elevated/40 transition-colors',
                              item.isActive === false && 'opacity-60 bg-status-danger/5',
                            )}
                          >
                            <td className="p-4 font-medium text-text-primary">
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                {item.isActive === false && (
                                  <Badge variant="danger">Desativado</Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="neutral">
                                <span>{stationInfo.icon}</span> {item.productionStation && item.productionStation !== 'none' ? (PRODUCTION_STATIONS.find(s => s.value === item.productionStation)?.label || stationInfo.label) : stationInfo.label}
                              </Badge>
                              {item.portionWeight !== undefined && item.portionWeight > 0 ? (
                                <span className="block text-[10px] text-brand-primary mt-1 font-mono">
                                  Porção: {item.portionWeight} {item.unit}
                                </span>
                              ) : null}
                            </td>
                            <td className="p-4 text-right font-mono tabular-nums text-text-secondary">
                              R$ {item.costPerUnit.toFixed(2)} / {item.unit}
                            </td>
                            <td className="p-4 text-right font-mono tabular-nums">
                              <span
                                className={cn(
                                  'font-bold',
                                  isLowStock ? 'text-status-danger' : 'text-text-primary',
                                )}
                              >
                                {item.currentStock} {item.unit}
                              </span>
                            </td>
                            <td className="p-4 text-right font-mono tabular-nums text-text-muted">
                              {item.minStock && item.minStock > 0 ? (
                                <span className="text-amber-300 font-semibold">
                                  {item.minStock} {item.unit}
                                </span>
                              ) : (
                                <span>—</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {isLowStock ? (
                                <Badge variant="danger" dot>
                                  Repor Estoque
                                </Badge>
                              ) : item.minStock && item.minStock > 0 ? (
                                <Badge variant="success" dot>
                                  Adequado
                                </Badge>
                              ) : (
                                <span className="text-text-muted text-xs">—</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                {item.isActive === false ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleReactivate(item)}
                                    leadingIcon={<RotateCcw size={14} aria-hidden="true" />}
                                  >
                                    Reativar
                                  </Button>
                                ) : (
                                  <>
                                    <IconButton
                                      label={`Editar insumo ${item.name}`}
                                      icon={<Edit2 size={16} aria-hidden="true" />}
                                      onClick={() => openEditModal(item)}
                                    />
                                    <IconButton
                                      label={`Desativar insumo ${item.name}`}
                                      icon={<Trash2 size={16} aria-hidden="true" />}
                                      onClick={() => setItemToDeactivate(item)}
                                    />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Modal de Cadastro / Edição */}
        <Dialog
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          preventClose={isSaving}
          title={editingItem ? 'Editar insumo' : 'Novo insumo'}
          description={
            editingItem
              ? 'Altere as informações de estoque, custo ou estação de preparo.'
              : 'Cadastre a matéria-prima para cálculo de custos e fichas técnicas.'
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" form="inventory-form" loading={isSaving}>
                {editingItem ? 'Salvar alterações' : 'Cadastrar insumo'}
              </Button>
            </>
          }
        >
          <form id="inventory-form" onSubmit={handleSave} className="space-y-4">
            <FormField label="Nome do insumo" required error={nameError}>
              <Input
                required
                data-autofocus="true"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError('');
                }}
                placeholder="Ex: Queijo Cheddar Fatiado"
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Categoria">
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Queijos, Carnes, Pães"
                />
              </FormField>

              <FormField label="Preparo na cozinha (opcional)">
                <Select value={kitchenComponentId} onChange={e => { setKitchenComponentId(e.target.value); setProductionStation('none'); setProductionKind('none'); setStation('nenhuma'); }}>
                  <option value="">Não exibir nas estações</option>
                  {kitchenComponents.filter(c => c.isActive && c.station !== 'none').map(c => <option key={c.id} value={c.id}>{c.name} — {c.station === 'grill' ? 'Chapa' : c.station === 'fryer' ? 'Fritadeira' : c.station}</option>)}
                </Select>

              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">


              <FormField label={`Porção padrão ao vincular (${unit})`}>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={portionWeight}
                  onChange={(e) => setPortionWeight(e.target.value)}
                  placeholder={unit === 'kg' ? 'Ex: 0.180 (180g) ou 0.150' : 'Ex: 1'}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Unidade">
                <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="kg">kg (Quilograma)</option>
                  <option value="g">g (Grama)</option>
                  <option value="un">un (Unidade)</option>
                  <option value="L">L (Litro)</option>
                  <option value="ml">ml (Mililitro)</option>
                </Select>
              </FormField>

              <FormField label="Custo unitário (R$)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Estoque atual">
                <Input
                  type="number"
                  step="0.01"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            </div>

            <FormField
              label="Ponto de reposição (Estoque mínimo)"
              hint="Alerta visual quando o estoque atingir ou ficar abaixo deste nível."
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="Ex: 10"
              />
            </FormField>
          </form>
        </Dialog>

        {/* Modal de Confirmação de Desativação */}
        <ConfirmDialog
          open={Boolean(itemToDeactivate)}
          onClose={() => setItemToDeactivate(null)}
          onConfirm={handleConfirmDeactivate}
          loading={isDeactivating}
          title="Desativar insumo?"
          description={`O insumo "${itemToDeactivate?.name}" será marcado como inativo e não aparecerá nas operações diárias.`}
          details="O histórico em fichas técnicas, compras anteriores e movimentações será integralmente preservado para fins fiscais e relatórios."
          confirmLabel="Desativar insumo"
          tone="danger"
        />
      </div>
    </div>
  );
}
