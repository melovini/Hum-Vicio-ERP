import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, description, id, ...props },
  ref,
) {
  return (
    <label htmlFor={id} className={cn('group inline-flex items-start gap-2.5', props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
      <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <input ref={ref} id={id} type="checkbox" className="peer size-5 appearance-none rounded border border-border-strong bg-surface-ground checked:border-brand-primary checked:bg-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30" {...props} />
        <Check className="pointer-events-none absolute size-3.5 scale-75 text-white opacity-0 transition peer-checked:scale-100 peer-checked:opacity-100" strokeWidth={3} aria-hidden="true" />
      </span>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-text-secondary">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
});
