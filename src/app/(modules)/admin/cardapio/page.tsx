'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChefHat, Plus, Trash2, Edit2, 
  FlaskConical, Sparkles, Layers, Store, Smartphone, Search, Copy,
  Landmark, AlertTriangle, CheckCircle2, X, FolderTree, Grid,
  ChevronDown, ChevronRight, ExternalLink, Info, FolderKanban,
  ArrowUp, ArrowDown, Pencil, Check
} from 'lucide-react';
import { 
  useInventory, type Product, type RecipeIngredient, type InventoryItem, 
  type RecipeProductionStation, type RecipeProductionKind, 
  type KitchenComponent, type KitchenComponentType 
} from '@/lib/store';
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
import { validateProductIntegrity, type ProductStatus } from '@/lib/product-validator';
import { KitchenProductPreview } from '@/components/cardapio/KitchenProductPreview';
import {
  getCustomSubcategories,
  saveCustomSubcategories,
  getSubcategoriesForCategory,
  addSubcategory,
  renameSubcategory,
  deleteSubcategory,
  moveSubcategory,
  purgeUnusedSubcategories,
  getFallbackSubcategoryForCategory,
  type CustomSubcategoriesMap,
} from '@/lib/subcategory-store';
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

const stationLabel = (value?: RecipeProductionStation) =>
  PRODUCTION_STATIONS.find(option => option.value === value)?.label || 'Não revisado';

const kindLabel = (value?: RecipeProductionKind) =>
  PRODUCTION_KINDS.find(option => option.value === value)?.label || 'Regra legada';

export default function CardapioAdminPage() {
  const { 
    items, products, addProduct, updateProduct, removeProduct, 
    kitchenComponents, addKitchenComponent, updateKitchenComponent, removeKitchenComponent,
    isLoaded, subRecipes, saveSubRecipe, removeSubRecipe, 
    getIngredientTrueCost, addInventoryItem, updateInventoryItem, batchAddIngredientToProducts,
    batchUpdateProductSubcategory
  } = useInventory();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<'produtos' | 'subreceitas'>('produtos');
  const [categoryFilter, setCategoryFilter] = useState<CardapioCategoryFilter>('todos');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<'hierarquico' | 'grade'>('hierarquico');
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Record<string, boolean>>({});

  // Gestão de Componentes de Preparo (Modal)
  const [isKitchenModalOpen, setIsKitchenModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Partial<KitchenComponent> | null>(null);
  const [compName, setCompName] = useState('');
  const [compType, setCompType] = useState<KitchenComponentType>('burger');
  const [compStation, setCompStation] = useState<RecipeProductionStation>('grill');
  const [compUnit, setCompUnit] = useState('disco');
  const [compWeight, setCompWeight] = useState<string>('180');
  const [compPortionUnit, setCompPortionUnit] = useState('g');
  const [compShowInSummary, setCompShowInSummary] = useState(true);

  const handleOpenAddComponent = () => {
    setEditingComponent({});
    setCompName('');
    setCompType('burger');
    setCompStation('grill');
    setCompUnit('disco');
    setCompWeight('180');
    setCompPortionUnit('g');
    setCompShowInSummary(true);
  };

  const handleOpenEditComponent = (comp: KitchenComponent) => {
    setEditingComponent(comp);
    setCompName(comp.name);
    setCompType(comp.componentType);
    setCompStation(comp.station);
    setCompUnit(comp.productionUnit);
    setCompWeight(comp.portionWeight !== undefined ? String(comp.portionWeight) : '');
    setCompPortionUnit(comp.portionUnit || 'g');
    setCompShowInSummary(comp.showInSummary !== false);
  };

  const handleSaveComponent = async () => {
    if (!compName.trim()) {
      notify({ title: 'O nome do componente é obrigatório.', tone: 'danger' });
      return;
    }
    const weightNum = compWeight !== '' ? Number(compWeight) : undefined;
    if (weightNum !== undefined && (!Number.isFinite(weightNum) || weightNum <= 0)) {
      notify({ title: 'Informe uma porção maior que zero.', tone: 'danger' }); return;
    }
    try {
    if (editingComponent && editingComponent.id) {
      await updateKitchenComponent(editingComponent.id, {
        name: compName.trim(),
        componentType: compType,
        station: compStation,
        productionUnit: compUnit.trim() || 'unidade',
        portionWeight: weightNum,
        portionUnit: compPortionUnit.trim() || 'g',
        showInSummary: compShowInSummary,
      });
      notify({ title: `Componente "${compName.trim()}" atualizado com sucesso!`, tone: 'success' });
    } else {
      const generatedId = `cmp-${crypto.randomUUID()}`;
      await addKitchenComponent({
        id: generatedId,
        name: compName.trim(),
        componentType: compType,
        station: compStation,
        productionUnit: compUnit.trim() || 'unidade',
        portionWeight: weightNum,
        portionUnit: compPortionUnit.trim() || 'g',
        showInSummary: compShowInSummary,
        isActive: true,
      });
      notify({ title: `Componente "${compName.trim()}" criado com sucesso!`, tone: 'success' });
    }
    setEditingComponent(null);
    } catch (error) {
      notify({ title: error instanceof Error ? error.message : 'Não foi possível salvar o componente.', tone: 'danger' });
    }
  };

  // Form State Produto (Dialog)
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'lanche'|'bebida'|'porcao'|'combo'>('lanche');
  const [subcategory, setSubcategory] = useState('');
  const [priceBalcao, setPriceBalcao] = useState('');
  const [priceIfood, setPriceIfood] = useState('');
  const [productStatus, setProductStatus] = useState<ProductStatus>('validado');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isCreatingIngOnTheFly, setIsCreatingIngOnTheFly] = useState(false);
  const [inlineCostInputs, setInlineCostInputs] = useState<Record<string, string>>({});

  // Subcategorias Customizadas & Modal de Gestão
  const [customSubcategoriesMap, setCustomSubcategoriesMap] = useState<CustomSubcategoriesMap>({});
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [selectedCatForSubMgmt, setSelectedCatForSubMgmt] = useState<'todas' | 'lanche' | 'porcao' | 'bebida' | 'combo'>('todas');
  const [targetCatForAdd, setTargetCatForAdd] = useState<'lanche' | 'porcao' | 'bebida' | 'combo'>('lanche');
  const [newSubcategoryInput, setNewSubcategoryInput] = useState('');
  const [editingSubcat, setEditingSubcat] = useState<{ oldName: string; newName: string } | null>(null);
  const [confirmDeleteSubcat, setConfirmDeleteSubcat] = useState<string | null>(null);

  // Adicionais e Personalização de Venda do Produto no Caixa
  const [acceptsAddons, setAcceptsAddons] = useState<boolean>(true);
  const [addonMode, setAddonMode] = useState<'all' | 'custom'>('all');
  const [allowedAddonIds, setAllowedAddonIds] = useState<string[]>([]);
  const [isAddon, setIsAddon] = useState<boolean>(false);

  // Carregar subcategorias customizadas do armazenamento persistente
  useEffect(() => {
    setCustomSubcategoriesMap(getCustomSubcategories());
  }, []);

  // Parâmetros Tributários Fiscais (NFC-e)
  const [ncm, setNcm] = useState('');
  const [cfop, setCfop] = useState('');
  const [csosn, setCsosn] = useState('');
  const [cest, setCest] = useState('');
  
  // Recipe State & Typeahead
  const [recipe, setRecipe] = useState<RecipeIngredient[]>([]);
  const [selectedIngId, setSelectedIngId] = useState('');
  const [ingQuantity, setIngQuantity] = useState('');
  const [ingredientProductionStation, setIngredientProductionStation] = useState<RecipeProductionStation>('none');
  const [ingredientProductionKind, setIngredientProductionKind] = useState<RecipeProductionKind>('none');
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
  const [newSubStation, setNewSubStation] = useState<RecipeProductionStation>('none');
  const [newSubKind, setNewSubKind] = useState<RecipeProductionKind>('none');
  const [newSubPortionWeight, setNewSubPortionWeight] = useState('');

  // Active Prep Operational State
  const [prepStation, setPrepStation] = useState<RecipeProductionStation>('none');
  const [prepKind, setPrepKind] = useState<RecipeProductionKind>('none');
  const [prepPortionWeight, setPrepPortionWeight] = useState('');
  const [isSavingPrepConfig, setIsSavingPrepConfig] = useState(false);

  // Modal Rápido de Vínculo para Produtos Existentes
  const [quickLinkProduct, setQuickLinkProduct] = useState<Product | null>(null);
  const [quickLinkIngredientId, setQuickLinkIngredientId] = useState<string>('');
  const [quickLinkSuggestedItem, setQuickLinkSuggestedItem] = useState<InventoryItem | null>(null);
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
    const pBalcao = Number(priceBalcao.toString().replace(',', '.')) || 0;
    const pIfood = Number(priceIfood.toString().replace(',', '.')) || pBalcao;
    return calculateRecipeMetrics(
      recipe,
      getIngredientTrueCost,
      pBalcao,
      pIfood,
      30,
    );
  }, [recipe, getIngredientTrueCost, priceBalcao, priceIfood]);

  // Validação em Tempo Real de Integridade e Prévia do KDS (Etapa 2)
  const validationResult = useMemo(() => {
    const pBalcao = Number(priceBalcao.toString().replace(',', '.')) || 0;
    const pIfood = Number(priceIfood.toString().replace(',', '.')) || pBalcao;
    return validateProductIntegrity(
      {
        id: editingId || undefined,
        name: name.trim(),
        category,
        subcategory: subcategory.trim() || undefined,
        priceBalcao: pBalcao,
        priceIfood: pIfood,
        recipe,
        status: productStatus,
      },
      items,
      30
    );
  }, [editingId, name, category, subcategory, priceBalcao, priceIfood, recipe, productStatus, items]);

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

  // Sincronizar estado de classificação operacional com o activePrep selecionado
  useEffect(() => {
    if (activePrep) {
      setPrepStation(activePrep.productionStation || 'none');
      setPrepKind(activePrep.productionKind || 'none');
      setPrepPortionWeight(
        activePrep.portionWeight !== undefined && activePrep.portionWeight !== null
          ? String(activePrep.portionWeight)
          : ''
      );
    }
  }, [activePrep?.id, activePrep?.productionStation, activePrep?.productionKind, activePrep?.portionWeight]);

  // Subcategorias disponíveis para a categoria sendo editada no formulário
  const availableSubcategoriesForCategory = useMemo(() => {
    return getSubcategoriesForCategory(category, products);
  }, [category, products, customSubcategoriesMap]);

  // Subcategorias para filtros no topo (exibe apenas subcategorias com produtos ou a atualmente ativa)
  const filterSubcategories = useMemo(() => {
    let rawSubs: string[] = [];
    if (categoryFilter === 'todos') {
      const allSubcats = new Set<string>();
      (['lanche', 'porcao', 'bebida', 'combo'] as const).forEach(cat => {
        getSubcategoriesForCategory(cat, products).forEach(s => allSubcats.add(s));
      });
      products.forEach(p => {
        const s = p.subcategory || inferDefaultSubcategory(p);
        if (s) allSubcats.add(s);
      });
      rawSubs = Array.from(allSubcats);
    } else {
      rawSubs = getSubcategoriesForCategory(categoryFilter, products);
    }

    return rawSubs.filter(sub => {
      if (subcategoryFilter === sub) return true;
      const count = products.filter(p => 
        (categoryFilter === 'todos' || p.category === categoryFilter) &&
        (showInactive || p.isActive !== false) &&
        (p.subcategory || inferDefaultSubcategory(p)) === sub
      ).length;
      return count > 0;
    });
  }, [products, categoryFilter, subcategoryFilter, showInactive, customSubcategoriesMap]);

  // Ordem hierárquica configurada para exibição em grupos
  const currentSubcategoryOrder = useMemo(() => {
    if (categoryFilter !== 'todos') {
      return getSubcategoriesForCategory(categoryFilter, products);
    }
    const order: string[] = [];
    (['lanche', 'porcao', 'bebida', 'combo'] as const).forEach(cat => {
      getSubcategoriesForCategory(cat, products).forEach(s => {
        if (!order.includes(s)) order.push(s);
      });
    });
    return order;
  }, [categoryFilter, products, customSubcategoriesMap]);

  const filteredProducts = useMemo(() => {
    return filterCardapioProducts(products, {
      category: categoryFilter,
      subcategory: subcategoryFilter,
      search: searchTerm,
      showInactive,
    });
  }, [products, categoryFilter, subcategoryFilter, searchTerm, showInactive]);

  const groupedProducts = useMemo(() => {
    return groupProductsBySubcategory(filteredProducts, currentSubcategoryOrder);
  }, [filteredProducts, currentSubcategoryOrder]);

  // Produtos adicionais disponíveis no sistema para seleção restrita
  const availableSystemAddonProducts = useMemo(() => {
    return products.filter(p => 
      p.isActive !== false && (
        p.isAddon === true ||
        p.category === 'porcao' ||
        p.name.startsWith('Adicional:') ||
        p.name.startsWith('Pote Maionese') ||
        p.name.toLowerCase().includes('adicional') ||
        p.name.toLowerCase().includes('extra')
      )
    );
  }, [products]);

  // Prévia em tempo real das observações rápidas para a chapa com base na receita
  const previewQuickNotes = useMemo(() => {
    const meatPoints = ['AO PONTO', 'BEM PASSADO', 'AO PONTO P/ BEM'];
    const removalChips: string[] = [];
    let hasSalad = false;

    if (recipe && recipe.length > 0 && items && items.length > 0) {
      recipe.forEach(r => {
        const ing = items.find(i => i.id === r.ingredientId);
        if (!ing) return;

        const rawName = ing.name.toUpperCase().trim();
        const cat = (ing.category || '').toUpperCase().trim();

        const isNonFood = 
          cat === 'EMBALAGENS' ||
          cat === 'DIVERSOS' ||
          cat === 'OPERACIONAL' ||
          cat === 'UTILIDADES' ||
          cat === 'LIMPEZA' ||
          rawName.includes('GÁS') ||
          rawName.includes('GAS') ||
          rawName.includes('ENERGIA') ||
          rawName.includes('LUZ') ||
          rawName.includes('ÁGUA') ||
          rawName.includes('AGUA') ||
          rawName.includes('EMBALAGEM') ||
          rawName.includes('PAPEL') ||
          rawName.includes('SACO') ||
          rawName.includes('SACOLA') ||
          rawName.includes('CAIXA') ||
          rawName.includes('COPO') ||
          rawName.includes('CANUDO') ||
          rawName.includes('ETIQUETA') ||
          rawName.includes('LACRE') ||
          rawName.includes('GUARDANAPO');

        if (isNonFood) return;
        if (rawName.includes('PÃO') || rawName.includes('PAO')) return;
        if (rawName.startsWith('HAMBÚRGUER') || rawName.startsWith('HAMBURGUER') || rawName.startsWith('HAMB.')) {
          if (!rawName.includes('QUEIJO')) return;
        }

        if (rawName.includes('CEBOLA')) {
          removalChips.push('SEM CEBOLA');
        } else if (rawName.includes('ALFACE')) {
          hasSalad = true;
          removalChips.push('SEM ALFACE');
        } else if (rawName.includes('TOMATE')) {
          hasSalad = true;
          removalChips.push('SEM TOMATE');
        } else if (rawName.includes('RÚCULA') || rawName.includes('RUCULA')) {
          hasSalad = true;
          removalChips.push('SEM RÚCULA');
        } else if (rawName.includes('BACON')) {
          removalChips.push('SEM BACON');
        } else if (rawName.includes('CHEDDAR')) {
          removalChips.push('SEM CHEDDAR');
        } else if (rawName.includes('COALHO')) {
          removalChips.push('SEM QUEIJO COALHO');
        } else if (rawName.includes('MINAS')) {
          removalChips.push('SEM QUEIJO MINAS');
        } else if (rawName.includes('MOZARELA') || rawName.includes('MUSSARELA')) {
          removalChips.push('SEM MOZARELA');
        } else if (rawName.includes('SOUR CREAM')) {
          removalChips.push('SEM SOUR CREAM');
        } else if (rawName.includes('PIMENTA') || rawName.includes('JALAPEÑO') || rawName.includes('JALAPENO')) {
          removalChips.push('SEM PIMENTA');
        } else if (rawName.includes('MAIONESE') || rawName.includes('MOLHO') || rawName.includes('CHIMICHURRI') || rawName.includes('BARBECUE')) {
          removalChips.push('SEM MOLHO');
        } else if (rawName.includes('COGUMELO') || rawName.includes('PARIS')) {
          removalChips.push('SEM COGUMELO');
        } else if (rawName.includes('COLESLAW')) {
          removalChips.push('SEM COLESLAW');
        } else if (rawName.includes('NACHOS')) {
          removalChips.push('SEM NACHOS');
        } else if (rawName.includes('CARNE SECA')) {
          removalChips.push('SEM CARNE SECA');
        } else if (rawName.includes('MELAÇO') || rawName.includes('MELACO')) {
          removalChips.push('SEM MELAÇO');
        } else if (rawName.includes('PICLES')) {
          removalChips.push('SEM PICLES');
        } else {
          const cleanName = rawName
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/\b(FATIADO|FATIADA|FRESCO|FRESCA|EM BARRA|PRONTO|PRONTA|COZIDO|COZIDA)\b/g, '')
            .trim();
          if (cleanName.length > 2) {
            removalChips.push(`SEM ${cleanName}`);
          }
        }
      });
    }

    if (hasSalad) {
      removalChips.unshift('SEM SALADA');
    }

    if (removalChips.length === 0) {
      removalChips.push('SEM CEBOLA', 'SEM SALADA', 'SEM MOLHO');
    }

    const uniqueRemovals = Array.from(new Set(removalChips));
    return [...meatPoints, ...uniqueRemovals, 'MOLHO À PARTE', 'CORTAR AO MEIO'];
  }, [recipe, items]);

  // Gestão de Subcategorias - Ações
  const handleAddCustomSubcategory = (cat: 'todas' | 'lanche' | 'porcao' | 'bebida' | 'combo', subName: string) => {
    const trimmed = subName.trim();
    if (!trimmed) {
      notify({ title: 'Informe o nome da subcategoria.', tone: 'warning' });
      return;
    }
    const targetCat = cat === 'todas' ? targetCatForAdd : cat;
    const updatedMap = addSubcategory(targetCat, trimmed);
    setCustomSubcategoriesMap(updatedMap);
    setNewSubcategoryInput('');
    notify({ title: `Subcategoria "${trimmed}" adicionada!`, tone: 'success' });
  };

  const handleRenameCustomSubcategory = async (cat: 'todas' | 'lanche' | 'porcao' | 'bebida' | 'combo', oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingSubcat(null);
      return;
    }
    const updatedMap = renameSubcategory(cat, oldName, trimmed);
    setCustomSubcategoriesMap(updatedMap);

    if (subcategoryFilter === oldName) {
      setSubcategoryFilter(trimmed);
    }

    // Atualização funcional atômica no estado, cache e Supabase
    await batchUpdateProductSubcategory(cat, oldName, trimmed);

    setEditingSubcat(null);
    notify({ 
      title: `Subcategoria renomeada para "${trimmed}"!`, 
      tone: 'success' 
    });
  };

  const handleDeleteCustomSubcategory = async (cat: 'todas' | 'lanche' | 'porcao' | 'bebida' | 'combo', subName: string) => {
    const updatedMap = deleteSubcategory(cat, subName);
    setCustomSubcategoriesMap(updatedMap);
    setConfirmDeleteSubcat(null);

    if (subcategoryFilter === subName) {
      setSubcategoryFilter('todas');
    }

    const fallbackSub = cat !== 'todas' ? getFallbackSubcategoryForCategory(cat) : undefined;

    await batchUpdateProductSubcategory(cat, subName, fallbackSub);
    notify({ 
      title: `Subcategoria "${subName}" excluída.`, 
      description: 'Itens associados foram reatribuídos para a subcategoria padrão.',
      tone: 'info' 
    });
  };

  const handleMoveCustomSubcategory = (cat: 'lanche' | 'porcao' | 'bebida' | 'combo', index: number, direction: 'up' | 'down') => {
    const updatedMap = moveSubcategory(cat, index, direction);
    setCustomSubcategoriesMap(updatedMap);
  };

  const handlePurgeUnusedSubcategories = () => {
    const { countPurged, updatedMap } = purgeUnusedSubcategories(products);
    setCustomSubcategoriesMap(updatedMap);
    if (countPurged > 0) {
      notify({
        title: `${countPurged} subcategorias vazias foram removidas!`,
        tone: 'success',
      });
    } else {
      notify({
        title: 'Nenhuma subcategoria vazia encontrada para remoção.',
        tone: 'info',
      });
    }
  };

  const resetForm = () => {
    setName(''); 
    setCategory('lanche'); 
    setSubcategory('');
    setProductStatus('validado');
    setPriceBalcao(''); 
    setPriceIfood('');
    setNcm(''); 
    setCfop(''); 
    setCsosn(''); 
    setCest('');
    setRecipe([]); 
    setSelectedIngId(''); 
    setIngQuantity(''); 
    setIngredientProductionStation('none');
    setIngredientProductionKind('none');
    setIngSearch('');
    setIsIngDropdownOpen(false); 
    setIsAdding(false); 
    setEditingId(null);
    setAcceptsAddons(true);
    setAddonMode('all');
    setAllowedAddonIds([]);
    setIsAddon(false);
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

        notify({
          title: `Insumo "${newItem.name}" criado no estoque com custo R$ 0,00!`,
          description: 'Agora informe quantidade, destino de produção e regra de contagem antes de adicioná-lo.',
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
    const cleanBalcao = priceBalcao.toString().replace(',', '.').trim();
    const valBalcao = Number(cleanBalcao);
    if (isNaN(valBalcao) || valBalcao <= 0) {
      notify({ title: 'Informe um Preço Balcão válido maior que zero (ex: 28,50).', tone: 'warning' });
      return;
    }
    const cleanIfood = priceIfood ? priceIfood.toString().replace(',', '.').trim() : '';
    const valIfood = cleanIfood ? Number(cleanIfood) : valBalcao;
    if (isNaN(valIfood) || valIfood <= 0) {
      notify({ title: 'Informe um Preço iFood válido maior que zero.', tone: 'warning' });
      return;
    }

    // Validador de Integridade Crítica (Etapa 2)
    const dangerWarnings = validationResult.warnings.filter(w => w.severity === 'danger');
    if (dangerWarnings.length > 0) {
      notify({ 
        title: 'Corrija os erros críticos antes de salvar:',
        description: dangerWarnings.map(w => w.message).join(' | '),
        tone: 'danger' 
      });
      return;
    }

    setIsSavingProduct(true);
    try {
      const subcategoryFinal = subcategory.trim() || inferDefaultSubcategory({ name, category } as Product);
      const isProductActive = productStatus !== 'inativo';
      const productData = {
        name: name.trim(), 
        category, 
        subcategory: subcategoryFinal,
        priceBalcao: valBalcao, 
        priceIfood: valIfood,
        recipe,
        status: productStatus,
        isActive: isProductActive,
        ncm: ncm.trim() || undefined,
        cfop: cfop.trim() || undefined,
        csosn: csosn.trim() || undefined,
        cest: cest.trim() || undefined,
        acceptsAddons,
        allowedAddonIds: addonMode === 'custom' ? allowedAddonIds : [],
        isAddon,
      };

      if (editingId) {
        await updateProduct(editingId, productData);
        notify({ title: 'Ficha salva e disponível para uso.', tone: 'success' });
      } else {
        await addProduct(productData);
        notify({ title: `Produto "${name}" cadastrado com sucesso!`, tone: 'success' });
      }

      // Garantir visibilidade imediata do produto recém-salvo no cardápio
      if (categoryFilter !== 'todos' && categoryFilter !== category) {
        setCategoryFilter('todos');
      }
      setSubcategoryFilter('todas');
      setSearchTerm('');
      setCollapsedSubcategories(prev => ({ ...prev, [subcategoryFinal]: false }));

      resetForm();
    } catch (err: any) {
      console.error('Erro ao salvar produto:', err);
      notify({ 
        title: err.message || 'Não foi possível salvar. A ficha publicada não foi alterada. Seus ajustes continuam nesta tela.', 
        tone: 'danger' 
      });
    } finally {
      setIsSavingProduct(false);
    }
  };

  const startEdit = (p: Product) => {
    setName(p.name);
    setCategory(p.category);
    setSubcategory(p.subcategory || inferDefaultSubcategory(p));
    setProductStatus((p.status as any) || (p.isActive === false ? 'inativo' : 'validado'));
    setPriceBalcao(p.priceBalcao.toString());
    setPriceIfood(p.priceIfood.toString());
    setNcm(p.ncm || '');
    setCfop(p.cfop || '');
    setCsosn(p.csosn || '');
    setCest(p.cest || '');
    setRecipe(p.recipe.map(r => {
      const ing = items.find(i => i.id === r.ingredientId);
      return {
        ...r,
        productionStation: r.productionStation && r.productionStation !== 'none'
          ? r.productionStation
          : (ing?.productionStation || 'none'),
        productionKind: r.productionKind && r.productionKind !== 'none'
          ? r.productionKind
          : (ing?.productionKind || 'none'),
      };
    }));
    setAcceptsAddons(p.acceptsAddons !== false);
    setIsAddon(Boolean(p.isAddon));
    if (p.allowedAddonIds && p.allowedAddonIds.length > 0) {
      setAddonMode('custom');
      setAllowedAddonIds(p.allowedAddonIds);
    } else {
      setAddonMode('all');
      setAllowedAddonIds([]);
    }
    setEditingId(p.id);
    setIsAdding(true);
  };

  const duplicateProduct = (p: Product) => {
    setName(`[Cópia] ${p.name}`);
    setCategory(p.category);
    setSubcategory(p.subcategory || inferDefaultSubcategory(p));
    setProductStatus('rascunho');
    setPriceBalcao(p.priceBalcao.toString());
    setPriceIfood(p.priceIfood.toString());
    setNcm(p.ncm || '');
    setCfop(p.cfop || '');
    setCsosn(p.csosn || '');
    setCest(p.cest || '');
    setRecipe(p.recipe.map(r => {
      const ing = items.find(i => i.id === r.ingredientId);
      return {
        ...r,
        productionStation: r.productionStation && r.productionStation !== 'none'
          ? r.productionStation
          : (ing?.productionStation || 'none'),
        productionKind: r.productionKind && r.productionKind !== 'none'
          ? r.productionKind
          : (ing?.productionKind || 'none'),
      };
    }));
    setAcceptsAddons(p.acceptsAddons !== false);
    setIsAddon(Boolean(p.isAddon));
    if (p.allowedAddonIds && p.allowedAddonIds.length > 0) {
      setAddonMode('custom');
      setAllowedAddonIds([...p.allowedAddonIds]);
    } else {
      setAddonMode('all');
      setAllowedAddonIds([]);
    }
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

  const handleSelectIngredient = (item: InventoryItem) => {
    setSelectedIngId(item.id);
    setIngSearch(item.name);
    setIsIngDropdownOpen(false);

    // 1. Determinar Praça de Produção herdando do item/sub-receita ou heurística
    let targetStation: RecipeProductionStation = item.productionStation || 'none';
    if (targetStation === 'none') {
      const lowerName = item.name.toLowerCase();
      if (
        lowerName.includes('burger') ||
        lowerName.includes('hambúrguer') ||
        lowerName.includes('carne moída') ||
        lowerName.includes('bacon') ||
        lowerName.includes('smash')
      ) {
        targetStation = 'grill';
      } else if (
        lowerName.includes('batata') ||
        lowerName.includes('empanado') ||
        lowerName.includes('nugget') ||
        lowerName.includes('frito') ||
        lowerName.includes('frita') ||
        lowerName.includes('anéis') ||
        lowerName.includes('onion')
      ) {
        targetStation = 'fryer';
      }
    }
    setIngredientProductionStation(targetStation);

    // 2. Determinar Regra de Contagem KDS herdando do item/sub-receita ou heurística
    let targetKind: RecipeProductionKind = item.productionKind || 'none';
    if (targetStation !== 'none' && targetKind === 'none') {
      const lowerName = item.name.toLowerCase();
      if (lowerName.includes('frango')) {
        targetKind = 'breaded_chicken';
      } else if (lowerName.includes('queijo') && (lowerName.includes('empanado') || lowerName.includes('minas'))) {
        targetKind = 'breaded_cheese';
      } else if (lowerName.includes('burger') || lowerName.includes('hambúrguer') || lowerName.includes('carne moída') || lowerName.includes('smash')) {
        targetKind = 'beef_patty';
      } else if (lowerName.includes('batata')) {
        targetKind = 'fries';
      } else if (lowerName.includes('anéis') || lowerName.includes('onion') || lowerName.includes('cebola empanada')) {
        targetKind = 'onion_rings';
      } else if (lowerName.includes('bacon')) {
        targetKind = 'bacon';
      } else if (lowerName.includes('ovo')) {
        targetKind = 'egg';
      }
    }
    setIngredientProductionKind(targetStation === 'none' ? 'none' : targetKind);

    // 3. Preencher porção padrão se definida e campo estiver vazio ou padrão
    if (item.portionWeight !== undefined && item.portionWeight > 0) {
      if (!ingQuantity || Number(ingQuantity) <= 0 || ingQuantity === '1') {
        setIngQuantity(String(item.portionWeight));
      }
    }
  };

  const addIngredientToRecipe = () => {
    if (selectedIngId && ingQuantity) {
      const qty = Number(ingQuantity);
      if (isNaN(qty) || qty <= 0) {
        notify({ title: 'Informe uma quantidade válida maior que zero.', tone: 'warning' });
        return;
      }
      setRecipe([...recipe, {
        ingredientId: selectedIngId,
        quantity: qty,
        productionStation: ingredientProductionStation,
        productionKind: ingredientProductionStation === 'none' ? 'none' : ingredientProductionKind,
      }]);
      setSelectedIngId('');
      setIngQuantity('');
      setIngSearch('');
      setIngredientProductionStation('none');
      setIngredientProductionKind('none');
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

    const weight = newSubPortionWeight.trim() ? Number(newSubPortionWeight.replace(',', '.')) : undefined;

    const created = await addInventoryItem({
      name: newSubName.trim(),
      category: 'Pré-preparos',
      unit: newSubUnit,
      costPerUnit: 0,
      currentStock: 0,
      status: 'ok',
      productionStation: newSubStation,
      productionKind: newSubStation === 'none' ? 'none' : newSubKind,
      portionWeight: weight,
      portionUnit: newSubUnit,
    });

    notify({ title: `Sub-receita "${newSubName}" criada! Adicione os ingredientes da fórmula.`, tone: 'success' });
    if (created?.id) {
      setSelectedPrepId(created.id);
    }
    setNewSubName('');
    setNewSubStation('none');
    setNewSubKind('none');
    setNewSubPortionWeight('');
    setShowNewSubModal(false);
  };

  const handleSaveActivePrepOperationalConfig = async () => {
    if (!activePrep) return;
    setIsSavingPrepConfig(true);
    try {
      const weight = prepPortionWeight.trim() ? Number(prepPortionWeight.replace(',', '.')) : undefined;
      await updateInventoryItem(activePrep.id, {
        productionStation: prepStation,
        productionKind: prepStation === 'none' ? 'none' : prepKind,
        portionWeight: weight,
        portionUnit: activePrep.unit,
      });
      notify({
        title: 'Configuração operacional da sub-receita salva!',
        description: `Praça: ${stationLabel(prepStation)} • Contagem: ${kindLabel(prepKind)}${weight ? ` • Porção: ${weight} ${activePrep.unit}` : ''}`,
        tone: 'success',
      });
    } catch (err: any) {
      notify({
        title: 'Erro ao salvar classificação da sub-receita.',
        description: err?.message || 'Tente novamente.',
        tone: 'danger',
      });
    } finally {
      setIsSavingPrepConfig(false);
    }
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
    setQuickLinkSuggestedItem(matched || null);
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
              {p.isAddon && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Adicional PDV
                </span>
              )}
              {p.acceptsAddons === false && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                  Sem adicionais
                </span>
              )}
              {p.isActive === false ? (
                <Badge variant="danger" dot>Desativado</Badge>
              ) : p.status === 'rascunho' || (p.recipe.length === 0 && (p.category === 'lanche' || p.category === 'combo')) ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Rascunho
                </span>
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
          title="Cardápio"
          eyebrow="Gestão de Produtos, Engenharia & CMV"
          description="Gerencie os produtos do seu cardápio, subcategorias hierárquicas, composição de insumos e adicionais de venda para o Caixa."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'produtos' ? (
                <>
                  <Button
                    onClick={() => { resetForm(); setIsAdding(true); }}
                    leadingIcon={<Plus size={18} aria-hidden="true" />}
                  >
                    Novo Produto
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setIsSubcategoryModalOpen(true)}
                    leadingIcon={<FolderKanban size={16} aria-hidden="true" />}
                  >
                    Subcategorias
                  </Button>
                </>
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

            {/* Subcategorias Chips de Filtragem Rápida e Gestão Direta */}
            {products.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center pt-1">
                <div className="flex items-center gap-1 mr-1">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                    <FolderTree size={13} className="text-brand-primary" /> Subcategorias:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCatForSubMgmt(categoryFilter === 'todos' ? 'todas' : categoryFilter);
                      setIsSubcategoryModalOpen(true);
                    }}
                    className="text-xs text-brand-primary hover:text-brand-primary/80 font-semibold flex items-center gap-1 px-2 py-0.5 rounded hover:bg-brand-primary/10 transition-colors cursor-pointer"
                    title="Gerenciar, renomear, reordenar ou excluir subcategorias"
                  >
                    <FolderKanban size={13} />
                    <span>Gerenciar</span>
                  </button>
                </div>

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

                {/* Ações Rápidas da Subcategoria Selecionada */}
                {subcategoryFilter !== 'todas' && (
                  <div className="flex items-center gap-1 ml-1 pl-2 border-l border-border-default">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCatForSubMgmt(categoryFilter === 'todos' ? 'todas' : categoryFilter);
                        setEditingSubcat({ oldName: subcategoryFilter, newName: subcategoryFilter });
                        setIsSubcategoryModalOpen(true);
                      }}
                      className="p-1 text-text-muted hover:text-brand-primary hover:bg-surface-elevated rounded transition-colors cursor-pointer text-xs flex items-center gap-1"
                      title={`Renomear subcategoria "${subcategoryFilter}"`}
                    >
                      <Pencil size={12} />
                      <span className="text-[11px]">Renomear</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSubcat(subcategoryFilter)}
                      className="p-1 text-text-muted hover:text-status-danger hover:bg-status-danger/10 rounded transition-colors cursor-pointer text-xs flex items-center gap-1"
                      title={`Excluir subcategoria "${subcategoryFilter}"`}
                    >
                      <Trash2 size={12} />
                      <span className="text-[11px]">Excluir</span>
                    </button>
                  </div>
                )}
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
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-text-muted">Unidade: {prep.unit}</span>
                        {prep.productionStation && prep.productionStation !== 'none' && (
                          <span className="text-[10px] font-semibold text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded border border-brand-primary/20">
                            {stationLabel(prep.productionStation)}
                          </span>
                        )}
                      </div>
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

                  {/* Classificação Operacional de Cozinha & KDS da Sub-Receita */}
                  <div className="bg-surface-elevated/40 p-4 rounded-xl border border-border-default space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs text-text-primary font-bold uppercase tracking-wider flex items-center gap-2">
                          <ChefHat size={14} className="text-brand-primary" />
                          Classificação de Cozinha & KDS
                        </h3>
                        <p className="text-[11px] text-text-muted">
                          Defina onde este item é preparado e como ele será contado nos lanches e porções.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {prepStation !== 'none' && (
                          <span className="rounded-full border border-border-default bg-surface-elevated px-2.5 py-0.5 text-[10px] font-bold text-text-secondary">
                            {stationLabel(prepStation)} • {kindLabel(prepKind)}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleSaveActivePrepOperationalConfig}
                          loading={isSavingPrepConfig}
                        >
                          Salvar Classificação
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-text-secondary uppercase">
                          Onde Preparar
                        </label>
                        <Select
                          value={prepStation}
                          onChange={e => {
                            const val = e.target.value as RecipeProductionStation;
                            setPrepStation(val);
                            if (val === 'none') setPrepKind('none');
                          }}
                        >
                          {PRODUCTION_STATIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-text-secondary uppercase">
                          O Que Contar (KDS)
                        </label>
                        <Select
                          value={prepKind}
                          onChange={e => setPrepKind(e.target.value as RecipeProductionKind)}
                          disabled={prepStation === 'none'}
                        >
                          {PRODUCTION_KINDS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-text-secondary uppercase">
                          Porção Unitária ({activePrep.unit})
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          placeholder={activePrep.unit === 'kg' ? 'Ex: 0.180 (180g)' : 'Ex: 1'}
                          value={prepPortionWeight}
                          onChange={e => setPrepPortionWeight(e.target.value)}
                          className="w-full bg-surface-input border border-border-default rounded-control p-2 text-text-primary font-mono text-xs outline-none focus:border-brand-primary"
                        />
                      </div>
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

        {/* DIALOG 1: CRIAÇÃO / EDIÇÃO DE PRODUTO DO CARDÁPIO */}
        <Dialog
          open={isAdding}
          onClose={resetForm}
          title={editingId ? 'Editar Produto do Cardápio' : 'Novo Produto no Cardápio'}
          description="Composição de insumos, cálculo de CMV em tempo real, regras de adicionais e parâmetros fiscais para NFC-e."
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
              <div className="md:col-span-5 space-y-1.5">
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

              <div className="md:col-span-2 space-y-1.5">
                <label htmlFor="prod-cat-input" className="block text-xs font-bold text-text-secondary">
                  Categoria *
                </label>
                <Select
                  id="prod-cat-input"
                  value={category}
                  onChange={e => {
                    const newCat = e.target.value as any;
                    setCategory(newCat);
                    const newSubs = getSubcategoriesForCategory(newCat, products);
                    if (!newSubs.includes(subcategory)) {
                      setSubcategory(newSubs[0] || '');
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
                  <label htmlFor="prod-subcat-select" className="block text-xs font-bold text-text-secondary">
                    Subcategoria
                  </label>
                  <span className="text-[10px] text-text-muted">Hierarquia</span>
                </div>
                <div className="space-y-1.5">
                  <Select
                    id="prod-subcat-select"
                    value={availableSubcategoriesForCategory.includes(subcategory) ? subcategory : '__custom__'}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setSubcategory('');
                      } else {
                        setSubcategory(e.target.value);
                      }
                    }}
                  >
                    {availableSubcategoriesForCategory.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    <option value="__custom__">+ Nova subcategoria personalizada...</option>
                  </Select>

                  {(!availableSubcategoriesForCategory.includes(subcategory) || subcategory === '') && (
                    <input
                      id="prod-subcat-input"
                      type="text"
                      value={subcategory}
                      onChange={e => setSubcategory(e.target.value)}
                      placeholder="Nome da subcategoria..."
                      className="w-full bg-surface-input border border-brand-primary rounded-control p-2 text-text-primary outline-none text-xs"
                      autoFocus
                    />
                  )}
                </div>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label htmlFor="prod-status-select" className="block text-xs font-bold text-text-secondary">
                  Status
                </label>
                <Select
                  id="prod-status-select"
                  value={productStatus}
                  onChange={e => setProductStatus(e.target.value as any)}
                >
                  <option value="validado">Disponível</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="inativo">Inativo</option>
                </Select>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
                  <div className="relative sm:col-span-2">
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
                            handleSelectIngredient(picked);
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
                                  handleSelectIngredient(item);
                                }}
                                className={cn(
                                  'p-2.5 px-3 flex justify-between items-center cursor-pointer border-b border-border-default/40 last:border-0 text-xs transition-colors',
                                  isHighlighted ? 'bg-brand-primary/20 text-text-primary' : isSelected ? 'bg-surface-elevated text-brand-primary' : 'text-text-secondary hover:bg-surface-elevated',
                                )}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold">{item.name}</span>
                                  {item.productionStation && item.productionStation !== 'none' && (
                                    <span className="text-[10px] font-semibold text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded border border-brand-primary/20">
                                      {stationLabel(item.productionStation)}
                                    </span>
                                  )}
                                </div>
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
                    aria-label="Quantidade do ingrediente"
                    className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary font-mono text-xs outline-none focus:border-brand-primary"
                  />

                  <Select
                    aria-label="Destino de produção do ingrediente"
                    value={ingredientProductionStation}
                    onChange={event => {
                      const station = event.target.value as RecipeProductionStation;
                      setIngredientProductionStation(station);
                      if (station === 'none') setIngredientProductionKind('none');
                    }}
                  >
                    {PRODUCTION_STATIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>

                  <Select
                    aria-label="Regra de contagem do ingrediente no KDS"
                    value={ingredientProductionKind}
                    onChange={event => setIngredientProductionKind(event.target.value as RecipeProductionKind)}
                    disabled={ingredientProductionStation === 'none'}
                  >
                    {PRODUCTION_KINDS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>

                  <Button
                    size="sm"
                    onClick={addIngredientToRecipe}
                    disabled={!selectedIngId || !ingQuantity}
                    className="sm:col-span-2"
                  >
                    Adicionar
                  </Button>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[11px] leading-relaxed text-text-muted">
                    A estação define onde o item será preparado. Vincule o componente de preparo para diferenciar carnes e gramaturas na cozinha.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingComponent(null);
                      setIsKitchenModalOpen(true);
                    }}
                    className="text-[11px] text-brand-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ChefHat size={13} /> Gerenciar Componentes de Preparo
                  </button>
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
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {recipe.map((r, idx) => {
                    const ing = items.find(i => i.id === r.ingredientId);
                    const unitCost = ing ? getIngredientTrueCost(ing.id) : 0;
                    const subtotal = unitCost * r.quantity;
                    const isZeroCost = unitCost <= 0;
                    const matchedComp = (kitchenComponents || []).find(c => c.id === r.kitchenComponentId);

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
                              Consumo: {r.quantity} {ing?.unit} × R$ {unitCost.toFixed(2)}
                            </span>
                            {(() => {
                              const summaryItem = validationResult.ingredientsSummary.find(s => s.ingredientId === r.ingredientId);
                              if (summaryItem?.portionLabel && summaryItem.portionLabel !== `${r.quantity} ${ing?.unit}`) {
                                return (
                                  <div className="text-[11px] text-brand-primary font-medium mt-0.5">
                                    ↳ Preparo: <strong>{summaryItem.portionLabel}</strong>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {matchedComp && (
                                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                  🍽️ {matchedComp.name}
                                </span>
                              )}
                              <span className="rounded-full border border-border-default bg-surface-elevated px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                                {stationLabel(r.productionStation)}
                              </span>
                              <span className="rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                                {kindLabel(r.productionKind)}
                              </span>
                            </div>
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

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-border-default/60 pt-2">
                          <div>
                            <span className="block text-[10px] text-text-muted mb-1 font-semibold uppercase">Como identificar na cozinha:</span>
                            <Select
                              aria-label={`Componente de preparo de ${ing?.name || 'ingrediente'}`}
                              value={r.kitchenComponentId || ''}
                              onChange={event => {
                                const compId = event.target.value;
                                const comp = (kitchenComponents || []).find(c => c.id === compId);
                                setRecipe(current => current.map((item, itemIndex) => itemIndex === idx
                                  ? { 
                                      ...item, 
                                      kitchenComponentId: compId || undefined,
                                      productionStation: comp ? comp.station : item.productionStation,
                                      productionKind: comp ? (comp.componentType === 'burger' ? 'beef_patty' : comp.componentType === 'egg' ? 'egg' : 'other') : item.productionKind
                                    }
                                  : item));
                              }}
                            >
                              <option value="">Usar identificação do insumo (legado)</option>
                              {(kitchenComponents || []).filter(option => option.isActive !== false).map(option => (
                                <option key={option.id} value={option.id}>
                                  {option.name} ({option.station === 'grill' ? 'Chapa' : option.station === 'fryer' ? 'Fritadeira' : option.station})
                                </option>
                              ))}
                            </Select>
                            <p className="mt-1 text-xs text-text-muted">Escolha o tipo e a porção exatos: costela, bovino e linguiça ficam separados na comanda. Confira o resultado na prévia abaixo.</p>
                          </div>
                          <div>
                            <span className="block text-[10px] text-text-muted mb-1 font-semibold uppercase">Onde preparar:</span>
                            <Select
                              aria-label={`Destino de produção de ${ing?.name || 'ingrediente'}`}
                              value={r.productionStation || ''}
                              onChange={event => {
                                const station = event.target.value as RecipeProductionStation;
                                setRecipe(current => current.map((item, itemIndex) => itemIndex === idx
                                  ? { ...item, productionStation: station, productionKind: station === 'none' ? 'none' : item.productionKind }
                                  : item));
                              }}
                            >
                              <option value="" disabled>Revisar destino...</option>
                              {PRODUCTION_STATIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </Select>
                          </div>
                          <div>
                            <span className="block text-[10px] text-text-muted mb-1 font-semibold uppercase">O que contar:</span>
                            <Select
                              aria-label={`Regra de contagem de ${ing?.name || 'ingrediente'}`}
                              value={r.productionKind || ''}
                              onChange={event => setRecipe(current => current.map((item, itemIndex) => itemIndex === idx
                                ? { ...item, productionKind: event.target.value as RecipeProductionKind }
                                : item))}
                              disabled={r.productionStation === 'none'}
                            >
                              <option value="" disabled>Revisar contagem...</option>
                              {PRODUCTION_KINDS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </Select>
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
                      type="text" 
                      inputMode="decimal"
                      value={priceBalcao} 
                      onChange={e => setPriceBalcao(e.target.value)}
                      placeholder="0,00" 
                      className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary font-mono text-sm outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="price-ifood-input" className="block text-xs font-bold text-text-secondary">
                      Preço iFood (R$)
                    </label>
                    <input 
                      id="price-ifood-input"
                      type="text" 
                      inputMode="decimal"
                      value={priceIfood} 
                      onChange={e => setPriceIfood(e.target.value)}
                      placeholder="0,00" 
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

            {/* Seção: Adicionais de Venda no PDV / Caixa */}
            <div className="rounded-xl border border-border-default bg-surface-elevated/40 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                    <Layers size={15} className="text-brand-primary" />
                    🍟 Adicionais de Venda no PDV / Caixa
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Configure se o operador de caixa pode selecionar adicionais para este produto na venda.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={acceptsAddons}
                    onChange={(e) => setAcceptsAddons(e.target.checked)}
                    className="rounded border-border-default bg-surface-input text-brand-primary focus:ring-brand-primary h-4 w-4"
                  />
                  <span className="text-xs font-bold text-text-primary">Aceita adicionais no Caixa</span>
                </label>
              </div>

              {acceptsAddons && (
                <div className="space-y-3 pt-2 border-t border-border-default/60">
                  <div className="flex flex-col sm:flex-row gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addonMode"
                        checked={addonMode === 'all'}
                        onChange={() => setAddonMode('all')}
                        className="text-brand-primary focus:ring-brand-primary"
                      />
                      <span className="text-text-secondary font-medium">Permitir todos os adicionais do catálogo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addonMode"
                        checked={addonMode === 'custom'}
                        onChange={() => setAddonMode('custom')}
                        className="text-brand-primary focus:ring-brand-primary"
                      />
                      <span className="text-text-secondary font-medium">Restringir a adicionais específicos ({allowedAddonIds.length} selecionado{allowedAddonIds.length === 1 ? '' : 's'})</span>
                    </label>
                  </div>

                  {addonMode === 'custom' && (
                    <div className="rounded-lg border border-border-default bg-surface-card p-3 max-h-44 overflow-y-auto space-y-2">
                      <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-2">
                        Selecione os adicionais permitidos para este item:
                      </p>
                      {availableSystemAddonProducts.length === 0 ? (
                        <p className="text-xs text-text-muted italic">Nenhum produto marcado como adicional ou porção no cardápio.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {availableSystemAddonProducts.map(add => {
                            const isChecked = allowedAddonIds.includes(add.id);
                            return (
                              <label
                                key={add.id}
                                className={cn(
                                  'flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors',
                                  isChecked 
                                    ? 'bg-brand-primary/10 border-brand-primary text-text-primary' 
                                    : 'bg-surface-elevated/40 border-border-default text-text-secondary hover:border-border-hover'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-1">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setAllowedAddonIds(prev => [...prev, add.id]);
                                      } else {
                                        setAllowedAddonIds(prev => prev.filter(id => id !== add.id));
                                      }
                                    }}
                                    className="rounded border-border-default bg-surface-input text-brand-primary focus:ring-brand-primary"
                                  />
                                  <span className="truncate font-medium">{add.name}</span>
                                </div>
                                <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">
                                  R$ {add.priceBalcao.toFixed(2)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAddon}
                        onChange={(e) => setIsAddon(e.target.checked)}
                        className="rounded border-border-default bg-surface-input text-emerald-400 focus:ring-emerald-400 h-4 w-4"
                      />
                      <span className="text-xs font-semibold text-text-primary">
                        Marcar este produto também como Adicional de Venda (poderá ser incluído em outros itens no Caixa)
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* PRÉVIA DETERMINÍSTICA DA COZINHA (KDS) & VALIDADOR (Etapa 2) */}
            <KitchenProductPreview
              validationResult={validationResult}
              productName={name}
              category={category}
              recipe={recipe}
              inventoryItems={items}
              kitchenComponents={kitchenComponents}
            />

            {/* Seção: Observações Rápidas para a Cozinha / Chapa */}
            <div className="rounded-xl border border-border-default bg-surface-elevated/40 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                  <ChefHat size={15} className="text-amber-400" />
                  👨‍🍳 Observações Rápidas na Cozinha (PDV / Chapa)
                </h3>
                <span className="text-[10px] font-mono text-text-muted">
                  {previewQuickNotes.length} opções automáticas
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                O sistema analisa a receita deste produto e gera automaticamente as opções de seleção rápida no Caixa (como ponto da carne e exclusões tipo <strong>SEM CEBOLA</strong>, <strong>SEM BACON</strong>, <strong>SEM MOLHO</strong>), eliminando erros e acelerando a chapa:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {previewQuickNotes.map(chip => (
                  <span
                    key={chip}
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-surface-card text-text-secondary border border-border-default"
                  >
                    {chip}
                  </span>
                ))}
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
            {quickLinkSuggestedItem && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-2 text-xs text-amber-200">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400 shrink-0" />
                  <span>Sugestão inteligente pelo nome: <strong>{quickLinkSuggestedItem.name}</strong></span>
                </span>
                {quickLinkIngredientId !== quickLinkSuggestedItem.id && (
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-7 text-[11px] px-2.5 bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                    onClick={() => setQuickLinkIngredientId(quickLinkSuggestedItem.id)}
                  >
                    Confirmar Vínculo Sugerido
                  </Button>
                )}
              </div>
            )}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-text-secondary">
                  Praça de Produção (Onde preparar)
                </label>
                <Select 
                  value={newSubStation} 
                  onChange={e => {
                    const val = e.target.value as RecipeProductionStation;
                    setNewSubStation(val);
                    if (val === 'none') setNewSubKind('none');
                  }}
                >
                  {PRODUCTION_STATIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-text-secondary">
                  Regra de Contagem KDS
                </label>
                <Select 
                  value={newSubKind} 
                  onChange={e => setNewSubKind(e.target.value as RecipeProductionKind)}
                  disabled={newSubStation === 'none'}
                >
                  {PRODUCTION_KINDS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-secondary">
                Peso / Quantidade da Porção Padrão (Opcional)
              </label>
              <input 
                type="number" 
                step="0.001"
                placeholder={newSubUnit === 'kg' ? 'Ex: 0.180 para 180g' : 'Ex: 1 ou 0.150'}
                value={newSubPortionWeight} 
                onChange={e => setNewSubPortionWeight(e.target.value)}
                className="w-full bg-surface-input border border-border-default rounded-control p-2.5 text-text-primary font-mono text-sm outline-none focus:border-brand-primary"
              />
              <p className="text-[11px] text-text-muted">
                Ex: Hambúrguer 180g = 0.180 kg; Batata = 0.150 kg. Ao vincular ao produto, preencherá a quantidade e a estação automaticamente.
              </p>
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

        {/* DIALOG 4: GESTÃO COMPLETA DE SUBCATEGORIAS DO CARDÁPIO */}
        <Dialog
          open={isSubcategoryModalOpen}
          onClose={() => {
            setIsSubcategoryModalOpen(false);
            setEditingSubcat(null);
            setNewSubcategoryInput('');
          }}
          title="Gestão de Subcategorias do Cardápio"
          description="Organize a ordem de exibição, crie novas subcategorias ou renomeie/exclua as existentes para adaptar à sua operação."
          size="lg"
          footer={
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center w-full gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePurgeUnusedSubcategories}
                leadingIcon={<Sparkles size={14} className="text-brand-primary" />}
                title="Remove subcategorias sem nenhum produto associado em qualquer categoria"
              >
                Limpar subcategorias vazias (0 itens)
              </Button>
              <Button onClick={() => setIsSubcategoryModalOpen(false)}>
                Concluir
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Seletor de Categoria Pai incluindo TODAS */}
            <div className="flex border-b border-border-default pb-2 gap-2 overflow-x-auto">
              {(['todas', 'lanche', 'porcao', 'bebida', 'combo'] as const).map(cat => {
                const label = cat === 'todas' 
                  ? 'Todas as Subcategorias'
                  : cat === 'lanche' 
                    ? 'Hambúrgueres' 
                    : cat === 'porcao' 
                      ? 'Porções' 
                      : cat === 'bebida' 
                        ? 'Bebidas' 
                        : 'Combos';
                const isSelected = selectedCatForSubMgmt === cat;
                const count = cat === 'todas'
                  ? getSubcategoriesForCategory('todas', products).length
                  : getSubcategoriesForCategory(cat, products).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCatForSubMgmt(cat);
                      setEditingSubcat(null);
                      setNewSubcategoryInput('');
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-control text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                      isSelected 
                        ? 'bg-brand-primary text-white shadow-sm' 
                        : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-card border border-border-default'
                    )}
                  >
                    <span>{label}</span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                      isSelected ? 'bg-white/20 text-white' : 'bg-surface-card text-text-muted'
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Adicionar Nova Subcategoria */}
            <div className="bg-surface-elevated/40 p-3.5 rounded-xl border border-border-default space-y-2">
              <label htmlFor="add-subcat-input" className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                Adicionar Subcategoria {selectedCatForSubMgmt !== 'todas' ? `em ${selectedCatForSubMgmt === 'lanche' ? 'Hambúrgueres' : selectedCatForSubMgmt === 'porcao' ? 'Porções' : selectedCatForSubMgmt === 'bebida' ? 'Bebidas' : 'Combos'}` : ''}:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                {selectedCatForSubMgmt === 'todas' && (
                  <select
                    value={targetCatForAdd}
                    onChange={(e) => setTargetCatForAdd(e.target.value as any)}
                    className="bg-surface-input border border-border-default rounded-control p-2 text-xs text-text-primary outline-none focus:border-brand-primary"
                  >
                    <option value="lanche">Hambúrgueres</option>
                    <option value="porcao">Porções</option>
                    <option value="bebida">Bebidas</option>
                    <option value="combo">Combos</option>
                  </select>
                )}
                <input
                  id="add-subcat-input"
                  type="text"
                  placeholder="Ex: Smash Burgers 100g, Clássicos, Especiais..."
                  value={newSubcategoryInput}
                  onChange={(e) => setNewSubcategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSubcategory(selectedCatForSubMgmt, newSubcategoryInput);
                    }
                  }}
                  className="flex-1 bg-surface-input border border-border-default rounded-control p-2 text-xs text-text-primary outline-none focus:border-brand-primary"
                />
                <Button
                  size="sm"
                  onClick={() => handleAddCustomSubcategory(selectedCatForSubMgmt, newSubcategoryInput)}
                  disabled={!newSubcategoryInput.trim()}
                  leadingIcon={<Plus size={14} />}
                >
                  Adicionar
                </Button>
              </div>
            </div>

            {/* Lista Ordenável de Subcategorias com Subir/Descer, Renomear e Excluir */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-muted font-bold uppercase tracking-wider px-1">
                <span>Subcategorias ({getSubcategoriesForCategory(selectedCatForSubMgmt, products).length})</span>
                <span>Ações</span>
              </div>

              <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                {getSubcategoriesForCategory(selectedCatForSubMgmt, products).length === 0 ? (
                  <div className="p-4 text-center text-xs text-text-muted bg-surface-card border border-border-default rounded-xl">
                    Nenhuma subcategoria cadastrada nesta categoria.
                  </div>
                ) : (
                  getSubcategoriesForCategory(selectedCatForSubMgmt, products).map((sub, idx, arr) => {
                    const isEditing = editingSubcat?.oldName === sub;
                    const prodsCount = products.filter(p => 
                      (selectedCatForSubMgmt === 'todas' || p.category === selectedCatForSubMgmt) && 
                      (p.subcategory || inferDefaultSubcategory(p)) === sub
                    ).length;

                    const associatedCategories = Array.from(new Set(
                      products
                        .filter(p => (p.subcategory || inferDefaultSubcategory(p)) === sub)
                        .map(p => p.category)
                    ));

                    return (
                      <div
                        key={sub}
                        className="p-3 bg-surface-card border border-border-default rounded-xl flex items-center justify-between gap-2 text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-mono text-[11px] text-text-muted w-5 shrink-0 text-center">
                            {idx + 1}.
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingSubcat.newName}
                                onChange={(e) => setEditingSubcat({ oldName: sub, newName: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleRenameCustomSubcategory(selectedCatForSubMgmt, sub, editingSubcat.newName);
                                  } else if (e.key === 'Escape') {
                                    setEditingSubcat(null);
                                  }
                                }}
                                autoFocus
                                className="flex-1 bg-surface-input border border-brand-primary rounded p-1 text-xs text-text-primary outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameCustomSubcategory(selectedCatForSubMgmt, sub, editingSubcat.newName)}
                                className="p-1 rounded bg-brand-primary text-white hover:bg-brand-primary/80 transition-colors cursor-pointer"
                                title="Salvar novo nome"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSubcat(null)}
                                className="p-1 rounded bg-surface-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                title="Cancelar edição"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-bold text-text-primary">{sub}</span>
                              <span className={cn(
                                'text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0',
                                prodsCount > 0 
                                  ? 'bg-surface-elevated text-text-muted' 
                                  : 'bg-status-warning/15 text-status-warning font-bold'
                              )}>
                                {prodsCount} {prodsCount === 1 ? 'item' : 'itens'}
                              </span>
                              {selectedCatForSubMgmt === 'todas' && associatedCategories.length > 0 && (
                                <div className="flex gap-1">
                                  {associatedCategories.map(c => (
                                    <span key={c} className="text-[9px] bg-brand-primary/10 text-brand-primary font-medium px-1.5 py-0.2 rounded">
                                      {c === 'lanche' ? 'Hambúrguer' : c === 'porcao' ? 'Porção' : c === 'bebida' ? 'Bebida' : 'Combo'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Botões de Ordem (Subir / Descer) apenas quando categoria específica */}
                          {selectedCatForSubMgmt !== 'todas' && (
                            <>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveCustomSubcategory(selectedCatForSubMgmt, idx, 'up')}
                                className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                title="Subir posição"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={() => handleMoveCustomSubcategory(selectedCatForSubMgmt, idx, 'down')}
                                className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                title="Descer posição"
                              >
                                <ArrowDown size={14} />
                              </button>
                            </>
                          )}

                          {/* Botão Renomear */}
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => setEditingSubcat({ oldName: sub, newName: sub })}
                              className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-brand-primary transition-colors cursor-pointer"
                              title="Renomear subcategoria"
                            >
                              <Pencil size={14} />
                            </button>
                          )}

                          {/* Botão Excluir */}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSubcat(sub)}
                            className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-status-danger transition-colors cursor-pointer"
                            title="Excluir subcategoria"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </Dialog>

        {/* DIALOG 4: GESTÃO DE COMPONENTES DE PREPARO DA COZINHA */}
        <Dialog
          open={isKitchenModalOpen}
          onClose={() => {
            setIsKitchenModalOpen(false);
            setEditingComponent(null);
          }}
          title="Componentes de Preparo da Cozinha"
          description="Cadastre e configure carnes, porções e itens de praça para diferenciação precisa no KDS e na comanda impressa."
          size="lg"
          footer={
            <div className="flex justify-between items-center w-full">
              {!editingComponent ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenAddComponent}
                  leadingIcon={<Plus size={14} />}
                >
                  Novo Componente
                </Button>
              ) : (
                <div />
              )}
              <Button onClick={() => {
                setIsKitchenModalOpen(false);
                setEditingComponent(null);
              }}>
                Concluir
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {editingComponent ? (
              <div className="bg-surface-elevated/40 p-4 rounded-xl border border-border-default space-y-3">
                <div className="flex items-center justify-between border-b border-border-default/60 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                    <ChefHat size={14} className="text-amber-400" />
                    {editingComponent.id ? 'Editar Componente' : 'Novo Componente de Preparo'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingComponent(null)}
                    className="text-xs text-text-muted hover:text-text-primary cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                      Nome de Apresentação (Cozinha & Impressão):
                    </label>
                    <input
                      type="text"
                      value={compName}
                      onChange={e => setCompName(e.target.value)}
                      placeholder="Ex: Bovino 180 g, Costela 180 g, Batata pequena, Anéis de cebola..."
                      className="w-full bg-surface-input border border-border-default rounded-control p-2 text-xs text-text-primary outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">
                        Tipo de Componente:
                      </label>
                      <Select
                        value={compType}
                        onChange={e => setCompType(e.target.value as KitchenComponentType)}
                      >
                        <option value="burger">Hambúrguer (Carne)</option>
                        <option value="egg">Ovo</option>
                        <option value="side">Acompanhamento / Porção</option>
                        <option value="protein">Proteína</option>
                        <option value="other">Outro</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">
                        Estação de Preparo:
                      </label>
                      <Select
                        value={compStation}
                        onChange={e => setCompStation(e.target.value as RecipeProductionStation)}
                      >
                        <option value="grill">Chapa 🔥</option>
                        <option value="fryer">Fritadeira 🍟</option>
                        <option value="oven">Forno</option>
                        <option value="cold">Preparo frio</option>
                        <option value="assembly">Montagem</option>
                        <option value="other">Outra</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">
                        Unidade de Produção:
                      </label>
                      <input
                        type="text"
                        value={compUnit}
                        onChange={e => setCompUnit(e.target.value)}
                        placeholder="disco, unidade, porcao..."
                        className="w-full bg-surface-input border border-border-default rounded-control p-2 text-xs text-text-primary outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">
                        Peso / Gramatura da Porção:
                      </label>
                      <input
                        type="number"
                        value={compWeight}
                        onChange={e => setCompWeight(e.target.value)}
                        placeholder="180, 90, 150..."
                        className="w-full bg-surface-input border border-border-default rounded-control p-2 text-xs text-text-primary outline-none focus:border-brand-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">
                        Unidade do Peso:
                      </label>
                      <Select
                        value={compPortionUnit}
                        onChange={e => setCompPortionUnit(e.target.value)}
                      >
                        <option value="g">Gramas (g)</option>
                        <option value="kg">Quilos (kg)</option>
                        <option value="un">Unidade (un)</option>
                        <option value="ml">Mililitros (ml)</option>
                      </Select>
                    </div>

                    <div className="pt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-primary">
                        <input
                          type="checkbox"
                          checked={compShowInSummary}
                          onChange={e => setCompShowInSummary(e.target.checked)}
                          className="rounded text-brand-primary focus:ring-brand-primary"
                        />
                        <span>Exibir no rodapé da comanda</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-border-default/60">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingComponent(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveComponent}
                    >
                      Salvar Componente
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Lista de Componentes Cadastrados */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-muted font-bold uppercase tracking-wider px-1">
                <span>Componentes ({kitchenComponents.length})</span>
                <span>Ações</span>
              </div>

              <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                {kitchenComponents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-text-muted bg-surface-card border border-border-default rounded-xl">
                    Nenhum componente de preparo configurado.
                  </div>
                ) : (
                  kitchenComponents.map(comp => {
                    const isGrill = comp.station === 'grill';
                    const isFryer = comp.station === 'fryer';

                    return (
                      <div
                        key={comp.id}
                        className="p-3 bg-surface-card border border-border-default rounded-xl flex items-center justify-between gap-2 text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                          <span className="font-bold text-text-primary">{comp.name}</span>
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                            isGrill ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                            isFryer ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30' :
                            'bg-surface-elevated text-text-muted border-border-default'
                          )}>
                            {isGrill ? '🔥 Chapa' : isFryer ? '🍟 Fritadeira' : comp.station}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border-default">
                            {comp.componentType === 'burger' ? 'Hambúrguer' :
                             comp.componentType === 'egg' ? 'Ovo' :
                             comp.componentType === 'side' ? 'Acompanhamento' :
                             comp.componentType === 'protein' ? 'Proteína' : 'Outro'}
                          </span>
                          {comp.portionWeight ? (
                            <span className="text-[10px] text-text-muted font-mono">
                              {comp.portionWeight} {comp.portionUnit || 'g'} ({comp.productionUnit})
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-muted font-mono">
                              {comp.productionUnit}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditComponent(comp)}
                            className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-brand-primary transition-colors cursor-pointer"
                            title="Editar componente"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Remover o componente "${comp.name}"?`)) {
                                await removeKitchenComponent(comp.id);
                                notify({ title: `Componente "${comp.name}" removido.`, tone: 'info' });
                              }
                            }}
                            className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-status-danger transition-colors cursor-pointer"
                            title="Excluir componente"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </Dialog>

        {/* Confirmação de Exclusão de Subcategoria */}
        <ConfirmDialog
          open={Boolean(confirmDeleteSubcat)}
          onClose={() => setConfirmDeleteSubcat(null)}
          title={`Excluir subcategoria "${confirmDeleteSubcat}"?`}
          description="A subcategoria será removida da lista da sua operação. Os produtos vinculados manterão sua receita e poderão ser reatribuídos para a subcategoria padrão."
          confirmLabel="Excluir Subcategoria"
          tone="danger"
          onConfirm={() => {
            if (confirmDeleteSubcat) {
              handleDeleteCustomSubcategory(selectedCatForSubMgmt, confirmDeleteSubcat);
            }
          }}
        />

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
