import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, autoFocus, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      autoFocus={autoFocus}
      data-autofocus={autoFocus || undefined}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-10 w-full rounded-control border bg-surface-ground px-3 text-sm text-text-primary outline-none transition-[border-color,box-shadow]',
        'placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50',
        invalid
          ? 'border-status-danger focus:border-status-danger focus:ring-2 focus:ring-status-danger/20'
          : 'border-border-default hover:border-border-strong focus:border-border-focus focus:ring-2 focus:ring-brand-primary/20',
        className,
      )}
      {...props}
    />
  );
});
