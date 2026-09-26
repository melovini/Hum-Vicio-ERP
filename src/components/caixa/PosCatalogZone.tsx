'use client';
import React, { useMemo } from 'react';
import { Product, Sale } from '@/lib/store';
import { PosCategory } from '@/lib/caixa-types';
import { 
  Sparkles, UtensilsCrossed, Flame, Coffee, 
  Search, X, AlertCircle 
} from 'lucide-react';

interface PosCatalogZoneProps {
  products: Product[];
  sales: Sale[];
  saleChannel: 'balcao' | 'ifood';
  posCategory: PosCategory;
  onSelectCategory: (cat: PosCategory) => void;
  productSortOrder: 'vendas' | 'alfabetica';
  onSelectSortOrder: (order: 'vendas' | 'alfabetica') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onProductClick: (product: Product, options?: { mode: 'simples' | 'combo'; comboProduct?: Product | null }) => void;
}

export default function PosCatalogZone({
  products,
  sales,
  saleChannel,
  posCategory,
  onSelectCategory,
  productSortOrder,
  onSelectSortOrder,
  searchQuery,
  onSearchChange,
  searchInputRef,
  onProductClick,
}: PosCatalogZoneProps) {
  const [inclusionMode, setInclusionMode] = React.useState<'simples' | 'combo'>('simples');
  const [selectedComboId, setSelectedComboId] = React.useState<string>('');

  const availableCombos = useMemo(() => {
    return products.filter(p => p.isActive !== false && p.category === 'combo');
  }, [products]);

  const activeCombo = useMemo(() => {
    if (availableCombos.length === 0) return null;
    return availableCombos.find(c => c.id === selectedComboId) || availableCombos[0];
  }, [availableCombos, selectedComboId]);

  const activeProducts = useMemo(() => {
    return products.filter(p => p.isActive !== false && p.status !== 'rascunho' && p.status !== 'inativo');
  }, [products]);

  // Top 9 mais vendidos globalmente
  const top9Products = useMemo(() => {
    const counts: Record<string, number> = {};
    sales.filter(s => s.status === 'completed').forEach(s => {
      s.items?.forEach(i => {
        counts[i.productId] = (counts[i.productId] || 0) + i.quantity;
      });
    });

    const vendaveis = activeProducts.filter(p => 
      !p.name.startsWith('Adicional:') && 
      !p.name.startsWith('Pote Maionese') &&
      p.category !== 'combo'
    );

    return [...vendaveis]
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
      .slice(0, 9);
  }, [activeProducts, sales]);

  // Lista base por categoria
  const categoryProducts = useMemo(() => {
    switch (posCategory) {
      case 'mais_pedidos':
        return top9Products;
      case 'hamburgueres':
        return activeProducts.filter(p => p.category === 'lanche' && !p.name.toLowerCase().includes('duplo'));
      case 'duplos':
        return activeProducts.filter(p => p.category === 'lanche' && p.name.toLowerCase().includes('duplo'));
      case 'bebidas':
        return activeProducts.filter(p => p.category === 'bebida');
      case 'porcoes':
        return activeProducts.filter(p => p.category === 'porcao' && !p.name.startsWith('Adicional:') && !p.name.startsWith('Pote Maionese'));
      default:
        return activeProducts;
    }
  }, [posCategory, activeProducts, top9Products]);

  // Aplicação da busca rápida e ordenação
  const displayedProducts = useMemo(() => {
    let list = categoryProducts;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      // Se houver busca digitada, busca em todos os produtos vendáveis
      list = activeProducts.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.category && p.category.toLowerCase().includes(q))
      );
    }

    if (productSortOrder === 'alfabetica') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else {
      const counts: Record<string, number> = {};
      sales.filter(s => s.status === 'completed').forEach(s => {
        s.items?.forEach(i => {
          counts[i.productId] = (counts[i.productId] || 0) + i.quantity;
        });
      });
      return [...list].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    }
  }, [categoryProducts, activeProducts, searchQuery, productSortOrder, sales]);

  return (
    <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider">Catálogo de Produtos</h2>
      </div>
      {/* Barra de Busca Rápida com Atalho [F2] */}
      <div className="mb-4">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar produto pelo nome ou código [F2]..."
            className="w-full pl-10 pr-20 py-2.5 bg-slate-950/80 border border-slate-700/80 hover:border-slate-600 focus:border-amber-500 rounded-2xl text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
            aria-label="Buscar produto no catálogo"
          />
          <div className="absolute right-2.5 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Limpar busca"
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 rounded shadow-xs pointer-events-none">
                F2
              </kbd>
            )}
          </div>
        </div>
      </div>

      {/* Seletor Superior de Inclusão Rápida: Simples vs Combo */}
      <div className="flex items-center justify-between gap-2 mb-3 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">
            Modo ao clicar:
          </span>
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setInclusionMode('simples')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                inclusionMode === 'simples'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🍔 Simples
            </button>
            <button
              type="button"
              onClick={() => setInclusionMode('combo')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                inclusionMode === 'combo'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🍟🥤 Combo
            </button>
          </div>
        </div>

        {inclusionMode === 'combo' && availableCombos.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] text-emerald-400 font-bold uppercase">Opção:</span>
            <select
              value={selectedComboId || availableCombos[0]?.id}
              onChange={e => setSelectedComboId(e.target.value)}
              className="bg-slate-900 border border-emerald-500/40 text-emerald-300 font-bold rounded-lg px-2 py-1 text-xs outline-none cursor-pointer max-w-[200px] truncate"
            >
              {availableCombos.map(c => {
                const comboPrice = saleChannel === 'ifood' ? (c.priceIfood ?? c.priceBalcao) : c.priceBalcao;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} (+ R$ {comboPrice.toFixed(2)})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Categorias Fixas e Ordenação */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSelectCategory('mais_pedidos')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              posCategory === 'mais_pedidos' && !searchQuery
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles size={14} /> Mais Pedidos
          </button>

          <button
            type="button"
            onClick={() => onSelectCategory('hamburgueres')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              posCategory === 'hamburgueres' && !searchQuery
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <UtensilsCrossed size={14} /> Hambúrgueres
          </button>

          <button
            type="button"
            onClick={() => onSelectCategory('duplos')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              posCategory === 'duplos' && !searchQuery
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Flame size={14} /> Duplos
          </button>

          <button
            type="button"
            onClick={() => onSelectCategory('bebidas')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              posCategory === 'bebidas' && !searchQuery
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Coffee size={14} /> Bebidas
          </button>

          <button
            type="button"
            onClick={() => onSelectCategory('porcoes')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              posCategory === 'porcoes' && !searchQuery
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🍟 Porções
          </button>
        </div>

        {/* Alternância de Ordenação */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => onSelectSortOrder('vendas')}
            className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              productSortOrder === 'vendas'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Mais vendidos primeiro"
          >
            🔥 Top Vendas
          </button>
          <button
            type="button"
            onClick={() => onSelectSortOrder('alfabetica')}
            className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              productSortOrder === 'alfabetica'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Ordem alfabética A-Z"
          >
            🔤 A-Z
          </button>
        </div>
      </div>

      {/* Grid de Produtos */}
      {displayedProducts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-8">
          <AlertCircle size={36} className="mb-2 opacity-40 text-blue-400" />
          <p className="text-xs">Nenhum produto encontrado nesta visualização.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 focus:outline-none">
          {displayedProducts.map(p => {
            const price = saleChannel === 'ifood' ? p.priceIfood : p.priceBalcao;
            const isBurger = p.category === 'lanche';

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onProductClick(p, {
                  mode: inclusionMode,
                  comboProduct: isBurger && inclusionMode === 'combo' ? activeCombo : null,
                })}
                className={`p-3.5 rounded-2xl text-left transition-all group flex flex-col justify-between border cursor-pointer active:scale-[0.98] ${
                  isBurger
                    ? 'bg-slate-950/70 border-slate-800/80 hover:border-amber-500/80 hover:bg-amber-500/10'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-emerald-500/80 hover:bg-emerald-500/10'
                }`}
                title={`Adicionar ${p.name}`}
              >
                <div>
                  <span className="font-bold text-slate-200 group-hover:text-white line-clamp-2 text-xs">
                    {p.name}
                  </span>
                  {isBurger && (
                    <span className={`text-[10px] font-bold block mt-0.5 ${
                      inclusionMode === 'combo' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {inclusionMode === 'combo'
                        ? `+ ${activeCombo ? activeCombo.name.replace(/^Combo:\s*/i, '') : 'Combo'}`
                        : 'Simples'}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400 font-mono">
                    {p.category === 'lanche' ? 'Lanche' : p.category === 'bebida' ? 'Bebida' : 'Porção'}
                  </span>
                  <span className="text-sm text-emerald-400 font-mono font-black">
                    R$ {price.toFixed(2)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
