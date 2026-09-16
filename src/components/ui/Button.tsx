import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-active',
  secondary: 'border border-border-default bg-action-secondary text-text-primary hover:border-border-strong hover:bg-action-secondary-hover',
  ghost: 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
  danger: 'bg-status-danger text-white hover:bg-red-600 active:bg-red-700',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', leadingIcon, trailingIcon, loading = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-150',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});
