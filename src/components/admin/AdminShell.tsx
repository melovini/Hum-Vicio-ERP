'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft, BarChart3, BookOpen, Boxes, Calculator, ChevronLeft, ChevronRight,
  ClipboardCheck, ContactRound, FileCheck2, LayoutGrid, Menu, PackageSearch,
  ReceiptText, ShieldCheck, ShoppingCart, Tags, Truck, UsersRound,
} from 'lucide-react';
import SlidingSheet from '@/components/ui/SlidingSheet';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';

interface AdminShellProps { children: ReactNode; isAdmin: boolean; userName: string }
interface NavItem { href: string; label: string; icon: typeof BarChart3; adminOnly?: boolean }
interface NavGroup { label: string; items: NavItem[] }

const groups: NavGroup[] = [
  { label: 'Visão geral', items: [
    { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/admin/clientes', label: 'Clientes', icon: ContactRound },
    { href: '/admin/fiscal', label: 'Fiscal e NFC-e', icon: ReceiptText },
  ] },
  { label: 'Cardápio e preço', items: [
    { href: '/admin/cardapio', label: 'Cardápio', icon: BookOpen },
    { href: '/admin/engenharia', label: 'Engenharia de cardápio', icon: LayoutGrid },
    { href: '/admin/precificacao', label: 'Precificação', icon: Tags },
    { href: '/admin/simulador', label: 'Simulador', icon: Calculator },
  ] },
  { label: 'Estoque e compras', items: [
    { href: '/admin/insumos', label: 'Insumos', icon: Boxes },
    { href: '/admin/compras', label: 'Compras', icon: ShoppingCart },
    { href: '/admin/fornecedores', label: 'Fornecedores', icon: Truck },
    { href: '/admin/inventario', label: 'Inventário físico', icon: PackageSearch },
  ] },
  { label: 'Operação e equipe', items: [
    { href: '/admin/mesas', label: 'Layout do salão', icon: LayoutGrid },
    { href: '/admin/checklists', label: 'Checklists', icon: ClipboardCheck },
    { href: '/admin/colaboradores', label: 'Colaboradores', icon: UsersRound, adminOnly: true },
    { href: '/admin/auditoria', label: 'Auditoria', icon: ShieldCheck, adminOnly: true },
  ] },
];

function Navigation({ pathname, isAdmin, idPrefix, compact = false, onNavigate }: { pathname: string; isAdmin: boolean; idPrefix: string; compact?: boolean; onNavigate?: () => void }) {
  return <nav aria-label="Navegação da gestão" className="space-y-5">
    {groups.map((group) => {
      const items = group.items.filter((item) => isAdmin || !item.adminOnly);
      const groupId = `${idPrefix}-${group.label.replaceAll(' ', '-').toLowerCase()}`;
      return <section key={group.label} aria-labelledby={groupId}>
        <h2 id={groupId} className={cn('mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted', compact && 'sr-only')}>{group.label}</h2>
        <div className="space-y-1">{items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
            title={compact ? item.label : undefined}
            className={cn('flex min-h-10 items-center rounded-control border text-sm font-medium transition-colors', compact ? 'justify-center px-2' : 'gap-3 px-3', active ? 'border-brand-primary/30 bg-brand-primary/10 text-orange-300' : 'border-transparent text-text-secondary hover:border-border-default hover:bg-surface-elevated hover:text-text-primary')}>
            <Icon size={18} className="shrink-0" aria-hidden="true" />
            {!compact && <span>{item.label}</span>}
          </Link>;
        })}</div>
      </section>;
    })}
  </nav>;
}

export function AdminShell({ children, isAdmin, userName }: AdminShellProps) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { setCompact(window.localStorage.getItem('hum-vicio-admin-nav-compact') === 'true'); } catch { /* A navegação continua expandida sem persistência. */ }
  }, []);
  const toggleCompact = () => setCompact((current) => {
    try { window.localStorage.setItem('hum-vicio-admin-nav-compact', String(!current)); } catch { /* Preferência apenas nesta sessão. */ }
    return !current;
  });

  return <div className="min-h-screen bg-surface-ground lg:flex">
    <a href="#admin-content" className="sr-only z-[110] rounded-control bg-brand-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Pular para o conteúdo</a>
    <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border-default bg-surface-card transition-[width] duration-150 lg:flex', compact ? 'w-20' : 'w-72')}>
      <div className={cn('flex min-h-16 items-center border-b border-border-default px-3', compact ? 'justify-center' : 'justify-between')}>
        {!compact && <div><p className="text-sm font-bold text-text-primary">Hum Vício ERP</p><p className="text-xs text-text-muted">Gestão</p></div>}
        <IconButton label={compact ? 'Expandir navegação' : 'Recolher navegação'} icon={compact ? <ChevronRight size={18} /> : <ChevronLeft size={18} />} onClick={toggleCompact} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3"><Navigation pathname={pathname} isAdmin={isAdmin} idPrefix="desktop-nav" compact={compact} /></div>
      <div className="border-t border-border-default p-3">
        <Link href="/" title={compact ? 'Voltar à central' : undefined} className={cn('flex min-h-10 items-center rounded-control text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary', compact ? 'justify-center' : 'gap-3 px-3')}><ArrowLeft size={18} aria-hidden="true" />{!compact && 'Voltar à central'}</Link>
        {!compact && <p className="mt-2 truncate px-3 text-xs text-text-muted">{userName}</p>}
      </div>
    </aside>

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-40 flex min-h-14 items-center gap-3 border-b border-border-default bg-surface-card/95 px-4 backdrop-blur lg:hidden">
        <IconButton label="Abrir navegação da gestão" icon={<Menu size={20} />} onClick={() => setMobileOpen(true)} />
        <div><p className="text-sm font-semibold text-text-primary">Hum Vício ERP</p><p className="text-[11px] text-text-muted">Gestão</p></div>
      </header>
      <main id="admin-content" tabIndex={-1} className="min-w-0">{children}</main>
    </div>

    <SlidingSheet isOpen={mobileOpen} onClose={() => setMobileOpen(false)} title="Navegação da gestão" description={userName} width="sm">
      <Navigation pathname={pathname} isAdmin={isAdmin} idPrefix="mobile-nav" onNavigate={() => setMobileOpen(false)} />
      <div className="border-t border-border-default pt-4"><Link href="/" onClick={() => setMobileOpen(false)} className="flex min-h-10 items-center gap-3 rounded-control px-3 text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary"><ArrowLeft size={18} />Voltar à central</Link></div>
    </SlidingSheet>
  </div>;
}
