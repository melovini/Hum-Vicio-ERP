'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Dialog } from '@/components/ui';
import { Product, SaleItem } from '@/lib/store';
import { Plus, MessageSquare } from 'lucide-react';

interface PosBurgerCustomizerModalProps {
  product: Product | null;
  saleChannel: 'balcao' | 'ifood';
  onClose: () => void;
  onConfirm: (item: SaleItem) => void;
}

const AVAILABLE_ADDITIONALS = [
  { name: 'Bacon Fatiado Crocante', price: 5.00 },
  { name: 'Cheddar Cremoso Extra', price: 5.00 },
  { name: 'Queijo Prato Extra', price: 5.00 },
  { name: 'Cebola Caramelizada', price: 4.00 },
  { name: 'Picles Artesanal', price: 4.00 },
  { name: 'Maionese da Casa Extra', price: 3.50 },
  { name: 'Ovo Frito na Manteiga', price: 3.00 },
  { name: 'Geleia de Pimenta Defumada', price: 4.00 },
];

const QUICK_NOTES = [
  'AO PONTO', 'BEM PASSADO', 'AO PONTO P/ BEM', 
  'SEM CEBOLA', 'SEM SALADA', 'SEM MOLHO', 'MOLHO À PARTE'
];

export default function PosBurgerCustomizerModal({
  product,
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
      const add = AVAILABLE_ADDITIONALS.find(a => a.name === name);
      return acc + ((add?.price || 5) * qty);
    }, 0);
  }, [selectedAdditionals]);

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
        const item = AVAILABLE_ADDITIONALS.find(a => a.name === name);
        const unitP = item ? item.price : 5;
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

        {/* Seção 2: Adicionais */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            🧀 Adicionais Exclusivos:
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AVAILABLE_ADDITIONALS.map(add => {
              const currentQty = selectedAdditionals[add.name] || 0;
              return (
                <div
                  key={add.name}
                  className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                    currentQty > 0
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="mb-2">
                    <span className="text-xs font-semibold block leading-tight truncate">{add.name}</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">+ R$ {add.price.toFixed(2)}</span>
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
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {QUICK_NOTES.map(chip => (
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
            placeholder="OUTRA OBSERVAÇÃO (EX: SEM MOLHO, CARNE BEM TOSTADA...)"
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
