import 'server-only';
import { createServerDatabase } from './supabase-server';
import { credentialAllowed, hashCredential, verifyCredential } from './security/credentials.mjs';
import type { Collaborator } from './collaborators';
export type { Collaborator } from './collaborators';

const publicColumns = 'id,name,role,phone,shift,pay_type,daily_rate,weekly_schedule,is_active,created_at,updated_at';
export async function getServerCollaborators() {
  const { data, error } = await createServerDatabase().from('collaborators')
    .select(publicColumns).order('created_at');
  if (error) throw new Error('Não foi possível consultar colaboradores.');
  const collaborators: Collaborator[] = (data || []).map(d => ({
    id: d.id, name: d.name, role: d.role, pin: '', phone: d.phone || undefined,
    shift: d.shift, payType: d.pay_type, dailyRate: d.daily_rate,
    weeklySchedule: typeof d.weekly_schedule === 'string' ? JSON.parse(d.weekly_schedule) : d.weekly_schedule,
    isActive: d.is_active, createdAt: d.created_at, updatedAt: d.updated_at,
  }));
  return { collaborators, isCloudSynced: true };
}

export async function checkSupabaseCollaboratorsTable() {
  const { error } = await createServerDatabase().from('collaborators').select('id').limit(1);
  return !error;
}

export async function saveServerCollaborator(collab: Collaborator) {
  const db = createServerDatabase();
  if (!collab || typeof collab.id !== 'string' || !/^[\w-]{1,100}$/.test(collab.id) ||
      typeof collab.name !== 'string' || !collab.name.trim() || collab.name.length > 150 ||
      !['admin', 'gerente', 'caixa', 'cozinha'].includes(collab.role) || typeof collab.isActive !== 'boolean' ||
      typeof collab.pin !== 'string') throw new Error('Dados do colaborador inválidos.');
  const { data: current, error } = await db.from('collaborators').select('id,pin,role,is_active').eq('id', collab.id).maybeSingle();
  if (error) throw new Error('Não foi possível verificar o colaborador.');
  let pin = current?.pin;
  if (collab.pin) {
    if (!credentialAllowed(collab.pin, collab.role)) throw new Error('Use pelo menos 12 caracteres para gestores ou 6 para operadores; não use credenciais padrão.');
    const { data: others, error: lookupError } = await db.from('collaborators').select('id,pin').neq('id', collab.id);
    if (lookupError) throw new Error('Não foi possível verificar a credencial.');
    for (const other of others || []) {
      if (await verifyCredential(collab.pin, other.pin)) throw new Error('Esta credencial já está em uso. Escolha outra.');
    }
    pin = await hashCredential(collab.pin);
  } else if (!pin?.startsWith('scrypt$') || current?.role !== collab.role) {
    throw new Error('Defina uma nova credencial para este cadastro ou alteração de perfil.');
  }
  const { error: saveError } = await db.from('collaborators').upsert({
    id: collab.id, name: collab.name.trim(), role: collab.role, pin,
    phone: collab.phone || null, shift: collab.shift || 'integral',
    pay_type: collab.payType || 'mensalista', daily_rate: collab.dailyRate ?? null,
    weekly_schedule: collab.weeklySchedule || [], is_active: collab.isActive,
    updated_at: new Date().toISOString(),
  });
  if (saveError) throw new Error('Não foi possível salvar. Verifique os dados e preserve ao menos um administrador ativo.');
  return { success: true, isCloudSynced: true, updatedList: (await getServerCollaborators()).collaborators, error: undefined };
}

export async function toggleActiveServerCollaborator(id: string) {
  const db = createServerDatabase();
  const { data, error } = await db.from('collaborators').select('is_active').eq('id', id).single();
  if (error || !data) throw new Error('Colaborador não encontrado.');
  const { error: updateError } = await db.from('collaborators').update({ is_active: !data.is_active,
    updated_at: new Date().toISOString() }).eq('id', id);
  if (updateError) throw new Error('Não foi possível alterar. Preserve ao menos um administrador ativo.');
  return { success: true, isCloudSynced: true, updatedList: (await getServerCollaborators()).collaborators, error: undefined };
}

export async function deleteServerCollaborator(id: string) {
  const { error } = await createServerDatabase().from('collaborators').delete().eq('id', id);
  if (error) throw new Error('Não foi possível excluir. Preserve ao menos um administrador ativo.');
  return { success: true, isCloudSynced: true, updatedList: (await getServerCollaborators()).collaborators, error: undefined };
}
