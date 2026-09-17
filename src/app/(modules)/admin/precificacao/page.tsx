'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Calculator, Store, Smartphone, 
  Save, Sparkles, TrendingUp, AlertTriangle, 
  Sliders, Check, Flame
} from 'lucide-react';
import { useInventory, type Product } from '@/lib/store';
import { 
  filterPricingProducts,
  applyPercentMarkup,
  calculateChannelComparison,
  calculatePricingSummaryMetrics,
  type PricingCategoryFilter 
} from '@/lib/pricing-helpers';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

export default function PrecificacaoPage() {
  const { products, getProductCmv, updateProduct, isLoaded } = useInventory();
  const { notify } = useToast();

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PricingCategoryFilter>('todos');
  
  // Taxas do iFood (configuráveis)
  const [ifoodCommissionPct, setIfoodCommissionPct] = useState<number>(23); // 23%
  const [paymentFeePct, setPaymentFeePct] = useState<number>(3.2); // 3.2%
  
  // Estados de Edição Local (para permitir digitação antes de salvar)
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [savedSuccessIds, setSavedSuccessIds] = useState<Record<string, boolean>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  // Modais de Ajuste em Lote e Confirmação
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkPercentInput, setBulkPercentInput] = useState<string>('27');
  const [confirmSaveAllOpen, setConfirmSaveAllOpen] = useState(false);

  // Produto Selecionado para Raio-X Detalhado
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Produtos Ativos
  const activeProducts = useMemo(() => {
    return products.filter(p => p.isActive !== false && !p.name.startsWith('Adicional:') && !p.name.startsWith('Pote Maionese'));
  }, [products]);

  // Produtos Filtrados
  const filteredProducts = useMemo(() => {
    return filterPricingProducts(activeProducts, {
      category: categoryFilter,
      search: searchTerm,
    });
  }, [activeProducts, categoryFilter, searchTerm]);

  // Obter Preço Ativo no iFood (seja o editado em tela ou o original)
  const getProductIfoodPrice = (p: Product): number => {
    return editedPrices[p.id] !== undefined ? editedPrices[p.id] : p.priceIfood;
  };

  // Alteração direta do valor em R$
  const handlePriceChange = (productId: string, value: string) => {
    const num = parseFloat(value);
    setEditedPrices(prev => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : num
    }));
  };

  // Alteração por porcentagem de acréscimo sobre o Balcão
  const handleApplyPercentToProduct = (p: Product, percent: number, round90: boolean = false) => {
    const newPrice = applyPercentMarkup(p.priceBalcao, percent, { round90 });
    setEditedPrices(prev => ({
      ...prev,
      [p.id]: newPrice
    }));
  };

  // Salvar Preço Individual
  const handleSaveProductPrice = async (p: Product) => {
    const newPrice = getProductIfoodPrice(p);
    setSavingProductId(p.id);
    try {
      await updateProduct(p.id, { priceIfood: newPrice });
      notify({ 
        title: `Preço no iFood salvo!`, 
        description: `"${p.name}" atualizado para R$ ${newPrice.toFixed(2)}.`,
        tone: 'success' 
      });

      // Remove dos editados locais
      setEditedPrices(prev => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });

      // Feedback visual momentâneo
      setSavedSuccessIds(prev => ({ ...prev, [p.id]: true }));
      setTimeout(() => {
        setSavedSuccessIds(prev => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
      }, 2500);
    } catch {
      notify({ title: 'Erro ao atualizar preço.', tone: 'danger' });
    } finally {
      setSavingProductId(null);
    }
  };

  // Aplicar Acréscimo em Massa
  const handleApplyBulkMarkup = () => {
    const pct = parseFloat(bulkPercentInput);
    if (isNaN(pct) || pct <= 0) {
      notify({ title: 'Informe uma porcentagem válida.', tone: 'warning' });
      return;
    }

    const updates: Record<string, number> = {};
    filteredProducts.forEach(p => {
      updates[p.id] = applyPercentMarkup(p.priceBalcao, pct, { round90: true });
    });

    setEditedPrices(prev => ({ ...prev, ...updates }));
    setShowBulkModal(false);
    notify({ 
      title: `Markup de +${pct}% aplicado na tabela!`, 
      description: `${filteredProducts.length} produto(s) atualizados com final .90. Clique em Salvar para efetivar.`,
      tone: 'info' 
    });
  };

  // Salvar Todos os Modificados
  const handleConfirmSaveAll = async () => {
    const count = Object.keys(editedPrices).length;
    if (count === 0) return;

    setIsSavingAll(true);
    try {
      for (const [id, newPrice] of Object.entries(editedPrices)) {
        await updateProduct(id, { priceIfood: newPrice });
      }
      setEditedPrices({});
      setConfirmSaveAllOpen(false);
      notify({ 
        title: `Preços atualizados com sucesso!`, 
        description: `${count} produto(s) atualizados no cardápio do iFood.`,
        tone: 'success' 
      });
    } catch {
      notify({ title: 'Erro ao salvar alterações de preço.', tone: 'danger' });
    } finally {
      setIsSavingAll(false);
    }
  };

  // Métricas do Topo
  const metrics = useMemo(() => {
    return calculatePricingSummaryMetrics(
      activeProducts,
      p => getProductCmv(p.recipe || []),
      p => getProductIfoodPrice(p),
      { ifoodCommissionPct, paymentFeePct },
    );
  }, [activeProducts, editedPrices, ifoodCommissionPct, paymentFeePct, getProductCmv]);

  // Produto ativo no simulador de raio-X
  const selectedProduct = useMemo(() => {
    return activeProducts.find(p => p.id === selectedProductId) || activeProducts[0];
  }, [activeProducts, selectedProductId]);

  const selectedProductCmv = useMemo(() => {
    return selectedProduct ? getProductCmv(selectedProduct.recipe || []) : 0;
  }, [selectedProduct, getProductCmv]);

  const selectedProductIfoodPrice = selectedProduct ? getProductIfoodPrice(selectedProduct) : 0;

  // Raio-X do produto selecionado
  const selectedProductSim = useMemo(() => {
    if (!selectedProduct) return null;
    return calculateChannelComparison(
      selectedProduct.priceBalcao,
      selectedProductIfoodPrice,
      selectedProductCmv,
      { ifoodCommissionPct, paymentFeePct, balcaoFeePct: 3.0 },
    );
  }, [selectedProduct, selectedProductCmv, selectedProductIfoodPrice, ifoodCommissionPct, paymentFeePct]);

  if (!isLoaded) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" data-testid="precificacao-skeleton">
        <Skeleton className="h-14 w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-dialog" />
          <Skeleton className="h-28 rounded-dialog" />
          <Skeleton className="h-28 rounded-dialog" />
          <Skeleton className="h-28 rounded-dialog" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-dialog" />
      </div>
    );
  }

  const modifiedCount = Object.keys(editedPrices).length;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        <PageHeader
          title="Precificação Inteligente do iFood"
          eyebrow="Gestão Estratégica de Margem"
          description="Simule preços no delivery, compare a rentabilidade real contra o Balcão e aplique markups inteligentes por produto ou categoria."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/engenharia">
                <Button variant="secondary" leadingIcon={<Flame size={15} className="text-amber-400" aria-hidden="true" />}>
                  Viabilidade iFood (Hits & Ads)
                </Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => setShowBulkModal(true)}
                leadingIcon={<Sparkles size={14} aria-hidden="true" />}
              >
                Ajuste em Lote
              </Button>
              {modifiedCount > 0 && (
                <Button
                  onClick={() => setConfirmSaveAllOpen(true)}
                  leadingIcon={<Save size={16} aria-hidden="true" />}
                  className="animate-pulse"
                >
                  Salvar Todos ({modifiedCount})
                </Button>
              )}
            </div>
          }
        />

        {/* Cards de Métricas Gerais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-dialog border border-border-default bg-surface-card p-5 shadow-elevated flex items-center gap-4">
            <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl border border-brand-primary/20">
              <Store size={22} aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs text-text-muted font-bold uppercase block">Preço Médio Balcão</span>
              <h3 className="text-2xl font-mono font-bold text-text-primary tabular-nums">
                R$ {metrics.avgBalcao.toFixed(2)}
              </h3>
              <span className="text-[10px] text-text-secondary">Base da loja física</span>
            </div>
          </div>

          <div className="rounded-dialog border border-border-default bg-surface-card p-5 shadow-elevated flex items-center gap-4">
            <div className="p-3 bg-status-danger/10 text-status-danger rounded-xl border border-status-danger/20">
              <Smartphone size={22} aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs text-text-muted font-bold uppercase block">Preço Médio iFood</span>
              <h3 className="text-2xl font-mono font-bold text-text-primary tabular-nums">
                R$ {metrics.avgIfood.toFixed(2)}
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono tabular-nums">
                +{metrics.avgBalcao > 0 ? (((metrics.avgIfood - metrics.avgBalcao) / metrics.avgBalcao) * 100).toFixed(1) : 0}% sobre Balcão
              </span>
            </div>
          </div>

          <div className="rounded-dialog border border-emerald-500/30 bg-surface-card p-5 shadow-elevated flex items-center gap-4 border-t-4 border-t-emerald-500">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <TrendingUp size={22} aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs text-text-muted font-bold uppercase block">Margem Líquida iFood</span>
              <h3 className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                {metrics.avgMargin.toFixed(1)}%
              </h3>
              <span className="text-[10px] text-text-secondary">Após taxas de {(ifoodCommissionPct + paymentFeePct).toFixed(1)}%</span>
            </div>
          </div>

          <div className="rounded-dialog border border-amber-500/30 bg-surface-card p-5 shadow-elevated flex items-center gap-4 border-t-4 border-t-amber-500">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <AlertTriangle size={22} aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs text-text-muted font-bold uppercase block">Margem Apertada (&lt;18%)</span>
              <h3 className={cn(
                'text-2xl font-mono font-bold tabular-nums',
                metrics.criticalItemsCount > 0 ? 'text-amber-400' : 'text-text-primary',
              )}>
                {metrics.criticalItemsCount} itens
              </h3>
              <span className="text-[10px] text-text-secondary">Exigem revisão de preço</span>
            </div>
          </div>
        </div>

        {/* Barra de Taxas & Parâmetros da Plataforma */}
        <div className="rounded-dialog border border-border-default bg-surface-card p-4 shadow-elevated flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-status-danger" aria-hidden="true" />
            <span className="text-xs font-bold text-text-primary">Taxas da Plataforma (iFood):</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <label htmlFor="commission-rate-input" className="text-text-secondary">Comissão iFood:</label>
              <div className="flex items-center bg-surface-input border border-border-default rounded-control px-2.5 py-1">
                <input
                  id="commission-rate-input"
                  type="number"
                  step="0.5"
                  value={ifoodCommissionPct}
                  onChange={e => setIfoodCommissionPct(parseFloat(e.target.value) || 0)}
                  className="w-12 bg-transparent text-text-primary font-mono font-bold text-center outline-none"
                />
                <span className="text-text-muted font-bold">%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="payment-rate-input" className="text-text-secondary">Pagamento Online:</label>
              <div className="flex items-center bg-surface-input border border-border-default rounded-control px-2.5 py-1">
                <input
                  id="payment-rate-input"
                  type="number"
                  step="0.1"
                  value={paymentFeePct}
                  onChange={e => setPaymentFeePct(parseFloat(e.target.value) || 0)}
                  className="w-12 bg-transparent text-text-primary font-mono font-bold text-center outline-none"
                />
                <span className="text-text-muted font-bold">%</span>
              </div>
            </div>

            <div className="bg-surface-elevated px-3 py-1.5 rounded-control border border-border-default text-text-primary font-mono">
              Taxa Total: <strong className="text-status-danger tabular-nums">{(ifoodCommissionPct + paymentFeePct).toFixed(1)}%</strong>
            </div>
          </div>
        </div>

        {/* FilterBar */}
        <FilterBar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchLabel="Buscar produtos"
          placeholder="Buscar por nome ou categoria..."
          resultCount={filteredProducts.length}
          totalCount={activeProducts.length}
          active={Boolean(searchTerm || categoryFilter !== 'todos')}
          onClear={() => {
            setSearchTerm('');
            setCategoryFilter('todos');
          }}
        >
          <div className="space-y-1.5 sm:w-48">
            <label htmlFor="pricing-cat-select" className="block text-sm font-medium text-text-secondary">
              Filtro de Categoria
            </label>
            <Select
              id="pricing-cat-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as PricingCategoryFilter)}
            >
              <option value="todos">Todos os produtos</option>
              <option value="lanche">Burgers Simples</option>
              <option value="duplo">Linha Duplos</option>
              <option value="combo">Combos & Upsell</option>
              <option value="porcao">Porções</option>
              <option value="bebida">Bebidas</option>
            </Select>
          </div>
        </FilterBar>

        {/* Tabela Interativa de Precificação */}
        {filteredProducts.length === 0 ? (
          <EmptyState
            title={activeProducts.length ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
            description="Tente pesquisar com outro termo ou alterar o filtro de categoria."
            icon={<Calculator aria-hidden="true" />}
            action={
              activeProducts.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('todos');
                  }}
                >
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
                  <th className="p-4">Produto & CMV</th>
                  <th className="p-4">Preço Balcão</th>
                  <th className="p-4 w-44">Preço iFood (R$)</th>
                  <th className="p-4">Acréscimo s/ Balcão</th>
                  <th className="p-4">Lucro Líquido iFood</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/50 text-sm">
                {filteredProducts.map(p => {
                  const cmv = getProductCmv(p.recipe || []);
                  const currentIfood = getProductIfoodPrice(p);
                  const isModified = editedPrices[p.id] !== undefined && editedPrices[p.id] !== p.priceIfood;
                  const isSaved = savedSuccessIds[p.id];
                  const isSaving = savingProductId === p.id;

                  // Markup e Lucro
                  const markupPct = p.priceBalcao > 0 ? ((currentIfood - p.priceBalcao) / p.priceBalcao) * 100 : 0;
                  const totalFeePct = (ifoodCommissionPct + paymentFeePct) / 100;
                  const netRevenue = currentIfood * (1 - totalFeePct);
                  const netProfit = netRevenue - cmv;
                  const marginPct = currentIfood > 0 ? (netProfit / currentIfood) * 100 : 0;

                  return (
                    <tr 
                      key={p.id}
                      className={cn(
                        'hover:bg-surface-elevated/40 transition-colors',
                        isModified && 'bg-amber-500/5',
                      )}
                    >
                      {/* Nome e CMV */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary text-sm">{p.name}</span>
                          {p.name.toLowerCase().includes('duplo') && (
                            <Badge variant="neutral" className="text-[10px]">
                              DUPLO
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-text-muted mt-1 font-mono text-xs">
                          <span>CMV: <strong className="text-amber-400 tabular-nums">R$ {cmv.toFixed(2)}</strong></span>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedProductId(p.id)}
                            className="text-brand-primary hover:underline cursor-pointer"
                          >
                            Ver Raio-X
                          </button>
                        </div>
                      </td>

                      {/* Preço Balcão */}
                      <td className="p-4 font-mono font-bold text-text-secondary tabular-nums">
                        R$ {p.priceBalcao.toFixed(2)}
                      </td>

                      {/* Input do Preço iFood */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-muted font-mono font-bold text-xs">R$</span>
                          <input
                            type="number"
                            step="0.10"
                            aria-label={`Preço iFood de ${p.name}`}
                            value={currentIfood}
                            onChange={e => handlePriceChange(p.id, e.target.value)}
                            className={cn(
                              'w-28 p-2 rounded-control font-mono text-sm font-bold outline-none border transition-colors tabular-nums',
                              isModified 
                                ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-sm' 
                                : 'bg-surface-input border-border-default text-text-primary focus:border-brand-primary',
                            )}
                          />
                        </div>
                      </td>

                      {/* Acréscimo Percentual & Botões de Atalho */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'font-mono font-bold text-xs tabular-nums',
                            markupPct < 20 ? 'text-amber-400' : 'text-emerald-400',
                          )}>
                            +{markupPct.toFixed(1)}%
                          </span>
                        </div>
                        {/* Botões Rápidos */}
                        <div className="flex items-center gap-1">
                          {[20, 25, 30, 35].map(pct => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => handleApplyPercentToProduct(p, pct, true)}
                              className="px-1.5 py-0.5 bg-surface-elevated hover:bg-surface-card text-text-muted hover:text-text-primary rounded text-[10px] font-mono cursor-pointer transition-colors border border-border-default"
                              title={`Aplicar +${pct}% com final .90`}
                            >
                              +{pct}%
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Lucro Líquido no iFood */}
                      <td className="p-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-bold text-sm tabular-nums',
                            netProfit > 0 ? 'text-text-primary' : 'text-status-danger',
                          )}>
                            R$ {netProfit.toFixed(2)}
                          </span>
                          <Badge 
                            variant={marginPct >= 25 ? 'success' : marginPct >= 18 ? 'neutral' : 'warning'}
                            className="font-mono tabular-nums text-[10px]"
                          >
                            {marginPct.toFixed(1)}%
                          </Badge>
                        </div>
                        <span className="text-[10px] text-text-muted">
                          {marginPct < 18 ? '⚠️ Margem apertada' : 'Margem saudável'}
                        </span>
                      </td>

                      {/* Ação: Salvar */}
                      <td className="p-4 text-right">
                        {isSaved ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-control font-bold text-xs">
                            <Check size={14} aria-hidden="true" /> Salvo!
                          </span>
                        ) : isModified ? (
                          <Button
                            size="sm"
                            onClick={() => handleSaveProductPrice(p)}
                            loading={isSaving}
                            leadingIcon={<Save size={14} aria-hidden="true" />}
                          >
                            Salvar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedProductId(p.id)}
                          >
                            Simular
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Raio-X Detalhado: Comparativo Balcão vs. iFood */}
        {selectedProduct && selectedProductSim && (
          <div className="rounded-dialog border border-border-default bg-surface-card p-6 shadow-elevated space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-default">
              <div>
                <h2 className="text-xs text-brand-primary font-bold uppercase tracking-wider block">
                  Raio-X de Margem e Rentabilidade
                </h2>
                <h3 className="text-2xl font-bold text-text-primary">{selectedProduct.name}</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  CMV da Ficha Técnica: <strong className="text-amber-400 font-mono tabular-nums">R$ {selectedProductCmv.toFixed(2)}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="select-product-xray" className="text-xs text-text-muted">Trocar produto:</label>
                <select
                  id="select-product-xray"
                  value={selectedProduct.id}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="bg-surface-input border border-border-default rounded-control p-2 text-text-primary text-xs font-bold outline-none cursor-pointer"
                >
                  {activeProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Coluna Balcão */}
              <div className="p-5 rounded-xl bg-surface-elevated/40 border border-border-default space-y-3 text-xs">
                <div className="flex items-center gap-2 text-brand-primary font-bold text-sm pb-2 border-b border-border-default">
                  <Store size={18} aria-hidden="true" /> Venda no Balcão (Loja Física)
                </div>

                <div className="flex justify-between text-text-secondary">
                  <span>Preço de Venda:</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    R$ {selectedProductSim.balcao.gross.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Taxa Cartão (Médio 3%):</span>
                  <span className="font-mono text-status-danger tabular-nums">
                    - R$ {selectedProductSim.balcao.fees.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>CMV do Lanche:</span>
                  <span className="font-mono text-amber-400 tabular-nums">
                    - R$ {selectedProductCmv.toFixed(2)}
                  </span>
                </div>

                <div className="pt-3 border-t border-border-default flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Lucro Líquido</span>
                    <strong className="text-2xl font-mono text-brand-primary font-bold tabular-nums">
                      R$ {selectedProductSim.balcao.profit.toFixed(2)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Margem Líquida</span>
                    <strong className="text-xl font-mono text-emerald-400 font-bold tabular-nums">
                      {selectedProductSim.balcao.margin.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Coluna iFood */}
              <div className="p-5 rounded-xl bg-surface-elevated/40 border border-status-danger/30 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-status-danger font-bold text-sm pb-2 border-b border-border-default">
                  <Smartphone size={18} aria-hidden="true" /> Venda no iFood (Preço Atual)
                </div>

                <div className="flex justify-between text-text-secondary">
                  <span>Preço no iFood:</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    R$ {selectedProductSim.ifood.gross.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Taxas Plataforma ({(ifoodCommissionPct + paymentFeePct).toFixed(1)}%):</span>
                  <span className="font-mono text-status-danger tabular-nums">
                    - R$ {selectedProductSim.ifood.fees.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>CMV do Lanche:</span>
                  <span className="font-mono text-amber-400 tabular-nums">
                    - R$ {selectedProductCmv.toFixed(2)}
                  </span>
                </div>

                <div className="pt-3 border-t border-border-default flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Lucro Líquido</span>
                    <strong className="text-2xl font-mono text-status-danger font-bold tabular-nums">
                      R$ {selectedProductSim.ifood.profit.toFixed(2)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Margem Líquida</span>
                    <strong className={cn(
                      'text-xl font-mono font-bold tabular-nums',
                      selectedProductSim.ifood.margin >= 18 ? 'text-emerald-400' : 'text-amber-400',
                    )}>
                      {selectedProductSim.ifood.margin.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG: REAJUSTE DE PREÇOS EM LOTE */}
        <Dialog
          open={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          title="Ajuste de Preços em Lote"
          description="Aplica uma porcentagem padronizada sobre o preço de balcão de todos os itens filtrados."
          size="sm"
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleApplyBulkMarkup}>
                Aplicar na Tabela
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="bulk-percent-input" className="block text-xs font-bold text-text-secondary">
                Porcentagem de Acréscimo s/ Balcão (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="bulk-percent-input"
                  type="number"
                  value={bulkPercentInput}
                  onChange={e => setBulkPercentInput(e.target.value)}
                  className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary font-mono font-bold outline-none focus:border-brand-primary"
                />
                <span className="text-lg text-text-muted font-bold">%</span>
              </div>
            </div>

            <div className="flex gap-2">
              {[20, 25, 27, 30, 35].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBulkPercentInput(p.toString())}
                  className="flex-1 py-1.5 bg-surface-elevated hover:bg-surface-card text-text-secondary hover:text-text-primary rounded-control text-xs font-mono font-bold border border-border-default cursor-pointer"
                >
                  +{p}%
                </button>
              ))}
            </div>

            <div className="rounded-control bg-brand-primary/10 border border-brand-primary/20 p-3 text-xs text-brand-primary">
              💡 Os preços serão automaticamente arredondados com terminação <strong>.90</strong> para maximizar a conversão.
            </div>
          </div>
        </Dialog>

        {/* CONFIRM DIALOG: SALVAR TODOS */}
        <ConfirmDialog
          open={confirmSaveAllOpen}
          onClose={() => setConfirmSaveAllOpen(false)}
          title={`Salvar alterações de preço?`}
          description={`Você está prestes a atualizar o preço de ${modifiedCount} produto(s) no cardápio do iFood.`}
          confirmLabel="Salvar Preços"
          tone="warning"
          loading={isSavingAll}
          onConfirm={handleConfirmSaveAll}
        />
      </div>
    </div>
  );
}
