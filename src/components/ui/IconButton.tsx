import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'md', className, type = 'button', ...props },
  ref,
) {
  const sizeClass = size === 'sm' ? 'size-9' : size === 'lg' ? 'size-12' : 'size-10';

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-control text-text-muted transition-colors',
        'hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50',
        sizeClass,
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
