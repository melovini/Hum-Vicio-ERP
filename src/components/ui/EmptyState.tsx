import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-card border border-dashed border-border-strong bg-surface-card px-6 py-10 text-center">
      {icon && <div className="mb-4 flex size-11 items-center justify-center rounded-card bg-surface-elevated text-text-muted">{icon}</div>}
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
