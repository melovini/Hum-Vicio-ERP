'use client';
import { useState, useEffect } from 'react';
import { useInventory } from '@/lib/store';
import { 
  ArrowLeft, LayoutDashboard, TrendingUp, TrendingDown, 
  DollarSign, AlertTriangle, Utensils, Settings2, Check 
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { sales, isLoaded, getRealSalesCmv, getTotalWasteCost, wasteRecords } = useInventory();
  
  // Despesas fixas diárias customizáveis (ex: R$ 150/dia = ~R$ 4.500/mês)
  const [dailyFixedExpense, setDailyFixedExpense] = useState<number>(150);
  const [editingExpense, setEditingExpense] = useState(false);
  const [tempExpense, setTempExpense] = useState('150');

  useEffect(() => {
    const saved = localStorage.getItem('hum_vicio_daily_fixed_expense');
    if (saved) {
      setDailyFixedExpense(Number(saved) || 150);
      setTempExpense(saved);
    }
  }, []);

  const saveExpense = () => {
    const val = Number(tempExpense) || 0;
    setDailyFixedExpense(val);
    localStorage.setItem('hum_vicio_daily_fixed_expense', val.toString());
    setEditingExpense(false);
  };

  if (!isLoaded) return null;

  // Filtra apenas vendas concluídas
  const validSales = sales.filter(s => s.status === 'completed');
  
  const totalRevenue = validSales.reduce((acc, s) => acc + s.total, 0);
  const ifoodRevenue = validSales.filter(s => s.channel === 'ifood').reduce((acc, s) => acc + s.total, 0);
  const balcaoRevenue = validSales.filter(s => s.channel === 'balcao').reduce((acc, s) => acc + s.total, 0);

  // 1. CMV Real baseado nas Fichas Técnicas dos lanches vendidos
  const realCmv = getRealSalesCmv();
  const cmvPercentage = totalRevenue > 0 ? (realCmv / totalRevenue) * 100 : 0;

  // 2. Custo Total de Desperdícios / Quebras registradas pela Cozinha
  const wasteLoss = getTotalWasteCost();

  // 3. Cálculo exato de Taxas (Cartões / iFood)
  const totalFees = validSales.reduce((acc, sale) => {
    let feeRate = 0;
    if (sale.channel === 'ifood') {
      feeRate = 0.30; // 30% iFood
    } else {
      if (sale.paymentMethod === 'credito') feeRate = 0.03;
      else if (sale.paymentMethod === 'debito' || sale.paymentMethod === 'pix') feeRate = 0.01;
    }
    return acc + (sale.total * feeRate);
  }, 0);

  // 4. Margem de Contribuição e Lucro Líquido Real
  const contributionMargin = totalRevenue - realCmv - wasteLoss - totalFees;
  const netProfit = contributionMargin - dailyFixedExpense;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-blue-400 font-bold mb-1">
                <LayoutDashboard size={20} /> Módulo Gestão Executiva
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">DRE de Precisão Absoluta</h1>
            </div>
          </div>
        </header>

        {/* KPIs Estratégicos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass-card rounded-3xl p-6 border-t-4 border-emerald-500">
            <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">Faturamento Bruto</p>
            <p className="text-3xl font-mono font-bold text-white">R$ {totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              <TrendingUp size={14}/> {validSales.length} pedidos faturados
            </p>
          </div>
          
          <div className="glass-card rounded-3xl p-6 border-t-4 border-amber-500">
            <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">CMV Real dos Lanches</p>
            <p className="text-3xl font-mono font-bold text-amber-400">R$ {realCmv.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-2">
              <strong className="text-slate-200">{cmvPercentage.toFixed(1)}%</strong> da receita bruta
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border-t-4 border-red-500">
            <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">Perdas & Descarte</p>
            <p className="text-3xl font-mono font-bold text-red-400">- R$ {wasteLoss.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-2">
              {wasteRecords.length} descartes lançados
            </p>
          </div>

          <div className={`glass-card rounded-3xl p-6 border-t-4 ${netProfit >= 0 ? 'border-emerald-500' : 'border-red-500'}`}>
            <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">Resultado Líquido Real</p>
            <p className={`text-3xl font-mono font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              R$ {netProfit.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Margem Líquida: <strong className="text-slate-200">{totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0'}%</strong>
            </p>
          </div>
        </div>

        {/* Canais de Venda */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="glass-card rounded-3xl p-6 border border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-slate-300">Vendas Balcão</span>
              <span className="font-mono text-lg font-bold text-blue-400">R$ {balcaoRevenue.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${totalRevenue ? (balcaoRevenue/totalRevenue)*100 : 0}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-right">
              {totalRevenue ? ((balcaoRevenue/totalRevenue)*100).toFixed(1) : 0}% do total
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-slate-300">Vendas iFood</span>
              <span className="font-mono text-lg font-bold text-red-400">R$ {ifoodRevenue.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div className="bg-red-500 h-full rounded-full transition-all" style={{ width: `${totalRevenue ? (ifoodRevenue/totalRevenue)*100 : 0}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-right">
              {totalRevenue ? ((ifoodRevenue/totalRevenue)*100).toFixed(1) : 0}% do total
            </p>
          </div>
        </div>

        {/* DRE Detalhado Real */}
        <div className="glass-card rounded-3xl p-8 border border-slate-800 mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-white">Demonstrativo de Resultado (DRE Real)</h2>
            
            {/* Controle de Despesas Fixas */}
            <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 px-4 py-2 rounded-2xl text-xs">
              <Settings2 size={16} className="text-slate-400" />
              <span className="text-slate-400">Despesa Fixa Diária:</span>
              {editingExpense ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    value={tempExpense}
                    onChange={e => setTempExpense(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                    autoFocus
                  />
                  <button onClick={saveExpense} className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer">
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setEditingExpense(true)} 
                  className="font-mono font-bold text-slate-200 hover:text-blue-400 underline decoration-dotted cursor-pointer"
                  title="Clique para editar a estimativa diária de custos fixos"
                >
                  R$ {dailyFixedExpense.toFixed(2)}/dia
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between p-4 bg-slate-950/60 rounded-xl">
              <span className="font-bold text-slate-200">(=) Receita Bruta Faturada</span>
              <span className="font-mono text-emerald-400 font-bold text-lg">R$ {totalRevenue.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between p-4 border-b border-slate-800/60">
              <span className="text-slate-400 pl-4">(-) CMV Real (Insumos dos Lanches Vendidos)</span>
              <span className="font-mono text-amber-400 font-semibold">- R$ {realCmv.toFixed(2)}</span>
            </div>

            <div className="flex justify-between p-4 border-b border-slate-800/60">
              <span className="text-slate-400 pl-4">(-) Desperdícios & Quebras (Cozinha)</span>
              <span className="font-mono text-red-400 font-semibold">- R$ {wasteLoss.toFixed(2)}</span>
            </div>

            <div className="flex justify-between p-4 border-b border-slate-800/60">
              <span className="text-slate-400 pl-4">(-) Taxas de Operação (iFood 30% / Cartão 3% / Pix-Déb 1%)</span>
              <span className="font-mono text-red-400 font-semibold">- R$ {totalFees.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between p-4 bg-slate-900/60 rounded-xl border border-blue-500/20">
              <span className="font-bold text-blue-300">(=) Margem de Contribuição Real</span>
              <span className="font-mono text-blue-400 font-bold text-lg">R$ {contributionMargin.toFixed(2)}</span>
            </div>

            <div className="flex justify-between p-4 border-b border-slate-800/60">
              <span className="text-slate-400 pl-4">(-) Despesas Fixas (Rateio Diário: Aluguel, Equipe, Luz)</span>
              <span className="font-mono text-red-400 font-semibold">- R$ {dailyFixedExpense.toFixed(2)}</span>
            </div>

            <div className={`flex justify-between p-6 rounded-2xl mt-4 border ${netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
              <div>
                <span className="font-extrabold text-xl text-white">(=) Lucro / Prejuízo Líquido</span>
                <p className="text-xs text-slate-400 mt-0.5">Dinheiro real que sobra para a empresa após todas as deduções</p>
              </div>
              <span className={`font-mono text-3xl font-extrabold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                R$ {netProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
