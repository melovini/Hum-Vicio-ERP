'use client';
import React from 'react';

export type StatusBadgeVariant = 'free' | 'occupied' | 'partial' | 'paid' | 'danger' | 'neutral';

interface StatusBadgeProps {
  status: StatusBadgeVariant;
  label?: string;
  className?: string;
  pulse?: boolean;
}

const statusConfig: Record<StatusBadgeVariant, {
  bg: string;
  text: string;
  border: string;
  dot: string;
  defaultLabel: string;
}> = {
  free: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
    defaultLabel: 'Livre'
  },
  occupied: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    defaultLabel: 'Ocupada'
  },
  partial: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    dot: 'bg-purple-400',
    defaultLabel: 'Parcial'
  },
  paid: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    dot: 'bg-cyan-400',
    defaultLabel: 'Paga'
  },
  danger: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    dot: 'bg-rose-400',
    defaultLabel: 'Alerta'
  },
  neutral: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    dot: 'bg-slate-400',
    defaultLabel: 'Inativo'
  }
};

export default function StatusBadge({
  status,
  label,
  className = '',
  pulse = true
}: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.neutral;
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text} border ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {displayLabel}
    </span>
  );
}
