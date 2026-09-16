import 'server-only';
import { cookies } from 'next/headers';
import { createServerDatabase } from '../supabase-server';
import { SESSION_COOKIE_NAME, verifySessionToken, type UserRole } from '../session';

export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireSession(roles?: readonly UserRole[]) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const verified = await verifySessionToken(token);
  if (!verified.valid || !verified.sessionId || !verified.collaboratorId) {
    throw new AccessError(401, 'Sua sessão expirou. Entre novamente.');
  }
  const db = createServerDatabase();
  const { data: session, error } = await db.from('app_sessions').select('*').eq('id', verified.sessionId).single();
  if (error) throw new AccessError(401, 'Sessão indisponível ou revogada. Entre novamente.');
  const now = Date.now();
  if (!session || session.revoked_at || session.collaborator_id !== verified.collaboratorId ||
      Date.parse(session.expires_at) <= now || Date.parse(session.last_seen_at) <= now - 30 * 60_000) {
    throw new AccessError(401, 'Sua sessão expirou. Entre novamente.');
  }
  const { data: person, error: personError } = await db.from('collaborators')
    .select('id,name,role,is_active,updated_at').eq('id', session.collaborator_id).single();
  if (personError || !person?.is_active || person.role !== verified.role ||
      person.updated_at !== session.collaborator_version) {
    throw new AccessError(401, 'Seu acesso foi alterado. Entre novamente.');
  }
  if (roles && !roles.includes(person.role)) throw new AccessError(403, 'Você não tem permissão para esta operação.');
  return { role: person.role as UserRole, userName: person.name as string,
    collaboratorId: person.id as string, sessionId: session.id as string };
}

export function apiError(error: unknown) {
  return Response.json({ message: error instanceof AccessError ? error.message : 'Operação indisponível. Tente novamente.',
    success: false }, { status: error instanceof AccessError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.APP_ORIGIN;
  const isAllowed = origin && (origin === requestOrigin || (configuredOrigin && origin === configuredOrigin));
  if (!isAllowed || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AccessError(403, 'Origem da solicitação não permitida.');
  }
}

export async function readJsonBody(request: Request, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new AccessError(415, 'Envie os dados no formato JSON.');
  }
  if (Number(request.headers.get('content-length')) > limit) throw new AccessError(413, 'Envie um lote menor.');
  const reader = request.body?.getReader();
  if (!reader) throw new AccessError(400, 'Dados inválidos.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AccessError(413, 'Envie um lote menor.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AccessError(400, 'Dados inválidos.'); }
}
