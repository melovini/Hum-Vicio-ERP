'use server';

import { 
  getServerCollaborators, 
  saveServerCollaborator, 
  toggleActiveServerCollaborator, 
  deleteServerCollaborator,
  checkSupabaseCollaboratorsTable
} from '@/lib/server-collaborators';
import { Collaborator } from '@/lib/collaborators';

export async function getCollaboratorsAction(): Promise<{
  collaborators: Collaborator[];
  isCloudSynced: boolean;
}> {
  return await getServerCollaborators();
}

export async function saveCollaboratorAction(collab: Collaborator): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
  error?: string;
}> {
  return await saveServerCollaborator(collab);
}

export async function toggleActiveCollaboratorAction(id: string): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
}> {
  return await toggleActiveServerCollaborator(id);
}

export async function deleteCollaboratorAction(id: string): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  updatedList: Collaborator[];
}> {
  return await deleteServerCollaborator(id);
}

export async function checkCloudStatusAction(): Promise<{ isCloudAvailable: boolean }> {
  const isCloudAvailable = await checkSupabaseCollaboratorsTable();
  return { isCloudAvailable };
}

/**
 * Validação de autoridade máxima da senha mestre do Administrador Master
 * Regra: se o administrador alterou a senha padrão, a senha antiga 'admin' é BLOQUEADA.
 */
export async function verifyMasterPasswordAction(password: string): Promise<{ 
  valid: boolean; 
  error?: string 
}> {
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
}
