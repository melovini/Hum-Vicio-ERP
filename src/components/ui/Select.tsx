import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid = false, children, ...props },
  ref,
) {
  return (
    <span className="relative block">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'min-h-10 w-full appearance-none rounded-control border bg-surface-ground py-2 pl-3 pr-9 text-sm text-text-primary outline-none transition-[border-color,box-shadow]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid
            ? 'border-status-danger focus:border-status-danger focus:ring-2 focus:ring-status-danger/20'
            : 'border-border-default hover:border-border-strong focus:border-border-focus focus:ring-2 focus:ring-brand-primary/20',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
    </span>
  );
});
