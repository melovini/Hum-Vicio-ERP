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
  const [selectedCombo, setSelectedCombo] = useState<'none' | 'batata_bebida' | 'aneis_bebida'>('none');
  const [selectedAdditionals, setSelectedAdditionals] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  // Resetar estado quando abrir novo produto
  useEffect(() => {
    if (product) {
      setSelectedCombo('none');
      setSelectedAdditionals({});
      setNotes('');
    }
  }, [product]);

  // Lista dinâmica de adicionais vinculados à ficha técnica e ao catálogo
  const availableAdditionals = useMemo(() => {
    const burgerRecipeIngredientIds = new Set((product?.recipe || []).map(r => r.ingredientId));
    const burgerRecipeIngredientNames = (product?.recipe || []).map(r => {
      const ing = items?.find(i => i.id === r.ingredientId);
      return ing?.name.toLowerCase().trim() || '';
    }).filter(Boolean);

    const candidateProducts = products.filter(p => 
      p.isActive !== false && (
        p.category === 'porcao' ||
        p.name.startsWith('Adicional:') ||
        p.name.startsWith('Pote Maionese') ||
        p.name.toLowerCase().includes('adicional') ||
        p.name.toLowerCase().includes('extra')
      )
    );

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

  // Chips dinâmicos de observações gerados a partir da ficha técnica
  const quickNotes = useMemo(() => {
    const meatPoints = ['AO PONTO', 'BEM PASSADO', 'AO PONTO P/ BEM'];
    const removalChips: string[] = [];

    if (product?.recipe && product.recipe.length > 0 && items && items.length > 0) {
      product.recipe.forEach(r => {
        const ing = items.find(i => i.id === r.ingredientId);
        if (ing) {
          const upper = ing.name.toUpperCase().trim();
          if (!upper.includes('PÃO') && !upper.includes('EMBALAGEM') && !upper.includes('SACO')) {
            removalChips.push(`SEM ${upper}`);
          }
        }
      });
    }

    if (removalChips.length === 0) {
      removalChips.push('SEM CEBOLA', 'SEM SALADA', 'SEM MOLHO');
    }

    return [...meatPoints, ...removalChips, 'MOLHO À PARTE'];
  }, [product, items]);

  const basePrice = useMemo(() => {
    if (!product) return 0;
    return saleChannel === 'ifood' ? product.priceIfood : product.priceBalcao;
  }, [product, saleChannel]);

  const comboPrice = useMemo(() => {
    if (selectedCombo === 'batata_bebida') return saleChannel === 'ifood' ? 18.00 : 15.00;
    if (selectedCombo === 'aneis_bebida') return saleChannel === 'ifood' ? 22.00 : 18.00;
    return 0;
  }, [selectedCombo, saleChannel]);

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
    const upper = notes.toUpperCase();
    if (upper.includes(chip)) {
      setNotes(upper.replace(chip, '').replace(/\s{2,}/g, ' ').trim());
    } else {
      setNotes(upper ? `${upper}, ${chip}` : chip);
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

    const comboName = selectedCombo === 'batata_bebida'
      ? 'Combo Batata e Bebida'
      : selectedCombo === 'aneis_bebida'
        ? 'Combo Anéis de Cebola e Bebida'
        : undefined;

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
              onClick={() => setSelectedCombo('none')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedCombo === 'none'
                  ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="block text-xs font-bold">Sem Combo</span>
              <span className="text-[11px] text-slate-500 font-mono">+ R$ 0,00</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCombo('batata_bebida')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedCombo === 'batata_bebida'
                  ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="block text-xs font-bold">🍟 Batata + Bebida</span>
              <span className="text-[11px] text-amber-400 font-mono font-bold">
                + R$ {(saleChannel === 'ifood' ? 18 : 15).toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCombo('aneis_bebida')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedCombo === 'aneis_bebida'
                  ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="block text-xs font-bold">🧅 Anéis + Bebida</span>
              <span className="text-[11px] text-amber-400 font-mono font-bold">
                + R$ {(saleChannel === 'ifood' ? 22 : 18).toFixed(2)}
              </span>
            </button>
          </div>
        </div>

        {/* Seção 2: Adicionais e Ficha Técnica */}
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
