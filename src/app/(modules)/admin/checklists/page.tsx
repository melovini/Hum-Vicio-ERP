'use client';
import { useInventory } from '@/lib/store';
import { ArrowLeft, CheckCircle, TrendingUp, User, LayoutList } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

export default function ChecklistsReportPage() {
  const { allChecklists, isLoaded } = useInventory();

  // Calcular ranking da equipe
  const stats = useMemo(() => {
    const counts: Record<string, { tasks: number; signs: number }> = {};

    allChecklists.forEach(check => {
      // Contar assinaturas gerais
      if (check.signedBy) {
        const name = check.signedBy.toUpperCase();
        if (!counts[name]) counts[name] = { tasks: 0, signs: 0 };
        counts[name].signs += 1;
      }
      
      // Contar tarefas individuais
      check.tasks.forEach(task => {
        if (task.checked && task.checkedBy) {
          const name = task.checkedBy.toUpperCase();
          if (!counts[name]) counts[name] = { tasks: 0, signs: 0 };
          counts[name].tasks += 1;
        }
      });
    });

    // Converter para array e ordenar pelo total de tarefas
    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.tasks - a.tasks);
  }, [allChecklists]);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center gap-6 mb-12">
          <Link href="/admin/dashboard" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
            <ArrowLeft size={24} className="text-slate-300" />
          </Link>
          <div>
            <div className="inline-flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <CheckCircle size={20} /> Módulo Gestão
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Relatório de Checklists</h1>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna da Esquerda: Gráfico / Ranking */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card rounded-3xl p-6 border-t-4 border-emerald-500">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="text-emerald-500" /> Produtividade da Equipe
              </h2>
              
              {stats.length === 0 ? (
                <p className="text-slate-500">Nenhum dado de checklist registrado ainda.</p>
              ) : (
                <div className="space-y-6">
                  {stats.map((stat, idx) => {
                    const maxTasks = Math.max(...stats.map(s => s.tasks)) || 1;
                    const widthPercent = (stat.tasks / maxTasks) * 100;
                    
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="font-bold text-slate-300 flex items-center gap-2">
                            <User size={16} className="text-slate-500" /> {stat.name}
                          </span>
                          <span className="text-sm font-bold text-emerald-400">{stat.tasks} tarefas</span>
                        </div>
                        {/* Barra do Gráfico */}
                        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          Assinaturas como Responsável Geral: <strong className="text-slate-300">{stat.signs}</strong>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Coluna da Direita: Histórico */}
          <div className="lg:col-span-2">
            <div className="glass-card rounded-3xl p-6 border border-slate-800">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <LayoutList className="text-blue-500" /> Histórico Diário (Últimos 15 dias)
              </h2>
              
              <div className="space-y-4">
                {allChecklists.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Nenhum checklist registrado.</p>
                ) : (
                  allChecklists.map(check => {
                    const totalTasks = check.tasks.length;
                    const completedTasks = check.tasks.filter(t => t.checked).length;
                    const isFullyCompleted = completedTasks === totalTasks;

                    return (
                      <div key={check.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 pb-4 border-b border-slate-800/50">
                          <div>
                            <h3 className="font-bold text-lg text-slate-200">
                              {new Date(check.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </h3>
                            <p className="text-sm text-slate-500">
                              Progresso: {completedTasks} de {totalTasks} tarefas concluídas
                            </p>
                          </div>
                          
                          <div className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
                            check.signedBy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}>
                            <CheckCircle size={16} />
                            {check.signedBy ? `Encerrado por: ${check.signedBy}` : 'Aguardando Encerramento'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {check.tasks.map(task => (
                            <div key={task.id} className="flex items-start gap-3">
                              {task.checked ? (
                                <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-700 mt-0.5 flex-shrink-0" />
                              )}
                              <div>
                                <p className={`text-sm ${task.checked ? 'text-slate-300' : 'text-slate-500'}`}>{task.label}</p>
                                {task.checked && task.checkedBy && (
                                  <p className="text-xs text-emerald-500/70">por {task.checkedBy}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
