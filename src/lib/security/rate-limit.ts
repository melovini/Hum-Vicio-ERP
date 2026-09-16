import 'server-only';
import { createHmac } from 'node:crypto';
import { createServerDatabase } from '../supabase-server';
import { getAuthSecret } from './config';

export async function allowCredentialAttempt(credential: string, scope = 'login') {
  const db = createServerDatabase();
  const digest = createHmac('sha256', getAuthSecret()).update(credential).digest('hex');
  // Banco compartilhado: os limites continuam valendo entre processos e reinícios.
  for (const [key, limit] of [[`${scope}:global`, 120], [`${scope}:${digest}`, 8]] as const) {
    const { data, error } = await db.rpc('consume_auth_attempt', { bucket_key: key, attempt_limit: limit });
    if (error || data !== true) return false;
  }
  return true;
}
