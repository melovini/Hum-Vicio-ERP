'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface SlidingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}
export default function SlidingSheet({ isOpen, onClose, title, description, children, footer, width = 'md' }: SlidingSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!isOpen || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen]);
  const widthClass = width === 'sm' ? 'max-w-sm' : width === 'lg' ? 'max-w-xl' : 'max-w-md';
  return (
    <dialog ref={ref} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
      className={`fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full ${widthClass} border-l border-border-default bg-surface-card p-0 text-text-primary shadow-elevated backdrop:bg-black/60`}>
      {isOpen && <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border-default p-5">
          <div><h2 id={titleId} className="text-base font-semibold">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm text-text-muted">{description}</p>}</div>
          <IconButton label="Fechar painel (Esc)" icon={<X size={18} aria-hidden="true" />} onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="border-t border-border-default bg-surface-elevated/40 p-4">{footer}</footer>}
      </div>}
    </dialog>
  );
}
