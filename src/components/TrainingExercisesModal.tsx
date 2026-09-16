'use client';
import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, Circle, BookOpen, 
  GraduationCap, ChevronRight, Award, Flame, ShoppingBag, Banknote
} from 'lucide-react';
import { 
  TrainingExercise, 
  getTrainingExercisesWithStatus, 
  toggleExerciseCompletion 
} from '@/lib/training';

interface TrainingExercisesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrainingExercisesModal({ isOpen, onClose }: TrainingExercisesModalProps) {
  const [exercises, setExercises] = useState<TrainingExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<TrainingExercise | null>(null);
  const [filterCategory, setFilterCategory] = useState<'todos' | 'caixa' | 'cozinha' | 'fechamento'>('todos');

  const loadExercises = () => {
    const list = getTrainingExercisesWithStatus();
    setExercises(list);
    if (!selectedExercise && list.length > 0) {
      setSelectedExercise(list[0]);
    } else if (selectedExercise) {
      const updated = list.find(e => e.id === selectedExercise.id);
      if (updated) setSelectedExercise(updated);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadExercises();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => loadExercises();
    window.addEventListener('hum_vicio_training_exercises_updated', handleUpdate);
    return () => window.removeEventListener('hum_vicio_training_exercises_updated', handleUpdate);
  }, []);

  // Fechar no Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = exercises.filter(e => {
    if (filterCategory === 'todos') return true;
    return e.category === filterCategory;
  });

  const completedCount = exercises.filter(e => e.completed).length;
  const progressPercent = Math.round((completedCount / (exercises.length || 1)) * 100);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-modal-title"
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <GraduationCap size={26} />
            </div>
            <div>
              <h2 id="training-modal-title" className="text-lg md:text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                Central de Treinamento Operacional
              </h2>
              <p className="text-xs text-slate-400">
                Exercícios práticos guiados para capacitação da equipe sem risco à operação real.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
            aria-label="Fechar painel de exercícios"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Progresso Geral */}
        <div className="p-4 px-6 bg-slate-950/40 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Award size={20} className="text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-black text-white uppercase">Seu Progresso de Aprendizado:</span>
              <span className="text-xs text-amber-300 font-bold ml-2">
                {completedCount} de {exercises.length} concluídos ({progressPercent}%)
              </span>
            </div>
          </div>

          <div className="w-full sm:w-64 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
            <div 
              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Corpo: Lista de Exercícios à esquerda e Detalhes à direita */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          
          {/* Coluna Esquerda: Filtros e Lista */}
          <div className="md:col-span-5 p-4 overflow-y-auto space-y-3 max-h-[60vh] md:max-h-[65vh]">
            {/* Filtros */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterCategory('todos')}
                className={`py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  filterCategory === 'todos' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('caixa')}
                className={`py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  filterCategory === 'caixa' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Caixa
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('cozinha')}
                className={`py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  filterCategory === 'cozinha' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cozinha
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('fechamento')}
                className={`py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  filterCategory === 'fechamento' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Fechamento
              </button>
            </div>

            {/* Itens da Lista */}
            <div className="space-y-2">
              {filtered.map(ex => {
                const isSelected = selectedExercise?.id === ex.id;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setSelectedExercise(ex)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 min-h-[54px] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExerciseCompletion(ex.id);
                        }}
                        className="p-1 text-slate-400 hover:text-white cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
                        title={ex.completed ? 'Marcar como não concluído' : 'Marcar como concluído'}
                      >
                        {ex.completed ? (
                          <CheckCircle2 size={20} className="text-emerald-400" />
                        ) : (
                          <Circle size={20} className="text-slate-600" />
                        )}
                      </button>
                      <div>
                        <span className={`font-black text-xs leading-snug block ${ex.completed ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                          {ex.title}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                            ex.category === 'caixa' 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                              : ex.category === 'cozinha' 
                                ? 'bg-orange-950 text-orange-300 border border-orange-800' 
                                : 'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}>
                            {ex.category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">
                            • {ex.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className={`shrink-0 mt-2 ${isSelected ? 'text-amber-400' : 'text-slate-600'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna Direita: Detalhes do Exercício Selecionado */}
          <div className="md:col-span-7 p-6 overflow-y-auto space-y-5 max-h-[60vh] md:max-h-[65vh]">
            {selectedExercise ? (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                      Exercício {selectedExercise.category.toUpperCase()} • Nível {selectedExercise.difficulty.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExerciseCompletion(selectedExercise.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer min-h-[38px] transition-all border ${
                        selectedExercise.completed
                          ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {selectedExercise.completed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} />}
                      <span>{selectedExercise.completed ? 'Concluído' : 'Marcar como Concluído'}</span>
                    </button>
                  </div>

                  <h3 className="text-xl font-black text-white mt-2">
                    {selectedExercise.title}
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    {selectedExercise.description}
                  </p>
                </div>

                {/* Objetivo */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-xs font-black text-amber-400 uppercase block mb-1">
                    🎯 Objetivo Prático:
                  </span>
                  <p className="text-xs text-slate-200">
                    {selectedExercise.objective}
                  </p>
                </div>

                {/* Passo a Passo Guiado */}
                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-300 uppercase block">
                    📋 Passo a Passo para Praticar:
                  </span>
                  <ol className="space-y-2.5">
                    {selectedExercise.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-200">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-black flex items-center justify-center shrink-0 text-[11px]">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Resultado Esperado */}
                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40">
                  <span className="text-xs font-black text-emerald-400 uppercase block mb-1">
                    ✓ Resultado Esperado:
                  </span>
                  <p className="text-xs text-emerald-200 font-medium">
                    {selectedExercise.expectedOutcome}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500">
                <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecione um exercício ao lado para visualizar o guia passo a passo.</p>
              </div>
            )}
          </div>

        </div>

        {/* Rodapé */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Dica: você pode alternar entre Caixa e Cozinha para treinar o fluxo completo do pedido.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
          >
            Fechar e Praticar
          </button>
        </div>
      </div>
    </div>
  );
}
