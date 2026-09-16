'use client';
import React, { useEffect } from 'react';
import { 
  X, HelpCircle, Keyboard, WifiOff, 
  Coins, UserCheck, Flame, GraduationCap, Check
} from 'lucide-react';
import { isTrainingModeActive, setTrainingModeActive } from '@/lib/training';

interface QuickHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: 'caixa' | 'cozinha';
}

export default function QuickHelpModal({ isOpen, onClose, context = 'caixa' }: QuickHelpModalProps) {
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

  const isTraining = isTrainingModeActive();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <HelpCircle size={26} />
            </div>
            <div>
              <h2 id="help-modal-title" className="text-lg md:text-xl font-black text-white uppercase tracking-wider">
                Ajuda Rápida & Guia Operacional
              </h2>
              <p className="text-xs text-slate-400">
                Instruções essenciais, atalhos de teclado e procedimentos de contingência.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            aria-label="Fechar guia de ajuda rápida"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 max-h-[70vh]">
          
          {/* Card de Modo Treinamento */}
          <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isTraining 
              ? 'bg-amber-950/40 border-amber-500 text-amber-100' 
              : 'bg-slate-950/60 border-slate-800 text-slate-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                <GraduationCap size={22} />
              </div>
              <div>
                <strong className="text-sm font-black uppercase text-white block">
                  {isTraining ? 'Você está no Modo Treinamento' : 'Deseja treinar sem alterar dados reais?'}
                </strong>
                <p className="text-xs text-slate-300">
                  {isTraining 
                    ? 'As vendas e movimentos atuais são de simulação (sandbox).' 
                    : 'Ative o Modo Treinamento para praticar vendas, troco e KDS com segurança total.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setTrainingModeActive(!isTraining);
                onClose();
              }}
              className={`px-4 py-2 min-h-[44px] rounded-xl font-black text-xs uppercase tracking-wider shrink-0 transition-all cursor-pointer shadow-md focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
                isTraining
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {isTraining ? 'Sair do Treinamento' : 'Ativar Modo Treinamento'}
            </button>
          </div>

          {/* Atalhos de Teclado */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Keyboard size={18} className="text-emerald-400" /> Atalhos Rápidos de Teclado
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                <span className="font-extrabold text-emerald-400 block uppercase">No Caixa / PDV:</span>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">Novo Pedido / Limpar</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-200 font-mono font-bold">F2</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">Fechar Janelas / Modais</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-200 font-mono font-bold">ESC</kbd>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-300">Confirmar Sucesso</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-200 font-mono font-bold">ENTER</kbd>
                </div>
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                <span className="font-extrabold text-amber-400 block uppercase">Na Cozinha (KDS):</span>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">Puxar p/ Chapa</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-200 font-mono font-bold">ESPAÇO</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">Concluir Lanche 1..9</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-200 font-mono font-bold">2x Número ou Enter</kbd>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-300">Alternar Abas</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-200 font-mono font-bold">T</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* O que fazer se a internet cair */}
          <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/40 space-y-2">
            <h3 className="text-sm font-black text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <WifiOff size={18} className="text-blue-400" /> O que fazer se a Internet Cair?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              O sistema Hum Vício possui <strong>Contingência Local Automática</strong>. Se o sinal de internet falhar:
            </p>
            <ul className="text-xs text-slate-300 space-y-1.5 pl-4 list-disc">
              <li><strong>Continue atendendo normalmente:</strong> os pedidos ficam guardados com total segurança na memória deste computador.</li>
              <li>Um badge amarelo <strong>&quot;📦 Salvo Localmente&quot;</strong> aparecerá no cabeçalho indicando a fila de pedidos pendentes.</li>
              <li>Assim que o sinal de rede retornar, a sincronização enviará todos os pedidos para o servidor central sem duplicar vendas ou estornos.</li>
            </ul>
          </div>

          {/* Dicas Operacionais de Atendimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <h4 className="font-extrabold text-amber-300 flex items-center gap-1.5 uppercase">
                <Coins size={16} /> Troco Rápido
              </h4>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Ao selecionar pagamento em <strong>Dinheiro</strong>, use os botões rápidos de cédulas (R$ 20, 50, 100, 200). O valor a devolver será exibido em destaque no rodapé e na confirmação da comanda.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <h4 className="font-extrabold text-emerald-300 flex items-center gap-1.5 uppercase">
                <UserCheck size={16} /> Troca de Operador
              </h4>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Durante a troca de turno de atendimento, selecione o seu nome no seletor de operador no topo da tela. As vendas passarão a ser registradas com o seu identificador sem fechar a sessão do caixa.
              </p>
            </div>
          </div>

        </div>

        {/* Rodapé */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
          >
            Entendido, Fechar Ajuda
          </button>
        </div>
      </div>
    </div>
  );
}
