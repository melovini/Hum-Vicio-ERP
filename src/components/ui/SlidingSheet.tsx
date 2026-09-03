'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlidingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

export default function SlidingSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md'
}: SlidingSheetProps) {
  // Atalho de Teclado: Esc para fechar a gaveta
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass = 
    width === 'sm' ? 'max-w-sm' :
    width === 'lg' ? 'max-w-xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop translúcido sutil que mantém o salão/PDV visível ao fundo */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity animate-fade-in cursor-pointer"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className={`w-screen ${widthClass} bg-surface-card border-l border-surface-border shadow-2xl flex flex-col transform transition-transform duration-200 ease-out animate-in slide-in-from-right`}>
          
          {/* Cabeçalho da Gaveta */}
          <div className="p-5 border-b border-surface-border flex items-start justify-between bg-surface-card/90">
            <div className="space-y-0.5 pr-4">
              <h3 className="text-base font-bold text-slate-100 tracking-tight">{title}</h3>
              {description && (
                <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-surface-elevated transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Conteúdo com rolagem contida */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {children}
          </div>

          {/* Rodapé de Ações Fixo */}
          {footer && (
            <div className="p-4 border-t border-surface-border bg-surface-elevated/40">
              {footer}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
