import { createServerDatabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  try {
    const db = createServerDatabase();
    const { error } = await db.from('app_sessions').select('id').limit(1);

    if (error) {
      return Response.json(
        { status: 'degraded', database: 'error', error: 'Serviço indisponível.', time: timestamp },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return Response.json(
      { status: 'ok', database: 'connected', time: timestamp },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return Response.json(
      { status: 'error', database: 'unreachable', error: 'Serviço indisponível.', time: timestamp },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
