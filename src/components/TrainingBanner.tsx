'use client';
import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, RefreshCw, LogOut, BookOpen, AlertTriangle 
} from 'lucide-react';
import { 
  isTrainingModeActive, setTrainingModeActive, resetTrainingSandbox 
} from '@/lib/training';

interface TrainingBannerProps {
  onOpenExercises?: () => void;
}

export default function TrainingBanner({ onOpenExercises }: TrainingBannerProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isTrainingModeActive());

    const handleModeChange = (e: any) => {
      setActive(Boolean(e.detail?.active));
    };

    window.addEventListener('hum_vicio_training_mode_changed', handleModeChange);
    return () => {
      window.removeEventListener('hum_vicio_training_mode_changed', handleModeChange);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-2.5 px-4 shadow-xl border-b-2 border-amber-300 z-50 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-white/20 rounded-xl shrink-0">
          <GraduationCap size={22} className="text-amber-100 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-xs md:text-sm tracking-wide uppercase bg-slate-950/40 px-2 py-0.5 rounded-md border border-white/20">
              MODO TREINAMENTO ATIVO
            </span>
            <span className="text-[11px] font-bold text-amber-100 hidden sm:inline">
              Ambiente Seguro (Sandbox)
            </span>
          </div>
          <p className="text-[11px] text-amber-100 font-medium">
            Nenhuma venda, estoque real, gaveta financeira ou nota fiscal será afetada.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {onOpenExercises && (
          <button
            type="button"
            onClick={onOpenExercises}
            className="px-3 py-1.5 min-h-[38px] bg-white text-slate-950 hover:bg-amber-100 font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            title="Ver catálogo de exercícios práticos de treinamento"
          >
            <BookOpen size={14} className="text-orange-600" />
            <span>Exercícios Práticos</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Deseja zerar os dados deste treinamento e reiniciar os testes?')) {
              resetTrainingSandbox();
            }
          }}
          className="px-3 py-1.5 min-h-[38px] bg-slate-950/40 hover:bg-slate-950/60 text-white font-bold text-xs rounded-xl border border-white/30 shadow-sm cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          title="Zera os pedidos de teste criados no ambiente de treino"
        >
          <RefreshCw size={13} />
          <span className="hidden sm:inline">Reiniciar Dados</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Deseja sair do Modo Treinamento e voltar para a Operação Real da Hamburgueria?')) {
              setTrainingModeActive(false);
            }
          }}
          className="px-3 py-1.5 min-h-[38px] bg-red-950/80 hover:bg-red-900 text-white font-black text-xs rounded-xl border border-red-400/50 shadow-md cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
          title="Retornar à operação real"
        >
          <LogOut size={13} />
          <span>Sair do Treino</span>
        </button>
      </div>
    </div>
  );
}
