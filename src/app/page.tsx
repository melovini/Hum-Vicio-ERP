import Link from 'next/link';
import { ChefHat, MonitorDot, LayoutDashboard, ChevronRight, TrendingUp, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { logoutAction } from '@/app/login/actions';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const isAdmin = Boolean(session.valid && session.role === 'admin');
  const userRole = session.role || 'colaborador';
  const userName = session.userName || (isAdmin ? 'Administrador Geral' : 'Gerente Operacional');

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-surface-ground text-slate-100 overflow-hidden">
      {/* Blueprint Dot-Grid Sutil */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />

      <div className="relative z-10 max-w-5xl w-full space-y-6">
        
        {/* Barra Superior com Status e Logout */}
        <div className="flex items-center justify-between pb-2 border-b border-surface-border">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-card border border-surface-border text-xs font-semibold text-slate-300 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-status-free animate-pulse" />
            <span>Hum Vício ERP</span>
            <span className="text-slate-500">•</span>
            <span className={`flex items-center gap-1 ${isAdmin ? 'text-brand-primary font-bold' : 'text-amber-400 font-bold'}`}>
              {isAdmin ? <ShieldCheck size={13} /> : <UserCheck size={13} />}
              {isAdmin ? 'Administrador Geral' : 'Gerente Operacional'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Olá, <strong className="text-slate-200">{userName}</strong>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-elevated border border-surface-border text-xs font-medium text-slate-400 hover:text-slate-100 flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                title="Encerrar turno ou trocar de perfil"
              >
                <LogOut size={13} /> Sair
              </button>
            </form>
          </div>
        </div>

        {/* Título e Subtítulo */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            Operação & Gestão <span className="text-brand-primary">Industrial</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-normal leading-relaxed">
            Controle de frente de caixa, KDS digital da chapa, mapas de salão e inteligência estratégica da empresa.
          </p>
        </div>
        
        {/* Grid dos 3 Módulos com Estilo Padronizado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-left">
          
          {/* MÓDULO 1: Cozinha & KDS */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-borderHover rounded-xl p-5 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-surface-ground border border-surface-border flex items-center justify-center text-brand-primary">
                <ChefHat size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Cozinha & KDS</h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  Chapa digital em tempo real, fila futura e controle de desperdícios.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-3 border-t border-surface-border text-xs font-medium">
              <Link 
                href="/cozinha" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2.5 flex items-center justify-between transition-colors"
              >
                <span>🔥 KDS Chapa Digital</span>
                <ChevronRight size={14} className="text-slate-500" />
              </Link>
              <Link 
                href="/cozinha/perdas" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2.5 flex items-center justify-between transition-colors"
              >
                <span>🗑️ Lançar Perdas & Descarte</span>
                <ChevronRight size={14} className="text-slate-500" />
              </Link>
            </div>
          </div>

          {/* MÓDULO 2: Caixa & Salão */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-borderHover rounded-xl p-5 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-surface-ground border border-surface-border flex items-center justify-center text-brand-accent">
                <MonitorDot size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Frente de Caixa & PDV</h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  Operação ágil de pedidos, sangrias, conferência e mapa de mesas na lateral.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-3 border-t border-surface-border text-xs font-medium">
              <Link 
                href="/caixa" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2.5 flex items-center justify-between transition-colors"
              >
                <span>⚡ Acessar Caixa / PDV</span>
                <ChevronRight size={14} className="text-slate-500" />
              </Link>
            </div>
          </div>

          {/* MÓDULO 3: Gestão Executiva */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-borderHover rounded-xl p-5 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-surface-ground border border-surface-border flex items-center justify-center text-brand-primary">
                <TrendingUp size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Gestão Executiva</h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  DRE, ficha técnica, BCG de cardápio, estoque, equipe e auditoria.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-surface-border text-xs font-medium">
              <Link 
                href="/admin/dashboard" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="DRE e Dashboard Financeiro"
              >
                📊 DRE & Dashboard
              </Link>
              
              {/* Colaboradores: Exclusivo Administrador Geral */}
              {isAdmin && (
                <Link 
                  href="/admin/colaboradores" 
                  className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-brand-primary/30 rounded-lg p-2 truncate transition-colors"
                  title="Gestão de Colaboradores e PINs (Exclusivo Master Admin)"
                >
                  👥 Colaboradores
                </Link>
              )}

              <Link 
                href="/admin/mesas" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Editor de Layouts de Salão"
              >
                🗺️ Layout Salão
              </Link>

              <Link 
                href="/admin/engenharia" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Engenharia de Cardápio BCG"
              >
                🍔 BCG Cardápio
              </Link>

              <Link 
                href="/admin/insumos" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Controle de Insumos e Estoque"
              >
                📦 Insumos & Estoque
              </Link>

              <Link 
                href="/admin/compras" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Gestão de Compras e Cotações"
              >
                🛒 Gestão de Compras
              </Link>

              <Link 
                href="/admin/cardapio" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Fichas Técnicas e Receitas"
              >
                📋 Ficha Técnica
              </Link>

              <Link 
                href="/admin/precificacao" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Precificação e Taxas iFood"
              >
                🏷️ Precificação
              </Link>

              <Link 
                href="/admin/fornecedores" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Gestão de Fornecedores"
              >
                🚚 Fornecedores
              </Link>

              <Link 
                href="/admin/inventario" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Auditoria de Inventário Físico"
              >
                🔍 Auditoria Físico
              </Link>

              <Link 
                href="/admin/checklists" 
                className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg p-2 truncate transition-colors"
                title="Relatórios de Checklists Operacionais"
              >
                📝 Checklists
              </Link>

              {/* Auditoria Geral: Exclusivo Administrador Geral */}
              {isAdmin && (
                <Link 
                  href="/admin/auditoria" 
                  className="bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-brand-primary/30 rounded-lg p-2 truncate transition-colors"
                  title="Central de Auditoria e Segurança Antifraude (Exclusivo Master Admin)"
                >
                  🛡️ Auditoria Geral
                </Link>
              )}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
