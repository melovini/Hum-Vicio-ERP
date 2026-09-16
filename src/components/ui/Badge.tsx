import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  children: ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  neutral: 'border-status-neutral/25 bg-status-neutral/10 text-slate-300',
  success: 'border-status-success/25 bg-status-success/10 text-emerald-400',
  warning: 'border-status-warning/25 bg-status-warning/10 text-amber-400',
  danger: 'border-status-danger/25 bg-status-danger/10 text-red-400',
  info: 'border-status-info/25 bg-status-info/10 text-sky-400',
  brand: 'border-brand-primary/25 bg-brand-primary/10 text-orange-400',
};

const dots: Record<BadgeVariant, string> = {
  neutral: 'bg-status-neutral', success: 'bg-status-success', warning: 'bg-status-warning',
  danger: 'bg-status-danger', info: 'bg-status-info', brand: 'bg-brand-primary',
};

export function Badge({ variant = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', variants[variant], className)} {...props}>
      {dot && <span className={cn('size-1.5 rounded-full', dots[variant])} aria-hidden="true" />}
      {children}
    </span>
  );
}
