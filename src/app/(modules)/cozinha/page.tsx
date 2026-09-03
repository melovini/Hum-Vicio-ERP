'use client';
import { useInventory, InventoryItem } from '@/lib/store';
import { ChefHat, AlertTriangle, CheckCircle, ArrowLeft, Trash2, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

export default function CozinhaPage() {
  const { items, updateStatus, isLoaded, checklist, toggleChecklistTask, signChecklist } = useInventory();

  if (!isLoaded) return null;

  // Agrupar itens por categoria
  const groupedItems = items.reduce((acc, item) => {
    let rawCat = (item.category || 'Geral').trim().toLowerCase();
    const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
    
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3 bg-slate-900 rounded-2xl hover:bg-slate-800 text-slate-400 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-1 flex items-center gap-3">
                <ChefHat className="text-amber-500" /> Operação Cozinha
              </h1>
              <p className="text-slate-500 text-sm">Sinalize rupturas, registre perdas de insumos e preencha o checklist diário.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/cozinha/perdas" 
              className="px-5 py-3 bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-red-600/10 cursor-pointer"
            >
              <Trash2 size={18} /> Lançar Perdas
            </Link>
            <LogoutButton />
          </div>
        </header>

        {Object.entries(groupedItems).map(([catName, catItems]) => (
          <div key={catName} className="mb-12">
            <h2 className="text-2xl font-bold text-slate-200 mb-6 px-2 border-l-4 border-amber-500 uppercase tracking-wider">{catName}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {catItems.map(item => (
                <div key={item.id} className={`p-6 rounded-3xl border transition-all ${
                  item.status === 'zerado' ? 'bg-red-500/10 border-red-500/30' :
                  item.status === 'acabando' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-200">{item.name}</h3>
                      <p className="text-slate-500 mt-1">Estoque atual: {item.currentStock} {item.unit}</p>
                    </div>
                    
                    {item.status !== 'ok' && (
                      <button 
                        onClick={() => updateStatus(item.id, 'ok')}
                        className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center gap-2"
                      >
                        <CheckCircle size={16} /> Desfazer Alerta
                      </button>
                    )}
                  </div>

                  {item.status === 'ok' ? (
                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          const qty = prompt(`Quantos ${item.unit} restam de ${item.name}?`);
                          if (qty !== null) updateStatus(item.id, 'acabando', Number(qty));
                        }}
                        className="flex-1 py-4 bg-amber-600/20 hover:bg-amber-500/30 text-amber-500 rounded-2xl font-bold border border-amber-500/20 transition-all flex justify-center items-center gap-2"
                      >
                        <AlertTriangle size={20} /> Acabando
                      </button>
                      <button 
                        onClick={() => updateStatus(item.id, 'zerado', 0)}
                        className="flex-1 py-4 bg-red-600/20 hover:bg-red-500/30 text-red-500 rounded-2xl font-bold border border-red-500/20 transition-all flex justify-center items-center gap-2"
                      >
                        Zerado!
                      </button>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold ${
                      item.status === 'zerado' ? 'bg-red-500 text-white' : 'bg-amber-500 text-amber-950'
                    }`}>
                      <AlertTriangle size={24} />
                      ALERTA ENVIADO À GESTÃO
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* --- CHECKLIST DIÁRIO --- */}
        <div className="mt-16 border-t-2 border-slate-800 pt-12 mb-20">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <CheckCircle className="text-emerald-500" /> Checklist de Encerramento
          </h2>
          <p className="text-slate-400 mb-8">Marque as tarefas verificadas ao final do expediente. Este documento ficará salvo por 15 dias.</p>
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-800">
              <span className="text-lg font-bold text-slate-300">
                Data Referência: {checklist?.date ? new Date(checklist.date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Hoje'}
              </span>
              {checklist?.signedBy && (
                <div className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-sm">
                  Encerrado por: {checklist.signedBy}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {checklist?.tasks.map(task => (
                <div key={task.id} className={`flex items-start md:items-center justify-between gap-4 p-5 rounded-2xl border transition-all ${
                  task.checked ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-950/50 border-slate-800'
                }`}>
                  <div className="flex items-start md:items-center gap-4 flex-1">
                    <button 
                      disabled={!!checklist.signedBy}
                      onClick={() => {
                        if (!task.checked) {
                          const name = prompt('Qual o seu nome para confirmar esta verificação?');
                          if (name?.trim()) toggleChecklistTask(task.id, name.trim());
                        } else {
                          // Uncheck (apenas se não estiver assinado)
                          toggleChecklistTask(task.id, '');
                        }
                      }}
                      className={`mt-1 md:mt-0 flex-shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                        task.checked 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : 'border-slate-600 text-transparent hover:border-emerald-500'
                      } ${checklist.signedBy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    >
                      <CheckCircle size={20} />
                    </button>
                    <div>
                      <p className={`font-bold text-lg ${task.checked ? 'text-slate-300' : 'text-slate-200'}`}>{task.label}</p>
                      {task.checked && (
                        <p className="text-sm text-emerald-500 mt-1">Verificado por: {task.checkedBy}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-800 flex justify-end">
              {!checklist?.signedBy ? (
                <button
                  onClick={() => {
                    const allChecked = checklist?.tasks.every(t => t.checked);
                    if (!allChecked) {
                      alert('Atenção: Nem todas as tarefas foram verificadas ainda!');
                    }
                    const name = prompt('Assinatura do Responsável do Dia (Seu Nome):');
                    if (name?.trim()) signChecklist(name.trim());
                  }}
                  className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all flex items-center gap-3"
                >
                  <CheckCircle size={24} /> Assinar e Encerrar Dia
                </button>
              ) : (
                <div className="px-8 py-4 bg-slate-800 text-slate-400 rounded-2xl font-bold text-lg flex items-center gap-3 cursor-not-allowed">
                  <CheckCircle size={24} /> Dia Encerrado Oficialmente
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
