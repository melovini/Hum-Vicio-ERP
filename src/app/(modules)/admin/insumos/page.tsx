'use client';
import { useState } from 'react';
import { useInventory, InventoryItem } from '@/lib/store';
import { ArrowLeft, Database, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import Link from 'next/link';

export default function GestaoInsumosPage() {
  const { items, addInventoryItem, updateInventoryItem, removeInventoryItem, isLoaded } = useInventory();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Geral');
  const [unit, setUnit] = useState('kg');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');

  if (!isLoaded) return null;

  const resetForm = () => {
    setName(''); setCategory('Geral'); setUnit('kg'); setCost(''); setStock('');
    setIsAdding(false); setEditingId(null);
  };

  const handleSave = () => {
    if (!name || !cost || !stock || !category) return;
    
    if (editingId) {
      updateInventoryItem(editingId, {
        name, category, unit, 
        costPerUnit: Number(cost), 
        currentStock: Number(stock)
      });
    } else {
      addInventoryItem({
        name, category, unit, 
        costPerUnit: Number(cost), 
        currentStock: Number(stock),
        status: 'ok'
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
    setEditingId(item.id);
    setIsAdding(true);
  };

  // Agrupar itens por categoria
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'Geral';
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
          <button 
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
          >
            <Plus size={20} /> Novo Insumo
          </button>
        </header>

        {isAdding && (
          <div className="glass-card rounded-3xl p-8 mb-8 border-t-4 border-blue-500">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingId ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 font-bold mb-2">Nome do Insumo</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Queijo Cheddar" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-slate-400 font-bold mb-2">Categoria</label>
                <input type="text" value={category} onChange={e=>setCategory(e.target.value)} placeholder="Ex: Carnes" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 font-bold mb-2">Unidade</label>
                <select value={unit} onChange={e=>setUnit(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500 appearance-none">
                  <option value="kg">Quilo (kg)</option>
                  <option value="g">Grama (g)</option>
                  <option value="un">Unidade (un)</option>
                  <option value="L">Litro (L)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 font-bold mb-2">Custo (R$)</label>
                <input type="number" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} placeholder="0.00" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 font-bold mb-2">Estoque Inic.</label>
                <input type="number" step="0.01" value={stock} onChange={e=>setStock(e.target.value)} placeholder="0" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-white outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-4 mt-6 justify-end">
              <button onClick={resetForm} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2">
                <X size={20} /> Cancelar
              </button>
              <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2">
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
                  <tr className="bg-slate-900/80 border-b border-slate-800">
                    <th className="p-4 text-slate-400 font-bold">Nome</th>
                    <th className="p-4 text-slate-400 font-bold">Custo Unitário</th>
                    <th className="p-4 text-slate-400 font-bold">Estoque Atual</th>
                    <th className="p-4 text-slate-400 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {catItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 font-bold text-slate-200">{item.name}</td>
                      <td className="p-4 font-mono text-emerald-400">R$ {item.costPerUnit.toFixed(2)} / {item.unit}</td>
                      <td className="p-4 font-mono text-blue-400">{item.currentStock} {item.unit}</td>
                      <td className="p-4 flex justify-end gap-2">
                        <button onClick={() => startEdit(item)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => removeInventoryItem(item.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
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
