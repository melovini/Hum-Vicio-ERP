'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { Feedback, type FeedbackTone } from './Feedback';
import { IconButton } from './IconButton';
import { Button } from './Button';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: FeedbackTone;
  /** Zero mantém a mensagem visível até dispensa manual */
  duration?: number;
  /** Ação contextual opcional (ex: Tentar novamente, Desfazer) */
  action?: ToastAction;
}

type ToastRecord = ToastOptions & { id: number };

export interface ToastAPI {
  notify: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

function ToastItem({ toast, dismiss }: { toast: ToastRecord; dismiss: ToastAPI['dismiss'] }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const duration = toast.duration ?? (toast.tone === 'danger' ? 0 : 6000);

  useEffect(() => {
    if (duration <= 0 || hovered || focused) return;
    const timer = window.setTimeout(() => dismiss(toast.id), Math.max(6000, duration));
    return () => window.clearTimeout(timer);
  }, [duration, hovered, focused, dismiss, toast.id]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className="transition-all duration-200"
    >
      <Feedback
        tone={toast.tone}
        title={toast.title}
        className="bg-surface-card shadow-elevated"
        action={
          <div className="flex items-center gap-2">
            {toast.action && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2.5 text-xs font-semibold"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </Button>
            )}
            <IconButton
              label={`Dispensar: ${toast.title}`}
              icon={<X size={16} aria-hidden="true" />}
              onClick={() => dismiss(toast.id)}
            />
          </div>
        }
      >
        {toast.description}
      </Feedback>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const sequence = useRef(0);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;
  const pathname = usePathname();

  // Limpeza de notificações transitórias na troca de rota (preserva alertas de perigo/erro)
  useEffect(() => {
    setToasts((items) => items.filter((item) => item.tone === 'danger'));
  }, [pathname]);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const notify = useCallback((options: ToastOptions) => {
    // Deduplicação: evita rajadas de notificações idênticas seguidas
    const isDuplicate = toastsRef.current.some(
      (t) =>
        t.title === options.title &&
        t.description === options.description &&
        t.tone === options.tone
    );
    if (isDuplicate) {
      return -1;
    }

    const id = ++sequence.current;
    setToasts((items) => {
      const next = [...items, { ...options, id }];
      return next.slice(-3); // Fila máxima de 3 itens visíveis
    });
    return id;
  }, []);

  const api = useMemo(() => ({ notify, dismiss, clearAll }), [notify, dismiss, clearAll]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Notificações"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] max-h-[50dvh] space-y-2 overflow-y-auto sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => (
          <div className="pointer-events-auto" key={toast.id}>
            <ToastItem toast={toast} dismiss={dismiss} />
          </div>
        ))}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider.');
  return context;
}
