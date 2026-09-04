'use client';
import { createClient } from './supabase';

const supabase = createClient();

export type PayType = 'mensalista' | 'diarista';

export type WageEntryType = 'diaria' | 'diaria_extra' | 'agrado' | 'pagamento_acerto';

export interface WageEntry {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  date: string; // YYYY-MM-DD
  type: WageEntryType;
  amount: number; // Positivo para créditos do diarista (diária/agrado) ou valor pago no acerto
  notes?: string;
  paymentMethod?: 'pix' | 'dinheiro' | 'transferencia' | 'outro';
  registeredBy?: string;
  createdAt: string;
}

export interface CollaboratorWageBalance {
  collaboratorId: string;
  collaboratorName: string;
  totalEarned: number;     // Total de diárias + extras + agrados
  totalPaid: number;       // Total já pago em acertos
  totalDue: number;        // Saldo devedor atual (o que a hamburgueria deve ao diarista)
  daysWorkedCount: number; // Quantidade de diárias registradas
  bonusCount: number;      // Quantidade de agrados/bônus
  entries: WageEntry[];
}

const STORAGE_ENTRIES_KEY = 'hum_vicio_diarias_entries';
const STORAGE_SCHEDULE_KEY = 'hum_vicio_weekly_schedules';

export const DAYS_OF_WEEK = [
  { key: 'seg', label: 'Segunda', short: 'Seg' },
  { key: 'ter', label: 'Terça', short: 'Ter' },
  { key: 'qua', label: 'Quarta', short: 'Qua' },
  { key: 'qui', label: 'Quinta', short: 'Qui' },
  { key: 'sex', label: 'Sexta', short: 'Sex' },
  { key: 'sab', label: 'Sábado', short: 'Sáb' },
  { key: 'dom', label: 'Domingo', short: 'Dom' }
] as const;

export type DayKey = typeof DAYS_OF_WEEK[number]['key'];

/**
 * Obter histórico completo de lançamentos de diárias e acertos (Offline-first)
 */
export function getStoredWageEntries(): WageEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_ENTRIES_KEY);
    if (!raw) return [];
    const list: WageEntry[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Erro ao ler entradas de diárias:', err);
    return [];
  }
}

/**
 * Salvar novo lançamento de diária, agrado ou acerto
 */
export function saveStoredWageEntry(entry: WageEntry): WageEntry[] {
  const current = getStoredWageEntries();
  const existingIdx = current.findIndex(e => e.id === entry.id);
  let updated: WageEntry[];

  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = entry;
  } else {
    updated = [entry, ...current];
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_ENTRIES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao persistir entrada de diária:', e);
    }
  }

  // Tentar sincronização em nuvem silenciosa
  try {
    supabase.from('collaborator_diarias').upsert({
      id: entry.id,
      collaborator_id: entry.collaboratorId,
      collaborator_name: entry.collaboratorName,
      date: entry.date,
      type: entry.type,
      amount: entry.amount,
      notes: entry.notes || null,
      payment_method: entry.paymentMethod || null,
      registered_by: entry.registeredBy || null,
      created_at: entry.createdAt
    }).then();
  } catch {}

  return updated;
}

/**
 * Excluir lançamento de diária/acerto
 */
export function deleteStoredWageEntry(id: string): WageEntry[] {
  const current = getStoredWageEntries();
  const updated = current.filter(e => e.id !== id);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_ENTRIES_KEY, JSON.stringify(updated));
    } catch {}
  }

  try {
    supabase.from('collaborator_diarias').delete().eq('id', id).then();
  } catch {}

  return updated;
}

/**
 * Calcular saldo devedor individual para um colaborador
 */
export function computeCollaboratorBalance(
  collaboratorId: string, 
  collaboratorName: string, 
  entries: WageEntry[]
): CollaboratorWageBalance {
  const collabEntries = entries.filter(e => e.collaboratorId === collaboratorId);

  let totalEarned = 0;
  let totalPaid = 0;
  let daysWorkedCount = 0;
  let bonusCount = 0;

  collabEntries.forEach(entry => {
    const val = Number(entry.amount) || 0;
    if (entry.type === 'diaria' || entry.type === 'diaria_extra') {
      totalEarned += val;
      daysWorkedCount += 1;
    } else if (entry.type === 'agrado') {
      totalEarned += val;
      bonusCount += 1;
    } else if (entry.type === 'pagamento_acerto') {
      totalPaid += val;
    }
  });

  const totalDue = Math.max(0, totalEarned - totalPaid);

  return {
    collaboratorId,
    collaboratorName,
    totalEarned,
    totalPaid,
    totalDue,
    daysWorkedCount,
    bonusCount,
    entries: collabEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  };
}

/**
 * Escala semanal cadastrada por colaborador (id -> array de dias como ['qui', 'sex', 'sab', 'dom'])
 */
export function getStoredWeeklySchedules(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_SCHEDULE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveStoredWeeklySchedule(schedules: Record<string, string[]>): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_SCHEDULE_KEY, JSON.stringify(schedules));
    } catch {}
  }
}
