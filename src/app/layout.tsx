import type { Metadata } from 'next'
import './globals.css'

import LogoutButton from '@/components/LogoutButton'
import SessionGuard from '@/components/SessionGuard'
import { ToastProvider } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'Hum Vício - ERP',
  description: 'Sistema de Gestão para Hum Vício',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="font-sans bg-slate-950 text-slate-100 min-h-screen antialiased">
        <ToastProvider>{children}</ToastProvider>
        <LogoutButton />
        <SessionGuard />
      </body>
    </html>
  )
}
