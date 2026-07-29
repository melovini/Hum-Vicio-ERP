'use client';
import { useState } from 'react';
import { useInventory, Product, RecipeIngredient } from '@/lib/store';
import { ChefHat, ArrowLeft, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import Link from 'next/link';

export default function EngenhariaCardapioPage() {
  const { items, products, addProduct, updateProduct, removeProduct, getProductCmv, isLoaded } = useInventory();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'lanche'|'bebida'|'porcao'|'combo'>('lanche');
  const [priceBalcao, setPriceBalcao] = useState('');
  const [priceIfood, setPriceIfood] = useState('');
  
  // Recipe State
  const [recipe, setRecipe] = useState<RecipeIngredient[]>([]);
  const [selectedIngId, setSelectedIngId] = useState('');
  const [ingQuantity, setIngQuantity] = useState('');

  if (!isLoaded) return null;

  const resetForm = () => {
    setName(''); setCategory('lanche'); setPriceBalcao(''); setPriceIfood('');
    setRecipe([]); setSelectedIngId(''); setIngQuantity('');
    setIsAdding(false); setEditingId(null);
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

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-blue-400 font-bold mb-1">
                <ChefHat size={20} /> Módulo Gestão
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Produtos e Ficha Técnica</h1>
            </div>
          </div>
          <button 
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
          >
            <Plus size={20} /> Novo Produto
          </button>
        </header>

        {isAdding && (
          <div className="glass-card rounded-3xl p-8 mb-8 border-t-4 border-blue-500">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingId ? 'Editar Produto e Ficha Técnica' : 'Criar Novo Produto'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 font-bold mb-2">Nome do Produto</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Bacon Smash" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 font-bold mb-2">Preço Balcão (R$)</label>
                <input type="number" step="0.01" value={priceBalcao} onChange={e=>setPriceBalcao(e.target.value)} placeholder="0.00" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 font-bold mb-2">Preço iFood (R$)</label>
                <input type="number" step="0.01" value={priceIfood} onChange={e=>setPriceIfood(e.target.value)} placeholder="0.00" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="border border-slate-800 rounded-2xl p-6 bg-slate-950/50 mb-8">
              <h3 className="text-lg font-bold text-slate-300 mb-4">Montagem da Receita (Ficha Técnica)</h3>
              <div className="flex gap-4 mb-4">
                <select value={selectedIngId} onChange={e=>setSelectedIngId(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700/50 rounded-xl p-3 text-slate-200 outline-none">
                  <option value="" disabled>Escolha um insumo...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} (R$ {i.costPerUnit}/{i.unit})</option>)}
                </select>
                <input type="number" step="0.001" value={ingQuantity} onChange={e=>setIngQuantity(e.target.value)} placeholder="Qtd" className="w-32 bg-slate-900 border border-slate-700/50 rounded-xl p-3 text-white outline-none" />
                <button onClick={addIngredientToRecipe} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl font-bold"><Plus size={20}/></button>
              </div>

              <div className="space-y-2">
                {recipe.map((r, idx) => {
                  const ing = items.find(i => i.id === r.ingredientId);
                  if(!ing) return null;
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-300">{ing.name} <span className="text-slate-500">({r.quantity} {ing.unit})</span></span>
                      <div className="flex gap-4 items-center">
                        <span className="text-emerald-400 font-mono text-sm">R$ {(r.quantity * ing.costPerUnit).toFixed(2)}</span>
                        <button onClick={() => removeIngredientFromRecipe(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="font-bold text-slate-400">CMV Total da Receita:</span>
                <span className="font-mono text-xl font-bold text-amber-400">R$ {getProductCmv(recipe).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-4 justify-end">
              <button onClick={resetForm} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2">
                <X size={20} /> Cancelar
              </button>
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2">
                <Check size={20} /> Salvar Produto
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => {
            const cmv = getProductCmv(p.recipe);
            const margin = p.priceBalcao > 0 ? ((p.priceBalcao - cmv) / p.priceBalcao) * 100 : 0;
            return (
              <div key={p.id} className="glass-card rounded-3xl p-6 border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(p)} className="text-slate-400 hover:text-blue-400"><Edit2 size={18}/></button>
                    <button onClick={() => removeProduct(p.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={18}/></button>
                  </div>
                </div>
                
                <div className="space-y-2 mb-6 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Balcão:</span>
                    <span className="font-mono text-slate-200">R$ {p.priceBalcao.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">iFood:</span>
                    <span className="font-mono text-slate-200">R$ {p.priceIfood.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-800">
                    <span className="text-slate-500 font-bold">Custo (CMV):</span>
                    <span className="font-mono text-amber-400 font-bold">R$ {cmv.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-bold">Margem (Balcão):</span>
                    <span className={`font-mono font-bold ${margin >= 40 ? 'text-emerald-400' : 'text-red-400'}`}>{margin.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="bg-slate-950/50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-bold mb-2">Ingredientes ({p.recipe.length}):</p>
                  <p className="text-xs text-slate-400 truncate">
                    {p.recipe.length === 0 ? 'Sem receita' : p.recipe.map(r => items.find(i=>i.id===r.ingredientId)?.name).filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
