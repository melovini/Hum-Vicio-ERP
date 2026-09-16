'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/login/actions';

export default function SessionGuard() {
  const pathname = usePathname();
  useEffect(() => {
    // Remover qualquer cache legado que continha credenciais.
    try { localStorage.removeItem('hum_vicio_collaborators'); } catch {}
    if (pathname === '/login') return;
    let lastActivity = Date.now();
    let lastSent = 0;
    let closing = false;
    const close = () => { if (!closing) { closing = true; void logoutAction(); } };
    const activity = () => {
      if (Date.now() - lastActivity >= 30 * 60_000) { close(); return; }
      lastActivity = Date.now();
      if (lastActivity - lastSent < 60_000) return;
      lastSent = lastActivity;
      void fetch('/api/session/activity', { method: 'POST' }).then(res => {
        if (res.status === 401) close();
      }).catch(() => {});
    };
    const interval = setInterval(() => { if (Date.now() - lastActivity >= 30 * 60_000) close(); }, 15_000);
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener('session-expired', close);
    return () => {
      clearInterval(interval);
      events.forEach(event => window.removeEventListener(event, activity));
      window.removeEventListener('session-expired', close);
    };
  }, [pathname]);
  return null;
}
