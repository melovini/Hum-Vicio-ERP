'use client';
import { useState, useMemo, useEffect } from 'react';
import { useInventory, Product, RecipeIngredient, InventoryItem } from '@/lib/store';
import { 
  ChefHat, ArrowLeft, Plus, Trash2, Edit2, Check, X, 
  FlaskConical, Sparkles, Layers, DollarSign, Store, Smartphone, Search, ChevronRight, Copy,
  Landmark, RefreshCw, CheckSquare, Square, Filter
} from 'lucide-react';
import Link from 'next/link';
import { FISCAL_CATEGORY_PRESETS } from '@/lib/fiscal';

// Helper inteligente para cruzar produtos adicionais com o insumo de estoque correspondente
export const findMatchingInventoryItem = (
  productName: string, 
  productRecipe: RecipeIngredient[] | undefined, 
  itemsList: InventoryItem[]
): InventoryItem | undefined => {
  if (productRecipe && productRecipe.length > 0) {
    const fromRecipe = itemsList.find(i => i.id === productRecipe[0].ingredientId);
    if (fromRecipe) return fromRecipe;
  }

  const clean = productName
    .replace(/^(adicional|adic|porcao|porção)\s*:\s*/i, '')
    .replace(/\s*no hamb[uú]rguer/i, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!clean) return undefined;

  const exact = itemsList.find(i => {
    const iName = i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return iName === clean;
  });
  if (exact) return exact;

  const startsWith = itemsList.find(i => {
    const iName = i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return iName.startsWith(clean) || clean.startsWith(iName);
  });
  if (startsWith) return startsWith;

  const contains = itemsList.find(i => {
    const iName = i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return iName.includes(clean);
  });
  if (contains) return contains;

  const stopwords = new Set(['hamburguer', 'lanche', 'porcao', 'adicional', 'extra', 'pote']);
  const words = clean.split(/\s+/).filter(w => w.length > 3 && !stopwords.has(w));
  if (words.length > 0) {
    let bestMatch: InventoryItem | undefined;
    let maxMatchCount = 0;
    for (const item of itemsList) {
      const iName = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let matchCount = 0;
      for (const w of words) {
        if (iName.includes(w)) matchCount++;
      }
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestMatch = item;
      }
    }
    if (bestMatch && maxMatchCount > 0) return bestMatch;
  }
  return undefined;
};

export default function EngenhariaCardapioPage() {
  const { 
    items, products, addProduct, updateProduct, removeProduct, 
    getProductCmv, isLoaded, subRecipes, saveSubRecipe, removeSubRecipe, 
    getIngredientTrueCost, addInventoryItem, batchAddIngredientToProducts 
  } = useInventory();
  
  const [activeTab, setActiveTab] = useState<'produtos' | 'subreceitas'>('produtos');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'lanche' | 'porcao' | 'bebida' | 'combo'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State Produto
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'lanche'|'bebida'|'porcao'|'combo'>('lanche');
  const [priceBalcao, setPriceBalcao] = useState('');
  const [priceIfood, setPriceIfood] = useState('');

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

  // Ordenação Alfabética Rigorosa de Insumos (sem sensibilidade a maiúsculas/minúsculas e acentos)
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

  // Segmentação Visual da Ficha Técnica por Categoria com Subtotais de CMV
  const recipeByCategory = useMemo(() => {
    const groups: Record<string, {
      category: string;
      items: { r: RecipeIngredient; ing?: InventoryItem; cost: number; subtotal: number; originalIndex: number }[];
      subtotalCost: number;
    }> = {};

    recipe.forEach((r, originalIndex) => {
      const ing = items.find(i => i.id === r.ingredientId);
      const cat = ing?.category || 'Outros';
      const cost = getIngredientTrueCost(r.ingredientId);
      const subtotal = cost * r.quantity;

      if (!groups[cat]) {
        groups[cat] = { category: cat, items: [], subtotalCost: 0 };
      }
      groups[cat].items.push({ r, ing, cost, subtotal, originalIndex });
      groups[cat].subtotalCost += subtotal;
    });

    return Object.values(groups).sort((a, b) => b.subtotalCost - a.subtotalCost);
  }, [recipe, items, getIngredientTrueCost]);

  const totalRecipeCmv = useMemo(() => {
    return recipe.reduce((acc, r) => acc + (getIngredientTrueCost(r.ingredientId) * r.quantity), 0);
  }, [recipe, getIngredientTrueCost]);

  // Sub-Receita Form State
  const [selectedPrepId, setSelectedPrepId] = useState<string>('');
  const [subChildId, setSubChildId] = useState('');
  const [subChildQty, setSubChildQty] = useState('');
  const [showNewSubModal, setShowNewSubModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubUnit, setNewSubUnit] = useState('kg');

  // Vínculo em Lote no Formulário de Criação/Edição
  const [batchIngredientId, setBatchIngredientId] = useState<string>('');
  const [batchDefaultQty, setBatchDefaultQty] = useState<string>('0.030');
  const [batchSearch, setBatchSearch] = useState<string>('');
  const [batchTargetCategory, setBatchTargetCategory] = useState<'lanche' | 'combo' | 'todos'>('lanche');
  const [batchTargets, setBatchTargets] = useState<Record<string, { checked: boolean; quantity: number }>>({});
  const [showBatchSection, setShowBatchSection] = useState<boolean>(true);

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
  const [newStockItemUnit, setNewStockItemUnit] = useState('kg');
  const [newStockItemCost, setNewStockItemCost] = useState('0');

  // Sugestão automática de insumo de estoque ao cadastrar/digitar adicional
  useEffect(() => {
    if (isAdding && !editingId && (category === 'porcao' || name.toLowerCase().includes('adicional'))) {
      const matched = findMatchingInventoryItem(name, recipe, items);
      if (matched && !batchIngredientId) {
        setBatchIngredientId(matched.id);
        const defQty = matched.unit === 'un' ? '1' : '0.030';
        setBatchDefaultQty(defQty);
      }
    }
  }, [name, category, isAdding, editingId, items, recipe, batchIngredientId]);

  // Atualizar alvos ao trocar o insumo selecionado no formulário
  useEffect(() => {
    if (!batchIngredientId) return;
    const ing = items.find(i => i.id === batchIngredientId);
    const defQty = Number(batchDefaultQty) || (ing?.unit === 'un' ? 1 : 0.030);

    setBatchTargets(prev => {
      const updated: Record<string, { checked: boolean; quantity: number }> = { ...prev };
      products.forEach(p => {
        const existingRec = (p.recipe || []).find(r => r.ingredientId === batchIngredientId);
        if (existingRec) {
          updated[p.id] = { checked: true, quantity: existingRec.quantity };
        } else if (updated[p.id] === undefined) {
          updated[p.id] = { checked: false, quantity: defQty };
        }
      });
      return updated;
    });
  }, [batchIngredientId, products, items]);

  const handleApplyBatchQtyToChecked = (qtyStr: string, isModal = false) => {
    const qty = Number(qtyStr);
    if (isNaN(qty) || qty <= 0) return;
    if (isModal) {
      setQuickLinkTargets(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          if (updated[id]?.checked) {
            updated[id] = { ...updated[id], quantity: qty };
          }
        });
        return updated;
      });
    } else {
      setBatchTargets(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          if (updated[id]?.checked) {
            updated[id] = { ...updated[id], quantity: qty };
          }
        });
        return updated;
      });
    }
  };

  const handleSelectAllTargets = (targetCat: string, selectAll: boolean, isModal = false) => {
    const targetProds = products.filter(p => {
      if (p.isActive === false) return false;
      if (targetCat === 'todos') return true;
      return p.category === targetCat;
    });

    if (isModal) {
      const ing = items.find(i => i.id === quickLinkIngredientId);
      const defQty = Number(quickLinkDefaultQty) || (ing?.unit === 'un' ? 1 : 0.030);
      setQuickLinkTargets(prev => {
        const updated = { ...prev };
        targetProds.forEach(p => {
          const current = updated[p.id] || { checked: false, quantity: defQty };
          updated[p.id] = { ...current, checked: selectAll };
        });
        return updated;
      });
    } else {
      const ing = items.find(i => i.id === batchIngredientId);
      const defQty = Number(batchDefaultQty) || (ing?.unit === 'un' ? 1 : 0.030);
      setBatchTargets(prev => {
        const updated = { ...prev };
        targetProds.forEach(p => {
          const current = updated[p.id] || { checked: false, quantity: defQty };
          updated[p.id] = { ...current, checked: selectAll };
        });
        return updated;
      });
    }
  };

  const handleSelectOnlyExistingTargets = (ingredientId: string, isModal = false) => {
    if (!ingredientId) return;
    if (isModal) {
      setQuickLinkTargets(prev => {
        const updated = { ...prev };
        products.forEach(p => {
          const hasIng = (p.recipe || []).some(r => r.ingredientId === ingredientId);
          if (updated[p.id]) {
            updated[p.id] = { ...updated[p.id], checked: hasIng };
          }
        });
        return updated;
      });
    } else {
      setBatchTargets(prev => {
        const updated = { ...prev };
        products.forEach(p => {
          const hasIng = (p.recipe || []).some(r => r.ingredientId === ingredientId);
          if (updated[p.id]) {
            updated[p.id] = { ...updated[p.id], checked: hasIng };
          }
        });
        return updated;
      });
    }
  };

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
      alert('Selecione um insumo de estoque correspondente.');
      return;
    }

    const activeTargets = Object.entries(quickLinkTargets)
      .filter(([_, t]) => t.checked && t.quantity > 0)
      .map(([productId, t]) => ({ productId, quantity: t.quantity }));

    if (activeTargets.length === 0) {
      if (!confirm('Nenhum produto está marcado com quantidade maior que zero. Deseja continuar?')) {
        return;
      }
    }

    setIsSavingQuickLink(true);
    try {
      const res = await batchAddIngredientToProducts(quickLinkIngredientId, activeTargets);
      if (res.success) {
        const ing = items.find(i => i.id === quickLinkIngredientId);
        alert(`Vínculo realizado com sucesso!\nO ingrediente "${ing?.name || 'insumo'}" foi atualizado na ficha técnica de ${activeTargets.length} produto(s).`);
        setQuickLinkProduct(null);
      } else {
        alert(`Erro ao vincular: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Erro inesperado: ${err.message}`);
    } finally {
      setIsSavingQuickLink(false);
    }
  };

  if (!isLoaded) return null;

  const resetForm = () => {
    setName(''); setCategory('lanche'); setPriceBalcao(''); setPriceIfood('');
    setNcm(''); setCfop(''); setCsosn(''); setCest('');
    setRecipe([]); setSelectedIngId(''); setIngQuantity(''); setIngSearch('');
    setIsIngDropdownOpen(false); setIsAdding(false); setEditingId(null);
    setBatchIngredientId(''); setBatchDefaultQty('0.030'); setBatchSearch('');
    setBatchTargets({}); setShowBatchSection(true);
  };

  const applyFiscalPreset = (presetKey: string) => {
    const preset = FISCAL_CATEGORY_PRESETS[presetKey];
    if (preset) {
      setNcm(preset.ncm);
      setCfop(preset.cfop);
      setCsosn(preset.csosn);
      setCest(preset.cest || '');
    }
  };

  const handleSave = async () => {
    if (!name || !priceBalcao || !priceIfood) return;
    
    const productData = {
      name, category, 
      priceBalcao: Number(priceBalcao), 
      priceIfood: Number(priceIfood),
      recipe,
      ncm: ncm.trim() || undefined,
      cfop: cfop.trim() || undefined,
      csosn: csosn.trim() || undefined,
      cest: cest.trim() || undefined
    };

    if (editingId) {
      await updateProduct(editingId, productData);
    } else {
      await addProduct(productData);
    }

    // Se houver produtos selecionados no painel de vínculo em lote:
    const activeTargets = Object.entries(batchTargets)
      .filter(([_, t]) => t.checked && t.quantity > 0)
      .map(([productId, t]) => ({ productId, quantity: t.quantity }));

    if (activeTargets.length > 0 && batchIngredientId) {
      const res = await batchAddIngredientToProducts(batchIngredientId, activeTargets);
      if (res.success) {
        const ing = items.find(i => i.id === batchIngredientId);
        alert(`Produto "${name}" salvo com sucesso!\nO adicional/insumo "${ing?.name || 'insumo'}" foi vinculado à ficha técnica de ${activeTargets.length} produto(s).`);
      }
    }

    resetForm();
  };

  const startEdit = (p: Product) => {
    setName(p.name);
    setCategory(p.category);
    setPriceBalcao(p.priceBalcao.toString());
    setPriceIfood(p.priceIfood.toString());
    setNcm(p.ncm || '');
    setCfop(p.cfop || '');
    setCsosn(p.csosn || '');
    setCest(p.cest || '');
    setRecipe([...p.recipe]);
    setEditingId(p.id);

    const matched = findMatchingInventoryItem(p.name, p.recipe, items);
    const targetIngId = matched?.id || p.recipe[0]?.ingredientId || '';
    setBatchIngredientId(targetIngId);

    const ing = items.find(i => i.id === targetIngId);
    const defQty = p.recipe[0]?.quantity 
      ? p.recipe[0].quantity.toString() 
      : (ing?.unit === 'un' ? '1' : '0.030');
    setBatchDefaultQty(defQty);

    const initialTargets: Record<string, { checked: boolean; quantity: number }> = {};
    products.forEach(prod => {
      const existingRec = (prod.recipe || []).find(r => r.ingredientId === targetIngId);
      if (existingRec) {
        initialTargets[prod.id] = { checked: true, quantity: existingRec.quantity };
      } else {
        initialTargets[prod.id] = { checked: false, quantity: Number(defQty) };
      }
    });
    setBatchTargets(initialTargets);

    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicateProduct = (p: Product) => {
    setName(`[Cópia] ${p.name}`);
    setCategory(p.category);
    setPriceBalcao(p.priceBalcao.toString());
    setPriceIfood(p.priceIfood.toString());
    setNcm(p.ncm || '');
    setCfop(p.cfop || '');
    setCsosn(p.csosn || '');
    setCest(p.cest || '');
    setRecipe(p.recipe.map(r => ({ ...r })));
    setEditingId(null);
    setBatchIngredientId('');
    setBatchTargets({});
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addIngredientToRecipe = () => {
    if (selectedIngId && ingQuantity) {
      setRecipe([...recipe, { ingredientId: selectedIngId, quantity: Number(ingQuantity) }]);
      setSelectedIngId('');
      setIngQuantity('');
    }
  };

  const removeIngredientFromRecipe = (idx: number) => {
    setRecipe(recipe.filter((_, i) => i !== idx));
  };

  // Sub-receitas (Insumos da categoria 'Pré-preparos' ou 'Molhos & Condimentos')
  const prepIngredients = items.filter(i => 
    i.isActive !== false && (
      i.category.toLowerCase().includes('pré-preparo') || 
      i.category.toLowerCase().includes('molhos') ||
      i.name.toLowerCase().includes('maionese') ||
      i.name.toLowerCase().includes('coleslaw') ||
      i.name.toLowerCase().includes('cebola caramelizada') ||
      i.name.toLowerCase().includes('farofa')
    )
  );

  const activePrep = prepIngredients.find(p => p.id === selectedPrepId) || prepIngredients[0];

  const currentSubItems = activePrep 
    ? subRecipes.filter(s => s.parentIngredientId === activePrep.id) 
    : [];

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
  };

  const handleRemoveSubComponent = async (idx: number) => {
    if (!activePrep) return;
    const currentComponents = currentSubItems
      .filter((_, i) => i !== idx)
      .map(c => ({ childIngredientId: c.childIngredientId, quantity: c.quantity }));
    await saveSubRecipe(activePrep.id, currentComponents);
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

    setNewSubName('');
    setShowNewSubModal(false);
  };

  const filteredProducts = products.filter(p => {
    if (!showInactive && p.isActive === false) return false;
    const matchesCategory = categoryFilter === 'todos' || p.category === categoryFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-blue-400 font-bold mb-1">
                <ChefHat size={20} /> Módulo Gestão Executiva
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Cardápio & Fichas Técnicas</h1>
            </div>
          </div>
          
          {activeTab === 'produtos' && (
            <button 
              onClick={() => { resetForm(); setIsAdding(true); }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] cursor-pointer"
            >
              <Plus size={20} /> Novo Produto
            </button>
          )}
        </header>

        {/* Abas Superiores */}
        <div className="flex gap-3 mb-8">
          <button 
            type="button" 
            onClick={() => setActiveTab('produtos')}
            className={`px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'produtos' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <ChefHat size={18} /> Produtos & Hambúrgueres ({products.length})
          </button>
          
          <button 
            type="button" 
            onClick={() => setActiveTab('subreceitas')}
            className={`px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'subreceitas' 
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' 
                : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FlaskConical size={18} /> Sub-Receitas & Molhos da Casa ({prepIngredients.length})
          </button>

          <Link 
            href="/admin/engenharia"
            className="px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 ml-auto"
          >
            <Sparkles size={18} /> Matriz BCG & Engenharia <ChevronRight size={14} />
          </Link>
        </div>

        {/* ABA 1: PRODUTOS & FICHAS TÉCNICAS */}
        {activeTab === 'produtos' && (
          <div>
            {/* Form de Criação/Edição */}
            {isAdding && (
              <div className="glass-card rounded-3xl p-8 mb-8 border-t-4 border-blue-500 animate-fade-in">
                <h2 className="text-xl font-bold text-white mb-6">
                  {editingId ? 'Editar Produto e Ficha Técnica' : 'Criar Novo Produto no Cardápio'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-slate-400 font-bold mb-1">Nome do Produto</label>
                    <input 
                      type="text" 
                      value={name} onChange={e => setName(e.target.value)}
                      placeholder="Ex: Argentina" 
                      className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-bold mb-1">Categoria</label>
                    <select 
                      value={category} onChange={e => setCategory(e.target.value as any)}
                      className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-3 text-slate-200 outline-none focus:border-blue-500"
                    >
                      <option value="lanche">Hambúrguer</option>
                      <option value="porcao">Porção / Adicional</option>
                      <option value="bebida">Bebida</option>
                      <option value="combo">Combo</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-400 font-bold mb-1">Preço Balcão</label>
                      <input 
                        type="number" step="0.50" value={priceBalcao} onChange={e => setPriceBalcao(e.target.value)}
                        placeholder="R$ 0,00" 
                        className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-3 text-white font-mono outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-bold mb-1">Preço iFood</label>
                      <input 
                        type="number" step="0.50" value={priceIfood} onChange={e => setPriceIfood(e.target.value)}
                        placeholder="R$ 0,00" 
                        className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-3 text-white font-mono outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* Parâmetros Tributários Fiscais (NFC-e / SEFAZ) */}
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Landmark size={14} className="text-cyan-400" /> Parâmetros Fiscais (NFC-e / SEFAZ)
                        </label>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Classificação tributária exigida na emissão da nota fiscal ao consumidor.
                        </p>
                      </div>
                      {/* Botões de Preenchimento Rápido */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-bold">Auto-preencher:</span>
                        <button
                          type="button"
                          onClick={() => applyFiscalPreset('lanche')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-[10px] font-bold border border-slate-700 cursor-pointer"
                        >
                          🍔 Lanche
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFiscalPreset('bebida')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-[10px] font-bold border border-slate-700 cursor-pointer"
                        >
                          🥤 Bebida c/ ST
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFiscalPreset('porcao')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-[10px] font-bold border border-slate-700 cursor-pointer"
                        >
                          🍟 Porção
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFiscalPreset('sobremesa')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-[10px] font-bold border border-slate-700 cursor-pointer"
                        >
                          🍰 Doce
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] text-slate-400 font-bold mb-1">NCM (8 dígitos):</label>
                        <input
                          type="text"
                          value={ncm}
                          onChange={e => setNcm(e.target.value)}
                          placeholder="Ex: 2106.90.90"
                          className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-2.5 text-white font-mono outline-none focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 font-bold mb-1">CFOP (4 dígitos):</label>
                        <input
                          type="text"
                          value={cfop}
                          onChange={e => setCfop(e.target.value)}
                          placeholder="Ex: 5102 ou 5405"
                          className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-2.5 text-white font-mono outline-none focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 font-bold mb-1">CSOSN (Simples):</label>
                        <input
                          type="text"
                          value={csosn}
                          onChange={e => setCsosn(e.target.value)}
                          placeholder="Ex: 102 ou 500"
                          className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-2.5 text-white font-mono outline-none focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 font-bold mb-1">CEST (Bebidas ST):</label>
                        <input
                          type="text"
                          value={cest}
                          onChange={e => setCest(e.target.value)}
                          placeholder="Ex: 03.010.00"
                          className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-2.5 text-white font-mono outline-none focus:border-cyan-500 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Montagem da Ficha Técnica com Typeahead e Agrupamento */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Layers size={16} className="text-blue-400" /> Composição / Ficha Técnica do Lanche
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      Total Insumos: <strong className="text-white">{recipe.length}</strong>
                    </span>
                  </div>
                  
                  {/* Barra de Inserção Rápida com Typeahead Combobox */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6 relative">
                    {/* Typeahead Combobox Autocomplete */}
                    <div className="relative flex-1">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar insumo por nome ou categoria (Ex: Pão, Carne, Cheddar)..."
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
                              }
                            } else if (e.key === 'Escape') {
                              setIsIngDropdownOpen(false);
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 outline-none focus:border-blue-500 text-sm"
                        />
                        {selectedIngId && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIngId('');
                              setIngSearch('');
                              setIsIngDropdownOpen(true);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                            title="Limpar seleção"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown de Resultados Typeahead */}
                      {isIngDropdownOpen && (
                        <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto pr-1 animate-scale-in">
                          {filteredTypeaheadItems.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-500">
                              Nenhum insumo encontrado para "{ingSearch}".
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
                                  className={`p-2.5 px-3.5 flex justify-between items-center cursor-pointer border-b border-slate-800/60 last:border-0 text-xs transition-colors ${
                                    isHighlighted ? 'bg-blue-600/30 text-white' : isSelected ? 'bg-slate-800 text-blue-300' : 'text-slate-300 hover:bg-slate-800'
                                  }`}
                                >
                                  <div>
                                    <span className="font-bold">{item.name}</span>
                                    <span className="text-[10px] text-slate-500 ml-2 uppercase font-semibold">({item.category})</span>
                                  </div>
                                  <div className="font-mono text-[11px] font-bold text-amber-400">
                                    R$ {cost.toFixed(2)} / {item.unit}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <input 
                      type="number" step="0.001" placeholder="Quantidade"
                      value={ingQuantity} onChange={e => setIngQuantity(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addIngredientToRecipe();
                        }
                      }}
                      className="w-36 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono outline-none focus:border-blue-500 text-sm"
                    />

                    <button 
                      type="button" 
                      onClick={addIngredientToRecipe}
                      disabled={!selectedIngId || !ingQuantity}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-5 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all shrink-0"
                    >
                      + Inserir
                    </button>
                  </div>

                  {/* Segmentação Visual por Categorias com Subtotal de CMV */}
                  <div className="space-y-4">
                    {recipeByCategory.map(group => {
                      const groupPercent = totalRecipeCmv > 0 ? (group.subtotalCost / totalRecipeCmv) * 100 : 0;

                      return (
                        <div key={group.category} className="bg-slate-900/50 border border-slate-800/90 rounded-2xl p-4">
                          <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase text-blue-400 tracking-wider">
                                {group.category}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                ({group.items.length} {group.items.length === 1 ? 'item' : 'itens'})
                              </span>
                            </div>
                            <div className="text-right flex items-center gap-2">
                              <span className="font-mono text-xs font-black text-amber-400">
                                R$ {group.subtotalCost.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                {groupPercent.toFixed(1)}% do CMV
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {group.items.map(({ r, ing, subtotal, originalIndex }) => (
                              <div key={originalIndex} className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-xl text-xs border border-slate-900">
                                <div>
                                  <span className="font-bold text-slate-200">{ing?.name}</span>
                                  <span className="text-slate-500 ml-2 font-mono">({r.quantity} {ing?.unit})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-amber-400 font-bold">R$ {subtotal.toFixed(2)}</span>
                                  <button 
                                    type="button"
                                    onClick={() => removeIngredientFromRecipe(originalIndex)} 
                                    className="text-slate-500 hover:text-red-400 cursor-pointer p-1 rounded-lg hover:bg-slate-900 transition-colors"
                                    title="Remover da ficha técnica"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {recipe.length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-6">Nenhum ingrediente adicionado à ficha técnica.</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                    <span className="text-slate-400">CMV Somado da Ficha Técnica:</span>
                    <span className="font-mono text-amber-400 text-lg">R$ {getProductCmv(recipe).toFixed(2)}</span>
                  </div>
                </div>

                {/* Seção de Vínculo em Lote com Hambúrgueres Existentes */}
                {(category === 'porcao' || name.toLowerCase().includes('adicional') || showBatchSection) ? (
                  <div className="bg-gradient-to-b from-indigo-950/40 via-slate-950/60 to-slate-950/80 border-2 border-indigo-500/30 rounded-3xl p-6 mb-6 shadow-xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-indigo-500/20">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl text-indigo-300">
                          <Layers size={22} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            Vincular este Adicional à Ficha Técnica de Hambúrgueres Existentes
                            <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-bold uppercase">
                              Lote Automático
                            </span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Selecione quais lanches existentes levam este adicional/ingrediente em sua receita padrão para atualizar todos de uma só vez.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowBatchSection(!showBatchSection)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 bg-indigo-950/60 border border-indigo-800 rounded-xl cursor-pointer self-start sm:self-auto"
                      >
                        {showBatchSection ? 'Ocultar Painel' : 'Expandir Painel'}
                      </button>
                    </div>

                    {showBatchSection && (
                      <div className="space-y-4 animate-fade-in">
                        {/* Linha de Configuração do Insumo e Quantidade Padrão */}
                        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="md:col-span-7">
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-xs font-bold text-slate-300">
                                Insumo de Estoque correspondente:
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewStockItemName(name.replace(/^(adicional|adic|porcao)\s*:\s*/i, ''));
                                  setShowCreateStockItemModal(true);
                                }}
                                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                              >
                                + Novo Insumo no Estoque
                              </button>
                            </div>
                            <select
                              value={batchIngredientId}
                              onChange={e => {
                                const newId = e.target.value;
                                setBatchIngredientId(newId);
                                const ing = items.find(i => i.id === newId);
                                const defQty = ing?.unit === 'un' ? '1' : '0.030';
                                setBatchDefaultQty(defQty);
                                setBatchTargets(prev => {
                                  const updated = { ...prev };
                                  products.forEach(p => {
                                    const hasIng = (p.recipe || []).find(r => r.ingredientId === newId);
                                    if (hasIng) {
                                      updated[p.id] = { checked: true, quantity: hasIng.quantity };
                                    } else if (updated[p.id]) {
                                      updated[p.id] = { ...updated[p.id], quantity: Number(defQty) };
                                    }
                                  });
                                  return updated;
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                            >
                              <option value="">Selecione o insumo para vincular...</option>
                              {sortedItems.map(i => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.category}) — R$ {i.costPerUnit.toFixed(2)} / {i.unit} (Estoque: {i.currentStock} {i.unit})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-5 flex flex-col justify-end">
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                              Qtd Padrão ({items.find(i => i.id === batchIngredientId)?.unit || 'kg'}):
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.001"
                                value={batchDefaultQty}
                                onChange={e => setBatchDefaultQty(e.target.value)}
                                placeholder="Ex: 0.030"
                                className="w-24 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono outline-none focus:border-indigo-500 text-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleApplyBatchQtyToChecked(batchDefaultQty, false)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3 py-2 text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                                title="Aplica este valor para todos os produtos que estiverem marcados"
                              >
                                Aplicar a Todos Marcados
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Filtros e Seletores Rápidos */}
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => setBatchTargetCategory('lanche')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                batchTargetCategory === 'lanche'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              🍔 Apenas Hambúrgueres ({products.filter(p => p.category === 'lanche' && p.isActive !== false).length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setBatchTargetCategory('todos')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                batchTargetCategory === 'todos'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              Todos os Produtos
                            </button>
                          </div>

                          <div className="relative w-full sm:w-60">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                              type="text"
                              placeholder="Filtrar por nome..."
                              value={batchSearch}
                              onChange={e => setBatchSearch(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleSelectAllTargets(batchTargetCategory, true, false)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold border border-slate-800 cursor-pointer"
                          >
                            ✓ Selecionar Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectAllTargets(batchTargetCategory, false, false)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold border border-slate-800 cursor-pointer"
                          >
                            ✗ Desmarcar Todos
                          </button>
                          {batchIngredientId && (
                            <button
                              type="button"
                              onClick={() => handleSelectOnlyExistingTargets(batchIngredientId, false)}
                              className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 rounded-lg font-semibold border border-indigo-800/60 cursor-pointer"
                            >
                              ⭐ Marcar Apenas os que Já Possuem
                            </button>
                          )}
                        </div>

                        {/* Grid/Lista de Produtos */}
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {products
                            .filter(p => {
                              if (p.isActive === false) return false;
                              if (editingId && p.id === editingId) return false;
                              if (batchTargetCategory !== 'todos' && p.category !== batchTargetCategory) return false;
                              if (batchSearch.trim() && !p.name.toLowerCase().includes(batchSearch.toLowerCase())) return false;
                              return true;
                            })
                            .map(p => {
                              const isChecked = !!batchTargets[p.id]?.checked;
                              const targetQty = batchTargets[p.id]?.quantity ?? (Number(batchDefaultQty) || 0.030);
                              const alreadyHasInRecipe = (p.recipe || []).find(r => r.ingredientId === batchIngredientId);
                              const ing = items.find(i => i.id === batchIngredientId);
                              const unitCost = ing ? getIngredientTrueCost(ing.id) : 0;
                              const costImpact = unitCost * targetQty;

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setBatchTargets(prev => ({
                                      ...prev,
                                      [p.id]: { checked: !isChecked, quantity: targetQty }
                                    }));
                                  }}
                                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-indigo-950/40 border-indigo-500/60 text-white shadow-sm'
                                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                                    />
                                    <div className="truncate">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-white truncate">{p.name}</span>
                                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded uppercase">
                                          {p.category}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-400 mt-0.5">
                                        {alreadyHasInRecipe ? (
                                          <span className="text-emerald-400 font-bold">
                                            ✓ Já possui ({alreadyHasInRecipe.quantity} {ing?.unit}) na ficha
                                          </span>
                                        ) : (
                                          <span className="text-slate-500">Novo na ficha técnica</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                                    {isChecked && (
                                      <div className="text-right text-[11px] text-amber-400 font-mono hidden sm:block">
                                        + R$ {costImpact.toFixed(2)} CMV
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        step="0.001"
                                        disabled={!isChecked}
                                        value={targetQty}
                                        onChange={e => {
                                          const val = Number(e.target.value);
                                          setBatchTargets(prev => ({
                                            ...prev,
                                            [p.id]: { checked: isChecked, quantity: val }
                                          }));
                                        }}
                                        className="w-20 bg-slate-900 border border-slate-700 disabled:bg-slate-950 disabled:text-slate-600 rounded-xl p-1.5 text-xs text-center text-white font-mono outline-none focus:border-indigo-500"
                                      />
                                      <span className="text-xs text-slate-400 font-mono">{ing?.unit || 'kg'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/80 flex justify-between items-center">
                          <span>
                            Hambúrgueres selecionados para receber o adicional:{' '}
                            <strong className="text-indigo-400 font-mono">
                              {Object.values(batchTargets).filter(t => t.checked && t.quantity > 0).length}
                            </strong>
                          </span>
                          <span className="text-[11px] text-slate-500 italic">
                            Os vínculos serão salvos ao clicar no botão "Salvar Produto" abaixo.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-6">
                    <button
                      type="button"
                      onClick={() => setShowBatchSection(true)}
                      className="w-full py-2.5 px-4 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-800/60 rounded-2xl text-xs font-bold text-indigo-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Layers size={15} /> + Deseja vincular este item como ingrediente a outros hambúrgueres?
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button onClick={resetForm} className="px-5 py-3 text-slate-400 hover:text-white font-bold text-sm cursor-pointer">
                    Cancelar
                  </button>
                  <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/30 text-sm cursor-pointer">
                    Salvar Produto
                  </button>
                </div>
              </div>
            )}

            {/* Filtros e Busca */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {(['todos', 'lanche', 'porcao', 'bebida', 'combo'] as const).map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                      categoryFilter === cat 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat === 'todos' ? 'Todos os Produtos' : cat === 'lanche' ? 'Hambúrgueres' : cat === 'porcao' ? 'Porções & Adicionais' : cat}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowInactive(!showInactive)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    showInactive
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {showInactive ? '👁️ Ocultar Desativados' : '👁️ Ver Desativados'}
                </button>
              </div>

              <div className="relative w-full md:w-72">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Filtrar por nome..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-white text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Lista de Produtos do Cardápio */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(p => {
                const cmv = getProductCmv(p.recipe);
                const margemBalcao = p.priceBalcao > 0 ? ((p.priceBalcao - cmv) / p.priceBalcao) * 100 : 0;
                
                return (
                  <div key={p.id} className={`glass-card rounded-3xl p-6 border transition-all flex flex-col justify-between ${
                    p.isActive === false 
                      ? 'opacity-60 bg-red-950/10 border-red-500/30' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}>
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-bold rounded-lg uppercase">
                            {p.category}
                          </span>
                          {p.isActive === false && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black rounded-lg uppercase">
                              Desativado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {p.isActive === false ? (
                            <button
                              type="button"
                              onClick={() => updateProduct(p.id, { isActive: true })}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="Reativar Produto no Cardápio"
                            >
                              Reativar
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => duplicateProduct(p)} 
                                className="p-1.5 text-slate-500 hover:text-amber-400 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors" 
                                title="Duplicar como Base (Clonar Ficha Técnica)"
                              >
                                <Copy size={16} />
                              </button>
                              <button onClick={() => startEdit(p)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded-lg hover:bg-slate-800 cursor-pointer" title="Editar">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => { if (confirm(`Desativar ${p.name} do cardápio?`)) removeProduct(p.id); }} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 cursor-pointer" title="Desativar">
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2">{p.name}</h3>

                      {/* Preços */}
                      <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/60 rounded-xl mb-4 border border-slate-800/80">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block flex items-center gap-1">
                            <Store size={12} /> BALCÃO
                          </span>
                          <span className="font-mono text-base font-bold text-slate-200">R$ {p.priceBalcao.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block flex items-center gap-1">
                            <Smartphone size={12} /> iFOOD
                          </span>
                          <span className="font-mono text-base font-bold text-red-400">R$ {p.priceIfood.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Ficha Técnica Resumida */}
                      <div className="mb-4">
                        <p className="text-[11px] text-slate-400 font-bold mb-1.5 uppercase">Ingredientes da Ficha:</p>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                          {p.recipe.map((r, idx) => {
                            const ing = items.find(i => i.id === r.ingredientId);
                            return (
                              <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                {ing?.name} ({r.quantity}{ing?.unit})
                              </span>
                            );
                          })}
                          {p.recipe.length === 0 && <span className="text-xs text-slate-600 italic">Sem ficha técnica</span>}
                        </div>
                      </div>
                    </div>

                    {/* Botão de Ação Rápida: Vincular este adicional a múltiplos hambúrgueres */}
                    {p.isActive !== false && (p.category === 'porcao' || p.name.toLowerCase().includes('adicional')) && (
                      <button
                        type="button"
                        onClick={() => openQuickLinkModal(p)}
                        className="w-full mb-3 py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-indigo-500/20"
                        title="Vincular este adicional à ficha técnica de múltiplos lanches existentes"
                      >
                        <Layers size={14} className="text-indigo-400" />
                        Vincular a Hambúrgueres
                      </button>
                    )}

                    {/* CMV e Margem */}
                    <div className="pt-3 border-t border-slate-800/80 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px]">CUSTO REAL (CMV)</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">R$ {cmv.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">MARGEM BRUTA</span>
                        <span className={`font-mono font-bold text-sm ${margemBalcao >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {margemBalcao.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA 2: SUB-RECEITAS E MOLHOS DA CASA */}
        {activeTab === 'subreceitas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Lista de Pré-preparos à esquerda */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-base font-bold text-slate-400 uppercase tracking-wider">
                  Pré-preparos ({prepIngredients.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewSubModal(true)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-purple-600/30"
                >
                  <Plus size={14} /> Nova Sub-Receita
                </button>
              </div>

              {prepIngredients.map(prep => {
                const isSelected = activePrep?.id === prep.id;
                const cost = getIngredientTrueCost(prep.id);

                return (
                  <div
                    key={prep.id}
                    onClick={() => setSelectedPrepId(prep.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex justify-between items-center ${
                      isSelected 
                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg' 
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex-1 pr-2">
                      <p className="font-bold text-sm text-slate-200">{prep.name}</p>
                      <p className="text-xs text-slate-500">Unidade: {prep.unit}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Custo Calculado</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">R$ {cost.toFixed(2)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Deseja realmente excluir a sub-receita "${prep.name}" e toda a sua fórmula?`)) {
                            removeSubRecipe(prep.id);
                            if (activePrep?.id === prep.id) {
                              setSelectedPrepId('');
                            }
                          }
                        }}
                        className="p-2 text-slate-500 hover:text-red-400 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                        title="Excluir esta sub-receita"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {prepIngredients.length === 0 && (
                <p className="text-slate-500 text-xs text-center py-6">Nenhum pré-preparo cadastrado.</p>
              )}
            </div>

            {/* Editor da Sub-Receita Selecionada */}
            <div className="lg:col-span-8">
              {activePrep ? (
                <div className="glass-card rounded-3xl p-8 border-t-4 border-purple-500">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="inline-flex items-center gap-2 text-purple-400 font-bold text-xs uppercase mb-1">
                        <FlaskConical size={16} /> Sub-Receita da Casa
                      </div>
                      <h2 className="text-3xl font-extrabold text-white">{activePrep.name}</h2>
                      <p className="text-slate-400 text-sm mt-1">
                        Defina as proporções de insumos brutos que compõem 1 {activePrep.unit} desta preparação.
                      </p>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-right">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Custo Total por {activePrep.unit}</span>
                      <span className="text-2xl font-mono font-extrabold text-amber-400">
                        R$ {getIngredientTrueCost(activePrep.id).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Adicionar Ingrediente na Sub-Receita */}
                  <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 mb-6">
                    <label className="block text-xs text-slate-300 font-bold mb-3 uppercase tracking-wider">
                      Adicionar Ingrediente ou Sub-preparo Base
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select 
                        value={subChildId}
                        onChange={e => setSubChildId(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 outline-none focus:border-purple-500 text-sm"
                      >
                        <option value="" disabled>Selecione um ingrediente (ex: Óleo de Girassol)...</option>
                        {sortedItems.filter(i => i.id !== activePrep.id).map(i => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.category}) - R$ {i.costPerUnit.toFixed(2)}/{i.unit}
                          </option>
                        ))}
                      </select>

                      <input 
                        type="number" step="0.001"
                        placeholder="Qtd (ex: 0.65)"
                        value={subChildQty}
                        onChange={e => setSubChildQty(e.target.value)}
                        className="w-36 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-purple-500"
                      />

                      <button 
                        type="button" 
                        onClick={handleAddSubComponent}
                        disabled={!subChildId || !subChildQty}
                        className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer"
                      >
                        + Vincular
                      </button>
                    </div>
                  </div>

                  {/* Lista de Componentes da Sub-Receita */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs text-slate-400 font-bold uppercase">Componentes da Fórmula:</h3>
                      {currentSubItems.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Deseja limpar todos os ingredientes da fórmula de "${activePrep.name}"?`)) {
                              await saveSubRecipe(activePrep.id, []);
                            }
                          }}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer underline"
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
                        <div key={idx} className="flex justify-between items-center p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                          <div>
                            <span className="font-bold text-slate-200 text-sm">{childIng?.name}</span>
                            <span className="text-slate-500 text-xs ml-3 font-mono">
                              proporção: {c.quantity} {childIng?.unit}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-amber-400 font-bold text-sm">
                              R$ {subtotal.toFixed(2)}
                            </span>
                            <button onClick={() => handleRemoveSubComponent(idx)} className="text-slate-500 hover:text-red-400 p-1 cursor-pointer">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {currentSubItems.length === 0 && (
                      <p className="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-800 rounded-2xl">
                        Nenhum ingrediente vinculado a esta sub-receita. Adicione acima para calcular o custo.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-card rounded-3xl p-12 text-center text-slate-500">
                  Selecione um pré-preparo à esquerda para ver sua composição.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Nova Sub-Receita */}
        {showNewSubModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FlaskConical size={20} className="text-purple-400" /> Nova Sub-Receita / Pré-Preparo
                </h2>
                <button onClick={() => setShowNewSubModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubRecipe} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nome da Sub-Receita / Molho</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: Molho Especial de Alho" 
                    value={newSubName} 
                    onChange={e => setNewSubName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-purple-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Unidade de Medida Produzida</label>
                  <select 
                    value={newSubUnit} 
                    onChange={e => setNewSubUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 outline-none focus:border-purple-500 text-sm"
                  >
                    <option value="kg">Quilograma (kg)</option>
                    <option value="L">Litro (L)</option>
                    <option value="un">Unidade (un)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowNewSubModal(false)} 
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-purple-600/30 cursor-pointer"
                  >
                    Criar Sub-Receita
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Rápido de Vínculo de Adicionais a Hambúrgueres */}
        {quickLinkProduct && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl animate-fade-in my-8 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex justify-between items-start pb-4 border-b border-slate-800 shrink-0">
                <div>
                  <div className="inline-flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase mb-1">
                    <Layers size={16} /> Vínculo Rápido à Ficha Técnica
                  </div>
                  <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                    {quickLinkProduct.name}
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Selecione quais lanches levam este item em sua receita padrão e defina a quantidade utilizada.
                  </p>
                </div>
                <button 
                  onClick={() => setQuickLinkProduct(null)} 
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body - Scrollable */}
              <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
                {/* Insumo selector & Default quantity */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-7">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-300">
                        Insumo de Estoque correspondente:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setNewStockItemName(quickLinkProduct.name.replace(/^(adicional|adic|porcao)\s*:\s*/i, ''));
                          setShowCreateStockItemModal(true);
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                      >
                        + Criar Insumo no Estoque
                      </button>
                    </div>
                    <select
                      value={quickLinkIngredientId}
                      onChange={e => {
                        const newId = e.target.value;
                        setQuickLinkIngredientId(newId);
                        const ing = items.find(i => i.id === newId);
                        const defQty = ing?.unit === 'un' ? '1' : '0.030';
                        setQuickLinkDefaultQty(defQty);
                        setQuickLinkTargets(prev => {
                          const updated = { ...prev };
                          products.forEach(p => {
                            const hasIng = (p.recipe || []).find(r => r.ingredientId === newId);
                            if (hasIng) {
                              updated[p.id] = { checked: true, quantity: hasIng.quantity };
                            } else if (updated[p.id]) {
                              updated[p.id] = { ...updated[p.id], quantity: Number(defQty) };
                            }
                          });
                          return updated;
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione o insumo correspondente no estoque...</option>
                      {sortedItems.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.category}) — R$ {i.costPerUnit.toFixed(2)} / {i.unit} (Estoque: {i.currentStock} {i.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-5 flex flex-col justify-end">
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Qtd Padrão ({items.find(i => i.id === quickLinkIngredientId)?.unit || 'kg'}):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        value={quickLinkDefaultQty}
                        onChange={e => setQuickLinkDefaultQty(e.target.value)}
                        placeholder="Ex: 0.030"
                        className="w-24 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono outline-none focus:border-indigo-500 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyBatchQtyToChecked(quickLinkDefaultQty, true)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3 py-2 text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                        title="Aplica este valor para todos os hambúrgueres que estiverem marcados"
                      >
                        Aplicar aos Marcados
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filters and Selection helpers */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setQuickLinkTargetCategory('lanche')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        quickLinkTargetCategory === 'lanche'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🍔 Apenas Hambúrgueres ({products.filter(p => p.category === 'lanche' && p.isActive !== false).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickLinkTargetCategory('todos')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        quickLinkTargetCategory === 'todos'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Todos os Produtos
                    </button>
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nome..."
                      value={quickLinkSearch}
                      onChange={e => setQuickLinkSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Quick select buttons */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectAllTargets(quickLinkTargetCategory, true, true)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold border border-slate-700 cursor-pointer"
                  >
                    ✓ Selecionar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAllTargets(quickLinkTargetCategory, false, true)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold border border-slate-700 cursor-pointer"
                  >
                    ✗ Desmarcar Todos
                  </button>
                  {quickLinkIngredientId && (
                    <button
                      type="button"
                      onClick={() => handleSelectOnlyExistingTargets(quickLinkIngredientId, true)}
                      className="px-2.5 py-1 bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-300 rounded-lg font-semibold border border-indigo-700/50 cursor-pointer"
                    >
                      ⭐ Marcar Apenas os que Já Possuem
                    </button>
                  )}
                </div>

                {/* List of Products */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {products
                    .filter(p => {
                      if (p.isActive === false) return false;
                      if (quickLinkTargetCategory !== 'todos' && p.category !== quickLinkTargetCategory) return false;
                      if (quickLinkSearch.trim() && !p.name.toLowerCase().includes(quickLinkSearch.toLowerCase())) return false;
                      return true;
                    })
                    .map(p => {
                      const isChecked = !!quickLinkTargets[p.id]?.checked;
                      const targetQty = quickLinkTargets[p.id]?.quantity ?? (Number(quickLinkDefaultQty) || 0.030);
                      const alreadyHasInRecipe = (p.recipe || []).find(r => r.ingredientId === quickLinkIngredientId);
                      const ing = items.find(i => i.id === quickLinkIngredientId);
                      const unitCost = ing ? getIngredientTrueCost(ing.id) : 0;
                      const costImpact = unitCost * targetQty;

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setQuickLinkTargets(prev => ({
                              ...prev,
                              [p.id]: { checked: !isChecked, quantity: targetQty }
                            }));
                          }}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-indigo-950/40 border-indigo-500/60 text-white shadow-sm'
                              : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                            />
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white truncate">{p.name}</span>
                                <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded uppercase">
                                  {p.category}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {alreadyHasInRecipe ? (
                                  <span className="text-emerald-400 font-bold">
                                    ✓ Já possui ({alreadyHasInRecipe.quantity} {ing?.unit}) na ficha
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Novo na ficha técnica</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                            {isChecked && (
                              <div className="text-right text-[11px] text-amber-400 font-mono hidden sm:block">
                                + R$ {costImpact.toFixed(2)} CMV
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.001"
                                disabled={!isChecked}
                                value={targetQty}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setQuickLinkTargets(prev => ({
                                    ...prev,
                                    [p.id]: { checked: isChecked, quantity: val }
                                  }));
                                }}
                                className="w-20 bg-slate-900 border border-slate-700 disabled:bg-slate-950 disabled:text-slate-600 rounded-xl p-1.5 text-xs text-center text-white font-mono outline-none focus:border-indigo-500"
                              />
                              <span className="text-xs text-slate-400 font-mono">{ing?.unit || 'kg'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-800 flex justify-between items-center shrink-0">
                <div className="text-xs text-slate-400">
                  Selecionados:{' '}
                  <strong className="text-indigo-400 font-mono">
                    {Object.values(quickLinkTargets).filter(t => t.checked && t.quantity > 0).length}
                  </strong>{' '}
                  produto(s)
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setQuickLinkProduct(null)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveQuickLink}
                    disabled={isSavingQuickLink}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isSavingQuickLink ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Salvar Vínculos na Ficha Técnica
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Inline: Cadastrar Novo Insumo no Estoque */}
        {showCreateStockItemModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ChefHat size={18} className="text-indigo-400" /> Cadastrar Novo Insumo no Estoque
                </h3>
                <button onClick={() => setShowCreateStockItemModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newStockItemName.trim()) return;
                const created = await addInventoryItem({
                  name: newStockItemName.trim(),
                  category: newStockItemCategory,
                  unit: newStockItemUnit,
                  costPerUnit: Number(newStockItemCost) || 0,
                  currentStock: 0,
                  status: 'ok'
                });
                if (created && created.id) {
                  setBatchIngredientId(created.id);
                  setQuickLinkIngredientId(created.id);
                }
                setShowCreateStockItemModal(false);
              }} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Insumo</label>
                  <input
                    type="text"
                    required
                    value={newStockItemName}
                    onChange={e => setNewStockItemName(e.target.value)}
                    placeholder="Ex: Queijo Brie Fatiado"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Categoria</label>
                    <select
                      value={newStockItemCategory}
                      onChange={e => setNewStockItemCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                    >
                      <option value="Carnes">Carnes</option>
                      <option value="Queijos & Laticínios">Queijos & Laticínios</option>
                      <option value="Molhos & Condimentos">Molhos & Condimentos</option>
                      <option value="Pães">Pães</option>
                      <option value="Hortifruti">Hortifruti</option>
                      <option value="Embalagens">Embalagens</option>
                      <option value="Pré-preparos">Pré-preparos</option>
                      <option value="Diversos">Diversos</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Unidade</label>
                    <select
                      value={newStockItemUnit}
                      onChange={e => setNewStockItemUnit(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                    >
                      <option value="kg">Quilograma (kg)</option>
                      <option value="un">Unidade (un)</option>
                      <option value="L">Litro (L)</option>
                      <option value="g">Grama (g)</option>
                      <option value="ml">Mililitro (ml)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Custo Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newStockItemCost}
                    onChange={e => setNewStockItemCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateStockItemModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    Criar Insumo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
