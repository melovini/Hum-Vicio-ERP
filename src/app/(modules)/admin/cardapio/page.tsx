'use client';
import { useState, useMemo } from 'react';
import { useInventory, Product, RecipeIngredient, InventoryItem } from '@/lib/store';
import { 
  ChefHat, ArrowLeft, Plus, Trash2, Edit2, Check, X, 
  FlaskConical, Sparkles, Layers, DollarSign, Store, Smartphone, Search, ChevronRight, Copy 
} from 'lucide-react';
import Link from 'next/link';

export default function EngenhariaCardapioPage() {
  const { 
    items, products, addProduct, updateProduct, removeProduct, 
    getProductCmv, isLoaded, subRecipes, saveSubRecipe, removeSubRecipe, 
    getIngredientTrueCost, addInventoryItem 
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

  if (!isLoaded) return null;

  const resetForm = () => {
    setName(''); setCategory('lanche'); setPriceBalcao(''); setPriceIfood('');
    setRecipe([]); setSelectedIngId(''); setIngQuantity(''); setIngSearch('');
    setIsIngDropdownOpen(false); setIsAdding(false); setEditingId(null);
  };

  const handleSave = () => {
    if (!name || !priceBalcao || !priceIfood) return;
    
    const productData = {
      name, category, 
      priceBalcao: Number(priceBalcao), 
      priceIfood: Number(priceIfood),
      recipe
    };

    if (editingId) {
      updateProduct(editingId, productData);
    } else {
      addProduct(productData);
    }
    resetForm();
  };

  const startEdit = (p: Product) => {
    setName(p.name);
    setCategory(p.category);
    setPriceBalcao(p.priceBalcao.toString());
    setPriceIfood(p.priceIfood.toString());
    setRecipe([...p.recipe]);
    setEditingId(p.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicateProduct = (p: Product) => {
    setName(`[Cópia] ${p.name}`);
    setCategory(p.category);
    setPriceBalcao(p.priceBalcao.toString());
    setPriceIfood(p.priceIfood.toString());
    setRecipe(p.recipe.map(r => ({ ...r })));
    setEditingId(null);
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
      </div>
    </div>
  );
}
