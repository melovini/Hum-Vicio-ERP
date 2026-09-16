import type { HTMLAttributes, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

export type FeedbackTone = 'success' | 'warning' | 'danger' | 'info';

interface FeedbackProps extends HTMLAttributes<HTMLDivElement> {
  tone?: FeedbackTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

const config = {
  success: { icon: CheckCircle2, classes: 'border-status-success/25 bg-status-success/10 text-emerald-400' },
  warning: { icon: TriangleAlert, classes: 'border-status-warning/25 bg-status-warning/10 text-amber-400' },
  danger: { icon: AlertCircle, classes: 'border-status-danger/25 bg-status-danger/10 text-red-400' },
  info: { icon: Info, classes: 'border-status-info/25 bg-status-info/10 text-sky-400' },
} satisfies Record<FeedbackTone, { icon: typeof Info; classes: string }>;

export function Feedback({ tone = 'info', title, children, action, className, ...props }: FeedbackProps) {
  const Icon = config[tone].icon;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-card border p-4', config[tone].classes, className)} {...props}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-text-secondary">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
