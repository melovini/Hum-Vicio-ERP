import Link from 'next/link';
import { ChefHat, MonitorDot, LayoutDashboard, ChevronRight, TrendingUp } from 'lucide-react';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl w-full text-center space-y-12">
        
        <div className="space-y-4 animate-float">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-amber-400 text-sm font-semibold mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            Sistema Online e Sincronizado
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Hum Vício <span className="text-gradient">ERP</span>
          </h1>
          <p className="text-slate-400 text-xl md:text-2xl max-w-2xl mx-auto font-light">
            Gestão inteligente, controle de rupturas e engenharia de cardápio de alta performance.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          {/* Módulo Cozinha */}
          <div className="group relative overflow-hidden flex flex-col items-start text-left gap-4 p-8 glass-card rounded-3xl hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-150 duration-500">
              <ChefHat size={120} />
            </div>
            <div className="p-4 bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-amber-400 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              <ChefHat size={32} />
            </div>
            <div className="z-10 mt-4">
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">Cozinha</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">Painel de rupturas, controle de estoque operacional e perdas.</p>
              
              <div className="flex flex-col gap-2 mt-4">
                <Link href="/cozinha" className="text-amber-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Painel de Faltas
                </Link>
                <Link href="/cozinha/perdas" className="text-amber-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Lançar Perdas
                </Link>
              </div>
            </div>
          </div>

          {/* Módulo Caixa */}
          <div className="group relative overflow-hidden flex flex-col items-start text-left gap-4 p-8 glass-card rounded-3xl hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-150 duration-500 pointer-events-none">
              <MonitorDot size={120} />
            </div>
            <div className="p-4 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 text-emerald-400 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <MonitorDot size={32} />
            </div>
            <div className="z-10 mt-4">
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">Frente de Caixa</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">PDV ágil, controle diário, sangrias e histórico de vendas.</p>
              
              <div className="flex flex-col gap-2 mt-4">
                <Link href="/caixa" className="text-emerald-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Acessar Caixa / PDV
                </Link>
              </div>
            </div>
          </div>

          {/* Módulo Gestão */}
          <div className="group relative overflow-hidden flex flex-col items-start text-left gap-4 p-8 glass-card rounded-3xl hover:-translate-y-2 transition-all duration-300 ring-1 ring-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-150 duration-500 pointer-events-none">
              <LayoutDashboard size={120} />
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 text-blue-400 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <TrendingUp size={32} />
            </div>
            <div className="z-10 mt-4">
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Gestão Executiva</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">DRE, Compras, Cardápio e Simuladores Estratégicos.</p>
              
              <div className="flex flex-col gap-2 mt-4">
                <Link href="/admin/dashboard" className="text-blue-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> DRE & Dashboard
                </Link>
                <Link href="/admin/insumos" className="text-blue-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> CRUD Insumos
                </Link>
                <Link href="/admin/compras" className="text-blue-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Gestão de Compras
                </Link>
                <Link href="/admin/cardapio" className="text-blue-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Ficha Técnica
                </Link>
                <Link href="/admin/precificacao" className="text-blue-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Precificação (iFood)
                </Link>
                <Link href="/admin/simulador" className="text-blue-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Simulador de Combos
                </Link>
                <Link href="/admin/fornecedores" className="text-blue-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Gestão de Fornecedores
                </Link>
                <Link href="/admin/inventario" className="text-emerald-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Auditoria de Inventário Físico
                </Link>
                <Link href="/admin/checklists" className="text-emerald-400 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  <ChevronRight size={16} /> Relatórios de Checklists
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
