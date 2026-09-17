'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Dialog } from '@/components/ui';
import { Product, SaleItem, InventoryItem } from '@/lib/store';
import { Plus, MessageSquare } from 'lucide-react';

interface PosBurgerCustomizerModalProps {
  product: Product | null;
  products?: Product[];
  items?: InventoryItem[];
  saleChannel: 'balcao' | 'ifood';
  onClose: () => void;
  onConfirm: (item: SaleItem) => void;
}

const FALLBACK_ADDITIONALS = [
  { id: 'fb_1', name: 'Bacon Fatiado Crocante', priceBalcao: 5.00, priceIfood: 6.00 },
  { id: 'fb_2', name: 'Cheddar Cremoso Extra', priceBalcao: 5.00, priceIfood: 6.00 },
  { id: 'fb_3', name: 'Queijo Prato Extra', priceBalcao: 5.00, priceIfood: 6.00 },
  { id: 'fb_4', name: 'Queijo Mussarela Extra', priceBalcao: 5.00, priceIfood: 6.00 },
  { id: 'fb_5', name: 'Cebola Caramelizada', priceBalcao: 4.00, priceIfood: 5.00 },
  { id: 'fb_6', name: 'Cebola Crispy', priceBalcao: 4.00, priceIfood: 5.00 },
  { id: 'fb_7', name: 'Picles Artesanal', priceBalcao: 4.00, priceIfood: 5.00 },
  { id: 'fb_8', name: 'Maionese da Casa Extra', priceBalcao: 3.50, priceIfood: 4.50 },
  { id: 'fb_9', name: 'Maionese de Alho Extra', priceBalcao: 3.50, priceIfood: 4.50 },
  { id: 'fb_10', name: 'Geleia de Pimenta Defumada', priceBalcao: 4.00, priceIfood: 5.00 },
  { id: 'fb_11', name: 'Barbecue Artesanal', priceBalcao: 3.50, priceIfood: 4.50 },
  { id: 'fb_12', name: 'Ovo Frito na Manteiga', priceBalcao: 3.00, priceIfood: 4.00 },
  { id: 'fb_13', name: 'Hambúrguer Smash 100g Extra', priceBalcao: 8.00, priceIfood: 10.00 },
  { id: 'fb_14', name: 'Hambúrguer 160g Extra', priceBalcao: 10.00, priceIfood: 12.00 },
  { id: 'fb_15', name: 'Catupiry Original Extra', priceBalcao: 6.00, priceIfood: 7.50 },
  { id: 'fb_16', name: 'Alface Americana', priceBalcao: 2.00, priceIfood: 3.00 },
  { id: 'fb_17', name: 'Tomate Fatiado', priceBalcao: 2.00, priceIfood: 3.00 },
  { id: 'fb_18', name: 'Pimenta Jalapeño', priceBalcao: 4.00, priceIfood: 5.00 },
  { id: 'fb_19', name: 'Pote Maionese da Casa 50g', priceBalcao: 4.00, priceIfood: 5.00 },
];

export default function PosBurgerCustomizerModal({
  product,
  products = [],
  items = [],
  saleChannel,
  onClose,
  onConfirm,
}: PosBurgerCustomizerModalProps) {
  const [selectedComboId, setSelectedComboId] = useState<string>('none');
  const [selectedAdditionals, setSelectedAdditionals] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  // Combos promocionais dinâmicos a partir do catálogo e precificação
  const availableCombos = useMemo(() => {
    const dbCombos = products.filter(p => p.isActive !== false && p.category === 'combo');
    if (dbCombos.length > 0) {
      return dbCombos.map(c => {
        const price = saleChannel === 'ifood' ? (c.priceIfood ?? c.priceBalcao) : c.priceBalcao;
        const isBatata = c.name.toLowerCase().includes('batata');
        const isAneis = c.name.toLowerCase().includes('anéis') || c.name.toLowerCase().includes('aneis');
        const icon = isBatata ? '🍟' : isAneis ? '🧅' : '🥤';
        const cleanName = c.name.replace(/^Combo:\s*/i, '').trim();
        return {
          id: c.id,
          rawName: c.name,
          displayName: `${icon} ${cleanName}`,
          price,
        };
      });
    }

    // Fallback com preços oficiais da precificação
    return [
      {
        id: 'fb_combo_batata',
        rawName: 'Combo: Batata + Bebida',
        displayName: '🍟 Batata + Bebida',
        price: saleChannel === 'ifood' ? 16.00 : 14.00,
      },
      {
        id: 'fb_combo_aneis',
        rawName: 'Combo: Anéis de Cebola + Bebida',
        displayName: '🧅 Anéis de Cebola + Bebida',
        price: saleChannel === 'ifood' ? 18.00 : 16.00,
      },
    ];
  }, [products, saleChannel]);

  const selectedComboObj = useMemo(() => {
    if (selectedComboId === 'none') return null;
    return availableCombos.find(c => c.id === selectedComboId) || null;
  }, [selectedComboId, availableCombos]);

  // Resetar estado quando abrir novo produto
  useEffect(() => {
    if (product) {
      setSelectedComboId('none');
      setSelectedAdditionals({});
      setNotes('');
    }
  }, [product]);

  // Lista dinâmica de adicionais vinculados à ficha técnica e ao catálogo
  const availableAdditionals = useMemo(() => {
    // Se o produto foi configurado explicitamente para não aceitar adicionais, retorna lista vazia
    if (product?.acceptsAddons === false) {
      return [];
    }

    const burgerRecipeIngredientIds = new Set((product?.recipe || []).map(r => r.ingredientId));
    const burgerRecipeIngredientNames = (product?.recipe || []).map(r => {
      const ing = items?.find(i => i.id === r.ingredientId);
      return ing?.name.toLowerCase().trim() || '';
    }).filter(Boolean);

    // Conjunto de IDs permitidos caso o produto tenha seleção restrita de adicionais
    const allowedIdsSet = (product?.allowedAddonIds && product.allowedAddonIds.length > 0)
      ? new Set(product.allowedAddonIds)
      : null;

    const candidateProducts = products.filter(p => {
      if (p.isActive === false) return false;
      if (p.id === product?.id) return false; // Não permitir adicionar o próprio produto a si mesmo

      // Se houver lista de adicionais permitidos, respeita estritamente
      if (allowedIdsSet) {
        return allowedIdsSet.has(p.id);
      }

      // Caso contrário, inclui porções, adicionais marcados explicitamente ou por nome
      return (
        p.isAddon === true ||
        p.category === 'porcao' ||
        p.name.startsWith('Adicional:') ||
        p.name.startsWith('Pote Maionese') ||
        p.name.toLowerCase().includes('adicional') ||
        p.name.toLowerCase().includes('extra')
      );
    });

    if (candidateProducts.length > 0) {
      const list = candidateProducts.map(p => {
        const price = saleChannel === 'ifood' ? (p.priceIfood || p.priceBalcao) : p.priceBalcao;
        const cleanName = p.name.replace(/^(Adicional|Porção|Extra):\s*/i, '').trim();

        const hasDirectIngredient = (p.recipe || []).some(r => burgerRecipeIngredientIds.has(r.ingredientId));
        const hasMatchingName = burgerRecipeIngredientNames.some(ingName => 
          cleanName.toLowerCase().includes(ingName) || ingName.includes(cleanName.toLowerCase())
        );
        const isFromRecipe = hasDirectIngredient || hasMatchingName;

        return {
          id: p.id,
          name: cleanName,
          price,
          isFromRecipe,
        };
      });

      return list.sort((a, b) => {
        if (a.isFromRecipe && !b.isFromRecipe) return -1;
        if (!a.isFromRecipe && b.isFromRecipe) return 1;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
    }

    // Se houver restrição por allowedAddonIds e nenhum produto foi encontrado, não usa fallback
    if (allowedIdsSet) {
      return [];
    }

    return FALLBACK_ADDITIONALS.map(fb => {
      const price = saleChannel === 'ifood' ? fb.priceIfood : fb.priceBalcao;
      const isFromRecipe = burgerRecipeIngredientNames.some(ingName => 
        fb.name.toLowerCase().includes(ingName) || ingName.includes(fb.name.toLowerCase())
      );
      return {
        id: fb.id,
        name: fb.name,
        price,
        isFromRecipe,
      };
    }).sort((a, b) => {
      if (a.isFromRecipe && !b.isFromRecipe) return -1;
      if (!a.isFromRecipe && b.isFromRecipe) return 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [product, products, items, saleChannel]);

  // Chips dinâmicos de observações gerados a partir da ficha técnica (SEM GÁS eliminado)
  const quickNotes = useMemo(() => {
    const meatPoints = ['AO PONTO', 'BEM PASSADO', 'AO PONTO P/ BEM'];
    const removalChips: string[] = [];
    let hasSalad = false;

    if (product?.recipe && product.recipe.length > 0 && items && items.length > 0) {
      product.recipe.forEach(r => {
        const ing = items.find(i => i.id === r.ingredientId);
        if (!ing) return;

        const rawName = ing.name.toUpperCase().trim();
        const cat = (ing.category || '').toUpperCase().trim();

        // 1. Filtrar utilidades, embalagens e operacionais não-alimentares (Elimina Gás, Energia, etc.)
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

        // 2. Filtrar base do lanche (pães e carnes base, cujo preparo já é coberto pelo ponto da carne)
        if (rawName.includes('PÃO') || rawName.includes('PAO')) return;
        if (rawName.startsWith('HAMBÚRGUER') || rawName.startsWith('HAMBURGUER') || rawName.startsWith('HAMB.')) {
          if (!rawName.includes('QUEIJO')) return;
        }

        // 3. Normalização limpa e padronizada para a cozinha
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
  }, [product, items]);

  const basePrice = useMemo(() => {
    if (!product) return 0;
    return saleChannel === 'ifood' ? product.priceIfood : product.priceBalcao;
  }, [product, saleChannel]);

  const comboPrice = useMemo(() => {
    return selectedComboObj?.price || 0;
  }, [selectedComboObj]);

  const additionalsPrice = useMemo(() => {
    return Object.entries(selectedAdditionals).reduce((acc, [name, qty]) => {
      if (qty <= 0) return acc;
      const add = availableAdditionals.find(a => a.name === name);
      return acc + ((add?.price || 0) * qty);
    }, 0);
  }, [selectedAdditionals, availableAdditionals]);

  const totalPrice = useMemo(() => {
    return basePrice + comboPrice + additionalsPrice;
  }, [basePrice, comboPrice, additionalsPrice]);

  if (!product) return null;

  const handleToggleNote = (chip: string) => {
    const meatPoints = ['AO PONTO', 'BEM PASSADO', 'AO PONTO P/ BEM'];
    let currentNotes = notes.toUpperCase();

    // Se for ponto da carne, substitui o ponto anterior
    if (meatPoints.includes(chip)) {
      meatPoints.forEach(mp => {
        const reg = new RegExp(`(^|,\\s*)${mp}(,\\s*|$)`, 'i');
        currentNotes = currentNotes.replace(reg, (_, p1, p2) => (p1 && p2 ? ', ' : '')).trim();
      });
      currentNotes = currentNotes.replace(/^,\s*|,\s*$/g, '');
      setNotes(currentNotes ? `${currentNotes}, ${chip}` : chip);
      return;
    }

    // Toggle para demais observações
    if (currentNotes.includes(chip)) {
      const reg = new RegExp(`(^|,\\s*)${chip}(,\\s*|$)`, 'i');
      const updated = currentNotes.replace(reg, (_, p1, p2) => (p1 && p2 ? ', ' : '')).trim();
      setNotes(updated.replace(/^,\s*|,\s*$/g, ''));
    } else {
      setNotes(currentNotes ? `${currentNotes}, ${chip}` : chip);
    }
  };

  const handleSave = () => {
    const additionalsList: { name: string; price: number }[] = [];
    Object.entries(selectedAdditionals).forEach(([name, qty]) => {
      if (qty > 0) {
        const item = availableAdditionals.find(a => a.name === name);
        const unitP = item ? item.price : 0;
        additionalsList.push({
          name: `${qty > 1 ? `${qty}x ` : ''}${name}`,
          price: unitP * qty,
        });
      }
    });

    const comboName = selectedComboObj ? selectedComboObj.rawName : undefined;

    const newItem: SaleItem = {
      id: Math.random().toString(36).substring(2, 9),
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: totalPrice,
      combo: comboName,
      comboPrice: comboPrice > 0 ? comboPrice : undefined,
      additionals: additionalsList,
      notes: notes.trim() ? notes.trim().toUpperCase() : undefined,
    };

    onConfirm(newItem);
  };

  return (
    <Dialog
      open={!!product}
      onClose={onClose}
      title={product.name}
      description={`Personalização de Hambúrguer • Preço Base: R$ ${basePrice.toFixed(2)}`}
      size="lg"
    >
      <div className="space-y-5 py-2">
        {/* Seção 1: Combos Promocionais */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            🍟 Selecionar Combo Promocional:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedComboId('none')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
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
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedComboId === c.id
                    ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
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

        {/* Seção 2: Adicionais e Ficha Técnica */}
        {product?.acceptsAddons !== false && availableAdditionals.length > 0 && (
          <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              🧀 Adicionais & Ficha Técnica:
            </h3>
            {availableAdditionals.some(a => a.isFromRecipe) && (
              <span className="text-[11px] text-amber-400/90 font-medium">
                ⭐ Insumos vinculados ao lanche
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
            {availableAdditionals.map(add => {
              const currentQty = selectedAdditionals[add.name] || 0;
              return (
                <div
                  key={add.name}
                  className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                    currentQty > 0
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-xs'
                      : add.isFromRecipe
                        ? 'bg-amber-950/20 border-amber-500/40 text-slate-200 hover:border-amber-500'
                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="mb-2">
                    <div className="flex items-start justify-between gap-1 mb-1">
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
                          onClick={() => setSelectedAdditionals(prev => ({ ...prev, [add.name]: Math.max(0, currentQty - 1) }))}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedAdditionals(prev => ({ ...prev, [add.name]: currentQty + 1 }))}
                        className="w-5 h-5 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Seção 3: Ponto da Carne e Observações */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare size={14} className="text-blue-400" /> Ponto da Carne & Observações de Cozinha:
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-32 overflow-y-auto pr-1">
            {quickNotes.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => handleToggleNote(chip)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer uppercase ${
                  notes.toUpperCase().includes(chip)
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
            value={notes}
            onChange={e => setNotes(e.target.value.toUpperCase())}
            placeholder="OUTRA OBSERVAÇÃO (EX: CARNE BEM TOSTADA...)"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs outline-none focus:border-amber-500 uppercase font-bold tracking-wide"
          />
        </div>

        {/* Rodapé do Modal com Preço Calculado e Ação */}
        <div className="pt-3 border-t border-slate-800 flex justify-between items-center gap-4">
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
              <Plus size={15} /> Adicionar ao Pedido
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
