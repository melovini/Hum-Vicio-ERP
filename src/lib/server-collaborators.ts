import fs from 'fs';
import path from 'path';
import { Collaborator, DEFAULT_COLLABORATORS } from './collaborators';
import { createClient } from './supabase';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'collaborators.json');

// Garantir diretório de dados local
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Ler do arquivo local do servidor
function readLocalCollaborators(): Collaborator[] {
  ensureDataDir();
  try {
    if (fs.existsSync(FILE_PATH)) {
      const content = fs.readFileSync(FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[server-collaborators] Erro ao ler collaborators.json local:', err);
  }

  // Se não existir, inicializar com os padrões de fábrica
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULT_COLLABORATORS, null, 2), 'utf8');
  } catch (e) {
    console.error('[server-collaborators] Erro ao criar collaborators.json inicial:', e);
  }
  return DEFAULT_COLLABORATORS;
}

// Salvar no arquivo local do servidor
function writeLocalCollaborators(list: Collaborator[]) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
}

/**
 * Checa se a tabela 'collaborators' está criada e acessível no Supabase
 */
export async function checkSupabaseCollaboratorsTable(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('collaborators').select('id').limit(1);
    if (error) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtém a lista de colaboradores (prioriza Supabase; se inacessível, usa arquivo local do servidor)
 */
export async function getServerCollaborators(): Promise<{
  collaborators: Collaborator[];
  isCloudSynced: boolean;
}> {
  let isCloud = false;
  let list: Collaborator[] = [];

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('collaborators')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      isCloud = true;
      list = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        role: d.role,
        pin: d.pin,
        phone: d.phone || undefined,
        shift: d.shift || 'integral',
        isActive: d.is_active !== false,
        createdAt: d.created_at,
        updatedAt: d.updated_at || d.created_at
      }));
      // Atualizar cache do arquivo local
      try {
        writeLocalCollaborators(list);
      } catch {}
      return { collaborators: list, isCloudSynced: true };
    }
  } catch (err) {
    console.warn('[server-collaborators] Falha ao consultar Supabase, usando armazenamento local:', err);
  }

  // Fallback: ler do armazenamento local do servidor
  list = readLocalCollaborators();
  return { collaborators: list, isCloudSynced: isCloud };
}

/**
 * Salva ou atualiza um colaborador no servidor e tenta sincronizar com o Supabase
 */
export async function saveServerCollaborator(collab: Collaborator): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
  error?: string;
}> {
  const current = readLocalCollaborators();
  const index = current.findIndex(c => c.id === collab.id);
  const now = new Date().toISOString();

  const itemToSave: Collaborator = {
    ...collab,
    updatedAt: now
  };

  let updated: Collaborator[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = itemToSave;
  } else {
    updated = [...current, itemToSave];
  }

  // 1. Salvar no arquivo local do servidor
  writeLocalCollaborators(updated);

  // 2. Tentar salvar no Supabase
  let isCloud = false;
  try {
    const supabase = createClient();
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
    }
  } catch (err) {
    console.warn('[server-collaborators] Não foi possível salvar no Supabase (tabela pendente):', err);
  }

  return {
    success: true,
    isCloudSynced: isCloud,
    updatedList: updated
  };
}

/**
 * Alterna status ativo/inativo no servidor e tenta sincronizar com o Supabase
 */
export async function toggleActiveServerCollaborator(id: string): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
}> {
  const current = readLocalCollaborators();
  const updated = current.map(c => {
    if (c.id === id) {
      return { ...c, isActive: !c.isActive, updatedAt: new Date().toISOString() };
    }
    return c;
  });

  writeLocalCollaborators(updated);

  let isCloud = false;
  const target = updated.find(c => c.id === id);
  if (target) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from('collaborators').update({
        is_active: target.isActive,
        updated_at: target.updatedAt
      }).eq('id', id);

      if (!error) isCloud = true;
    } catch {}
  }

  return {
    success: true,
    isCloudSynced: isCloud,
    updatedList: updated
  };
}

/**
 * Exclui um colaborador no servidor e tenta sincronizar com o Supabase
 */
export async function deleteServerCollaborator(id: string): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
}> {
  const current = readLocalCollaborators();
  const updated = current.filter(c => c.id !== id);

  writeLocalCollaborators(updated);

  let isCloud = false;
  try {
    const supabase = createClient();
    const { error } = await supabase.from('collaborators').delete().eq('id', id);
    if (!error) isCloud = true;
  } catch {}

  return {
    success: true,
    isCloudSynced: isCloud,
    updatedList: updated
  };
}
