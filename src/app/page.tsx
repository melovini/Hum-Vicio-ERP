import Link from 'next/link';
import { ChefHat, MonitorDot, LayoutDashboard, ChevronRight, TrendingUp, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-surface-ground text-slate-100 overflow-hidden">
      {/* Background blueprint sutil */}
      <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-5xl w-full text-center space-y-10">
        
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-surface-border text-xs font-semibold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-status-free animate-pulse" />
            <span>Hum Vício ERP • Produção e Salão Sincronizados</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
            Operação & Gestão <span className="text-brand-primary">Industrial</span>
          </h1>
          <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto font-normal leading-relaxed">
            Frente de caixa, controle em tempo real de salão com mapa visual de mesas, KDS de cozinha e inteligência de cardápio.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-left">
          
          {/* Módulo Cozinha & KDS */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-borderHover rounded-xl p-6 transition-all flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-status-occupied/10 border border-status-occupied/20 flex items-center justify-center text-status-occupied">
                <ChefHat size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Cozinha & KDS</h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Chapa digital em tempo real, fila futura e controle de rupturas e perdas.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-3 border-t border-surface-border text-xs font-medium">
              <Link href="/cozinha" className="text-status-occupied hover:text-amber-300 flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-surface-elevated transition-colors">
                <span>🔥 KDS Chapa Digital</span>
                <ChevronRight size={14} />
              </Link>
              <Link href="/cozinha/perdas" className="text-slate-400 hover:text-slate-200 flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-surface-elevated transition-colors">
                <span>Lançar Perdas & Desperdício</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Módulo Caixa & Salão */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-borderHover rounded-xl p-6 transition-all flex flex-col justify-between space-y-5 ring-1 ring-brand-primary/20">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                <MonitorDot size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Frente de Caixa & PDV</h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Operação ágil de pedidos, sangrias, conferência cega e mapa interativo de mesas.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-3 border-t border-surface-border text-xs font-medium">
              <Link href="/caixa" className="text-brand-primary hover:text-orange-400 font-semibold flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-surface-elevated transition-colors">
                <span>⚡ Acessar Caixa / PDV</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Módulo Gestão Executiva */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-borderHover rounded-xl p-6 transition-all flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Gestão Executiva</h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  DRE, ficha técnica, BCG de cardápio, estoque e central de auditoria antifraude.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 pt-3 border-t border-surface-border text-[11px] font-medium text-slate-400">
              <Link href="/admin/dashboard" className="hover:text-brand-accent py-1 px-1.5 rounded hover:bg-surface-elevated truncate">
                • DRE & Dashboard
              </Link>
              <Link href="/admin/mesas" className="hover:text-brand-accent py-1 px-1.5 rounded hover:bg-surface-elevated truncate">
                • Layout Salão
              </Link>
              <Link href="/admin/engenharia" className="hover:text-amber-400 py-1 px-1.5 rounded hover:bg-surface-elevated truncate">
                • BCG Cardápio
              </Link>
              <Link href="/admin/insumos" className="hover:text-brand-accent py-1 px-1.5 rounded hover:bg-surface-elevated truncate">
                • Insumos
              </Link>
              <Link href="/admin/compras" className="hover:text-brand-accent py-1 px-1.5 rounded hover:bg-surface-elevated truncate">
                • Compras
              </Link>
              <Link href="/admin/cardapio" className="hover:text-brand-accent py-1 px-1.5 rounded hover:bg-surface-elevated truncate">
                • Ficha Técnica
              </Link>
              <Link href="/admin/precificacao" className="hover:text-brand-accent py-1 px-1.5 rounded hover:bg-surface-elevated truncate">
                • Precificação
              </Link>
              <Link href="/admin/auditoria" className="text-status-free hover:underline py-1 px-1.5 rounded hover:bg-surface-elevated truncate font-semibold">
                🛡️ Auditoria
              </Link>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
