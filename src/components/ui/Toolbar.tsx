import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="toolbar"
      className={cn('flex flex-col gap-3 rounded-card border border-border-default bg-surface-card p-3 sm:flex-row sm:items-center sm:justify-between', className)}
      {...props}
    />
  );
}
