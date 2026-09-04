import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export type CollaboratorRole = 'admin' | 'gerente' | 'caixa' | 'cozinha';

export interface Collaborator {
  id: string;
  name: string;
  role: CollaboratorRole;
  pin: string;
  phone?: string;
  shift?: 'manha' | 'tarde' | 'noite' | 'integral';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

// Instanciar cliente Supabase dedicado para execução no servidor
function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

// Armazenamento em cache de memória no servidor (evita quebra em ambientes read-only como Vercel)
let inMemoryCollaboratorsCache: Collaborator[] = [...DEFAULT_COLLABORATORS];

// Tentativa segura de ler arquivo local (não quebra se o filesystem for read-only)
function tryReadLocalFile(): Collaborator[] | null {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'collaborators.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignora restrições de filesystem
  }
  return null;
}

// Tentativa segura de gravar arquivo local (não quebra se o filesystem for read-only)
function tryWriteLocalFile(list: Collaborator[]): void {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'collaborators.json');
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // Em ambientes serverless read-only como Vercel, fs.writeFileSync falha normalmente;
    // O cache em memória e o Supabase tratam isso com total transparência.
  }
}

/**
 * Checa se a tabela 'collaborators' existe e responde no Supabase
 */
export async function checkSupabaseCollaboratorsTable(): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('collaborators').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Mapeia registro do Supabase para a interface Collaborator
 */
function mapFromDb(d: any): Collaborator {
  return {
    id: d.id,
    name: d.name,
    role: d.role,
    pin: d.pin,
    phone: d.phone || undefined,
    shift: d.shift || 'integral',
    isActive: d.is_active !== false,
    createdAt: d.created_at || new Date().toISOString(),
    updatedAt: d.updated_at || d.created_at || new Date().toISOString()
  };
}

/**
 * Obtém a lista oficial de colaboradores (prioriza Supabase; cai em cache se offline)
 */
export async function getServerCollaborators(): Promise<{
  collaborators: Collaborator[];
  isCloudSynced: boolean;
}> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('collaborators')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data)) {
      if (data.length > 0) {
        const list = data.map(mapFromDb);
        inMemoryCollaboratorsCache = list;
        tryWriteLocalFile(list);
        return { collaborators: list, isCloudSynced: true };
      } else {
        // Tabela existe no Supabase mas está vazia: fazer seed inicial automático
        try {
          await supabase.from('collaborators').upsert(
            DEFAULT_COLLABORATORS.map(c => ({
              id: c.id,
              name: c.name,
              role: c.role,
              pin: c.pin,
              phone: c.phone || null,
              shift: c.shift || 'integral',
              is_active: c.isActive,
              created_at: c.createdAt,
              updated_at: c.updatedAt
            }))
          );
        } catch {}
        return { collaborators: DEFAULT_COLLABORATORS, isCloudSynced: true };
      }
    }
  } catch (err) {
    console.warn('[server-collaborators] Supabase não disponível, usando fallback:', err);
  }

  // Fallback: tentar arquivo local ou cache em memória
  const fromFile = tryReadLocalFile();
  if (fromFile && fromFile.length > 0) {
    inMemoryCollaboratorsCache = fromFile;
    return { collaborators: fromFile, isCloudSynced: false };
  }

  return { collaborators: inMemoryCollaboratorsCache, isCloudSynced: false };
}

/**
 * Salva ou atualiza um colaborador no Supabase e em cache
 */
export async function saveServerCollaborator(collab: Collaborator): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
  error?: string;
}> {
  try {
    const now = new Date().toISOString();
    const itemToSave: Collaborator = {
      ...collab,
      updatedAt: now
    };

    // 1. Tentar salvar no Supabase (Fonte soberana na Nuvem)
    let isCloud = false;
    try {
      const supabase = getSupabaseServerClient();
      const { error } = await supabase.from('collaborators').upsert({
        id: itemToSave.id,
        name: itemToSave.name,
        role: itemToSave.role,
        pin: itemToSave.pin,
        phone: itemToSave.phone || null,
        shift: itemToSave.shift || 'integral',
        is_active: itemToSave.isActive,
        created_at: itemToSave.createdAt,
        updated_at: itemToSave.updatedAt
      });

      if (!error) {
        isCloud = true;
      } else {
        console.warn('[server-collaborators] Erro ao salvar no Supabase:', error.message);
      }
    } catch (err) {
      console.warn('[server-collaborators] Falha de conexão com Supabase:', err);
    }

    // 2. Atualizar cache em memória e arquivo local
    const current = inMemoryCollaboratorsCache;
    const index = current.findIndex(c => c.id === collab.id);
    let updated: Collaborator[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = itemToSave;
    } else {
      updated = [...current, itemToSave];
    }

    inMemoryCollaboratorsCache = updated;
    tryWriteLocalFile(updated);

    return {
      success: true,
      isCloudSynced: isCloud,
      updatedList: updated
    };
  } catch (err: any) {
    console.error('[server-collaborators] Erro crítico em saveServerCollaborator:', err);
    return {
      success: false,
      isCloudSynced: false,
      updatedList: inMemoryCollaboratorsCache,
      error: err.message || 'Erro interno ao salvar colaborador.'
    };
  }
}

/**
 * Alterna status ativo/inativo
 */
export async function toggleActiveServerCollaborator(id: string): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
}> {
  try {
    let isCloud = false;
    const target = inMemoryCollaboratorsCache.find(c => c.id === id);
    const newActiveState = target ? !target.isActive : true;

    try {
      const supabase = getSupabaseServerClient();
      const { error } = await supabase
        .from('collaborators')
        .update({
          is_active: newActiveState,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (!error) isCloud = true;
    } catch {}

    const updated = inMemoryCollaboratorsCache.map(c => {
      if (c.id === id) {
        return { ...c, isActive: newActiveState, updatedAt: new Date().toISOString() };
      }
      return c;
    });

    inMemoryCollaboratorsCache = updated;
    tryWriteLocalFile(updated);

    return {
      success: true,
      isCloudSynced: isCloud,
      updatedList: updated
    };
  } catch {
    return {
      success: false,
      isCloudSynced: false,
      updatedList: inMemoryCollaboratorsCache
    };
  }
}

/**
 * Exclui colaborador
 */
export async function deleteServerCollaborator(id: string): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
}> {
  try {
    let isCloud = false;
    try {
      const supabase = getSupabaseServerClient();
      const { error } = await supabase.from('collaborators').delete().eq('id', id);
      if (!error) isCloud = true;
    } catch {}

    const updated = inMemoryCollaboratorsCache.filter(c => c.id !== id);
    inMemoryCollaboratorsCache = updated;
    tryWriteLocalFile(updated);

    return {
      success: true,
      isCloudSynced: isCloud,
      updatedList: updated
    };
  } catch {
    return {
      success: false,
      isCloudSynced: false,
      updatedList: inMemoryCollaboratorsCache
    };
  }
}
