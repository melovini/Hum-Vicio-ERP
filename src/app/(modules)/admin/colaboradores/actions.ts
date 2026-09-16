'use server';
import { getServerCollaborators, saveServerCollaborator, toggleActiveServerCollaborator,
  deleteServerCollaborator, checkSupabaseCollaboratorsTable } from '@/lib/server-collaborators';
import type { Collaborator } from '@/lib/collaborators';
import { requireSession } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';
import { verifyCredential } from '@/lib/security/credentials.mjs';
import { allowCredentialAttempt } from '@/lib/security/rate-limit';

export async function getCollaboratorsAction() {
  await requireSession(['admin']);
  return getServerCollaborators();
}

export async function getOperatorDirectoryAction() {
  await requireSession(['admin', 'gerente', 'caixa']);
  const { collaborators } = await getServerCollaborators();
  return collaborators.filter(c => c.isActive).map(c => ({
    id: c.id, name: c.name, role: c.role, pin: '', isActive: c.isActive, createdAt: c.createdAt, updatedAt: c.updatedAt,
  }));
}

export async function saveCollaboratorAction(collab: Collaborator) {
  try {
    await requireSession(['admin']);
    return await saveServerCollaborator(collab);
  } catch (error) {
    return { success: false, isCloudSynced: false, updatedList: [] as Collaborator[],
      error: error instanceof Error ? error.message : 'Não foi possível salvar.' };
  }
}

export async function toggleActiveCollaboratorAction(id: string) {
  try {
    await requireSession(['admin']);
    return await toggleActiveServerCollaborator(id);
  } catch (error) {
    return { success: false, isCloudSynced: false, updatedList: [] as Collaborator[],
      error: error instanceof Error ? error.message : 'Não foi possível alterar.' };
  }
}

export async function deleteCollaboratorAction(id: string) {
  try {
    await requireSession(['admin']);
    return await deleteServerCollaborator(id);
  } catch (error) {
    return { success: false, isCloudSynced: false, updatedList: [] as Collaborator[],
      error: error instanceof Error ? error.message : 'Não foi possível excluir.' };
  }
}

export async function checkCloudStatusAction() {
  await requireSession(['admin']);
  return { isCloudAvailable: await checkSupabaseCollaboratorsTable() };
}

export async function verifyMasterPasswordAction(password: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const session = await requireSession(['admin']);
    if (typeof password !== 'string' || password.length > 128 || !await allowCredentialAttempt(password, 'master')) {
      return { valid: false, error: 'Aguarde antes de tentar novamente.' };
    }
    const { data, error } = await createServerDatabase().from('collaborators').select('pin').eq('id', session.collaboratorId).single();
    return { valid: !error && await verifyCredential(password, data?.pin) };
  } catch { return { valid: false, error: 'Acesso não autorizado.' }; }
}
