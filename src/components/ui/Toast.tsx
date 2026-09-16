'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Feedback, type FeedbackTone } from './Feedback';
import { IconButton } from './IconButton';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: FeedbackTone;
  /** Zero keeps a message visible until dismissed. */
  duration?: number;
}
type ToastRecord = ToastOptions & { id: number };
interface ToastAPI { notify: (options: ToastOptions) => number; dismiss: (id: number) => void }
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
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <Feedback tone={toast.tone} title={toast.title} className="bg-surface-card shadow-elevated"
        action={<IconButton label={`Dispensar: ${toast.title}`} icon={<X size={16} aria-hidden="true" />} onClick={() => dismiss(toast.id)} />}>
        {toast.description}
      </Feedback>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const sequence = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const notify = useCallback((options: ToastOptions) => {
    const id = ++sequence.current;
    setToasts((items) => [...items, { ...options, id }]);
    return id;
  }, []);
  const api = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <section aria-label="Notificações" className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] max-h-[50dvh] space-y-2 overflow-y-auto sm:left-auto sm:w-96">
        {toasts.slice(0, 3).map((toast) => <div className="pointer-events-auto" key={toast.id}><ToastItem toast={toast} dismiss={dismiss} /></div>)}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider.');
  return context;
}
