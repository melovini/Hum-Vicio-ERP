import { requireSession, requireSameOrigin, apiError } from '@/lib/security/server-session';
import { createServerDatabase } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = await requireSession();
    const { error } = await createServerDatabase().from('app_sessions')
      .update({ last_seen_at: new Date().toISOString() }).eq('id', session.sessionId);
    if (error) throw error;
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
