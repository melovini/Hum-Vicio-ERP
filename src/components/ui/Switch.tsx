import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, description, id, ...props },
  ref,
) {
  return (
    <label htmlFor={id} className={cn('flex items-start justify-between gap-4', props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
      <span>
        <span className="block text-sm font-medium text-text-secondary">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-text-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input ref={ref} id={id} type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span className="h-6 w-11 rounded-full border border-border-strong bg-surface-elevated transition-colors peer-checked:border-brand-primary peer-checked:bg-brand-primary peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/30" />
        <span className="pointer-events-none absolute left-1 top-1 size-4 rounded-full bg-text-muted shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:bg-white" />
      </span>
    </label>
  );
});
