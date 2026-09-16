'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { validateServerCredentialsAsync, signSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { verifySessionToken } from '@/lib/session';
import { createServerDatabase } from '@/lib/supabase-server';
import { requireSession } from '@/lib/security/server-session';

export async function loginAction(pinOrPassword: string): Promise<{ success: boolean; error?: string; redirectUrl?: string }> {
  try {
    const person = await validateServerCredentialsAsync(pinOrPassword);
    if (!person.valid || !person.role || !person.collaboratorId) {
      return { success: false, error: 'Acesso não autorizado. Confira sua credencial ou aguarde antes de tentar novamente.' };
    }
    const sessionId = randomUUID();
    const now = new Date();
    const { error } = await createServerDatabase().from('app_sessions').insert({
      id: sessionId, collaborator_id: person.collaboratorId, collaborator_version: person.version,
      expires_at: new Date(now.getTime() + 8 * 3600_000).toISOString(), last_seen_at: now.toISOString(),
    });
    if (error) throw new Error('Sessão indisponível.');
    const token = await signSessionToken(person.role, person.userName, person.collaboratorId, sessionId);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      path: '/', maxAge: 8 * 3600,
    });
    cookieStore.delete('hum_vicio_role');
    return { success: true, redirectUrl: ['admin', 'gerente'].includes(person.role) ? '/' : '/' + person.role };
  } catch {
    return { success: false, error: 'Não foi possível validar o acesso. Verifique a configuração de segurança com o administrador.' };
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  let revoked = false;
  try {
    if (session.sessionId) {
      const { error } = await createServerDatabase().from('app_sessions')
        .update({ revoked_at: new Date().toISOString() }).eq('id', session.sessionId);
      revoked = !error;
    } else { revoked = true; }
  } catch {}
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete('hum_vicio_role');
  redirect(revoked ? '/login' : '/login?logout=local');
}

export async function getCurrentSessionAction(): Promise<{
  role: import('@/lib/session').UserRole | null; userName?: string; collaboratorId?: string;
}> {
  try {
    const session = await requireSession();
    return { role: session.role, userName: session.userName, collaboratorId: session.collaboratorId };
  } catch { return { role: null }; }
}
