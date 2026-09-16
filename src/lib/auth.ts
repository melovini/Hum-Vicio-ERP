import 'server-only';
import { createServerDatabase } from './supabase-server';
import { verifyCredential } from './security/credentials.mjs';
import { allowCredentialAttempt } from './security/rate-limit';
import type { UserRole } from './session';
export { signSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from './session';
export type { UserRole, SessionPayload } from './session';

export async function validateServerCredentialsAsync(credential: string): Promise<{
  valid: boolean; role?: UserRole; userName?: string; collaboratorId?: string; version?: string;
}> {
  if (typeof credential !== 'string' || !credential.trim() || credential.length > 128) return { valid: false };
  if (!await allowCredentialAttempt(credential.trim())) return { valid: false };
  const { data, error } = await createServerDatabase().from('collaborators')
    .select('id,name,role,pin,updated_at').eq('is_active', true);
  if (error || !data) return { valid: false };
  for (const person of data) {
    if (await verifyCredential(credential.trim(), person.pin)) {
      return { valid: true, role: person.role, userName: person.name,
        collaboratorId: person.id, version: person.updated_at };
    }
  }
  return { valid: false };
}
