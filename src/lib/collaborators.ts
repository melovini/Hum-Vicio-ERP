'use client';
export type CollaboratorRole = 'admin' | 'gerente' | 'caixa' | 'cozinha';

export type PayType = 'mensalista' | 'diarista';

export interface Collaborator {
  id: string;
  name: string;
  role: CollaboratorRole;
  pin: string; // PIN numérico ou senha individual
  phone?: string;
  shift?: 'manha' | 'tarde' | 'noite' | 'integral';
  payType?: PayType;
  dailyRate?: number; // Valor da diária em R$ (para diaristas)
  weeklySchedule?: string[]; // Ex: ['qui', 'sex', 'sab', 'dom']
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'hum_vicio_collaborators';
export function setLocalCollaboratorsCache(list: Collaborator[]): void {
  if (typeof window !== 'undefined') {
    // Nunca manter PINs ou hashes de credenciais no navegador.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.map(c => ({ ...c, pin: '' })))); } catch {}
  }
}
export function getStoredCollaborators(): Collaborator[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(list)) return [];
    const sanitized = list.map(c => ({ ...c, pin: '' }));
    setLocalCollaboratorsCache(sanitized);
    return sanitized;
  } catch { return []; }
}
export function getActiveCollaborators(): Collaborator[] {
  return getStoredCollaborators().filter(c => c.isActive);
}
