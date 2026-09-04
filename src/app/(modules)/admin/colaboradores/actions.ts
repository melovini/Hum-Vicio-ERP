'use server';

import { 
  getServerCollaborators, 
  saveServerCollaborator, 
  toggleActiveServerCollaborator, 
  deleteServerCollaborator,
  checkSupabaseCollaboratorsTable,
  DEFAULT_COLLABORATORS
} from '@/lib/server-collaborators';
import { Collaborator } from '@/lib/collaborators';

export async function getCollaboratorsAction(): Promise<{
  collaborators: Collaborator[];
  isCloudSynced: boolean;
}> {
  try {
    return await getServerCollaborators();
  } catch (err: any) {
    console.error('[actions] Erro em getCollaboratorsAction:', err);
    return { collaborators: DEFAULT_COLLABORATORS, isCloudSynced: false };
  }
}

async function assertAdminSession(): Promise<boolean> {
  try {
    const { cookies } = await import('next/headers');
    const { verifySessionToken, SESSION_COOKIE_NAME } = await import('@/lib/session');
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);
    return Boolean(session.valid && session.role === 'admin');
  } catch {
    return false;
  }
}

export async function saveCollaboratorAction(collab: Collaborator): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
  error?: string;
}> {
  try {
    const isAdmin = await assertAdminSession();
    if (!isAdmin) {
      return {
        success: false,
        isCloudSynced: false,
        updatedList: [],
        error: 'Acesso negado: apenas o Administrador Geral pode adicionar ou alterar colaboradores e senhas.'
      };
    }
    return await saveServerCollaborator(collab);
  } catch (err: any) {
    console.error('[actions] Erro em saveCollaboratorAction:', err);
    return {
      success: false,
      isCloudSynced: false,
      updatedList: [],
      error: err.message || 'Erro inesperado ao salvar colaborador.'
    };
  }
}

export async function toggleActiveCollaboratorAction(id: string): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
  error?: string;
}> {
  try {
    const isAdmin = await assertAdminSession();
    if (!isAdmin) {
      return {
        success: false,
        isCloudSynced: false,
        updatedList: [],
        error: 'Acesso negado: apenas o Administrador Geral pode alterar status de colaboradores.'
      };
    }
    return await toggleActiveServerCollaborator(id);
  } catch (err: any) {
    console.error('[actions] Erro em toggleActiveCollaboratorAction:', err);
    return {
      success: false,
      isCloudSynced: false,
      updatedList: [],
      error: 'Erro ao alterar status do colaborador.'
    };
  }
}

export async function deleteCollaboratorAction(id: string): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
  error?: string;
}> {
  try {
    const isAdmin = await assertAdminSession();
    if (!isAdmin) {
      return {
        success: false,
        isCloudSynced: false,
        updatedList: [],
        error: 'Acesso negado: apenas o Administrador Geral pode excluir colaboradores.'
      };
    }
    return await deleteServerCollaborator(id);
  } catch (err: any) {
    console.error('[actions] Erro em deleteCollaboratorAction:', err);
    return {
      success: false,
      isCloudSynced: false,
      updatedList: [],
      error: 'Erro ao excluir colaborador.'
    };
  }
}

export async function checkCloudStatusAction(): Promise<{ isCloudAvailable: boolean }> {
  try {
    const isCloudAvailable = await checkSupabaseCollaboratorsTable();
    return { isCloudAvailable };
  } catch {
    return { isCloudAvailable: false };
  }
}

/**
 * Validação de autoridade máxima da senha mestre do Administrador Master
 * Regra: se o administrador alterou a senha padrão, a senha antiga 'admin' é BLOQUEADA.
 */
export async function verifyMasterPasswordAction(password: string): Promise<{ 
  valid: boolean; 
  error?: string 
}> {
  try {
    if (!password || !password.trim()) {
      return { valid: false, error: 'Digite a senha do Administrador Master.' };
    }

    const clean = password.trim();
    const { collaborators } = await getServerCollaborators();

    const activeAdmins = collaborators.filter(c => c.isActive && c.role === 'admin');

    // Verificar se bate com a senha de algum admin ativo
    const matchedAdmin = activeAdmins.find(c => c.pin.trim() === clean);
    if (matchedAdmin) {
      return { valid: true };
    }

    // Se o usuário digitou 'admin', mas já há um admin com senha personalizada diferente de 'admin':
    const hasCustomizedAdmin = activeAdmins.some(c => c.pin.trim() !== 'admin');
    if (clean === 'admin' && hasCustomizedAdmin) {
      return { 
        valid: false, 
        error: 'A senha padrão "admin" foi revogada por segurança após a alteração no painel de colaboradores. Use sua nova senha master.' 
      };
    }

    // Fallback de contingência (somente se não houver nenhum admin com senha personalizada configurada)
    const envAdminPass = process.env.ADMIN_PASSWORD || 'admin';
    if (clean === envAdminPass && !hasCustomizedAdmin) {
      return { valid: true };
    }

    return { valid: false, error: 'Senha de Administrador Master incorreta.' };
  } catch (err: any) {
    console.error('[actions] Erro em verifyMasterPasswordAction:', err);
    return { valid: false, error: 'Erro ao validar credencial mestre.' };
  }
}
