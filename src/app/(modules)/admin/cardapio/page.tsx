'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChefHat, Plus, Trash2, Edit2, 
  FlaskConical, Sparkles, Layers, Store, Smartphone, Search, Copy,
  Landmark, AlertTriangle, CheckCircle2, X, FolderTree, Grid,
  ChevronDown, ChevronRight, ExternalLink, Info
} from 'lucide-react';
import { useInventory, type Product, type RecipeIngredient, type InventoryItem } from '@/lib/store';
import { FISCAL_CATEGORY_PRESETS } from '@/lib/fiscal';
import { 
  filterCardapioProducts, 
  calculateRecipeMetrics, 
  findMatchingInventoryItem,
  inferDefaultSubcategory,
  groupProductsBySubcategory,
  DEFAULT_SUBCATEGORIES_BY_CATEGORY,
  type CardapioCategoryFilter 
} from '@/lib/recipe-helpers';
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

export default function CardapioAdminPage() {
  const { 
    items, products, addProduct, updateProduct, removeProduct, 
    isLoaded, subRecipes, saveSubRecipe, removeSubRecipe, 
    getIngredientTrueCost, addInventoryItem, updateInventoryItem, batchAddIngredientToProducts 
  } = useInventory();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<'produtos' | 'subreceitas'>('produtos');
  const [categoryFilter, setCategoryFilter] = useState<CardapioCategoryFilter>('todos');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<'hierarquico' | 'grade'>('hierarquico');
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Record<string, boolean>>({});

  // Form State Produto (Dialog)
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'lanche'|'bebida'|'porcao'|'combo'>('lanche');
  const [subcategory, setSubcategory] = useState('');
  const [priceBalcao, setPriceBalcao] = useState('');
  const [priceIfood, setPriceIfood] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isCreatingIngOnTheFly, setIsCreatingIngOnTheFly] = useState(false);
  const [inlineCostInputs, setInlineCostInputs] = useState<Record<string, string>>({});

  // Parâmetros Tributários Fiscais (NFC-e)
  const [ncm, setNcm] = useState('');
  const [cfop, setCfop] = useState('');
  const [csosn, setCsosn] = useState('');
  const [cest, setCest] = useState('');
  
  // Recipe State & Typeahead
  const [recipe, setRecipe] = useState<RecipeIngredient[]>([]);
  const [selectedIngId, setSelectedIngId] = useState('');
  const [ingQuantity, setIngQuantity] = useState('');
  const [ingSearch, setIngSearch] = useState('');
  const [isIngDropdownOpen, setIsIngDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Confirmações de Exclusão / Desativação
  const [confirmProductToArchive, setConfirmProductToArchive] = useState<Product | null>(null);
  const [confirmSubRecipeToRemove, setConfirmSubRecipeToRemove] = useState<InventoryItem | null>(null);
  const [confirmClearFormulaOpen, setConfirmClearFormulaOpen] = useState(false);

  // Sub-Receita Form State
  const [selectedPrepId, setSelectedPrepId] = useState<string>('');
  const [subChildId, setSubChildId] = useState('');
  const [subChildQty, setSubChildQty] = useState('');
  const [showNewSubModal, setShowNewSubModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubUnit, setNewSubUnit] = useState('kg');

  // Modal Rápido de Vínculo para Produtos Existentes
  const [quickLinkProduct, setQuickLinkProduct] = useState<Product | null>(null);
  const [quickLinkIngredientId, setQuickLinkIngredientId] = useState<string>('');
  const [quickLinkDefaultQty, setQuickLinkDefaultQty] = useState<string>('0.030');
  const [quickLinkSearch, setQuickLinkSearch] = useState<string>('');
  const [quickLinkTargetCategory, setQuickLinkTargetCategory] = useState<'lanche' | 'combo' | 'todos'>('lanche');
  const [quickLinkTargets, setQuickLinkTargets] = useState<Record<string, { checked: boolean; quantity: number }>>({});
  const [isSavingQuickLink, setIsSavingQuickLink] = useState(false);

  // Modal Inline para criar Insumo de Estoque caso não exista
  const [showCreateStockItemModal, setShowCreateStockItemModal] = useState(false);
  const [newStockItemName, setNewStockItemName] = useState('');
  const [newStockItemCategory, setNewStockItemCategory] = useState('Diversos');
  const [newStockItemUnit, setNewStockItemUnit] = useState('un');
  const [newStockItemCost, setNewStockItemCost] = useState('0.00');

  // Ordenação Alfabética de Insumos
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => 
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [items]);

  // Filtro de Typeahead para Insumos
  const filteredTypeaheadItems = useMemo(() => {
    if (!ingSearch.trim()) return sortedItems.slice(0, 30);
    const q = ingSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return sortedItems.filter(i => {
      const nameNorm = i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const catNorm = i.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nameNorm.includes(q) || catNorm.includes(q);
    });
  }, [sortedItems, ingSearch]);

  // Cálculos em Tempo Real da Ficha Técnica Sendo Editada
  const activeRecipeMetrics = useMemo(() => {
    return calculateRecipeMetrics(
      recipe,
      getIngredientTrueCost,
      Number(priceBalcao) || 0,
      Number(priceIfood) || 0,
      30,
    );
  }, [recipe, getIngredientTrueCost, priceBalcao, priceIfood]);

  // Sub-receitas (Insumos da categoria 'Pré-preparos' ou 'Molhos & Condimentos')
  const prepIngredients = useMemo(() => {
    return items.filter(i => 
      i.isActive !== false && (
        i.category.toLowerCase().includes('pré-preparo') || 
        i.category.toLowerCase().includes('molhos') ||
        i.name.toLowerCase().includes('maionese') ||
        i.name.toLowerCase().includes('coleslaw') ||
        i.name.toLowerCase().includes('cebola caramelizada') ||
        i.name.toLowerCase().includes('farofa')
      )
    );
  }, [items]);

  const activePrep = prepIngredients.find(p => p.id === selectedPrepId) || prepIngredients[0];

  const currentSubItems = activePrep 
    ? subRecipes.filter(s => s.parentIngredientId === activePrep.id) 
    : [];

  const availableSubcategoriesForCategory = useMemo(() => {
    const defaults = DEFAULT_SUBCATEGORIES_BY_CATEGORY[category] || [];
    const fromProds = Array.from(
      new Set(
        products
          .filter(p => p.category === category)
          .map(p => p.subcategory || inferDefaultSubcategory(p))
          .filter(Boolean)
      )
    );
    return Array.from(new Set([...defaults, ...fromProds]));
  }, [category, products]);

  const filterSubcategories = useMemo(() => {
    const relevantProducts = categoryFilter === 'todos' 
      ? products 
      : products.filter(p => p.category === categoryFilter);
    const subcats = Array.from(
      new Set(
        relevantProducts.map(p => p.subcategory || inferDefaultSubcategory(p)).filter(Boolean)
      )
    );
    return subcats;
  }, [products, categoryFilter]);

  const filteredProducts = useMemo(() => {
    return filterCardapioProducts(products, {
      category: categoryFilter,
      subcategory: subcategoryFilter,
      search: searchTerm,
      showInactive,
    });
  }, [products, categoryFilter, subcategoryFilter, searchTerm, showInactive]);

  const groupedProducts = useMemo(() => {
    return groupProductsBySubcategory(filteredProducts);
  }, [filteredProducts]);

  const resetForm = () => {
    setName(''); 
    setCategory('lanche'); 
    setSubcategory('');
    setPriceBalcao(''); 
    setPriceIfood('');
    setNcm(''); 
    setCfop(''); 
    setCsosn(''); 
    setCest('');
    setRecipe([]); 
    setSelectedIngId(''); 
    setIngQuantity(''); 
    setIngSearch('');
    setIsIngDropdownOpen(false); 
    setIsAdding(false); 
    setEditingId(null);
  };

  const applyFiscalPreset = (presetKey: string) => {
    const preset = FISCAL_CATEGORY_PRESETS[presetKey];
    if (preset) {
      setNcm(preset.ncm);
      setCfop(preset.cfop);
      setCsosn(preset.csosn);
      setCest(preset.cest || '');
      notify({ title: `Parâmetros fiscais preenchidos para ${presetKey}.`, tone: 'info' });
    }
  };

  const handleCreateIngredientOnTheFly = async (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    setIsCreatingIngOnTheFly(true);
    try {
      const isLiquidOrWeight = /molho|maionese|geleia|farofa|creme|bacon|queijo|carne|frango|batata/i.test(trimmed);
      const defaultUnit = isLiquidOrWeight ? 'kg' : 'un';
      const defaultCat = isLiquidOrWeight ? 'Carnes' : 'Diversos';

      const newItem = await addInventoryItem({
        name: trimmed,
        category: defaultCat,
        unit: defaultUnit,
        costPerUnit: 0,
        currentStock: 0,
        status: 'ok',
      });

      if (newItem?.id) {
        setSelectedIngId(newItem.id);
        setIngSearch(newItem.name);
        setIsIngDropdownOpen(false);

        const qty = Number(ingQuantity);
        if (!isNaN(qty) && qty > 0) {
          setRecipe(prev => [...prev, { ingredientId: newItem.id, quantity: qty }]);
          setSelectedIngId('');
          setIngQuantity('');
          setIngSearch('');
        }

        notify({
          title: `Insumo "${newItem.name}" criado no estoque com custo R$ 0,00!`,
          description: 'O CMV está aproximado. Defina o custo unitário na tabela abaixo ou em Insumos.',
          tone: 'warning',
        });
      }
    } catch (err: any) {
      notify({ title: `Erro ao criar insumo: ${err.message}`, tone: 'danger' });
    } finally {
      setIsCreatingIngOnTheFly(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!name.trim()) {
      notify({ title: 'O nome do produto é obrigatório.', tone: 'warning' });
      return;
    }
    const valBalcao = Number(priceBalcao);
    if (isNaN(valBalcao) || valBalcao <= 0) {
      notify({ title: 'Informe um Preço Balcão válido maior que zero.', tone: 'warning' });
      return;
    }

    setIsSavingProduct(true);
    try {
      const subcategoryFinal = subcategory.trim() || inferDefaultSubcategory({ name, category } as Product);
      const productData = {
        name: name.trim(), 
        category, 
        subcategory: subcategoryFinal,
        priceBalcao: valBalcao, 
        priceIfood: Number(priceIfood) || valBalcao,
        recipe,
        ncm: ncm.trim() || undefined,
        cfop: cfop.trim() || undefined,
        csosn: csosn.trim() || undefined,
        cest: cest.trim() || undefined
      };

      if (editingId) {
        await updateProduct(editingId, productData);
        notify({ title: `Produto "${name}" atualizado com sucesso!`, tone: 'success' });
      } else {
        await addProduct(productData);
        notify({ title: `Produto "${name}" criado com sucesso no cardápio!`, tone: 'success' });
      }

      resetForm();
    } catch (err: any) {
      notify({ title: `Erro ao salvar produto: ${err.message || 'Falha de conexão'}`, tone: 'danger' });
    } finally {
      setIsSavingProduct(false);
    }
  };

  const startEdit = (p: Product) => {
    setName(p.name);
    setCategory(p.category);
    setSubcategory(p.subcategory || inferDefaultSubcategory(p));
    setPriceBalcao(p.priceBalcao.toString());
    setPriceIfood(p.priceIfood.toString());
    setNcm(p.ncm || '');
    setCfop(p.cfop || '');
    setCsosn(p.csosn || '');
    setCest(p.cest || '');
    setRecipe([...p.recipe]);
    setEditingId(p.id);
    setIsAdding(true);
  };

  const duplicateProduct = (p: Product) => {
    setName(`[Cópia] ${p.name}`);
    setCategory(p.category);
    setSubcategory(p.subcategory || inferDefaultSubcategory(p));
    setPriceBalcao(p.priceBalcao.toString());
    setPriceIfood(p.priceIfood.toString());
    setNcm(p.ncm || '');
    setCfop(p.cfop || '');
    setCsosn(p.csosn || '');
    setCest(p.cest || '');
    setRecipe(p.recipe.map(r => ({ ...r })));
    setEditingId(null);
    setIsAdding(true);
    notify({ title: `Item clonado! Altere o nome e os ingredientes desejados.`, tone: 'info' });
    setTimeout(() => {
      const input = document.getElementById('prod-name-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  };

  const handleConfirmArchiveProduct = async () => {
    if (!confirmProductToArchive) return;
    try {
      await removeProduct(confirmProductToArchive.id);
      notify({ title: `Produto "${confirmProductToArchive.name}" desativado do cardápio.`, tone: 'success' });
      setConfirmProductToArchive(null);
    } catch {
      notify({ title: 'Erro ao desativar produto.', tone: 'danger' });
    }
  };

  const handleReactivateProduct = async (p: Product) => {
    try {
      await updateProduct(p.id, { isActive: true });
      notify({ title: `Produto "${p.name}" reativado no cardápio!`, tone: 'success' });
    } catch {
      notify({ title: 'Erro ao reativar produto.', tone: 'danger' });
    }
  };

  const addIngredientToRecipe = () => {
    if (selectedIngId && ingQuantity) {
      const qty = Number(ingQuantity);
      if (isNaN(qty) || qty <= 0) {
        notify({ title: 'Informe uma quantidade válida maior que zero.', tone: 'warning' });
        return;
      }
      setRecipe([...recipe, { ingredientId: selectedIngId, quantity: qty }]);
      setSelectedIngId('');
      setIngQuantity('');
      setIngSearch('');
    }
  };

  const removeIngredientFromRecipe = (idx: number) => {
    setRecipe(recipe.filter((_, i) => i !== idx));
  };

  // Sub-receitas ações
  const handleAddSubComponent = async () => {
    if (!activePrep || !subChildId || !subChildQty) return;
    const currentComponents = currentSubItems.map(c => ({
      childIngredientId: c.childIngredientId,
      quantity: c.quantity
    }));
    await saveSubRecipe(activePrep.id, [
      ...currentComponents,
      { childIngredientId: subChildId, quantity: Number(subChildQty) }
    ]);
    setSubChildId('');
    setSubChildQty('');
    notify({ title: 'Ingrediente adicionado à sub-receita.', tone: 'success' });
  };

  const handleRemoveSubComponent = async (idx: number) => {
    if (!activePrep) return;
    const currentComponents = currentSubItems
      .filter((_, i) => i !== idx)
      .map(c => ({ childIngredientId: c.childIngredientId, quantity: c.quantity }));
    await saveSubRecipe(activePrep.id, currentComponents);
    notify({ title: 'Item removido da sub-receita.', tone: 'info' });
  };

  const handleConfirmClearFormula = async () => {
    if (!activePrep) return;
    await saveSubRecipe(activePrep.id, []);
    setConfirmClearFormulaOpen(false);
    notify({ title: `Fórmula de "${activePrep.name}" limpa com sucesso.`, tone: 'info' });
  };

  const handleCreateSubRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;

    await addInventoryItem({
      name: newSubName.trim(),
      category: 'Pré-preparos',
      unit: newSubUnit,
      costPerUnit: 0,
      currentStock: 0,
      status: 'ok'
    });

    notify({ title: `Sub-receita "${newSubName}" criada! Adicione os ingredientes da fórmula.`, tone: 'success' });
    setNewSubName('');
    setShowNewSubModal(false);
  };

  const handleConfirmRemoveSubRecipe = async () => {
    if (!confirmSubRecipeToRemove) return;
    await removeSubRecipe(confirmSubRecipeToRemove.id);
    if (activePrep?.id === confirmSubRecipeToRemove.id) {
      setSelectedPrepId('');
    }
    notify({ title: `Sub-receita "${confirmSubRecipeToRemove.name}" excluída.`, tone: 'success' });
    setConfirmSubRecipeToRemove(null);
  };

  // Quick Link Modal Handlers
  const openQuickLinkModal = (p: Product) => {
    setQuickLinkProduct(p);
    const matched = findMatchingInventoryItem(p.name, p.recipe, items);
    const targetIngId = matched?.id || p.recipe[0]?.ingredientId || '';
    setQuickLinkIngredientId(targetIngId);

    const ing = items.find(i => i.id === targetIngId);
    const defQty = p.recipe[0]?.quantity 
      ? p.recipe[0].quantity.toString() 
      : (ing?.unit === 'un' ? '1' : '0.030');
    setQuickLinkDefaultQty(defQty);
    setQuickLinkSearch('');
    setQuickLinkTargetCategory('lanche');

    const initialTargets: Record<string, { checked: boolean; quantity: number }> = {};
    products.forEach(prod => {
      const existingRec = (prod.recipe || []).find(r => r.ingredientId === targetIngId);
      if (existingRec) {
        initialTargets[prod.id] = { checked: true, quantity: existingRec.quantity };
      } else {
        initialTargets[prod.id] = { checked: false, quantity: Number(defQty) };
      }
    });
    setQuickLinkTargets(initialTargets);
  };

  const handleSaveQuickLink = async () => {
    if (!quickLinkIngredientId) {
      notify({ title: 'Selecione um insumo de estoque correspondente.', tone: 'warning' });
      return;
    }

    const activeTargets = Object.entries(quickLinkTargets).map(([productId, t]) => ({
      productId,
      quantity: t.checked && t.quantity > 0 ? t.quantity : 0,
    }));

    const linkedCount = activeTargets.filter(t => t.quantity > 0).length;

    setIsSavingQuickLink(true);
    try {
      const res = await batchAddIngredientToProducts(quickLinkIngredientId, activeTargets);
      if (res.success) {
        const ing = items.find(i => i.id === quickLinkIngredientId);
        notify({ 
          title: `Ingrediente "${ing?.name || 'insumo'}" atualizado na ficha técnica: ${linkedCount} lanche(s) com o item.`, 
          tone: 'success' 
        });
        setQuickLinkProduct(null);
      } else {
        notify({ title: `Erro ao vincular: ${res.error}`, tone: 'danger' });
      }
    } catch (err: any) {
      notify({ title: `Erro inesperado: ${err.message}`, tone: 'danger' });
    } finally {
      setIsSavingQuickLink(false);
    }
  };

  // Inline Stock Item Modal Handler
  const handleCreateStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStockItemName.trim()) return;

    try {
      const newItem = await addInventoryItem({
        name: newStockItemName.trim(),
        category: newStockItemCategory,
        unit: newStockItemUnit,
        costPerUnit: Number(newStockItemCost) || 0,
        currentStock: 0,
        status: 'ok'
      });

      notify({ title: `Insumo "${newStockItemName}" cadastrado no estoque com sucesso!`, tone: 'success' });
      if (newItem?.id) {
        setQuickLinkIngredientId(newItem.id);
      }
      setShowCreateStockItemModal(false);
    } catch {
      notify({ title: 'Erro ao cadastrar novo insumo no estoque.', tone: 'danger' });
    }
  };

  const renderProductCard = (p: Product) => {
    const cmv = calculateRecipeMetrics(
      p.recipe,
      getIngredientTrueCost,
      p.priceBalcao,
      p.priceIfood
    );
    const subcat = p.subcategory || inferDefaultSubcategory(p);

    return (
      <div
        key={p.id}
        className={cn(
          'rounded-dialog border bg-surface-card p-5 shadow-elevated flex flex-col justify-between transition-all',
          p.isActive === false ? 'border-status-danger/30 opacity-60' : 'border-border-default hover:border-border-hover',
        )}
      >
        <div>
          {/* Header do Card */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="neutral" className="uppercase text-[10px]">
                {p.category}
              </Badge>
              {subcat && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                  {subcat}
                </span>
              )}
              {p.isActive === false ? (
                <Badge variant="danger" dot>Desativado</Badge>
              ) : (
                <Badge variant="success" dot>Ativo</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              {p.isActive === false ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleReactivateProduct(p)}
                >
                  Reativar
                </Button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => duplicateProduct(p)}
                    className="p-2 text-text-muted hover:text-amber-400 rounded-control hover:bg-surface-elevated transition-colors cursor-pointer"
                    title="Duplicar Item (clonar receita e preços)"
                    aria-label={`Duplicar ${p.name}`}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="p-2 text-text-muted hover:text-brand-primary rounded-control hover:bg-surface-elevated transition-colors cursor-pointer"
                    title="Editar Produto"
                    aria-label={`Editar ${p.name}`}
                  >
                    <Edit2 size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmProductToArchive(p)}
                    className="p-2 text-text-muted hover:text-status-danger rounded-control hover:bg-surface-elevated transition-colors cursor-pointer"
                    title="Desativar Produto"
                    aria-label={`Desativar ${p.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>

          <h3 className="text-lg font-bold text-text-primary mb-2">{p.name}</h3>

          {/* Preços */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-surface-elevated/50 rounded-xl mb-4 border border-border-default">
            <div>
              <span className="text-[10px] text-text-muted font-bold block flex items-center gap-1">
                <Store size={12} /> BALCÃO
              </span>
              <span className="font-mono text-sm font-bold text-text-primary tabular-nums">
                R$ {p.priceBalcao.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted font-bold block flex items-center gap-1">
                <Smartphone size={12} /> iFOOD
              </span>
              <span className="font-mono text-sm font-bold text-red-400 tabular-nums">
                R$ {p.priceIfood.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Ficha Técnica Resumo */}
          <div className="mb-4">
            <p className="text-[11px] text-text-muted font-bold mb-1.5 uppercase">
              Ingredientes ({p.recipe.length}):
            </p>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
              {p.recipe.map((r, idx) => {
                const ing = items.find(i => i.id === r.ingredientId);
                return (
                  <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-surface-elevated text-text-secondary border border-border-default font-mono">
                    {ing?.name || 'Insumo'} ({r.quantity}{ing?.unit || ''})
                  </span>
                );
              })}
              {p.recipe.length === 0 && (
                <span className="text-xs text-text-muted italic">Sem ficha técnica definida</span>
              )}
            </div>
          </div>
        </div>

        <div>
          {/* Botão de Vínculo Rápido */}
          {p.isActive !== false && (p.category === 'porcao' || p.name.toLowerCase().includes('adicional')) && (
            <button
              type="button"
              onClick={() => openQuickLinkModal(p)}
              className="w-full mb-3 py-2 px-3 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/30 rounded-control text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Layers size={14} aria-hidden="true" />
              Vincular a Hambúrgueres
            </button>
          )}

          {/* Custo Real e Margem */}
          <div className="pt-3 border-t border-border-default flex justify-between items-center text-xs">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-text-muted block text-[10px]">
                  {cmv.hasZeroCostIngredient ? 'CMV APROXIMADO' : 'CUSTO REAL (CMV)'}
                </span>
                {cmv.hasZeroCostIngredient && (
                  <span title={`${cmv.missingCostCount} insumo(s) sem custo cadastrado (R$ 0,00)`}>
                    <AlertTriangle size={11} className="text-amber-400" />
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-amber-400 text-sm tabular-nums">
                R$ {cmv.totalCost.toFixed(2)}
              </span>
              {cmv.hasZeroCostIngredient && (
                <span className="block text-[9px] text-amber-400 font-semibold">
                  {cmv.missingCostCount} custo(s) pendente(s)
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-text-muted block text-[10px]">CMV BALCÃO</span>
              <span className={cn(
                'font-mono font-bold text-sm tabular-nums',
                cmv.cmvBalcao <= 32 ? 'text-emerald-400' : cmv.cmvBalcao <= 38 ? 'text-amber-400' : 'text-red-400',
              )}>
                {cmv.cmvBalcao.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isLoaded) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6" data-testid="cardapio-skeleton">
        <Skeleton className="h-14 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 rounded-dialog" />
          <Skeleton className="h-48 rounded-dialog" />
          <Skeleton className="h-48 rounded-dialog" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        <PageHeader
          title="Cardápio & Fichas Técnicas"
          eyebrow="Engenharia de Cardápio e CMV"
          description="Fichas técnicas com cálculo de CMV em tempo real, sub-receitas e parâmetros fiscais para emissão de NFC-e."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'produtos' ? (
                <Button
                  onClick={() => { resetForm(); setIsAdding(true); }}
                  leadingIcon={<Plus size={18} aria-hidden="true" />}
                >
                  Novo Produto
                </Button>
              ) : (
                <Button
                  onClick={() => setShowNewSubModal(true)}
                  leadingIcon={<Plus size={18} aria-hidden="true" />}
                >
                  Novo Pré-preparo
                </Button>
              )}
              <Link href="/admin/engenharia">
                <Button variant="secondary" leadingIcon={<Sparkles size={16} aria-hidden="true" />}>
                  Matriz BCG
                </Button>
              </Link>
            </div>
          }
        />

        {/* Abas Superiores */}
        <div role="tablist" aria-label="Navegação do Cardápio" className="flex border-b border-border-default overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'produtos'}
            onClick={() => setActiveTab('produtos')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'produtos'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <ChefHat size={16} aria-hidden="true" />
            <span>Produtos & Hambúrgueres ({products.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'subreceitas'}
            onClick={() => setActiveTab('subreceitas')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'subreceitas'
                ? 'border-brand-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            <FlaskConical size={16} aria-hidden="true" />
            <span>Sub-Receitas & Molhos ({prepIngredients.length})</span>
          </button>
        </div>

        {/* ABA 1: PRODUTOS & FICHAS TÉCNICAS */}
        {activeTab === 'produtos' && (
          <div className="space-y-6">
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchLabel="Buscar produtos"
              placeholder="Buscar por nome ou categoria..."
              resultCount={filteredProducts.length}
              totalCount={products.length}
              active={Boolean(searchTerm || categoryFilter !== 'todos' || showInactive)}
              onClear={() => {
                setSearchTerm('');
                setCategoryFilter('todos');
                setShowInactive(false);
                setSubcategoryFilter('todas');
              }}
            >
              <div className="space-y-1.5 sm:w-44">
                <label htmlFor="cardapio-cat-select" className="block text-sm font-medium text-text-secondary">
                  Categoria
                </label>
                <Select
                  id="cardapio-cat-select"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value as CardapioCategoryFilter);
                    setSubcategoryFilter('todas');
                  }}
                >
                  <option value="todos">Todas as categorias</option>
                  <option value="lanche">Hambúrgueres</option>
                  <option value="porcao">Porções / Adicionais</option>
                  <option value="bebida">Bebidas</option>
                  <option value="combo">Combos</option>
                </Select>
              </div>

              {filterSubcategories.length > 0 && (
                <div className="space-y-1.5 sm:w-48">
                  <label htmlFor="cardapio-subcat-select" className="block text-sm font-medium text-text-secondary">
                    Subcategoria
                  </label>
                  <Select
                    id="cardapio-subcat-select"
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                  >
                    <option value="todas">Todas as subcategorias</option>
                    {filterSubcategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-6">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-border-default bg-surface-elevated text-brand-primary focus:ring-brand-primary"
                  />
                  <span>Exibir inativos</span>
                </label>
              </div>
            </FilterBar>

            {/* Subcategorias Chips de Filtragem Rápida */}
            {filterSubcategories.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center pt-1">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-1 flex items-center gap-1">
                  <FolderTree size={13} className="text-brand-primary" /> Subcategorias:
                </span>
                <button
                  type="button"
                  onClick={() => setSubcategoryFilter('todas')}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer',
                    subcategoryFilter === 'todas'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-card border border-border-default',
                  )}
                >
                  Todas ({products.filter(p => (categoryFilter === 'todos' || p.category === categoryFilter) && (showInactive || p.isActive !== false)).length})
                </button>
                {filterSubcategories.map(sub => {
                  const count = products.filter(p => 
                    (categoryFilter === 'todos' || p.category === categoryFilter) &&
                    (showInactive || p.isActive !== false) &&
                    (p.subcategory || inferDefaultSubcategory(p)) === sub
                  ).length;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSubcategoryFilter(sub)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5',
                        subcategoryFilter === sub
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-card border border-border-default',
                      )}
                    >
                      <span>{sub}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                        subcategoryFilter === sub ? 'bg-white/20 text-white' : 'bg-surface-card text-text-muted',
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Alternância de Modo de Visualização e Contadores */}
            {products.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-text-muted">
                  Exibindo <strong>{filteredProducts.length}</strong> de <strong>{products.length}</strong> produtos
                  {subcategoryFilter !== 'todas' && ` na subcategoria "${subcategoryFilter}"`}
                </div>
                <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-control border border-border-default text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('hierarquico')}
                    className={cn(
                      'px-2.5 py-1 rounded flex items-center gap-1.5 font-medium transition-colors cursor-pointer',
                      viewMode === 'hierarquico' ? 'bg-surface-card text-brand-primary font-bold shadow-sm' : 'text-text-muted hover:text-text-secondary',
                    )}
                  >
                    <FolderTree size={14} />
                    Hierarquia
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grade')}
                    className={cn(
                      'px-2.5 py-1 rounded flex items-center gap-1.5 font-medium transition-colors cursor-pointer',
                      viewMode === 'grade' ? 'bg-surface-card text-brand-primary font-bold shadow-sm' : 'text-text-muted hover:text-text-secondary',
                    )}
                  >
                    <Grid size={14} />
                    Grade Simples
                  </button>
                </div>
              </div>
            )}

            {products.length === 0 ? (
              /* Onboarding para quem inicia do zero */
              <div className="rounded-dialog border border-dashed border-brand-primary/40 bg-brand-primary/5 p-8 md:p-12 text-center space-y-4 max-w-2xl mx-auto shadow-sm">
                <div className="inline-flex p-3 rounded-full bg-brand-primary/20 text-brand-primary mb-1">
                  <ChefHat size={32} />
                </div>
                <h3 className="text-xl font-bold text-text-primary">
                  Monte seu cardápio do zero de forma simples e guiada
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed max-w-lg mx-auto">
                  Cadastre seus hambúrgueres artesanais, porções e bebidas. Ao digitar a receita, o sistema busca os insumos no estoque ou cria-os automaticamente na hora, calculando o CMV para garantir a lucratividade da sua operação.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3">
                  <Button
                    onClick={() => {
                      resetForm();
                      setCategory('lanche');
                      setSubcategory('Artesanais 180g');
                      setIsAdding(true);
                    }}
                    leadingIcon={<Plus size={16} />}
                  >
                    Criar Primeiro Hambúrguer
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      resetForm();
                      setCategory('porcao');
                      setSubcategory('Batatas Fritas');
                      setIsAdding(true);
                    }}
                    leadingIcon={<Plus size={16} />}
                  >
                    Criar Porção ou Bebida
                  </Button>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                title="Nenhum produto encontrado"
                description="Tente pesquisar com outro termo ou redefina os filtros selecionados."
                icon={<ChefHat aria-hidden="true" />}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('todos');
                      setSubcategoryFilter('todas');
                      setShowInactive(false);
                    }}
                  >
                    Limpar filtros
                  </Button>
                }
              />
            ) : viewMode === 'hierarquico' && subcategoryFilter === 'todas' ? (
              /* Visualização Hierárquica por Subcategorias */
              <div className="space-y-8">
                {groupedProducts.map(({ subcategory: groupSub, products: groupProds }) => {
                  const isCollapsed = Boolean(collapsedSubcategories[groupSub]);
                  const avgCmv = groupProds.reduce((acc, p) => {
                    const m = calculateRecipeMetrics(p.recipe, getIngredientTrueCost, p.priceBalcao, p.priceIfood);
                    return acc + m.cmvBalcao;
                  }, 0) / (groupProds.length || 1);

                  return (
                    <div key={groupSub} className="space-y-4">
                      {/* Cabeçalho da Subcategoria */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 rounded-xl bg-surface-card border border-border-default shadow-sm">
                        <button
                          type="button"
                          onClick={() => setCollapsedSubcategories(prev => ({ ...prev, [groupSub]: !isCollapsed }))}
                          className="flex items-center gap-2 text-left cursor-pointer group"
                        >
                          <span className="p-1 rounded bg-surface-elevated text-text-muted group-hover:text-text-primary transition-colors">
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </span>
                          <span className="font-bold text-base text-text-primary group-hover:text-brand-primary transition-colors">
                            {groupSub}
                          </span>
                          <span className="text-xs text-text-muted font-mono bg-surface-elevated px-2 py-0.5 rounded-full">
                            {groupProds.length} {groupProds.length === 1 ? 'item' : 'itens'}
                          </span>
                          <span className="text-xs text-text-muted hidden sm:inline">
                            • CMV Médio:{' '}
                            <strong className={avgCmv <= 32 ? 'text-emerald-400' : avgCmv <= 38 ? 'text-amber-400' : 'text-red-400'}>
                              {avgCmv.toFixed(1)}%
                            </strong>
                          </span>
                        </button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            resetForm();
                            setCategory(groupProds[0]?.category || 'lanche');
                            setSubcategory(groupSub);
                            setIsAdding(true);
                          }}
                          leadingIcon={<Plus size={14} />}
                        >
                          Adicionar em {groupSub}
                        </Button>
                      </div>

                      {/* Grade de Cards da Subcategoria */}
                      {!isCollapsed && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {groupProds.map(renderProductCard)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Visualização Grade Direta */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(renderProductCard)}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: SUB-RECEITAS E MOLHOS DA CASA */}
        {activeTab === 'subreceitas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Lista de Pré-preparos à esquerda */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
                  Pré-preparos ({prepIngredients.length})
                </h2>
                <Button
                  size="sm"
                  onClick={() => setShowNewSubModal(true)}
                  leadingIcon={<Plus size={14} aria-hidden="true" />}
                >
                  Novo
                </Button>
              </div>

              {prepIngredients.map(prep => {
                const isSelected = activePrep?.id === prep.id;
                const cost = getIngredientTrueCost(prep.id);

                return (
                  <div
                    key={prep.id}
                    onClick={() => setSelectedPrepId(prep.id)}
                    className={cn(
                      'w-full p-4 rounded-dialog border text-left transition-all cursor-pointer flex justify-between items-center',
                      isSelected 
                        ? 'bg-brand-primary/10 border-brand-primary text-text-primary shadow-elevated' 
                        : 'bg-surface-card border-border-default text-text-secondary hover:border-border-hover',
                    )}
                  >
                    <div className="flex-1 pr-2">
                      <p className="font-bold text-sm text-text-primary">{prep.name}</p>
                      <p className="text-xs text-text-muted">Unidade: {prep.unit}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-text-muted block">Custo Calculado</span>
                        <span className="font-mono font-bold text-amber-400 text-sm tabular-nums">
                          R$ {cost.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmSubRecipeToRemove(prep);
                        }}
                        className="p-2 text-text-muted hover:text-status-danger rounded-control hover:bg-surface-elevated transition-colors cursor-pointer"
                        title="Excluir esta sub-receita"
                        aria-label={`Excluir sub-receita ${prep.name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {prepIngredients.length === 0 && (
                <p className="text-text-muted text-xs text-center py-6">Nenhum pré-preparo cadastrado.</p>
              )}
            </div>

            {/* Editor da Sub-Receita Selecionada */}
            <div className="lg:col-span-8">
              {activePrep ? (
                <div className="rounded-dialog border border-border-default bg-surface-card p-6 shadow-elevated space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="inline-flex items-center gap-2 text-brand-primary font-bold text-xs uppercase mb-1">
                        <FlaskConical size={16} aria-hidden="true" /> Sub-Receita da Casa
                      </div>
                      <h2 className="text-2xl font-extrabold text-text-primary">{activePrep.name}</h2>
                      <p className="text-text-secondary text-sm mt-1">
                        Proporções de insumos brutos que compõem 1 {activePrep.unit} desta preparação.
                      </p>
                    </div>
                    <div className="p-4 bg-surface-elevated/60 rounded-xl border border-border-default text-right">
                      <span className="text-[10px] text-text-muted font-bold block uppercase">
                        Custo Total por {activePrep.unit}
                      </span>
                      <span className="text-2xl font-mono font-extrabold text-amber-400 tabular-nums">
                        R$ {getIngredientTrueCost(activePrep.id).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Adicionar Ingrediente na Sub-Receita */}
                  <div className="bg-surface-elevated/40 p-4 rounded-xl border border-border-default space-y-3">
                    <label className="block text-xs text-text-secondary font-bold uppercase tracking-wider">
                      Adicionar Ingrediente à Fórmula
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select 
                        value={subChildId}
                        onChange={e => setSubChildId(e.target.value)}
                        className="flex-1 bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary outline-none focus:border-brand-primary text-sm"
                      >
                        <option value="" disabled>Selecione um ingrediente (ex: Óleo de Girassol)...</option>
                        {sortedItems.filter(i => i.id !== activePrep.id).map(i => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.category}) — R$ {i.costPerUnit.toFixed(2)}/{i.unit}
                          </option>
                        ))}
                      </select>

                      <input 
                        type="number" 
                        step="0.001"
                        placeholder="Qtd (ex: 0.65)"
                        value={subChildQty}
                        onChange={e => setSubChildQty(e.target.value)}
                        className="w-36 bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary font-mono text-sm outline-none focus:border-brand-primary"
                      />

                      <Button 
                        onClick={handleAddSubComponent}
                        disabled={!subChildId || !subChildQty}
                      >
                        Vincular
                      </Button>
                    </div>
                  </div>

                  {/* Componentes da Sub-Receita */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs text-text-muted font-bold uppercase">Componentes da Fórmula:</h3>
                      {currentSubItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setConfirmClearFormulaOpen(true)}
                          className="text-xs text-status-danger hover:underline font-semibold cursor-pointer"
                        >
                          Limpar fórmula inteira
                        </button>
                      )}
                    </div>
                    {currentSubItems.map((c, idx) => {
                      const childIng = items.find(i => i.id === c.childIngredientId);
                      const cost = childIng ? getIngredientTrueCost(childIng.id) : 0;
                      const subtotal = cost * c.quantity;

                      return (
                        <div key={idx} className="flex justify-between items-center p-3.5 bg-surface-elevated/40 rounded-xl border border-border-default">
                          <div>
                            <span className="font-bold text-text-primary text-sm">{childIng?.name || 'Insumo'}</span>
                            <span className="text-text-muted text-xs ml-3 font-mono">
                              proporção: {c.quantity} {childIng?.unit}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-amber-400 font-bold text-sm tabular-nums">
                              R$ {subtotal.toFixed(2)}
                            </span>
                            <button 
                              type="button"
                              onClick={() => handleRemoveSubComponent(idx)} 
                              className="text-text-muted hover:text-status-danger p-1 cursor-pointer"
                              aria-label="Remover componente"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {currentSubItems.length === 0 && (
                      <p className="text-text-muted text-sm text-center py-6 border border-dashed border-border-default rounded-xl">
                        Nenhum ingrediente vinculado a esta sub-receita. Adicione acima para calcular o custo.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-dialog border border-border-default bg-surface-card p-12 text-center text-text-muted">
                  Selecione um pré-preparo à esquerda para visualizar sua composição.
                </div>
              )}
            </div>
          </div>
        )}

        {/* DIALOG 1: CRIAÇÃO / EDIÇÃO DE PRODUTO E FICHA TÉCNICA */}
        <Dialog
          open={isAdding}
          onClose={resetForm}
          title={editingId ? 'Editar Produto e Ficha Técnica' : 'Novo Produto no Cardápio'}
          description="Composição de insumos, cálculo de CMV em tempo real e parâmetros fiscais para NFC-e."
          size="lg"
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button variant="secondary" onClick={resetForm} disabled={isSavingProduct}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProduct} loading={isSavingProduct}>
                Salvar Produto
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Informações Básicas do Produto */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6 space-y-1.5">
                <label htmlFor="prod-name-input" className="block text-xs font-bold text-text-secondary">
                  Nome do Produto *
                </label>
                <input 
                  id="prod-name-input"
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Hum Burger Artesanal" 
                  className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary outline-none focus:border-brand-primary text-sm"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label htmlFor="prod-cat-input" className="block text-xs font-bold text-text-secondary">
                  Categoria *
                </label>
                <Select
                  id="prod-cat-input"
                  value={category}
                  onChange={e => {
                    const newCat = e.target.value as any;
                    setCategory(newCat);
                    const defs = DEFAULT_SUBCATEGORIES_BY_CATEGORY[newCat];
                    if (defs && defs.length > 0 && !subcategory) {
                      setSubcategory(defs[0]);
                    }
                  }}
                >
                  <option value="lanche">Hambúrguer</option>
                  <option value="porcao">Porção / Adicional</option>
                  <option value="bebida">Bebida</option>
                  <option value="combo">Combo</option>
                </Select>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="prod-subcat-input" className="block text-xs font-bold text-text-secondary">
                    Subcategoria
                  </label>
                  <span className="text-[10px] text-text-muted">Hierarquia</span>
                </div>
                <div className="relative">
                  <input
                    id="prod-subcat-input"
                    list="subcategories-datalist"
                    type="text"
                    value={subcategory}
                    onChange={e => setSubcategory(e.target.value)}
                    placeholder="Ex: Smash Burgers"
                    className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary outline-none focus:border-brand-primary text-sm"
                  />
                  <datalist id="subcategories-datalist">
                    {availableSubcategoriesForCategory.map(sub => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Grid de Duas Colunas: Composição à Esquerda, Indicadores à Direita */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda: Ingredientes da Ficha Técnica */}
              <div className="lg:col-span-7 rounded-xl border border-border-default bg-surface-elevated/30 p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <Layers size={14} className="text-brand-primary" aria-hidden="true" />
                    Ingredientes da Ficha
                  </h3>
                  <span className="text-xs font-mono text-text-muted">
                    {recipe.length} insumo(s)
                  </span>
                </div>

                {/* Combobox de Inserção com Criação On-the-Fly */}
                <div className="flex flex-col sm:flex-row gap-2 relative">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Buscar insumo existente ou digitar novo..."
                      value={ingSearch}
                      onChange={e => {
                        setIngSearch(e.target.value);
                        setIsIngDropdownOpen(true);
                        setHighlightedIndex(0);
                      }}
                      onFocus={() => setIsIngDropdownOpen(true)}
                      onKeyDown={e => {
                        if (!isIngDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                          setIsIngDropdownOpen(true);
                          return;
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedIndex(prev => Math.min(prev + 1, filteredTypeaheadItems.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedIndex(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredTypeaheadItems[highlightedIndex]) {
                            const picked = filteredTypeaheadItems[highlightedIndex];
                            setSelectedIngId(picked.id);
                            setIngSearch(picked.name);
                            setIsIngDropdownOpen(false);
                          } else if (ingSearch.trim()) {
                            handleCreateIngredientOnTheFly(ingSearch.trim());
                          }
                        } else if (e.key === 'Escape') {
                          setIsIngDropdownOpen(false);
                        }
                      }}
                      className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary outline-none focus:border-brand-primary text-xs"
                    />

                    {isIngDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface-card border border-border-default rounded-xl shadow-dialog max-h-56 overflow-y-auto">
                        {/* Opção On-the-Fly: Criar novo insumo se não houver correspondência exata */}
                        {ingSearch.trim() && !items.some(i => i.name.toLowerCase().trim() === ingSearch.toLowerCase().trim()) && (
                          <div
                            onClick={() => handleCreateIngredientOnTheFly(ingSearch.trim())}
                            className="p-3 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border-b border-border-default/60 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Plus size={14} className="text-brand-primary" />
                              <span className="font-bold text-xs">
                                + Cadastrar "{ingSearch.trim()}" no Estoque
                              </span>
                            </div>
                            <span className="text-[10px] bg-brand-primary/20 text-brand-primary font-bold px-2 py-0.5 rounded-full">
                              Novo Insumo
                            </span>
                          </div>
                        )}

                        {filteredTypeaheadItems.length === 0 && !ingSearch.trim() ? (
                          <div className="p-2.5 text-center text-xs text-text-muted">
                            Digite o nome de um ingrediente...
                          </div>
                        ) : (
                          filteredTypeaheadItems.map((item, idx) => {
                            const cost = getIngredientTrueCost(item.id);
                            const isSelected = item.id === selectedIngId;
                            const isHighlighted = idx === highlightedIndex;

                            return (
                              <div
                                key={item.id}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onClick={() => {
                                  setSelectedIngId(item.id);
                                  setIngSearch(item.name);
                                  setIsIngDropdownOpen(false);
                                }}
                                className={cn(
                                  'p-2.5 px-3 flex justify-between items-center cursor-pointer border-b border-border-default/40 last:border-0 text-xs transition-colors',
                                  isHighlighted ? 'bg-brand-primary/20 text-text-primary' : isSelected ? 'bg-surface-elevated text-brand-primary' : 'text-text-secondary hover:bg-surface-elevated',
                                )}
                              >
                                <span className="font-bold">{item.name}</span>
                                <span className="font-mono text-[11px] text-text-muted">
                                  R$ {cost.toFixed(2)} / {item.unit}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <input
                    type="number"
                    step="0.001"
                    placeholder="Qtd"
                    value={ingQuantity}
                    onChange={e => setIngQuantity(e.target.value)}
                    className="w-24 bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary font-mono text-xs outline-none focus:border-brand-primary"
                  />

                  <Button
                    size="sm"
                    onClick={addIngredientToRecipe}
                    disabled={!selectedIngId || !ingQuantity}
                  >
                    Adicionar
                  </Button>
                </div>

                {/* Alerta de Custo Zerado & CMV Aproximado */}
                {activeRecipeMetrics.hasZeroCostIngredient && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-300 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-amber-200">
                      <AlertTriangle size={16} className="shrink-0 text-amber-400" aria-hidden="true" />
                      <span>CMV APROXIMADO: {activeRecipeMetrics.missingCostCount} insumo(s) sem custo (R$ 0,00)</span>
                    </div>
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      O CMV do produto está subestimado. Defina o custo unitário na tabela abaixo ou na aba{' '}
                      <Link href="/admin/insumos" target="_blank" className="underline font-bold text-amber-200 hover:text-white inline-flex items-center gap-0.5">
                        Insumos <ExternalLink size={10} />
                      </Link>{' '}
                      para que a operação tenha clareza total dos lucros.
                    </p>
                  </div>
                )}

                {/* Tabela de Insumos da Receita com Edição Rápida de Custo */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {recipe.map((r, idx) => {
                    const ing = items.find(i => i.id === r.ingredientId);
                    const unitCost = ing ? getIngredientTrueCost(ing.id) : 0;
                    const subtotal = unitCost * r.quantity;
                    const isZeroCost = unitCost <= 0;

                    return (
                      <div key={idx} className={cn(
                        'p-2.5 rounded-lg border text-xs transition-colors',
                        isZeroCost ? 'bg-amber-500/5 border-amber-500/30' : 'bg-surface-card border-border-default'
                      )}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-text-primary">{ing?.name || 'Insumo'}</span>
                              {isZeroCost && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <AlertTriangle size={10} /> Custo R$ 0,00
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-text-muted font-mono">
                              {r.quantity} {ing?.unit} × R$ {unitCost.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-amber-400 tabular-nums">
                              R$ {subtotal.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeIngredientFromRecipe(idx)}
                              className="text-text-muted hover:text-status-danger p-1 cursor-pointer"
                              aria-label="Remover insumo"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {/* Edição Rápida de Custo para Insumo com Custo Zerado */}
                        {isZeroCost && ing && (
                          <div className="mt-2 pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-300/90">
                              Definir custo (por {ing.unit}):
                            </span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="R$ 0,00"
                                value={inlineCostInputs[ing.id] ?? ''}
                                onChange={(e) => setInlineCostInputs(prev => ({ ...prev, [ing.id]: e.target.value }))}
                                className="w-20 bg-surface-input border border-border-default rounded p-1 text-xs text-text-primary font-mono outline-none focus:border-brand-primary"
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-[11px] px-2"
                                disabled={!inlineCostInputs[ing.id] || Number(inlineCostInputs[ing.id]) <= 0}
                                onClick={async () => {
                                  const newCost = Number(inlineCostInputs[ing.id]);
                                  if (newCost > 0) {
                                    await updateInventoryItem(ing.id, { costPerUnit: newCost });
                                    notify({ title: `Custo de "${ing.name}" atualizado para R$ ${newCost.toFixed(2)}!`, tone: 'success' });
                                    setInlineCostInputs(prev => {
                                      const next = { ...prev };
                                      delete next[ing.id];
                                      return next;
                                    });
                                  }
                                }}
                              >
                                Salvar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {recipe.length === 0 && (
                    <div className="text-center py-6 text-xs text-text-muted border border-dashed border-border-default rounded-lg">
                      Nenhum insumo adicionado ainda. Digite um nome acima para selecionar ou cadastrar.
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna Direita: CMV em Tempo Real, Precificação e Fiscal */}
              <div className="lg:col-span-5 space-y-4">
                {/* Preços de Venda */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="price-balcao-input" className="block text-xs font-bold text-text-secondary">
                      Preço Balcão (R$) *
                    </label>
                    <input 
                      id="price-balcao-input"
                      type="number" 
                      step="0.50" 
                      value={priceBalcao} 
                      onChange={e => setPriceBalcao(e.target.value)}
                      placeholder="0.00" 
                      className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary font-mono text-sm outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="price-ifood-input" className="block text-xs font-bold text-text-secondary">
                      Preço iFood (R$)
                    </label>
                    <input 
                      id="price-ifood-input"
                      type="number" 
                      step="0.50" 
                      value={priceIfood} 
                      onChange={e => setPriceIfood(e.target.value)}
                      placeholder="0.00" 
                      className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary font-mono text-sm outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                {/* Painel Resumo Financeiro em Tempo Real */}
                <div className="rounded-xl border border-border-default bg-surface-elevated/40 p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-border-default">
                    <span className="text-xs text-text-muted uppercase font-bold">Custo Ficha Técnica</span>
                    <span className="text-xl font-mono font-bold text-amber-400 tabular-nums">
                      R$ {activeRecipeMetrics.totalCost.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-surface-card border border-border-default">
                      <span className="text-[10px] text-text-muted block">CMV Balcão</span>
                      <span className={cn(
                        'font-mono font-bold text-sm tabular-nums',
                        activeRecipeMetrics.cmvBalcao <= 32 ? 'text-emerald-400' : activeRecipeMetrics.cmvBalcao <= 38 ? 'text-amber-400' : 'text-red-400',
                      )}>
                        {activeRecipeMetrics.cmvBalcao.toFixed(1)}%
                      </span>
                    </div>

                    <div className="p-2 rounded bg-surface-card border border-border-default">
                      <span className="text-[10px] text-text-muted block">CMV iFood</span>
                      <span className="font-mono font-bold text-sm text-text-secondary tabular-nums">
                        {activeRecipeMetrics.cmvIfood.toFixed(1)}%
                      </span>
                    </div>

                    <div className="p-2 rounded bg-surface-card border border-border-default">
                      <span className="text-[10px] text-text-muted block">Margem Balcão</span>
                      <span className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
                        R$ {activeRecipeMetrics.marginBalcao.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-surface-card border border-border-default">
                      <span className="text-[10px] text-text-muted block">Sugestão (30%)</span>
                      <span className="font-mono font-bold text-sm text-brand-primary tabular-nums">
                        R$ {activeRecipeMetrics.suggestedPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Parâmetros Fiscais (NFC-e) */}
                <div className="rounded-xl border border-border-default bg-surface-elevated/30 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-text-secondary uppercase flex items-center gap-1">
                      <Landmark size={14} className="text-cyan-400" aria-hidden="true" /> Parâmetros Fiscais
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => applyFiscalPreset('lanche')}
                        className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-card text-[10px] font-bold text-text-secondary border border-border-default cursor-pointer"
                      >
                        Lanche
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFiscalPreset('bebida')}
                        className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-card text-[10px] font-bold text-text-secondary border border-border-default cursor-pointer"
                      >
                        Bebida
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label htmlFor="ncm-input" className="block text-[10px] text-text-muted font-bold mb-1">NCM:</label>
                      <input
                        id="ncm-input"
                        type="text"
                        value={ncm}
                        onChange={e => setNcm(e.target.value)}
                        placeholder="Ex: 2106.90.90"
                        className="w-full bg-surface-input border border-border-default rounded-control p-2 text-text-primary font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="cfop-input" className="block text-[10px] text-text-muted font-bold mb-1">CFOP:</label>
                      <input
                        id="cfop-input"
                        type="text"
                        value={cfop}
                        onChange={e => setCfop(e.target.value)}
                        placeholder="Ex: 5102"
                        className="w-full bg-surface-input border border-border-default rounded-control p-2 text-text-primary font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Dialog>

        {/* DIALOG 2: VÍNCULO RÁPIDO DE ADICIONAIS A HAMBÚRGUERES */}
        <Dialog
          open={Boolean(quickLinkProduct)}
          onClose={() => setQuickLinkProduct(null)}
          title={`Vínculo à Ficha Técnica: ${quickLinkProduct?.name || ''}`}
          description="Selecione os lanches que levam este adicional/insumo na composição padrão."
          size="lg"
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button variant="secondary" onClick={() => setQuickLinkProduct(null)} disabled={isSavingQuickLink}>
                Cancelar
              </Button>
              <Button onClick={handleSaveQuickLink} loading={isSavingQuickLink}>
                Salvar Vínculos
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-surface-elevated/40 border border-border-default rounded-xl p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-7">
                <label htmlFor="quick-link-ing-select" className="block text-xs font-bold text-text-secondary mb-1">
                  Insumo de Estoque correspondente:
                </label>
                <select
                  id="quick-link-ing-select"
                  value={quickLinkIngredientId}
                  onChange={e => setQuickLinkIngredientId(e.target.value)}
                  className="w-full bg-surface-input border border-border-default rounded-control p-2 text-xs text-text-primary outline-none focus:border-brand-primary"
                >
                  <option value="">Selecione o insumo correspondente...</option>
                  {sortedItems.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.category}) — R$ {i.costPerUnit.toFixed(2)} / {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-5">
                <label htmlFor="quick-link-qty-input" className="block text-xs font-bold text-text-secondary mb-1">
                  Qtd Padrão:
                </label>
                <input
                  id="quick-link-qty-input"
                  type="number"
                  step="0.001"
                  value={quickLinkDefaultQty}
                  onChange={e => setQuickLinkDefaultQty(e.target.value)}
                  className="w-full bg-surface-input border border-border-default rounded-control p-2 text-xs text-text-primary font-mono outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            {/* Lista de Hambúrgueres Alvo */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {products
                .filter(p => p.isActive !== false && p.category === 'lanche')
                .map(p => {
                  const isChecked = Boolean(quickLinkTargets[p.id]?.checked);
                  const targetQty = quickLinkTargets[p.id]?.quantity ?? (Number(quickLinkDefaultQty) || 0.030);

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setQuickLinkTargets(prev => ({
                          ...prev,
                          [p.id]: { checked: !isChecked, quantity: targetQty }
                        }));
                      }}
                      className={cn(
                        'p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs',
                        isChecked ? 'bg-brand-primary/10 border-brand-primary text-text-primary' : 'bg-surface-elevated/30 border-border-default text-text-secondary hover:border-border-hover',
                      )}
                    >
                      <span className="font-semibold">{p.name}</span>
                      <span className="font-mono text-text-muted">
                        {isChecked ? `${targetQty} un/kg vinculado` : 'Não vinculado'}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </Dialog>

        {/* DIALOG 3: NOVA SUB-RECEITA / PRÉ-PREPARO */}
        <Dialog
          open={showNewSubModal}
          onClose={() => setShowNewSubModal(false)}
          title="Nova Sub-Receita / Pré-Preparo"
          description="Crie uma base de molho ou pré-preparo para calcular seu custo composto por quilo ou litro."
          size="sm"
        >
          <form onSubmit={handleCreateSubRecipe} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-sub-name-input" className="block text-xs font-bold text-text-secondary">
                Nome da Sub-Receita / Molho *
              </label>
              <input 
                id="new-sub-name-input"
                type="text" 
                required 
                placeholder="Ex: Maionese de Alho Confitado" 
                value={newSubName} 
                onChange={e => setNewSubName(e.target.value)}
                className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary outline-none focus:border-brand-primary text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-sub-unit-select" className="block text-xs font-bold text-text-secondary">
                Unidade de Medida Produzida *
              </label>
              <Select 
                id="new-sub-unit-select"
                value={newSubUnit} 
                onChange={e => setNewSubUnit(e.target.value)}
              >
                <option value="kg">Quilograma (kg)</option>
                <option value="L">Litro (L)</option>
                <option value="un">Unidade (un)</option>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowNewSubModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Criar Sub-Receita
              </Button>
            </div>
          </form>
        </Dialog>

        {/* CONFIRM DIALOGS: DESATIVAÇÕES E EXCLUSÕES */}
        <ConfirmDialog
          open={Boolean(confirmProductToArchive)}
          onClose={() => setConfirmProductToArchive(null)}
          title={`Desativar "${confirmProductToArchive?.name}"?`}
          description="O produto será desativado do cardápio e não poderá ser vendido no Caixa até ser reativado."
          confirmLabel="Desativar Produto"
          tone="danger"
          onConfirm={handleConfirmArchiveProduct}
        />

        <ConfirmDialog
          open={Boolean(confirmSubRecipeToRemove)}
          onClose={() => setConfirmSubRecipeToRemove(null)}
          title={`Excluir sub-receita "${confirmSubRecipeToRemove?.name}"?`}
          description="A fórmula e todos os custos associados a este pré-preparo serão removidos."
          confirmLabel="Excluir Sub-Receita"
          tone="danger"
          onConfirm={handleConfirmRemoveSubRecipe}
        />

        <ConfirmDialog
          open={confirmClearFormulaOpen}
          onClose={() => setConfirmClearFormulaOpen(false)}
          title={`Limpar fórmula de "${activePrep?.name || ''}"?`}
          description="Todos os ingredientes vinculados a esta sub-receita serão desvinculados."
          confirmLabel="Limpar Fórmula"
          tone="danger"
          onConfirm={handleConfirmClearFormula}
        />
      </div>
    </div>
  );
}
