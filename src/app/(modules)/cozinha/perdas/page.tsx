'use client';
import { useState } from 'react';
import { useInventory, InventoryItem } from '@/lib/store';
import { ChefHat, ArrowLeft, AlertTriangle, Send } from 'lucide-react';
import Link from 'next/link';

export default function PerdasPage() {
  const { items, isLoaded } = useInventory();
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('validade');

  if (!isLoaded) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItem && quantity) {
      alert(`Perda registrada com sucesso: ${quantity} do item ${selectedItem}. Motivo: ${reason}`);
      setSelectedItem('');
      setQuantity('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <Link href="/cozinha" className="p-3 bg-slate-900 rounded-2xl hover:bg-slate-800 text-slate-400 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-2 flex items-center gap-3">
               Controle de Perdas
            </h1>
            <p className="text-slate-500 text-lg">Registro de insumos descartados (Quebra, Validade, etc)</p>
          </div>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-slate-400 font-bold mb-3 text-lg">Qual insumo foi perdido?</label>
              <select 
                value={selectedItem}
                onChange={e => setSelectedItem(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/50 rounded-2xl p-6 text-slate-200 outline-none focus:border-amber-500 text-xl appearance-none"
                required
              >
                <option value="" disabled>Selecione o insumo...</option>
                {items.map(i => (
                  <option key={i.id} value={i.name}>{i.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-3 text-lg">Quantidade perdida</label>
              <input 
                type="number" step="0.01" required value={quantity} onChange={e => setQuantity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/50 rounded-2xl py-6 px-6 text-white font-mono text-3xl outline-none focus:border-amber-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-3 text-lg">Motivo do descarte</label>
              <select 
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/50 rounded-2xl p-6 text-slate-200 outline-none focus:border-amber-500 text-xl appearance-none"
              >
                <option value="validade">Passou da Validade</option>
                <option value="queimou">Queimou / Erro de preparo</option>
                <option value="caiu">Caiu no chão / Acidente</option>
                <option value="qualidade">Baixa qualidade do fornecedor</option>
              </select>
            </div>

            <button type="submit" className="w-full mt-4 bg-amber-600 hover:bg-amber-500 text-white py-6 rounded-2xl font-bold text-2xl shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all flex items-center justify-center gap-3">
              <AlertTriangle size={28} /> Confirmar Descarte
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
