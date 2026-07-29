'use client';
import { useInventory } from '@/lib/store';
import { ArrowLeft, LayoutDashboard, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { sales, isLoaded } = useInventory();

  if (!isLoaded) return null;

  // Filtra apenas vendas concluídas
  const validSales = sales.filter(s => s.status === 'completed');
  
  const totalRevenue = validSales.reduce((acc, s) => acc + s.total, 0);
  const ifoodRevenue = validSales.filter(s => s.channel === 'ifood').reduce((acc, s) => acc + s.total, 0);
  const balcaoRevenue = validSales.filter(s => s.channel === 'balcao').reduce((acc, s) => acc + s.total, 0);

  // Despesas Fixas Mockadas (Aluguel, Folha, Impostos)
  const fixedExpenses = 4500;
  // Custo Variável Estimado (Mockado 35% do faturamento para exemplo do DRE)
  const variableCost = totalRevenue * 0.35;
  
  const netProfit = totalRevenue - fixedExpenses - variableCost;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-blue-400 font-bold mb-1">
                <LayoutDashboard size={20} /> Módulo Gestão
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Dashboard DRE</h1>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="glass-card rounded-3xl p-6 border-t-4 border-emerald-500">
            <p className="text-sm text-slate-400 font-bold mb-2">Faturamento Total</p>
            <p className="text-3xl font-mono font-bold text-white">R$ {totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1"><TrendingUp size={14}/> Hoje</p>
          </div>
          
          <div className="glass-card rounded-3xl p-6 border-t-4 border-blue-500">
            <p className="text-sm text-slate-400 font-bold mb-2">Vendas Balcão</p>
            <p className="text-2xl font-mono font-bold text-slate-200">R$ {balcaoRevenue.toFixed(2)}</p>
            <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${totalRevenue ? (balcaoRevenue/totalRevenue)*100 : 0}%` }} />
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 border-t-4 border-red-500">
            <p className="text-sm text-slate-400 font-bold mb-2">Vendas iFood</p>
            <p className="text-2xl font-mono font-bold text-slate-200">R$ {ifoodRevenue.toFixed(2)}</p>
            <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
              <div className="bg-red-500 h-full" style={{ width: `${totalRevenue ? (ifoodRevenue/totalRevenue)*100 : 0}%` }} />
            </div>
          </div>

          <div className={`glass-card rounded-3xl p-6 border-t-4 ${netProfit >= 0 ? 'border-emerald-500' : 'border-red-500'}`}>
            <p className="text-sm text-slate-400 font-bold mb-2">Resultado Líquido</p>
            <p className={`text-3xl font-mono font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              R$ {netProfit.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-2">DRE Projetado Diário</p>
          </div>
        </div>

        {/* DRE Simplificado */}
        <div className="glass-card rounded-3xl p-8 border border-slate-800">
          <h2 className="text-2xl font-bold text-white mb-6">DRE Simplificado (Visão à Vista)</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between p-4 bg-slate-950/50 rounded-xl">
              <span className="font-bold text-slate-300">(=) Receita Bruta</span>
              <span className="font-mono text-emerald-400">R$ {totalRevenue.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between p-4 border-b border-slate-800/50">
              <span className="text-slate-400 pl-4">(-) Custo Variável Estimado (CMV + Taxas)</span>
              <span className="font-mono text-red-400">- R$ {variableCost.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between p-4 bg-slate-900/50 rounded-xl">
              <span className="font-bold text-slate-300">(=) Margem de Contribuição</span>
              <span className="font-mono text-blue-400">R$ {(totalRevenue - variableCost).toFixed(2)}</span>
            </div>

            <div className="flex justify-between p-4 border-b border-slate-800/50">
              <span className="text-slate-400 pl-4">(-) Despesas Fixas (Rateio Diário: Aluguel, Folha)</span>
              <span className="font-mono text-red-400">- R$ {fixedExpenses.toFixed(2)}</span>
            </div>

            <div className={`flex justify-between p-6 rounded-xl mt-4 ${netProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <span className="font-bold text-xl text-white">(=) Lucro/Prejuízo Líquido</span>
              <span className={`font-mono text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                R$ {netProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
