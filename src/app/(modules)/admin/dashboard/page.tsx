'use client';
import { useState, useEffect, useMemo } from 'react';
import { useInventory } from '@/lib/store';
import { 
  ArrowLeft, LayoutDashboard, TrendingUp, TrendingDown, 
  DollarSign, AlertTriangle, Utensils, Settings2, Check,
  Store, Bike, ShoppingBag, PieChart
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

  // 3. Cálculo exato de Taxas (iFood 23% e 33%, Cartões 1% a 3%)
  const totalFees = validSales.reduce((acc, sale) => {
    let feeRate = 0;
    if (sale.paymentMethod === 'ifood_online') {
      feeRate = 0.33; // 33% iFood Pagamento Online no App
    } else if (sale.paymentMethod === 'ifood_entrega' || sale.paymentMethod === 'ifood') {
      feeRate = 0.23; // 23% iFood Pagamento na Entrega
    } else if (sale.channel === 'ifood') {
      feeRate = 0.23; // Fallback iFood
    } else {
      if (sale.paymentMethod === 'credito') feeRate = 0.03;
      else if (sale.paymentMethod === 'debito') feeRate = 0.01;
      else if (sale.paymentMethod === 'pix' || sale.paymentMethod === 'dinheiro') feeRate = 0.00;
    }
    return acc + (sale.total * feeRate);
  }, 0);

  const ifoodOnlineRevenue = validSales.filter(s => s.paymentMethod === 'ifood_online').reduce((acc, s) => acc + s.total, 0);
  const ifoodEntregaRevenue = validSales.filter(s => s.paymentMethod === 'ifood_entrega' || (s.channel === 'ifood' && s.paymentMethod !== 'ifood_online')).reduce((acc, s) => acc + s.total, 0);

  // 4. Margem de Contribuição e Lucro Líquido Real
  const contributionMargin = totalRevenue - realCmv - wasteLoss - totalFees;
  const netProfit = contributionMargin - dailyFixedExpense;

  // 5. Métricas por Modalidade de Atendimento (Mesa vs Retirada vs Delivery)
  const modalityStats = useMemo(() => {
    let mesaTotal = 0, mesaCount = 0;
    let retiradaTotal = 0, retiradaCount = 0;
    let deliveryTotal = 0, deliveryCount = 0;

    validSales.forEach(s => {
      const type = s.orderType || (s.channel === 'ifood' ? 'delivery' : 'mesa');
      if (type === 'delivery') {
        deliveryTotal += s.total;
        deliveryCount += 1;
      } else if (type === 'retirada') {
        retiradaTotal += s.total;
        retiradaCount += 1;
      } else {
        mesaTotal += s.total;
        mesaCount += 1;
      }
    });

    return {
      mesa: { 
        total: mesaTotal, 
        count: mesaCount, 
        avg: mesaCount > 0 ? mesaTotal / mesaCount : 0, 
        pct: totalRevenue > 0 ? (mesaTotal / totalRevenue) * 100 : 0 
      },
      retirada: { 
        total: retiradaTotal, 
        count: retiradaCount, 
        avg: retiradaCount > 0 ? retiradaTotal / retiradaCount : 0, 
        pct: totalRevenue > 0 ? (retiradaTotal / totalRevenue) * 100 : 0 
      },
      delivery: { 
        total: deliveryTotal, 
        count: deliveryCount, 
        avg: deliveryCount > 0 ? deliveryTotal / deliveryCount : 0, 
        pct: totalRevenue > 0 ? (deliveryTotal / totalRevenue) * 100 : 0 
      },
    };
  }, [validSales, totalRevenue]);

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
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-slate-300">Vendas iFood Total</span>
              <span className="font-mono text-lg font-bold text-red-400">R$ {ifoodRevenue.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div className="bg-red-500 h-full rounded-full transition-all" style={{ width: `${totalRevenue ? (ifoodRevenue/totalRevenue)*100 : 0}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-3 pt-2 border-t border-slate-800/60">
              <span className="text-slate-400">
                Online (33%): <strong className="text-red-400 font-mono">R$ {ifoodOnlineRevenue.toFixed(2)}</strong>
              </span>
              <span className="text-slate-400">
                Entrega (23%): <strong className="text-amber-400 font-mono">R$ {ifoodEntregaRevenue.toFixed(2)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Distribuição por Modalidade de Consumo (Mesa vs Retirada vs Delivery) */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <PieChart size={22} className="text-emerald-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Vendas por Modalidade (CAC & Retenção)</h2>
              <p className="text-xs text-slate-400">Análise de captação e lucratividade: Consumo no Salão, Retirada no Balcão e Entregas.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* MESA */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    🍽️ Consumo Mesa / Salão
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">{modalityStats.mesa.pct.toFixed(1)}%</span>
                </div>
                <p className="text-2xl font-mono font-bold text-white mb-1">
                  R$ {modalityStats.mesa.total.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">
                  {modalityStats.mesa.count} pedidos • Ticket Médio: <strong className="text-slate-200">R$ {modalityStats.mesa.avg.toFixed(2)}</strong>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <span className="text-[11px] text-emerald-400 font-medium">
                  ✓ Sem custo de entrega / CAC orgânico
                </span>
              </div>
            </div>

            {/* RETIRADA */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    🥡 Retirada no Balcão
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">{modalityStats.retirada.pct.toFixed(1)}%</span>
                </div>
                <p className="text-2xl font-mono font-bold text-white mb-1">
                  R$ {modalityStats.retirada.total.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">
                  {modalityStats.retirada.count} pedidos • Ticket Médio: <strong className="text-slate-200">R$ {modalityStats.retirada.avg.toFixed(2)}</strong>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <span className="text-[11px] text-blue-400 font-medium">
                  ✓ Maior margem líquida (Sem taxa e sem garçom)
                </span>
              </div>
            </div>

            {/* DELIVERY */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    🛵 Entrega / Delivery
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">{modalityStats.delivery.pct.toFixed(1)}%</span>
                </div>
                <p className="text-2xl font-mono font-bold text-white mb-1">
                  R$ {modalityStats.delivery.total.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">
                  {modalityStats.delivery.count} pedidos • Ticket Médio: <strong className="text-slate-200">R$ {modalityStats.delivery.avg.toFixed(2)}</strong>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <span className="text-[11px] text-amber-400 font-medium">
                  ⚠️ Sujeito a taxa motoboy e comissão iFood (30%)
                </span>
              </div>
            </div>
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
              <span className="text-slate-400 pl-4">(-) Taxas de Operação (iFood 33% Online / 23% Entrega / Cartões 1%-3%)</span>
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
