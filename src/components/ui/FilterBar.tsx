'use client';

import { useId, type ReactNode } from 'react';
import { Input } from './Input';
import { Button } from './Button';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  placeholder?: string;
  resultCount: number;
  totalCount: number;
  active: boolean;
  onClear: () => void;
  children?: ReactNode;
}

/** Native form controls retain their normal Tab order (not an ARIA toolbar). */
export function FilterBar({ search, onSearchChange, searchLabel, placeholder, resultCount, totalCount, active, onClear, children }: FilterBarProps) {
  const searchId = useId();
  return (
    <section aria-label="Filtros de consulta" className="space-y-3 rounded-card border border-border-default bg-surface-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor={searchId} className="block text-sm font-medium text-text-secondary">{searchLabel}</label>
          <Input id={searchId} type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={placeholder} />
        </div>
        {children}
        <Button variant="secondary" disabled={!active} onClick={onClear}>Limpar filtros</Button>
      </div>
      <p role="status" aria-atomic="true" className="text-sm tabular-nums text-text-muted">
        {resultCount} de {totalCount} registros
      </p>
    </section>
  );
}
