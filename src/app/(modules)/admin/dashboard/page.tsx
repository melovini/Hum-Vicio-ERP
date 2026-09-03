'use client';
import { useState, useEffect, useMemo } from 'react';
import { useInventory } from '@/lib/store';
import { 
  ArrowLeft, LayoutDashboard, TrendingUp, TrendingDown, 
  DollarSign, AlertTriangle, Utensils, Settings2, Check,
  Store, Bike, ShoppingBag, PieChart, Award, Users, Info
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { sales = [], isLoaded, getRealSalesCmv, getTotalWasteCost, wasteRecords = [] } = useInventory();
  
  // Despesas fixas diárias customizáveis (ex: R$ 150/dia = ~R$ 4.500/mês)
  const [dailyFixedExpense, setDailyFixedExpense] = useState<number>(150);
  const [editingExpense, setEditingExpense] = useState(false);
  const [tempExpense, setTempExpense] = useState('150');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hum_vicio_daily_fixed_expense');
      if (saved) {
        setDailyFixedExpense(Number(saved) || 150);
        setTempExpense(saved);
      }
    } catch {}
  }, []);

  const saveExpense = () => {
    const val = Number(tempExpense) || 0;
    setDailyFixedExpense(val);
    try {
      localStorage.setItem('hum_vicio_daily_fixed_expense', val.toString());
    } catch {}
    setEditingExpense(false);
  };

  // 1. Vendas concluídas com proteção estrita contra nulos
  const validSales = useMemo(() => {
    if (!Array.isArray(sales)) return [];
    return sales.filter(s => s && s.status === 'completed');
  }, [sales]);
  
  const totalRevenue = useMemo(() => {
    return validSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [validSales]);

  const ifoodRevenue = useMemo(() => {
    return validSales
      .filter(s => s.channel === 'ifood')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [validSales]);

  const balcaoRevenue = useMemo(() => {
    return validSales
      .filter(s => s.channel === 'balcao')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [validSales]);

  // 2. CMV Real dos lanches vendidos (fallback seguro se função não estiver pronta)
  const realCmv = useMemo(() => {
    try {
      if (typeof getRealSalesCmv === 'function') {
        const val = getRealSalesCmv();
        return Number(val) || 0;
      }
    } catch {}
    return totalRevenue * 0.30;
  }, [getRealSalesCmv, totalRevenue]);

  const cmvPercentage = totalRevenue > 0 ? (realCmv / totalRevenue) * 100 : 0;

  // 3. Custo Total de Desperdícios / Quebras
  const wasteLoss = useMemo(() => {
    try {
      if (typeof getTotalWasteCost === 'function') {
        return Number(getTotalWasteCost()) || 0;
      }
    } catch {}
    if (Array.isArray(wasteRecords)) {
      return wasteRecords.reduce((acc, w) => acc + (Number(w?.totalLoss) || 0), 0);
    }
    return 0;
  }, [getTotalWasteCost, wasteRecords]);

  // 4. Taxas de Operação (iFood 33% / 23%, Cartões 1% a 3%)
  const totalFees = useMemo(() => {
    return validSales.reduce((acc, sale) => {
      const tot = Number(sale.total) || 0;
      let feeRate = 0;
      if (sale.paymentMethod === 'ifood_online') {
        feeRate = 0.33;
      } else if (sale.paymentMethod === 'ifood_entrega' || sale.paymentMethod === 'ifood') {
        feeRate = 0.23;
      } else if (sale.channel === 'ifood') {
        feeRate = 0.23;
      } else {
        if (sale.paymentMethod === 'credito') feeRate = 0.03;
        else if (sale.paymentMethod === 'debito') feeRate = 0.01;
        else if (sale.paymentMethod === 'pix' || sale.paymentMethod === 'dinheiro') feeRate = 0.00;
      }
      return acc + (tot * feeRate);
    }, 0);
  }, [validSales]);

  const ifoodOnlineRevenue = useMemo(() => {
    return validSales
      .filter(s => s.paymentMethod === 'ifood_online')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [validSales]);

  const ifoodEntregaRevenue = useMemo(() => {
    return validSales
      .filter(s => s.paymentMethod === 'ifood_entrega' || (s.channel === 'ifood' && s.paymentMethod !== 'ifood_online'))
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [validSales]);

  // 5. Margem de Contribuição e Lucro Líquido Real
  const contributionMargin = totalRevenue - realCmv - wasteLoss - totalFees;
  const netProfit = contributionMargin - dailyFixedExpense;

  // 6. Métricas por Modalidade (Mesa vs Retirada vs Delivery)
  const modalityStats = useMemo(() => {
    let mesaTotal = 0, mesaCount = 0;
    let retiradaTotal = 0, retiradaCount = 0;
    let deliveryTotal = 0, deliveryCount = 0;

    validSales.forEach(s => {
      const type = s.orderType || (s.channel === 'ifood' ? 'delivery' : 'mesa');
      const tot = Number(s.total) || 0;
      if (type === 'delivery') {
        deliveryTotal += tot;
        deliveryCount += 1;
      } else if (type === 'retirada') {
        retiradaTotal += tot;
        retiradaCount += 1;
      } else {
        mesaTotal += tot;
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
    <div className="min-h-screen bg-surface-ground text-slate-100 p-4 md:p-6 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="p-2.5 bg-surface-card border border-surface-border text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Voltar para a Home"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="inline-flex items-center gap-1.5 text-brand-accent font-medium text-xs tracking-wider mb-0.5">
                <LayoutDashboard size={14} /> Módulo Gestão Executiva
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">DRE de Precisão & Indicadores</h1>
              <p className="text-xs text-slate-400">
                Demonstrativo de resultado do exercício, lucratividade líquida real e análise por canais.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/colaboradores"
              className="py-2 px-3.5 bg-surface-card hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              👥 Colaboradores
            </Link>
            <Link
              href="/admin/engenharia"
              className="py-2 px-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Award size={14} /> BCG Cardápio
            </Link>
          </div>
        </div>

        {/* Banner informativo quando o caixa ainda não possui vendas concluídas */}
        {validSales.length === 0 && (
          <div className="p-3.5 bg-surface-card rounded-xl border border-surface-border flex items-center gap-3 text-xs text-slate-300">
            <Info size={16} className="text-brand-accent shrink-0" />
            <span>
              <strong>Modo de Visualização Inicial:</strong> Nenhum pedido finalizado registrado no período. A estrutura completa do DRE e os gráficos analíticos estão prontos para receber lançamentos do Caixa e do iFood.
            </span>
          </div>
        )}

        {/* KPIs Estratégicos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Faturamento Bruto */}
          <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-1">
            <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Faturamento Bruto</span>
            <p className="text-2xl font-mono tabular-nums font-bold text-slate-100">
              R$ {totalRevenue.toFixed(2)}
            </p>
            <p className="text-[11px] text-status-free flex items-center gap-1 font-mono tabular-nums">
              <TrendingUp size={13} /> {validSales.length} pedidos faturados
            </p>
          </div>
          
          {/* CMV Real */}
          <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-1">
            <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">CMV Real (Insumos)</span>
            <p className="text-2xl font-mono tabular-nums font-bold text-status-occupied">
              R$ {realCmv.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono tabular-nums">
              <strong className="text-slate-200">{cmvPercentage.toFixed(1)}%</strong> da receita bruta
            </p>
          </div>

          {/* Desperdícios & Quebras */}
          <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-1">
            <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Perdas & Descarte</span>
            <p className="text-2xl font-mono tabular-nums font-bold text-status-danger">
              - R$ {wasteLoss.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono tabular-nums">
              {(wasteRecords || []).length} descartes lançados
            </p>
          </div>

          {/* Resultado Líquido Real */}
          <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-1">
            <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Resultado Líquido Real</span>
            <p className={`text-2xl font-mono tabular-nums font-bold ${netProfit >= 0 ? 'text-status-free' : 'text-status-danger'}`}>
              R$ {netProfit.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono tabular-nums">
              Margem Líquida: <strong className="text-slate-200">{totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0'}%</strong>
            </p>
          </div>
        </div>

        {/* Canais de Venda */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* Balcão */}
          <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                🏪 Vendas Balcão / Loja Física
              </span>
              <span className="font-mono tabular-nums text-sm font-bold text-brand-accent">
                R$ {balcaoRevenue.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-surface-ground h-2 rounded-full overflow-hidden border border-surface-border">
              <div 
                className="bg-brand-accent h-full rounded-full transition-all duration-300" 
                style={{ width: `${totalRevenue > 0 ? (balcaoRevenue / totalRevenue) * 100 : 0}%` }} 
              />
            </div>
            <p className="text-[10px] text-slate-500 text-right font-mono tabular-nums">
              {totalRevenue > 0 ? ((balcaoRevenue / totalRevenue) * 100).toFixed(1) : '0.0'}% do total faturado
            </p>
          </div>

          {/* iFood */}
          <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                🛵 Vendas iFood Total
              </span>
              <span className="font-mono tabular-nums text-sm font-bold text-status-danger">
                R$ {ifoodRevenue.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-surface-ground h-2 rounded-full overflow-hidden border border-surface-border">
              <div 
                className="bg-status-danger h-full rounded-full transition-all duration-300" 
                style={{ width: `${totalRevenue > 0 ? (ifoodRevenue / totalRevenue) * 100 : 0}%` }} 
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 pt-1 border-t border-surface-border">
              <span>Online (33%): <strong className="text-status-danger">R$ {ifoodOnlineRevenue.toFixed(2)}</strong></span>
              <span>Entrega (23%): <strong className="text-status-occupied">R$ {ifoodEntregaRevenue.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>

        {/* Distribuição por Modalidade de Consumo */}
        <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-4">
          <div className="flex items-center gap-2">
            <PieChart size={18} className="text-brand-accent" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Vendas por Modalidade (CAC & Retenção)</h2>
              <p className="text-[11px] text-slate-400">Análise comparativa de consumo: Salão/Mesa, Retirada no Balcão e Entregas.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* MESA */}
            <div className="p-3.5 rounded-lg bg-surface-ground border border-surface-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-semibold text-status-occupied uppercase tracking-wider">
                    🍽️ Consumo Mesa / Salão
                  </span>
                  <span className="text-xs font-mono tabular-nums font-bold text-slate-400">
                    {modalityStats.mesa.pct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xl font-mono tabular-nums font-bold text-white">
                  R$ {modalityStats.mesa.total.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                  {modalityStats.mesa.count} pedidos • Ticket Médio: <strong className="text-slate-200">R$ {modalityStats.mesa.avg.toFixed(2)}</strong>
                </p>
              </div>
              <div className="pt-2 border-t border-surface-border">
                <span className="text-[10px] text-status-free font-medium">
                  ✓ Sem taxa de comissão e CAC orgânico
                </span>
              </div>
            </div>

            {/* RETIRADA */}
            <div className="p-3.5 rounded-lg bg-surface-ground border border-surface-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-semibold text-brand-accent uppercase tracking-wider">
                    🥡 Retirada no Balcão
                  </span>
                  <span className="text-xs font-mono tabular-nums font-bold text-slate-400">
                    {modalityStats.retirada.pct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xl font-mono tabular-nums font-bold text-white">
                  R$ {modalityStats.retirada.total.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                  {modalityStats.retirada.count} pedidos • Ticket Médio: <strong className="text-slate-200">R$ {modalityStats.retirada.avg.toFixed(2)}</strong>
                </p>
              </div>
              <div className="pt-2 border-t border-surface-border">
                <span className="text-[10px] text-brand-accent font-medium">
                  ✓ Maior margem líquida (Sem taxa e sem garçom)
                </span>
              </div>
            </div>

            {/* DELIVERY */}
            <div className="p-3.5 rounded-lg bg-surface-ground border border-surface-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-semibold text-status-free uppercase tracking-wider">
                    🛵 Entrega / Delivery
                  </span>
                  <span className="text-xs font-mono tabular-nums font-bold text-slate-400">
                    {modalityStats.delivery.pct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xl font-mono tabular-nums font-bold text-white">
                  R$ {modalityStats.delivery.total.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                  {modalityStats.delivery.count} pedidos • Ticket Médio: <strong className="text-slate-200">R$ {modalityStats.delivery.avg.toFixed(2)}</strong>
                </p>
              </div>
              <div className="pt-2 border-t border-surface-border">
                <span className="text-[10px] text-status-occupied font-medium">
                  ⚠️ Sujeito a taxa de motoboy ou comissão iFood
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* DRE Detalhado Real */}
        <div className="bg-surface-card rounded-xl p-5 border border-surface-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Demonstrativo de Resultado do Exercício (DRE Real)</h2>
              <p className="text-xs text-slate-400">Visão financeira auditável com deduções linha por linha.</p>
            </div>
            
            {/* Controle de Despesas Fixas */}
            <div className="flex items-center gap-2 bg-surface-ground border border-surface-border px-3 py-1.5 rounded-lg text-xs">
              <Settings2 size={14} className="text-slate-400" />
              <span className="text-slate-400 text-[11px]">Despesa Fixa Diária:</span>
              {editingExpense ? (
                <div className="flex items-center gap-1.5">
                  <input 
                    type="number"
                    value={tempExpense}
                    onChange={e => setTempExpense(e.target.value)}
                    className="w-16 input-util py-0.5 px-1.5 font-mono tabular-nums text-xs"
                    autoFocus
                  />
                  <button onClick={saveExpense} className="p-1 bg-brand-primary hover:bg-brand-primaryHover text-white rounded cursor-pointer">
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setEditingExpense(true)} 
                  className="font-mono tabular-nums font-bold text-slate-200 hover:text-brand-accent underline decoration-dotted cursor-pointer"
                  title="Clique para editar a estimativa diária de custos fixos"
                >
                  R$ {dailyFixedExpense.toFixed(2)}/dia
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between p-3 bg-surface-ground rounded-lg border border-surface-border">
              <span className="font-bold text-slate-200">(=) Receita Bruta Faturada</span>
              <span className="font-mono tabular-nums text-status-free font-bold text-sm">R$ {totalRevenue.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between p-2.5 px-3 border-b border-surface-border/60">
              <span className="text-slate-400 pl-3">(-) CMV Real (Insumos dos Lanches Vendidos)</span>
              <span className="font-mono tabular-nums text-status-occupied font-semibold">- R$ {realCmv.toFixed(2)}</span>
            </div>

            <div className="flex justify-between p-2.5 px-3 border-b border-surface-border/60">
              <span className="text-slate-400 pl-3">(-) Desperdícios & Quebras (Cozinha)</span>
              <span className="font-mono tabular-nums text-status-danger font-semibold">- R$ {wasteLoss.toFixed(2)}</span>
            </div>

            <div className="flex justify-between p-2.5 px-3 border-b border-surface-border/60">
              <span className="text-slate-400 pl-3">(-) Taxas de Operação (iFood 33% / 23% / Cartões 1%-3%)</span>
              <span className="font-mono tabular-nums text-status-danger font-semibold">- R$ {totalFees.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between p-3 bg-surface-elevated rounded-lg border border-brand-accent/20">
              <span className="font-bold text-brand-accent">(=) Margem de Contribuição Real</span>
              <span className="font-mono tabular-nums text-brand-accent font-bold text-sm">R$ {contributionMargin.toFixed(2)}</span>
            </div>

            <div className="flex justify-between p-2.5 px-3 border-b border-surface-border/60">
              <span className="text-slate-400 pl-3">(-) Despesas Fixas (Rateio Diário: Equipe, Aluguel, Luz)</span>
              <span className="font-mono tabular-nums text-status-danger font-semibold">- R$ {dailyFixedExpense.toFixed(2)}</span>
            </div>

            <div className={`flex justify-between items-center p-4 rounded-xl mt-3 border ${
              netProfit >= 0 ? 'bg-status-free/10 border-status-free/30' : 'bg-status-danger/10 border-status-danger/30'
            }`}>
              <div>
                <span className="font-bold text-sm text-white">(=) Lucro / Prejuízo Líquido</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Saldo real restante após a quitação de todos os custos variáveis e fixos</p>
              </div>
              <span className={`font-mono tabular-nums text-2xl font-bold ${netProfit >= 0 ? 'text-status-free' : 'text-status-danger'}`}>
                R$ {netProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
