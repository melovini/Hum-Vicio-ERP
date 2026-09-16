import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin/AdminShell';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  return <AdminShell isAdmin={session.valid && session.role === 'admin'} userName={session.userName || 'Gestor'}>{children}</AdminShell>;
}
