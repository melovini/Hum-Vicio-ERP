import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-24 w-full resize-y rounded-control border bg-surface-ground px-3 py-2 text-sm text-text-primary outline-none transition-[border-color,box-shadow]',
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
