'use client';
import { useState } from 'react';
import { useInventory } from '@/lib/store';
import { ChefHat, ArrowLeft, AlertTriangle, History, User, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function PerdasPage() {
  const { items, isLoaded, registerWaste, wasteRecords } = useInventory();
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('validade');
  const [responsibleName, setResponsibleName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isLoaded) return null;

  const selectedItemObj = items.find(i => i.id === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !quantity || !responsibleName.trim() || submitting) return;

    setSubmitting(true);
    setSuccessMsg('');

    const res = await registerWaste(
      selectedItemId, 
      Number(quantity), 
      reason, 
      responsibleName.trim()
    );

    setSubmitting(false);

    if (res.success) {
      setSuccessMsg(`Perda de ${quantity} ${selectedItemObj?.unit || ''} de ${selectedItemObj?.name} registrada e estoque abatido!`);
      setSelectedItemId('');
      setQuantity('');
      setResponsibleName('');
      setTimeout(() => setSuccessMsg(''), 6000);
    } else {
      alert(`Erro ao registrar perda: ${res.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <Link href="/cozinha" className="p-3 bg-slate-900 rounded-2xl hover:bg-slate-800 text-slate-400 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-2 flex items-center gap-3">
              <AlertTriangle className="text-amber-500" /> Controle de Perdas & Descarte
            </h1>
            <p className="text-slate-400 text-base">
              Registro oficial de quebra, validade e erros de preparo. Abate o estoque na hora e calcula o prejuízo.
            </p>
          </div>
        </header>

        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 font-semibold animate-fade-in">
            <CheckCircle2 size={24} className="flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Formulário de Registro de Perda */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <ChefHat size={22} className="text-amber-400" /> Lançar Descarte de Insumo
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-slate-300 font-bold mb-2">Qual insumo foi descartado?</label>
                <select 
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/60 rounded-2xl p-4 text-slate-200 outline-none focus:border-amber-500 text-base appearance-none"
                  required
                >
                  <option value="" disabled>Selecione o insumo do estoque...</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.category}) - Restam {i.currentStock} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-2">
                  Quantidade descartada {selectedItemObj ? `(em ${selectedItemObj.unit})` : ''}
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  required 
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/60 rounded-2xl py-4 px-5 text-white font-mono text-2xl outline-none focus:border-amber-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-2">Motivo do descarte</label>
                <select 
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/60 rounded-2xl p-4 text-slate-200 outline-none focus:border-amber-500 text-base appearance-none"
                >
                  <option value="queimou">Queimou / Erro de Chapa</option>
                  <option value="validade">Venceu a Validade</option>
                  <option value="caiu">Caiu no chão / Acidente</option>
                  <option value="qualidade">Baixa qualidade / Avaria do Fornecedor</option>
                  <option value="outro">Outro motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-2 flex items-center gap-2">
                  <User size={16} className="text-slate-400" /> Nome de quem está registrando
                </label>
                <input 
                  type="text" 
                  required 
                  value={responsibleName} 
                  onChange={e => setResponsibleName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/60 rounded-2xl p-4 text-white outline-none focus:border-amber-500"
                  placeholder="Ex: Carlos (Chapa)"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting || !selectedItemId || !quantity || !responsibleName.trim()}
                className="w-full mt-4 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-4 rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <AlertTriangle size={22} />
                {submitting ? 'Abatendo do Estoque...' : 'Confirmar Baixa por Perda'}
              </button>
            </form>
          </div>

          {/* Histórico Recente de Perdas */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg flex flex-col">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <History size={20} className="text-blue-400" /> Histórico Recente
            </h2>
            
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] pr-1">
              {wasteRecords.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-center p-4">
                  <p>Nenhuma perda registrada até o momento.</p>
                  <p className="text-xs text-slate-600 mt-1">Os descartes lançados aparecerão aqui.</p>
                </div>
              ) : (
                wasteRecords.slice(0, 10).map((record) => (
                  <div key={record.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-200 text-base">{record.ingredientName}</span>
                      <span className="font-mono text-amber-400 font-bold text-sm">
                        {record.quantity} {record.unit}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span className="capitalize text-slate-400 font-medium">Motivo: {record.reason}</span>
                      <span className="text-red-400 font-mono font-semibold">- R$ {record.totalLoss.toFixed(2)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
                      <span>Por: {record.responsibleName}</span>
                      <span>{new Date(record.createdAt).toLocaleDateString('pt-BR')} {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
