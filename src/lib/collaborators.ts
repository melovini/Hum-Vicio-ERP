'use client';
import { createClient } from './supabase';

const supabase = createClient();

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

// Colaboradores padrão de fábrica
export const DEFAULT_COLLABORATORS: Collaborator[] = [
  {
    id: 'collab_admin_1',
    name: 'Administrador Master',
    role: 'admin',
    pin: 'admin',
    phone: '(11) 99999-0001',
    shift: 'integral',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'collab_gerente_1',
    name: 'Gerente Geral',
    role: 'gerente',
    pin: '0000',
    phone: '(11) 99999-0002',
    shift: 'integral',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'collab_caixa_1',
    name: 'Operador de Caixa',
    role: 'caixa',
    pin: '5678',
    phone: '(11) 99999-0003',
    shift: 'tarde',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'collab_cozinha_1',
    name: 'Chapeiro Principal',
    role: 'cozinha',
    pin: '1234',
    phone: '(11) 99999-0004',
    shift: 'noite',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  }
];

// Obter lista de colaboradores (Offline-First)
export function getStoredCollaborators(): Collaborator[] {
  if (typeof window === 'undefined') return DEFAULT_COLLABORATORS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COLLABORATORS));
      return DEFAULT_COLLABORATORS;
    }
    const list: Collaborator[] = JSON.parse(raw);
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  } catch (err) {
    console.warn('Erro ao carregar colaboradores do localStorage:', err);
  }
  return DEFAULT_COLLABORATORS;
}

// Obter apenas colaboradores ativos
export function getActiveCollaborators(): Collaborator[] {
  return getStoredCollaborators().filter(c => c.isActive !== false);
}

// Salvar ou Atualizar Colaborador
export function saveStoredCollaborator(collab: Collaborator): Collaborator[] {
  const current = getStoredCollaborators();
  const index = current.findIndex(c => c.id === collab.id);
  let updated: Collaborator[];

  const now = new Date().toISOString();
  const itemToSave: Collaborator = {
    ...collab,
    updatedAt: now
  };

  if (index >= 0) {
    updated = [...current];
    updated[index] = itemToSave;
  } else {
    updated = [...current, itemToSave];
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao persistir colaborador:', e);
    }
  }

  // Tentar sincronização assíncrona com o Supabase (fallback silencioso)
  try {
    supabase.from('collaborators').upsert({
      id: itemToSave.id,
      name: itemToSave.name,
      role: itemToSave.role,
      pin: itemToSave.pin,
      phone: itemToSave.phone || null,
      shift: itemToSave.shift || 'integral',
      is_active: itemToSave.isActive,
      created_at: itemToSave.createdAt,
      updated_at: itemToSave.updatedAt
    }).then();
  } catch {}

  return updated;
}

// Remover / Desativar Colaborador (Soft Delete)
export function toggleActiveStoredCollaborator(id: string): Collaborator[] {
  const current = getStoredCollaborators();
  const updated = current.map(c => {
    if (c.id === id) {
      return { ...c, isActive: !c.isActive, updatedAt: new Date().toISOString() };
    }
    return c;
  });

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  }

  const target = updated.find(c => c.id === id);
  if (target) {
    try {
      supabase.from('collaborators').update({
        is_active: target.isActive,
        updated_at: target.updatedAt
      }).eq('id', id).then();
    } catch {}
  }

  return updated;
}

// Excluir Colaborador
export function deleteStoredCollaborator(id: string): Collaborator[] {
  const current = getStoredCollaborators();
  const updated = current.filter(c => c.id !== id);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  }

  try {
    supabase.from('collaborators').delete().eq('id', id).then();
  } catch {}

  return updated;
}

// Autenticar Colaborador por PIN
export function findCollaboratorByPin(pin: string): Collaborator | null {
  const list = getStoredCollaborators();
  const cleanPin = pin.trim();
  const found = list.find(c => c.isActive && c.pin.trim() === cleanPin);
  return found || null;
}

// Atualizar cache local do navegador
export function setLocalCollaboratorsCache(list: Collaborator[]): void {
  if (typeof window !== 'undefined' && Array.isArray(list)) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }
}

/**
 * Verifica se a senha/PIN fornecida bate com algum colaborador com role 'admin'
 * Regra: se o administrador alterou a senha padrão, a senha antiga 'admin' é BLOQUEADA.
 */
export function validateMasterPassword(password: string): boolean {
  const clean = password.trim();
  if (!clean) return false;

  const list = getStoredCollaborators();
  const activeAdmins = list.filter(c => c.isActive && c.role === 'admin');

  // Verificar se bate com a senha de algum admin ativo
  const matched = activeAdmins.find(c => c.pin.trim() === clean);
  if (matched) {
    return true;
  }

  // Se o usuário digitou a senha antiga 'admin', mas já existe um admin com senha diferente:
  const hasCustomizedAdmin = activeAdmins.some(c => c.pin.trim() !== 'admin');
  if (clean === 'admin' && hasCustomizedAdmin) {
    return false;
  }

  // Se a lista estiver virgem (só admin padrão)
  if (clean === 'admin' && !hasCustomizedAdmin) {
    return true;
  }

  return false;
}
