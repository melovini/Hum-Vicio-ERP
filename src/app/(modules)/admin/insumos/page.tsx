'use client';
import { useState } from 'react';
import { useInventory, InventoryItem } from '@/lib/store';
import { ArrowLeft, Database, Plus, Trash2, Edit2, Check, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function GestaoInsumosPage() {
  const { items, addInventoryItem, updateInventoryItem, removeInventoryItem, isLoaded } = useInventory();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Geral');
  const [unit, setUnit] = useState('kg');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');

  if (!isLoaded) return null;

  const resetForm = () => {
    setName(''); setCategory('Geral'); setUnit('kg'); setCost(''); setStock(''); setMinStock('');
    setIsAdding(false); setEditingId(null);
  };

  const handleSave = () => {
    if (!name || !cost || !stock || !category) return;
    
    const minStockNum = minStock.trim() ? Number(minStock) : undefined;

    if (editingId) {
      updateInventoryItem(editingId, {
        name, category, unit, 
        costPerUnit: Number(cost), 
        currentStock: Number(stock),
        minStock: minStockNum
      });
    } else {
      addInventoryItem({
        name, category, unit, 
        costPerUnit: Number(cost), 
        currentStock: Number(stock),
        status: 'ok',
        minStock: minStockNum
      });
    }
    resetForm();
  };

  const startEdit = (item: InventoryItem) => {
    setName(item.name);
    setCategory(item.category || 'Geral');
    setUnit(item.unit);
    setCost(item.costPerUnit.toString());
    setStock(item.currentStock.toString());
    setMinStock(item.minStock !== undefined ? item.minStock.toString() : '');
    setEditingId(item.id);
    setIsAdding(true);
  };

  // Quantidade de itens em ponto de reposição
  const lowStockCount = items.filter(i => i.isActive !== false && (i.minStock || 0) > 0 && i.currentStock <= (i.minStock || 0)).length;

  // Agrupar itens por categoria com ordenação alfabética rigorosa
  const displayedItems = [...items]
    .filter(i => showInactive ? true : i.isActive !== false)
    .filter(i => filterLowStock ? ((i.minStock || 0) > 0 && i.currentStock <= (i.minStock || 0)) : true)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  const groupedItems = displayedItems.reduce((acc, item) => {
    let rawCat = (item.category || 'Geral').trim().toLowerCase();
    const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
    
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

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
                <Database size={20} /> Módulo Gestão
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Cadastro de Insumos</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`px-4 py-3 rounded-xl font-bold text-xs transition-all border cursor-pointer flex items-center gap-1.5 ${
                filterLowStock 
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-xs' 
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Filtrar itens que atingiram ou estão abaixo do estoque mínimo"
            >
              <AlertTriangle size={14} className={lowStockCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400'} />
              <span>Ponto de Reposição</span>
              {lowStockCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white font-mono text-[10px] rounded-full font-black">
                  {lowStockCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowInactive(!showInactive)}
              className={`px-4 py-3 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                showInactive 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {showInactive ? '👁️ Ocultar Desativados' : '👁️ Ver Desativados'}
            </button>
            <button 
              onClick={() => { resetForm(); setIsAdding(true); }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] cursor-pointer"
            >
              <Plus size={20} /> Novo Insumo
            </button>
          </div>
        </header>

        {isAdding && (
          <div className="glass-card rounded-3xl p-8 mb-8 border-t-4 border-blue-500">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingId ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <label className="block text-sm text-slate-400 font-bold mb-2">Nome do Insumo *</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Queijo Cheddar Fatiado" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 font-bold mb-2">Categoria</label>
                <input type="text" value={category} onChange={e=>setCategory(e.target.value)} placeholder="Ex: Queijos" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 font-bold mb-2">Unidade</label>
                <select value={unit} onChange={e=>setUnit(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500 appearance-none">
                  <option value="kg">Quilo (kg)</option>
                  <option value="g">Grama (g)</option>
                  <option value="un">Unidade (un)</option>
                  <option value="L">Litro (L)</option>
                  <option value="ml">Mililitro (ml)</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-slate-400 font-bold mb-2">Custo</label>
                <input type="number" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} placeholder="0.00" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-slate-400 font-bold mb-2">Estoque</label>
                <input type="number" step="0.01" value={stock} onChange={e=>setStock(e.target.value)} placeholder="0" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-amber-400 font-bold mb-2 flex items-center gap-1">
                  ⚠️ Ponto Reposição
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={minStock} 
                  onChange={e=>setMinStock(e.target.value)} 
                  placeholder="Estoque mín." 
                  className="w-full bg-slate-950/50 border border-amber-500/40 rounded-2xl p-4 text-white outline-none focus:border-amber-400" 
                  title="Alerta automático quando o estoque atingir ou for menor que este nível"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-6 justify-end">
              <button onClick={resetForm} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer">
                <X size={20} /> Cancelar
              </button>
              <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md">
                <Check size={20} /> Salvar Insumo
              </button>
            </div>
          </div>
        )}

        {Object.entries(groupedItems).map(([catName, catItems]) => (
          <div key={catName} className="mb-8">
            <h2 className="text-2xl font-bold text-slate-200 mb-4 px-2 border-l-4 border-blue-500">{catName}</h2>
            <div className="glass-card rounded-3xl overflow-hidden border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="p-4 font-bold">Nome</th>
                    <th className="p-4 font-bold">Custo Unitário</th>
                    <th className="p-4 font-bold">Estoque Atual</th>
                    <th className="p-4 font-bold">Ponto Reposição</th>
                    <th className="p-4 font-bold text-center">Status</th>
                    <th className="p-4 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {catItems.map(item => {
                    const isLowStock = item.isActive !== false && (item.minStock || 0) > 0 && item.currentStock <= (item.minStock || 0);

                    return (
                      <tr key={item.id} className={`hover:bg-slate-800/20 transition-colors ${item.isActive === false ? 'opacity-60 bg-red-950/15' : ''}`}>
                        <td className="p-4 font-bold text-slate-200">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            {item.isActive === false && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                                Desativado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-emerald-400">R$ {item.costPerUnit.toFixed(2)} / {item.unit}</td>
                        <td className="p-4 font-mono">
                          <span className={isLowStock ? 'text-red-400 font-bold' : 'text-blue-400'}>
                            {item.currentStock} {item.unit}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">
                          {item.minStock && item.minStock > 0 ? (
                            <span className="text-amber-300 font-bold">{item.minStock} {item.unit}</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold animate-pulse">
                              <AlertTriangle size={12} /> Repor Estoque
                            </span>
                          ) : item.minStock && item.minStock > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                              <Check size={12} /> Adequado
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-4 flex justify-end gap-2">
                          {item.isActive === false ? (
                            <button
                              type="button"
                              onClick={() => updateInventoryItem(item.id, { isActive: true })}
                              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="Reativar Insumo"
                            >
                              Reativar
                            </button>
                          ) : (
                            <>
                              <button onClick={() => startEdit(item)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer" title="Editar Insumo">
                                <Edit2 size={18} />
                              </button>
                              <button onClick={() => removeInventoryItem(item.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer" title="Desativar Insumo">
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="p-8 text-center text-slate-500 glass-card rounded-3xl border border-slate-800">Nenhum insumo cadastrado.</div>
        )}
      </div>
    </div>
  );
}
