'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Dialog } from '@/components/ui';
import { Product, SaleItem, SaleItemAdditional, InventoryItem } from '@/lib/store';
import { generateCartItemId, isProductRequiringMeatPoint, getDefaultMeatPoint } from '@/lib/pos-cart-helpers';
import { Plus, Minus, MessageSquare, AlertCircle, Sparkles, Check, Info, GitFork, RefreshCw } from 'lucide-react';

interface PosBurgerCustomizerModalProps {
  mode?: 'create' | 'edit';
  product: Product | null;
  initialItem?: SaleItem | null;
  products?: Product[];
  items?: InventoryItem[];
  saleChannel: 'balcao' | 'ifood';
  onClose: () => void;
  onConfirm: (item: SaleItem, options?: { applyToAll?: boolean; isSplit?: boolean }) => void;
}

const MEAT_POINTS = [
  { id: 'MAL PASSADO', label: 'Mal Passado', badge: '🔴' },
  { id: 'AO PONTO -', label: 'Ao Ponto -', badge: '🟠' },
  { id: 'AO PONTO', label: 'Ao Ponto', badge: '🟢' },
  { id: 'AO PONTO +', label: 'Ao Ponto +', badge: '🟤' },
  { id: 'BEM PASSADO', label: 'Bem Passado', badge: '⚫' },
];

const QUICK_OBS = ['MOLHO À PARTE', 'CORTAR AO MEIO', 'BEM TOSTADO', 'CAPRICHAR NO MOLHO'];

export default function PosBurgerCustomizerModal({
  mode = 'create',
  product,
  initialItem = null,
  products = [],
  items = [],
  saleChannel,
  onClose,
  onConfirm,
}: PosBurgerCustomizerModalProps) {
  const [selectedComboId, setSelectedComboId] = useState<string>('none');
  const [selectedAdditionals, setSelectedAdditionals] = useState<Record<string, number>>({});
  const [selectedMeatPoint, setSelectedMeatPoint] = useState<string>('AO PONTO');
  const [selectedRemovals, setSelectedRemovals] = useState<Set<string>>(new Set());
  const [customNotes, setCustomNotes] = useState('');
  const [applyScope, setApplyScope] = useState<'single' | 'all'>('all');

  // Identifica se o produto é carne bovina ou se deve exibir ponto da carne
  const isBeefBurger = useMemo(() => {
    if (!product) return false;
    return isProductRequiringMeatPoint(product);
  }, [product]);

  // Preenchimento de estado: edição (item existente) vs criação (novo item)
  useEffect(() => {
    if (product) {
      if (mode === 'edit' && initialItem) {
        setSelectedComboId(initialItem.comboId || 'none');
        const addMap: Record<string, number> = {};
        if (Array.isArray(initialItem.additionals)) {
          for (const a of initialItem.additionals) {
            const key = a.id || a.productId || a.name;
            if (key) addMap[key] = a.quantity || 1;
          }
        }
        setSelectedAdditionals(addMap);
        setSelectedMeatPoint(initialItem.meatPoint || (isBeefBurger ? getDefaultMeatPoint(product) : ''));
        setSelectedRemovals(new Set(initialItem.removals || []));
        setCustomNotes(initialItem.notes || '');
        setApplyScope(initialItem.quantity > 1 ? 'single' : 'all');
      } else {
        setSelectedComboId('none');
        setSelectedAdditionals({});
        setSelectedMeatPoint(isBeefBurger ? getDefaultMeatPoint(product) : '');
        setSelectedRemovals(new Set());
        setCustomNotes('');
        setApplyScope('all');
      }
    }
  }, [product, initialItem, mode, isBeefBurger]);

  // Combos promocionais dinâmicos a partir do catálogo real sem ofertas ou preços fixos de fallback
  const availableCombos = useMemo(() => {
    const dbCombos = products.filter(p => p.isActive !== false && p.category === 'combo');

    const result: { id: string; rawName: string; displayName: string; price: number }[] = [];

    for (const c of dbCombos) {
      const norm = c.name.toLowerCase();
      const price = saleChannel === 'ifood' ? (c.priceIfood ?? c.priceBalcao) : c.priceBalcao;
      let icon = '🥤';
      if (norm.includes('cheddar') && norm.includes('bacon')) {
        icon = '🍟🥓🧀';
      } else if (norm.includes('batata')) {
        icon = '🍟';
      } else if (norm.includes('anéis') || norm.includes('aneis') || norm.includes('cebola')) {
        icon = '🧅';
      }
      const cleanName = c.name.replace(/^Combo:\s*/i, '').trim();
      result.push({
        id: c.id,
        rawName: c.name,
        displayName: `${icon} ${cleanName}`,
        price,
      });
    }

    return result;
  }, [products, saleChannel]);

  const selectedComboObj = useMemo(() => {
    if (selectedComboId === 'none') return null;
    return availableCombos.find(c => c.id === selectedComboId) || null;
  }, [selectedComboId, availableCombos]);

  // Lista dinâmica de adicionais vinculados à ficha técnica e ao catálogo (sem FALLBACK_ADDITIONALS)
  const availableAdditionals = useMemo(() => {
    if (product?.acceptsAddons === false) {
      return [];
    }

    const burgerRecipeIngredientIds = new Set((product?.recipe || []).map(r => r.ingredientId));
    const burgerRecipeIngredientNames = (product?.recipe || []).map(r => {
      const ing = items?.find(i => i.id === r.ingredientId);
      return ing?.name.toLowerCase().trim() || '';
    }).filter(Boolean);

    const allowedIdsSet = (product?.allowedAddonIds && product.allowedAddonIds.length > 0)
      ? new Set(product.allowedAddonIds)
      : null;

    const candidateProducts = products.filter(p => {
      if (p.isActive === false) return false;
      if (p.id === product?.id) return false;

      if (allowedIdsSet) {
        return allowedIdsSet.has(p.id);
      }

      return (
        p.isAddon === true ||
        p.category === 'porcao' ||
        p.name.startsWith('Adicional:') ||
        p.name.startsWith('Pote Maionese') ||
        p.name.toLowerCase().includes('adicional') ||
        p.name.toLowerCase().includes('extra')
      );
    });

    const list = candidateProducts.map(p => {
      const price = saleChannel === 'ifood' ? (p.priceIfood ?? p.priceBalcao) : p.priceBalcao;
      const cleanName = p.name.replace(/^(Adicional|Porção|Extra):\s*/i, '').trim();

      const hasDirectIngredient = (p.recipe || []).some(r => burgerRecipeIngredientIds.has(r.ingredientId));
      const hasMatchingName = burgerRecipeIngredientNames.some(ingName => 
        cleanName.toLowerCase().includes(ingName) || ingName.includes(cleanName.toLowerCase())
      );
      const isFromRecipe = hasDirectIngredient || hasMatchingName;

      return {
        id: p.id,
        name: cleanName,
        fullName: p.name,
        price,
        isFromRecipe,
      };
    });

    return list.sort((a, b) => {
      if (a.isFromRecipe && !b.isFromRecipe) return -1;
      if (!a.isFromRecipe && b.isFromRecipe) return 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [product, products, items, saleChannel]);

  // Chips dinâmicos de retiradas gerados exclusivamente a partir dos insumos da receita
  const availableRemovals = useMemo(() => {
    const removalChips: string[] = [];
    let hasSalad = false;

    if (product?.recipe && product.recipe.length > 0 && items && items.length > 0) {
      product.recipe.forEach(r => {
        const ing = items.find(i => i.id === r.ingredientId);
        if (!ing) return;

        const rawName = ing.name.toUpperCase().trim();
        const cat = (ing.category || '').toUpperCase().trim();

        // Filtrar embalagens e itens operacionais não-alimentares
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

        // Filtrar base do lanche (pão e carnes base)
        if (rawName.includes('PÃO') || rawName.includes('PAO')) return;
        if (rawName.startsWith('HAMBÚRGUER') || rawName.startsWith('HAMBURGUER') || rawName.startsWith('HAMB.')) {
          if (!rawName.includes('QUEIJO')) return;
        }

        // Mapeamento padronizado de retiradas
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

    return Array.from(new Set(removalChips));
  }, [product, items]);

  const basePrice = useMemo(() => {
    if (!product) return 0;
    return saleChannel === 'ifood' ? (product.priceIfood ?? product.priceBalcao) : product.priceBalcao;
  }, [product, saleChannel]);

  const comboPrice = useMemo(() => {
    return selectedComboObj?.price || 0;
  }, [selectedComboObj]);

  const additionalsPrice = useMemo(() => {
    return Object.entries(selectedAdditionals).reduce((acc, [id, qty]) => {
      if (qty <= 0) return acc;
      const add = availableAdditionals.find(a => a.id === id);
      return acc + ((add?.price || 0) * qty);
    }, 0);
  }, [selectedAdditionals, availableAdditionals]);

  const totalPrice = useMemo(() => {
    return basePrice + comboPrice + additionalsPrice;
  }, [basePrice, comboPrice, additionalsPrice]);

  if (!product) return null;

  const handleToggleRemoval = (removal: string) => {
    setSelectedRemovals(prev => {
      const next = new Set(prev);
      if (next.has(removal)) {
        next.delete(removal);
      } else {
        next.add(removal);
      }
      return next;
    });
  };

  const handleToggleQuickNote = (noteText: string) => {
    if (customNotes.toUpperCase().includes(noteText)) {
      const reg = new RegExp(`(^|,\\s*)${noteText}(,\\s*|$)`, 'i');
      const updated = customNotes.replace(reg, (_, p1, p2) => (p1 && p2 ? ', ' : '')).trim();
      setCustomNotes(updated.replace(/^,\s*|,\s*$/g, ''));
    } else {
      setCustomNotes(prev => (prev.trim() ? `${prev.trim()}, ${noteText}` : noteText));
    }
  };

  const handleSave = () => {
    if (!product) return;

    const additionalsList: SaleItemAdditional[] = [];
    for (const add of availableAdditionals) {
      const qty = selectedAdditionals[add.id] || 0;
      if (qty > 0) {
        additionalsList.push({
          id: add.id,
          name: qty > 1 ? `${qty}x ${add.name}` : add.name,
          quantity: qty,
          unitPrice: add.price,
          price: Number((add.price * qty).toFixed(2)),
        });
      }
    }

    const comboName = selectedComboObj ? selectedComboObj.rawName : undefined;
    const isGift = Boolean(initialItem?.isGift);
    const unitPrice = isGift ? 0 : totalPrice;
    const originalPrice = isGift ? totalPrice : (initialItem?.originalPrice || undefined);

    const isSplitting = mode === 'edit' && applyScope === 'single' && (initialItem?.quantity || 1) > 1;

    const savedItem: SaleItem = {
      id: (!isSplitting && initialItem?.id) ? initialItem.id : generateCartItemId(),
      productId: product.id,
      productName: product.name,
      quantity: isSplitting ? 1 : (mode === 'edit' ? (initialItem?.quantity || 1) : 1),
      unitPrice,
      originalPrice,
      isGift,
      giftReason: initialItem?.giftReason,
      giftNotes: initialItem?.giftNotes,
      comboId: selectedComboObj ? selectedComboObj.id : undefined,
      combo: comboName,
      comboPrice: comboPrice > 0 ? comboPrice : undefined,
      meatPoint: selectedMeatPoint.trim() ? selectedMeatPoint.trim() : undefined,
      removals: selectedRemovals.size > 0 ? Array.from(selectedRemovals) : undefined,
      additionals: additionalsList.length > 0 ? additionalsList : undefined,
      notes: customNotes.trim() ? customNotes.trim().toUpperCase() : undefined,
    };

    onConfirm(savedItem, {
      applyToAll: applyScope === 'all',
      isSplit: isSplitting,
    });
  };

  const selectedAdditionalsCount = Object.values(selectedAdditionals).reduce((a, b) => a + b, 0);

  return (
    <Dialog
      open={!!product}
      onClose={onClose}
      title={mode === 'edit' ? `Editar: ${product?.name}` : (product?.name || 'Personalização')}
      description={
        mode === 'edit'
          ? `Ajuste a composição deste item na comanda • Preço Base: R$ ${basePrice.toFixed(2)}`
          : `Personalização de Hambúrguer • Preço Base: R$ ${basePrice.toFixed(2)}`
      }
      size="lg"
    >
      <div className="space-y-4 py-1 text-slate-200">
        {/* Banner de Desmembramento quando o item em edição possui quantidade > 1 */}
        {mode === 'edit' && initialItem && initialItem.quantity > 1 && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 space-y-2">
            <span className="text-[11px] font-black uppercase text-amber-300 flex items-center gap-1.5">
              <GitFork size={14} className="text-amber-400" />
              Esta linha possui {initialItem.quantity} unidades do item:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setApplyScope('single')}
                className={`p-2.5 rounded-lg font-bold text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  applyScope === 'single'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="text-[11px] font-black">✨ Personalizar apenas 1 unidade</span>
                <span className={`text-[10px] mt-1 ${applyScope === 'single' ? 'text-slate-900' : 'text-slate-400'}`}>
                  Desmembra 1 unidade para esta receita, mantendo as outras {initialItem.quantity - 1} intactas
                </span>
              </button>

              <button
                type="button"
                onClick={() => setApplyScope('all')}
                className={`p-2.5 rounded-lg font-bold text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  applyScope === 'all'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="text-[11px] font-black">🔄 Alterar todas as {initialItem.quantity} unidades</span>
                <span className={`text-[10px] mt-1 ${applyScope === 'all' ? 'text-slate-900' : 'text-slate-400'}`}>
                  Aplica esta personalização em todas as {initialItem.quantity} unidades juntas
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Seção 1: Combos Promocionais */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              🍟 Combo Promocional:
            </h3>
            {availableCombos.length === 0 && (
              <span className="text-[11px] text-slate-500 italic">Nenhum combo cadastrado</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedComboId('none')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedComboId === 'none'
                  ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="block text-xs font-bold">Sem Combo</span>
              <span className="text-[11px] text-slate-500 font-mono">+ R$ 0,00</span>
            </button>

            {availableCombos.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedComboId(c.id)}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedComboId === c.id
                    ? 'bg-amber-500/20 border-amber-500 text-white font-bold ring-1 ring-amber-500/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="block text-xs font-bold">{c.displayName}</span>
                <span className="text-[11px] text-amber-400 font-mono font-bold">
                  + R$ {c.price.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Seção 2: Ponto da Carne (Pills dedicadas) */}
        {isBeefBurger && (
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              🥩 Ponto da Carne:
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {MEAT_POINTS.map(mp => {
                const isSelected = selectedMeatPoint === mp.id;
                return (
                  <button
                    key={mp.id}
                    type="button"
                    onClick={() => setSelectedMeatPoint(isSelected ? '' : mp.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 border ${
                      isSelected
                        ? 'bg-orange-600/30 border-orange-500 text-white ring-1 ring-orange-500 font-black shadow-xs'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm">{mp.badge}</span>
                    <span className="text-[11px] leading-tight text-center">{mp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Seção 3: Retiradas de Ingredientes da Receita */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              🚫 Retirar Ingredientes (Da Receita):
            </h3>
            {selectedRemovals.size > 0 && (
              <span className="text-[11px] text-red-400 font-bold">
                {selectedRemovals.size} {selectedRemovals.size === 1 ? 'item retirado' : 'itens retirados'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {availableRemovals.map(removal => {
              const isRemoved = selectedRemovals.has(removal);
              return (
                <button
                  key={removal}
                  type="button"
                  onClick={() => handleToggleRemoval(removal)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer uppercase border ${
                    isRemoved
                      ? 'bg-rose-950/80 border-rose-500 text-rose-300 line-through ring-1 ring-rose-500/50 font-black'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {removal}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seção 4: Adicionais & Ficha Técnica */}
        {product?.acceptsAddons !== false && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                🧀 Adicionais & Extras:
              </h3>
              {availableAdditionals.some(a => a.isFromRecipe) && (
                <span className="text-[11px] text-amber-400/90 font-medium">
                  ⭐ Insumos vinculados ao lanche
                </span>
              )}
            </div>

            {availableAdditionals.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">Nenhum adicional disponível no catálogo.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {availableAdditionals.map(add => {
                  const currentQty = selectedAdditionals[add.id] || 0;
                  return (
                    <div
                      key={add.id}
                      className={`p-2 rounded-xl border transition-all flex flex-col justify-between ${
                        currentQty > 0
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-xs ring-1 ring-blue-500/40'
                          : add.isFromRecipe
                            ? 'bg-amber-950/20 border-amber-500/40 text-slate-200 hover:border-amber-500'
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="mb-1.5">
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <span className="text-xs font-semibold block leading-tight truncate" title={add.name}>
                            {add.name}
                          </span>
                          {add.isFromRecipe && (
                            <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                              ⭐ Ficha
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          + R$ {add.price.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                        <span className="text-[10px] text-slate-400 font-mono">Qtd: {currentQty}</span>
                        <div className="flex items-center gap-1">
                          {currentQty > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedAdditionals(prev => {
                                const next = { ...prev };
                                if (currentQty <= 1) {
                                  delete next[add.id];
                                } else {
                                  next[add.id] = currentQty - 1;
                                }
                                return next;
                              })}
                              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                              title="Diminuir"
                            >
                              <Minus size={10} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedAdditionals(prev => ({ ...prev, [add.id]: currentQty + 1 }))}
                            className="w-5 h-5 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer font-bold"
                            title="Aumentar"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Seção 5: Observações Livres do Cliente */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare size={13} className="text-blue-400" /> Observações Especiais do Cliente:
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_OBS.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => handleToggleQuickNote(chip)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer uppercase ${
                  customNotes.toUpperCase().includes(chip)
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={customNotes}
            onChange={e => setCustomNotes(e.target.value.toUpperCase())}
            placeholder="OUTRA OBSERVAÇÃO (EX: CORTAR AO MEIO, MOLHO À PARTE...)"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs outline-none focus:border-amber-500 uppercase font-bold tracking-wide"
          />
        </div>

        {/* Seção 6: Resumo Visual em Tempo Real Pré-Confirmação */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              Resumo da Composição:
            </span>
            <span className="font-mono text-emerald-400 font-bold text-[11px]">
              Base R$ {basePrice.toFixed(2)}
              {comboPrice > 0 && ` + Combo R$ ${comboPrice.toFixed(2)}`}
              {additionalsPrice > 0 && ` + Extras R$ ${additionalsPrice.toFixed(2)}`}
            </span>
          </div>

          <div className="text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="font-bold text-white">
              1x {product.name}
            </span>
            {selectedMeatPoint && (
              <span className="px-1.5 py-0.5 rounded bg-orange-950/60 border border-orange-500/40 text-orange-300 font-bold">
                🥩 {selectedMeatPoint}
              </span>
            )}
            {selectedComboObj && (
              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-bold">
                {selectedComboObj.displayName}
              </span>
            )}
            {selectedAdditionalsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-300 font-semibold">
                + {availableAdditionals
                  .filter(a => (selectedAdditionals[a.id] || 0) > 0)
                  .map(a => `${selectedAdditionals[a.id] > 1 ? `${selectedAdditionals[a.id]}x ` : ''}${a.name}`)
                  .join(', ')}
              </span>
            )}
            {selectedRemovals.size > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold">
                🚫 {Array.from(selectedRemovals).join(', ')}
              </span>
            )}
            {customNotes.trim() && (
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 italic">
                💬 {customNotes.trim().toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Rodapé do Modal com Preço Calculado e Ação */}
        <div className="pt-2 border-t border-slate-800 flex justify-between items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total deste item:</span>
            <span className="text-2xl font-mono font-black text-emerald-400">
              R$ {totalPrice.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              {mode === 'edit' ? (
                <>
                  <Check size={15} />
                  {applyScope === 'single' && (initialItem?.quantity || 1) > 1
                    ? 'Salvar 1 Unidade Desmembrada'
                    : 'Salvar Alterações'}
                </>
              ) : (
                <>
                  <Plus size={15} /> Adicionar ao Pedido
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
