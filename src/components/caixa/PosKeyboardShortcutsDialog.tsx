'use client';
import React from 'react';
import { Dialog } from '@/components/ui';
import { Keyboard, Zap } from 'lucide-react';

interface PosKeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'F1', desc: 'Abrir / fechar este guia de atalhos rápidos' },
  { key: 'F2', desc: 'Focar instantaneamente na busca de produtos' },
  { key: 'F4', desc: 'Finalizar comanda e concluir checkout' },
  { key: 'F8', desc: 'Selecionar pagamento em Dinheiro' },
  { key: 'F9', desc: 'Selecionar pagamento via PIX' },
  { key: 'F10', desc: 'Selecionar Cartão de Débito' },
  { key: 'F11', desc: 'Selecionar Cartão de Crédito' },
  { key: 'Alt + N', desc: 'Abrir novo atendimento paralelo no balcão' },
  { key: 'Alt + L', desc: 'Limpar todos os itens da comanda atual' },
  { key: 'Alt + H', desc: 'Abrir janela de módulos e retorno à raiz do sistema' },
  { key: 'Esc', desc: 'Fechar modais, cancelar busca ou retornar o foco' },
];

export default function PosKeyboardShortcutsDialog({ isOpen, onClose }: PosKeyboardShortcutsDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Atalhos de Teclado — Operação Ágil de Caixa"
      description="Teclas de atalho para operar o PDV com velocidade máxima sem depender exclusivamente do mouse."
      size="md"
    >
      <div className="space-y-3 py-2">
        <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl flex items-center gap-2.5 text-xs text-blue-200">
          <Zap size={16} className="text-amber-400 shrink-0" />
          <span>Dica operacional: Os atalhos funcionam em qualquer tela do PDV, acelerando horários de pico.</span>
        </div>

        <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          {SHORTCUTS.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-900/50 transition-colors">
              <span className="text-xs text-slate-300 font-medium">{s.desc}</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-black bg-slate-800 text-amber-300 border border-slate-700 rounded-lg shadow-inner">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Entendido (Esc)
          </button>
        </div>
      </div>
    </Dialog>
  );
}
