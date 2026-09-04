'use client';
import { useState, useEffect, useMemo } from 'react';
import { useInventory, Sale, CashSession, FixedExpensesConfig, DEFAULT_FIXED_EXPENSES } from '@/lib/store';
import { 
  ArrowLeft, LayoutDashboard, TrendingUp, TrendingDown, 
  DollarSign, AlertTriangle, Utensils, Settings2, Check,
  Store, Bike, ShoppingBag, PieChart, Award, Users, Info,
  Calendar, Clock, Filter, GitCompare, Trash2, ShieldAlert,
  ChevronRight, RefreshCw, Flame, BarChart3, AlertCircle,
  Target, Receipt, HelpCircle, X
} from 'lucide-react';
import Link from 'next/link';

type PeriodFilter = 'hoje' | 'ontem' | 'esta_semana' | 'finais_de_semana' | 'este_mes' | 'mes_anterior' | 'personalizado';
type DashboardTab = 'visao_geral' | 'cruzamento_horarios' | 'gerenciar_caixas';

export default function DashboardPage() {
  const { 
    sales = [], 
    isLoaded, 
    getRealSalesCmv, 
    getTotalWasteCost, 
    wasteRecords = [],
    allCashSessions = [],
    deleteCashSession,
    deleteTestSales,
    fixedExpensesConfig = DEFAULT_FIXED_EXPENSES,
    saveFixedExpensesConfig
  } = useInventory();
  
  // Abas de navegação do Dashboard
  const [activeTab, setActiveTab] = useState<DashboardTab>('visao_geral');

  // Filtro Temporal Ativo
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('hoje');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Estados para Cruzamento de Horários
  const [compareDateA, setCompareDateA] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [compareDateB, setCompareDateB] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal de Configuração Estruturada de Custos Fixos Mensais (Break-Even)
  const [showFixedExpensesModal, setShowFixedExpensesModal] = useState(false);
  const [expensesForm, setExpensesForm] = useState<FixedExpensesConfig>(DEFAULT_FIXED_EXPENSES);

  useEffect(() => {
    if (fixedExpensesConfig) {
      setExpensesForm(fixedExpensesConfig);
    }
  }, [fixedExpensesConfig]);

  const handleSaveExpensesForm = (e: React.FormEvent) => {
    e.preventDefault();
    saveFixedExpensesConfig(expensesForm);
    setShowFixedExpensesModal(false);
  };

  // Modal de Exclusão de Caixa de Teste
  const [sessionToDelete, setSessionToDelete] = useState<CashSession | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminActionError, setAdminActionError] = useState('');
  const [adminActionSuccess, setAdminActionSuccess] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper de comparação de data local (YYYY-MM-DD)
  const getLocalDateString = (dateInput: string | Date): string => {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. Filtrar Vendas pelo Período Selecionado
  const filteredSales = useMemo(() => {
    if (!Array.isArray(sales)) return [];
    const completed = sales.filter(s => s && s.status === 'completed');

    const now = new Date();
    const todayStr = getLocalDateString(now);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    // Segunda da semana atual
    const dayOfWeek = now.getDay(); // 0 é domingo
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const mondayStr = getLocalDateString(monday);

    // Mês atual e anterior
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return completed.filter(sale => {
      const saleDate = new Date(sale.date);
      const saleDateStr = getLocalDateString(saleDate);

      switch (periodFilter) {
        case 'hoje':
          return saleDateStr === todayStr;

        case 'ontem':
          return saleDateStr === yesterdayStr;

        case 'esta_semana':
          return saleDateStr >= mondayStr && saleDateStr <= todayStr;

        case 'finais_de_semana': {
          // Sexta (5), Sábado (6) ou Domingo (0) dentro do mês corrente
          const day = saleDate.getDay();
          const isWeekend = day === 0 || day === 5 || day === 6;
          const isThisMonth = saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
          return isWeekend && isThisMonth;
        }

        case 'este_mes':
          return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;

        case 'mes_anterior': {
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return saleDate.getMonth() === prevMonth && saleDate.getFullYear() === prevYear;
        }

        case 'personalizado':
          return saleDateStr >= customStartDate && saleDateStr <= customEndDate;

        default:
          return true;
      }
    });
  }, [sales, periodFilter, customStartDate, customEndDate]);

  // Cálculos do DRE Baseados no Período Filtrado
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [filteredSales]);

  const ifoodRevenue = useMemo(() => {
    return filteredSales
      .filter(s => s.channel === 'ifood')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [filteredSales]);

  const balcaoRevenue = useMemo(() => {
    return filteredSales
      .filter(s => s.channel === 'balcao')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [filteredSales]);

  const realCmv = useMemo(() => {
    try {
      if (typeof getRealSalesCmv === 'function') {
        return getRealSalesCmv(filteredSales);
      }
    } catch {}
    return totalRevenue * 0.30;
  }, [getRealSalesCmv, filteredSales, totalRevenue]);

  const cmvPercentage = totalRevenue > 0 ? (realCmv / totalRevenue) * 100 : 0;

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

  const totalFees = useMemo(() => {
    return filteredSales.reduce((acc, sale) => {
      const tot = Number(sale.total) || 0;
      let feeRate = 0;
      if (sale.paymentMethod === 'ifood_online') feeRate = 0.33;
      else if (sale.paymentMethod === 'ifood_entrega' || sale.paymentMethod === 'ifood') feeRate = 0.23;
      else if (sale.channel === 'ifood') feeRate = 0.23;
      else if (sale.paymentMethod === 'credito') feeRate = 0.03;
      else if (sale.paymentMethod === 'debito') feeRate = 0.01;
      return acc + (tot * feeRate);
    }, 0);
  }, [filteredSales]);

  const ifoodOnlineRevenue = useMemo(() => {
    return filteredSales
      .filter(s => s.paymentMethod === 'ifood_online')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [filteredSales]);

  const ifoodEntregaRevenue = useMemo(() => {
    return filteredSales
      .filter(s => s.paymentMethod === 'ifood_entrega' || (s.channel === 'ifood' && s.paymentMethod !== 'ifood_online'))
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [filteredSales]);

  // Custo Fixo Total Mensal (Soma Estruturada)
  const totalMonthlyFixedExpense = useMemo(() => {
    const cfg = fixedExpensesConfig || DEFAULT_FIXED_EXPENSES;
    return (
      (Number(cfg.rent) || 0) +
      (Number(cfg.electricity) || 0) +
      (Number(cfg.gas) || 0) +
      (Number(cfg.water) || 0) +
      (Number(cfg.internetSoftware) || 0) +
      (Number(cfg.payroll) || 0) +
      (Number(cfg.proLabore) || 0) +
      (Number(cfg.otherExpenses) || 0)
    );
  }, [fixedExpensesConfig]);

  const operatingDaysPerMonth = (fixedExpensesConfig?.operatingDaysPerMonth) || 26;
  const dailyProratedFixedExpense = totalMonthlyFixedExpense / (operatingDaysPerMonth > 0 ? operatingDaysPerMonth : 26);

  // Custo Fixo Rateado Proporcionalmente pelo Filtro de Período
  const proratedFixedExpense = useMemo(() => {
    switch (periodFilter) {
      case 'hoje':
      case 'ontem':
        return dailyProratedFixedExpense * 1;

      case 'esta_semana': {
        const now = new Date();
        const day = now.getDay();
        const daysPassed = day === 0 ? 6 : Math.min(day, 6);
        return dailyProratedFixedExpense * Math.max(1, daysPassed);
      }

      case 'finais_de_semana':
        return dailyProratedFixedExpense * 8; // Média de 8 dias de final de semana/mês

      case 'este_mes':
      case 'mes_anterior':
        return totalMonthlyFixedExpense;

      case 'personalizado': {
        if (!customStartDate || !customEndDate) return dailyProratedFixedExpense;
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        return dailyProratedFixedExpense * diffDays;
      }

      default:
        return dailyProratedFixedExpense;
    }
  }, [periodFilter, dailyProratedFixedExpense, totalMonthlyFixedExpense, customStartDate, customEndDate]);

  // Margem de Contribuição & Ponto de Equilíbrio
  const contributionMargin = totalRevenue - realCmv - wasteLoss - totalFees;
  const contributionMarginRatio = totalRevenue > 0 ? (contributionMargin / totalRevenue) : 0;

  // Ponto de Equilíbrio Financeiro em R$
  const breakEvenRevenue = contributionMarginRatio > 0 
    ? (proratedFixedExpense / contributionMarginRatio) 
    : 0;

  // Contagem de Hambúrgueres / Itens no Período
  const totalBurgersCount = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      return acc + (s.items || []).reduce((itemAcc, item) => itemAcc + (item.quantity || 1), 0);
    }, 0);
  }, [filteredSales]);

  // Ponto de Equilíbrio em Quantidade de Hambúrgueres / Lanches
  const averagePricePerBurger = totalBurgersCount > 0 ? (totalRevenue / totalBurgersCount) : 32.0;
  const averageContributionMarginPerBurger = averagePricePerBurger * (contributionMarginRatio > 0 ? contributionMarginRatio : 0.45);
  const breakEvenBurgersCount = averageContributionMarginPerBurger > 0
    ? Math.ceil(proratedFixedExpense / averageContributionMarginPerBurger)
    : 0;

  // Lucro Líquido Real do Período
  const netProfit = contributionMargin - proratedFixedExpense;

  // Progresso rumo ao Break-Even
  const breakEvenProgress = breakEvenRevenue > 0
    ? Math.min(100, Math.round((totalRevenue / breakEvenRevenue) * 100))
    : (totalRevenue > 0 ? 100 : 0);

  const isBreakEvenReached = totalRevenue >= breakEvenRevenue && breakEvenRevenue > 0;

  // Resumo de Contas a Receber (Fiado VIP & Consumo Equipe)
  const creditSalesSummary = useMemo(() => {
    const all = sales || [];
    const pending = all.filter(s => 
      (s.paymentMethod === 'fiado_vip' || s.paymentMethod === 'consumo_funcionario') && 
      s.creditStatus !== 'quitado' &&
      s.status === 'completed'
    );
    const fiadoPending = pending.filter(s => s.paymentMethod === 'fiado_vip');
    const colabPending = pending.filter(s => s.paymentMethod === 'consumo_funcionario');

    const totalPendingAmount = pending.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const fiadoAmount = fiadoPending.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const colabAmount = colabPending.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    return {
      pendingCount: pending.length,
      totalPendingAmount,
      fiadoCount: fiadoPending.length,
      fiadoAmount,
      colabCount: colabPending.length,
      colabAmount
    };
  }, [sales]);

  const modalityStats = useMemo(() => {
    let mesaTotal = 0, mesaCount = 0;
    let retiradaTotal = 0, retiradaCount = 0;
    let deliveryTotal = 0, deliveryCount = 0;

    filteredSales.forEach(s => {
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
  }, [filteredSales, totalRevenue]);

  // =========================================================================
  // 2. MOTOR DE CRUZAMENTO COMPARATIVO DE HORÁRIOS (Hourly Peak Comparison)
  // =========================================================================
  const hourlyComparisonData = useMemo(() => {
    // Horários operacionais das 11:00 às 02:00 (16 faixas de 1h)
    const hours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2];

    const completed = (sales || []).filter(s => s && s.status === 'completed');

    const salesDateA = completed.filter(s => getLocalDateString(s.date) === compareDateA);
    const salesDateB = completed.filter(s => getLocalDateString(s.date) === compareDateB);

    const totalA = salesDateA.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const totalB = salesDateB.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    let maxRevA = 0;
    let maxHourA = -1;
    let maxRevB = 0;
    let maxHourB = -1;

    const rows = hours.map(hour => {
      const salesInHourA = salesDateA.filter(s => new Date(s.date).getHours() === hour);
      const salesInHourB = salesDateB.filter(s => new Date(s.date).getHours() === hour);

      const revA = salesInHourA.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const countA = salesInHourA.length;

      const revB = salesInHourB.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const countB = salesInHourB.length;

      if (revA > maxRevA) { maxRevA = revA; maxHourA = hour; }
      if (revB > maxRevB) { maxRevB = revB; maxHourB = hour; }

      const diffRev = revB - revA;
      const diffPct = revA > 0 ? ((revB - revA) / revA) * 100 : revB > 0 ? 100 : 0;

      const formattedHour = `${String(hour).padStart(2, '0')}:00`;

      return {
        hour,
        label: formattedHour,
        revA,
        countA,
        revB,
        countB,
        diffRev,
        diffPct
      };
    });

    const diffTotal = totalB - totalA;
    const diffTotalPct = totalA > 0 ? ((totalB - totalA) / totalA) * 100 : totalB > 0 ? 100 : 0;

    return {
      rows,
      totalA,
      totalB,
      diffTotal,
      diffTotalPct,
      countA: salesDateA.length,
      countB: salesDateB.length,
      maxHourA,
      maxRevA,
      maxHourB,
      maxRevB
    };
  }, [sales, compareDateA, compareDateB]);

  // =========================================================================
  // 3. AÇÕES DO ADMINISTRADOR MASTER: EXCLUSÃO DE CAIXA DE TESTE
  // =========================================================================
  const handleConfirmDeleteSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToDelete) return;
    setIsDeleting(true);
    setAdminActionError('');

    try {
      const res = await deleteCashSession(sessionToDelete.id, adminPasswordInput);
      if (!res.success) {
        setAdminActionError(res.error || 'Falha ao excluir caixa.');
      } else {
        setAdminActionSuccess(`Caixa #${sessionToDelete.id.slice(0, 6)} e ${res.count || 0} vendas de teste expurgadas com sucesso!`);
        setTimeout(() => setAdminActionSuccess(''), 4000);
        setSessionToDelete(null);
        setAdminPasswordInput('');
      }
    } catch (err: any) {
      setAdminActionError(err.message || 'Erro inesperado ao excluir caixa.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePurgeTodayTestSales = async () => {
    const todayStr = getLocalDateString(new Date());
    const todaySales = sales.filter(s => getLocalDateString(s.date) === todayStr).map(s => s.id);
    if (todaySales.length === 0) {
      alert('Nenhuma venda registrada hoje para expurgar.');
      return;
    }

    const pass = prompt('CONFIRMAÇÃO MASTER: Digite a senha do Administrador Master para expurgar TODAS as vendas registradas hoje:');
    if (!pass) return;

    const res = await deleteTestSales(todaySales, pass);
    if (!res.success) {
      alert(res.error || 'Senha incorreta.');
    } else {
      alert(`${todaySales.length} vendas de hoje expurgadas com sucesso do faturamento!`);
    }
  };

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
              <h1 className="text-2xl font-bold text-white tracking-tight">DRE & Inteligência Financeira</h1>
              <p className="text-xs text-slate-400">
                Faturamento por períodos, cruzamento por horários de pico e gerenciamento de turnos.
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

        {/* Notificações de Sucesso / Erro do Administrador */}
        {adminActionSuccess && (
          <div className="p-3.5 rounded-xl bg-status-free/10 border border-status-free/30 text-status-free text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Check size={16} /> {adminActionSuccess}
          </div>
        )}

        {/* NAVEGAÇÃO ENTRE ABAS DO DASHBOARD */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card p-2 rounded-xl border border-surface-border">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('visao_geral')}
              className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'visao_geral'
                  ? 'bg-surface-elevated text-white border border-surface-borderHover shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 size={14} className="text-brand-accent" />
              <span>DRE & Visão Geral</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cruzamento_horarios')}
              className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'cruzamento_horarios'
                  ? 'bg-surface-elevated text-white border border-surface-borderHover shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitCompare size={14} className="text-brand-primary" />
              <span>Cruzamento por Horários</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gerenciar_caixas')}
              className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'gerenciar_caixas'
                  ? 'bg-surface-elevated text-white border border-surface-borderHover shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert size={14} className="text-status-danger" />
              <span>Caixas & Reset de Testes</span>
            </button>
          </div>

          {/* Atalho Rápido para o Dono / Master Admin limpar testes do dia */}
          {activeTab === 'gerenciar_caixas' && (
            <button
              type="button"
              onClick={handlePurgeTodayTestSales}
              className="py-1.5 px-3 bg-status-danger/10 hover:bg-status-danger/20 text-status-danger border border-status-danger/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Exclusivo Master Admin: expurgar todas as vendas de teste feitas hoje"
            >
              <Trash2 size={13} /> Limpar Vendas de Teste de Hoje
            </button>
          )}
        </div>

        {/* ================================================================= */}
        {/* ABA 1: DRE & VISÃO GERAL COM FILTROS TEMPORAIS                   */}
        {/* ================================================================= */}
        {activeTab === 'visao_geral' && (
          <div className="space-y-6">
            
            {/* BARRA DE FILTROS TEMPORAIS */}
            <div className="bg-surface-card p-3 rounded-xl border border-surface-border flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 w-full md:w-auto">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1">
                  <Filter size={12} /> Período:
                </span>
                {[
                  { id: 'hoje', label: '📅 Hoje' },
                  { id: 'ontem', label: '⏮️ Ontem' },
                  { id: 'esta_semana', label: '🗓️ Esta Semana' },
                  { id: 'finais_de_semana', label: '🍻 Finais de Semana' },
                  { id: 'este_mes', label: '📆 Este Mês' },
                  { id: 'mes_anterior', label: '⏪ Mês Anterior' },
                  { id: 'personalizado', label: '🎯 Intervalo' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPeriodFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      periodFilter === tab.id
                        ? 'bg-surface-elevated text-slate-100 border border-surface-borderHover shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Seletor de Datas Personalizadas */}
              {periodFilter === 'personalizado' && (
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums bg-surface-ground p-1.5 rounded-lg border border-surface-border">
                  <span className="text-slate-500 text-[11px]">De:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="input-util py-0.5 px-1.5 text-xs text-slate-200"
                  />
                  <span className="text-slate-500 text-[11px]">Até:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="input-util py-0.5 px-1.5 text-xs text-slate-200"
                  />
                </div>
              )}
            </div>

            {/* Banner informativo se o período não possuir vendas */}
            {filteredSales.length === 0 && (
              <div className="p-3.5 bg-surface-card rounded-xl border border-surface-border flex items-center gap-3 text-xs text-slate-300">
                <Info size={16} className="text-brand-accent shrink-0" />
                <span>
                  <strong>Nenhuma venda no período selecionado:</strong> Os indicadores abaixo refletem o estado zerado ({periodFilter === 'finais_de_semana' ? 'apenas vendas de Sexta a Domingo' : 'período filtrado'}).
                </span>
              </div>
            )}

            {/* HERO CARD: PONTO DE EQUILÍBRIO & CONTAS A RECEBER */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Card Ponto de Equilíbrio */}
              <div className="lg:col-span-2 bg-surface-card rounded-xl p-5 border border-surface-border space-y-4 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isBreakEvenReached ? 'bg-status-free/20 text-status-free' : 'bg-brand-primary/20 text-brand-primary'}`}>
                      <Target size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-white tracking-tight">Ponto de Equilíbrio Operacional (Break-Even)</h2>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isBreakEvenReached 
                            ? 'bg-status-free/20 text-status-free border border-status-free/30' 
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {isBreakEvenReached ? 'Lucro Real Atingido' : 'Rumo ao Break-Even'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Custo Fixo Rateado: <strong className="text-slate-200">R$ {proratedFixedExpense.toFixed(2)}</strong> ({periodFilter === 'hoje' || periodFilter === 'ontem' ? '1 dia operacional' : periodFilter})
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFixedExpensesModal(true)}
                    className="py-1.5 px-3 bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
                  >
                    <Settings2 size={13} className="text-slate-400" />
                    <span>Configurar Fixos (R$ {totalMonthlyFixedExpense.toFixed(0)}/mês)</span>
                  </button>
                </div>

                {/* Métricas de Break-Even */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-surface-ground/70 rounded-lg p-3 border border-surface-border/60">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Meta Break-Even (R$)</span>
                    <span className="font-mono tabular-nums text-lg font-bold text-white">
                      R$ {breakEvenRevenue > 0 ? breakEvenRevenue.toFixed(2) : '0.00'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Faturamento mínimo para zero a zero</span>
                  </div>

                  <div className="bg-surface-ground/70 rounded-lg p-3 border border-surface-border/60">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Meta em Hambúrgueres</span>
                    <span className="font-mono tabular-nums text-lg font-bold text-brand-accent">
                      {breakEvenBurgersCount} lanches
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {totalBurgersCount} vendidos ({totalBurgersCount >= breakEvenBurgersCount ? 'Meta atingida' : `faltam ${Math.max(0, breakEvenBurgersCount - totalBurgersCount)}`})
                    </span>
                  </div>

                  <div className="bg-surface-ground/70 rounded-lg p-3 border border-surface-border/60">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Resultado Real</span>
                    <span className={`font-mono tabular-nums text-lg font-bold ${netProfit >= 0 ? 'text-status-free' : 'text-status-danger'}`}>
                      {netProfit >= 0 ? `+ R$ ${netProfit.toFixed(2)}` : `- R$ ${Math.abs(netProfit).toFixed(2)}`}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {netProfit >= 0 ? 'Excedente de Lucro Líquido' : 'Déficit para cobrir custos'}
                    </span>
                  </div>
                </div>

                {/* Barra de Progresso Rumo ao Break-Even */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-mono tabular-nums">
                    <span className="text-slate-400">Faturamento vs Break-Even:</span>
                    <span className={`font-bold ${isBreakEvenReached ? 'text-status-free' : 'text-slate-200'}`}>
                      {breakEvenProgress}% {isBreakEvenReached && '• 100% Cobrindo Custos'}
                    </span>
                  </div>
                  <div className="w-full bg-surface-ground h-2.5 rounded-full overflow-hidden border border-surface-border">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isBreakEvenReached ? 'bg-status-free' : 'bg-brand-primary'}`}
                      style={{ width: `${Math.min(100, breakEvenProgress)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Contas a Receber (Fiado & Colaboradores) */}
              <div className="bg-surface-card rounded-xl p-5 border border-surface-border flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-brand-accent">
                      <Receipt size={18} />
                      <h3 className="text-sm font-bold text-white tracking-tight">Contas a Receber</h3>
                    </div>
                    <Link
                      href="/caixa"
                      className="text-[11px] text-brand-primary hover:text-brand-primaryHover font-semibold transition-colors flex items-center gap-0.5"
                    >
                      Ver no Caixa <ChevronRight size={12} />
                    </Link>
                  </div>
                  <p className="text-xs text-slate-400">Pendências de Fiado VIP e Consumo de Funcionários da equipe.</p>
                </div>

                <div className="p-3 bg-surface-ground rounded-lg border border-surface-border space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Total Pendente:</span>
                    <span className="font-mono tabular-nums text-xl font-bold text-status-occupied">
                      R$ {creditSalesSummary.totalPendingAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-surface-border font-mono tabular-nums">
                    <span>Fiado VIP ({creditSalesSummary.fiadoCount}): <strong className="text-slate-200">R$ {creditSalesSummary.fiadoAmount.toFixed(2)}</strong></span>
                    <span>Equipe ({creditSalesSummary.colabCount}): <strong className="text-slate-200">R$ {creditSalesSummary.colabAmount.toFixed(2)}</strong></span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{creditSalesSummary.pendingCount} lançamentos em aberto</span>
                  <span className="text-status-free font-medium">Auto-baixa no caixa</span>
                </div>
              </div>
            </div>

            {/* KPIs Estratégicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-1">
                <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Faturamento Bruto</span>
                <p className="text-2xl font-mono tabular-nums font-bold text-slate-100">
                  R$ {totalRevenue.toFixed(2)}
                </p>
                <p className="text-[11px] text-status-free flex items-center gap-1 font-mono tabular-nums">
                  <TrendingUp size={13} /> {filteredSales.length} pedidos faturados
                </p>
              </div>
              
              <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-1">
                <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">CMV Real (Insumos)</span>
                <p className="text-2xl font-mono tabular-nums font-bold text-status-occupied">
                  R$ {realCmv.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                  <strong className="text-slate-200">{cmvPercentage.toFixed(1)}%</strong> da receita bruta
                </p>
              </div>

              <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-1">
                <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Perdas & Descarte</span>
                <p className="text-2xl font-mono tabular-nums font-bold text-status-danger">
                  - R$ {wasteLoss.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {(wasteRecords || []).length} descartes lançados
                </p>
              </div>

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
              <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    🏪 Vendas Balcão / Salão
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
                  {totalRevenue > 0 ? ((balcaoRevenue / totalRevenue) * 100).toFixed(1) : '0.0'}% do total
                </p>
              </div>

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

            {/* Modalidades de Consumo */}
            <div className="bg-surface-card rounded-xl p-4 border border-surface-border space-y-4">
              <div className="flex items-center gap-2">
                <PieChart size={18} className="text-brand-accent" />
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Vendas por Modalidade (CAC & Retenção)</h2>
                  <p className="text-[11px] text-slate-400">Análise de consumo: Salão/Mesa, Retirada no Balcão e Entregas.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    <span className="text-[10px] text-status-free font-medium">✓ Sem taxa de entrega</span>
                  </div>
                </div>

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
                    <span className="text-[10px] text-brand-accent font-medium">✓ Maior margem líquida</span>
                  </div>
                </div>

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
                    <span className="text-[10px] text-status-occupied font-medium">⚠️ Sujeito a taxa motoboy/iFood</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DRE Detalhado Real */}
            <div className="bg-surface-card rounded-xl p-5 border border-surface-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Demonstrativo de Resultado do Exercício (DRE Real)</h2>
                  <p className="text-xs text-slate-400">Visão financeira auditável com deduções linha por linha para o período.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFixedExpensesModal(true)}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Settings2 size={13} className="text-brand-accent" />
                    <span>Configurar Custos Fixos (R$ {totalMonthlyFixedExpense.toFixed(2)}/mês)</span>
                  </button>
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
                  <div>
                    <span className="font-bold text-brand-accent">(=) Margem de Contribuição Real</span>
                    <span className="text-[10px] text-slate-400 ml-2 font-mono">({(contributionMarginRatio * 100).toFixed(1)}% da receita)</span>
                  </div>
                  <span className="font-mono tabular-nums text-brand-accent font-bold text-sm">R$ {contributionMargin.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center p-2.5 px-3 border-b border-surface-border/60">
                  <div className="pl-3 space-y-0.5">
                    <span className="text-slate-300 font-medium block">(-) Custos Fixos Estruturados (Rateio do Período)</span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      R$ {totalMonthlyFixedExpense.toFixed(0)}/mês ÷ {operatingDaysPerMonth} dias = R$ {dailyProratedFixedExpense.toFixed(2)}/dia (Aluguel, Luz, Gás, Folha, Pró-Labore...)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono tabular-nums text-status-danger font-semibold block">- R$ {proratedFixedExpense.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setShowFixedExpensesModal(true)}
                      className="text-[10px] text-brand-primary hover:underline cursor-pointer"
                    >
                      Ajustar valores
                    </button>
                  </div>
                </div>

                <div className={`flex justify-between items-center p-4 rounded-xl mt-3 border ${
                  netProfit >= 0 ? 'bg-status-free/10 border-status-free/30' : 'bg-status-danger/10 border-status-danger/30'
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">(=) Lucro / Prejuízo Líquido Real</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        netProfit >= 0 ? 'bg-status-free/20 text-status-free' : 'bg-status-danger/20 text-status-danger'
                      }`}>
                        {netProfit >= 0 ? 'Operação Lucrativa' : 'Abaixo do Break-Even'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isBreakEvenReached 
                        ? `Meta superada em R$ ${netProfit.toFixed(2)} acima de todos os custos fixos.` 
                        : `Faltam R$ ${(Math.max(0, breakEvenRevenue - totalRevenue)).toFixed(2)} de faturamento para cobrir os custos fixos.`
                      }
                    </p>
                  </div>
                  <span className={`font-mono tabular-nums text-2xl font-bold ${netProfit >= 0 ? 'text-status-free' : 'text-status-danger'}`}>
                    {netProfit >= 0 ? `+ R$ ${netProfit.toFixed(2)}` : `- R$ ${Math.abs(netProfit).toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 2: CRUZAMENTO COMPARATIVO POR HORÁRIOS DE PICO               */}
        {/* ================================================================= */}
        {activeTab === 'cruzamento_horarios' && (
          <div className="space-y-6">
            
            {/* Controles de Seleção das Duas Datas */}
            <div className="bg-surface-card p-4 rounded-xl border border-surface-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <GitCompare className="text-brand-primary" size={18} />
                    <span>Cruzamento Comparativo de Vendas por Horários</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Compare o faturamento e a densidade de pedidos hora a hora entre dois dias de operação.
                  </p>
                </div>

                {/* Atalhos Rápidos */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const d1 = new Date();
                      d1.setDate(now.getDate() - 7);
                      setCompareDateA(d1.toISOString().split('T')[0]);
                      setCompareDateB(now.toISOString().split('T')[0]);
                    }}
                    className="py-1 px-2.5 bg-surface-ground hover:bg-surface-elevated text-slate-300 border border-surface-border rounded-lg cursor-pointer transition-colors"
                  >
                    Hoje vs 7 Dias Atrás
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-surface-border">
                {/* Data Base A */}
                <div className="p-3 bg-surface-ground rounded-lg border border-brand-accent/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-accent flex items-center gap-1.5">
                      <Calendar size={13} /> Data Base (A):
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(compareDateA + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </span>
                  </div>
                  <input
                    type="date"
                    value={compareDateA}
                    onChange={e => setCompareDateA(e.target.value)}
                    className="w-full input-util text-xs font-mono tabular-nums text-white"
                  />
                  <div className="flex justify-between items-center text-xs pt-1 font-mono tabular-nums">
                    <span className="text-slate-400">{hourlyComparisonData.countA} pedidos</span>
                    <strong className="text-brand-accent">R$ {hourlyComparisonData.totalA.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Data Comparada B */}
                <div className="p-3 bg-surface-ground rounded-lg border border-brand-primary/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-primary flex items-center gap-1.5">
                      <Calendar size={13} /> Data Comparada (B):
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(compareDateB + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </span>
                  </div>
                  <input
                    type="date"
                    value={compareDateB}
                    onChange={e => setCompareDateB(e.target.value)}
                    className="w-full input-util text-xs font-mono tabular-nums text-white"
                  />
                  <div className="flex justify-between items-center text-xs pt-1 font-mono tabular-nums">
                    <span className="text-slate-400">{hourlyComparisonData.countB} pedidos</span>
                    <strong className="text-brand-primary">R$ {hourlyComparisonData.totalB.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Balanço Geral do Cruzamento */}
              <div className="p-3.5 bg-surface-elevated rounded-xl border border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Variação Total (B vs A):</span>
                  <span className={`font-bold text-sm ${hourlyComparisonData.diffTotal >= 0 ? 'text-status-free' : 'text-status-danger'}`}>
                    {hourlyComparisonData.diffTotal >= 0 ? '+' : ''} R$ {hourlyComparisonData.diffTotal.toFixed(2)} ({hourlyComparisonData.diffTotalPct >= 0 ? '+' : ''}{hourlyComparisonData.diffTotalPct.toFixed(1)}%)
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[11px]">
                  {hourlyComparisonData.maxHourA >= 0 && (
                    <span className="text-slate-300">
                      Pico Data A: <strong className="text-brand-accent">{String(hourlyComparisonData.maxHourA).padStart(2, '0')}:00</strong> (R$ {hourlyComparisonData.maxRevA.toFixed(2)})
                    </span>
                  )}
                  {hourlyComparisonData.maxHourB >= 0 && (
                    <span className="text-slate-300">
                      Pico Data B: <strong className="text-brand-primary">{String(hourlyComparisonData.maxHourB).padStart(2, '0')}:00</strong> (R$ {hourlyComparisonData.maxRevB.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* GRÁFICO VISUAL COMPARATIVO DE BARRAS POR HORÁRIO */}
            <div className="bg-surface-card p-5 rounded-xl border border-surface-border space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 size={15} className="text-brand-accent" />
                  <span>Distribuição Comparativa de Faturamento por Faixa Horária</span>
                </h3>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-brand-accent">
                    <span className="w-2.5 h-2.5 rounded-sm bg-brand-accent" /> Data A
                  </span>
                  <span className="flex items-center gap-1.5 text-brand-primary">
                    <span className="w-2.5 h-2.5 rounded-sm bg-brand-primary" /> Data B
                  </span>
                </div>
              </div>

              {/* Barras Horárias */}
              <div className="space-y-2 pt-2">
                {hourlyComparisonData.rows.map(row => {
                  const maxPeak = Math.max(hourlyComparisonData.maxRevA, hourlyComparisonData.maxRevB, 1);
                  const pctA = (row.revA / maxPeak) * 100;
                  const pctB = (row.revB / maxPeak) * 100;
                  const isPeakA = row.hour === hourlyComparisonData.maxHourA && row.revA > 0;
                  const isPeakB = row.hour === hourlyComparisonData.maxHourB && row.revB > 0;

                  return (
                    <div key={row.hour} className="p-2.5 bg-surface-ground rounded-lg border border-surface-border/80 hover:border-surface-border transition-colors">
                      <div className="flex justify-between items-center text-xs mb-1.5 font-mono tabular-nums">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 w-14">{row.label}</span>
                          {(isPeakA || isPeakB) && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                              <Flame size={10} /> Pico
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-[11px]">
                          <span className="text-brand-accent">
                            A: R$ {row.revA.toFixed(2)} <span className="text-slate-500">({row.countA} ped)</span>
                          </span>
                          <span className="text-brand-primary">
                            B: R$ {row.revB.toFixed(2)} <span className="text-slate-500">({row.countB} ped)</span>
                          </span>
                          <span className={`w-20 text-right font-bold ${row.diffRev >= 0 ? 'text-status-free' : 'text-status-danger'}`}>
                            {row.diffRev >= 0 ? '+' : ''}{row.diffRev.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Barras Lado a Lado / Empilhadas */}
                      <div className="space-y-1">
                        <div className="w-full bg-surface-card h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-brand-accent h-full rounded-full transition-all duration-300"
                            style={{ width: `${pctA}%` }} 
                          />
                        </div>
                        <div className="w-full bg-surface-card h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-brand-primary h-full rounded-full transition-all duration-300"
                            style={{ width: `${pctB}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 3: GERENCIAR CAIXAS DIÁRIOS & RESET DE TESTES (MASTER ADMIN)  */}
        {/* ================================================================= */}
        {activeTab === 'gerenciar_caixas' && (
          <div className="space-y-6">
            
            <div className="bg-surface-card p-4 rounded-xl border border-surface-border flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="text-status-danger" size={18} />
                  <span>Gerenciador de Sessões de Caixa & Reset de Testes</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Exclusivo para o Administrador Master (Dono). Permite apagar sessões de teste e expurgar vendas correspondentes do faturamento.
                </p>
              </div>

              <div className="text-right font-mono tabular-nums text-xs">
                <span className="text-slate-500 block">Total de Sessões:</span>
                <strong className="text-slate-200 text-sm">{allCashSessions.length} turnos registrados</strong>
              </div>
            </div>

            {/* Tabela de Sessões de Caixa */}
            <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-surface-border bg-surface-ground/60 font-medium text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Sessão / Status</th>
                      <th className="py-3 px-4">Abertura</th>
                      <th className="py-3 px-4">Fechamento</th>
                      <th className="py-3 px-4">Operador</th>
                      <th className="py-3 px-4 font-mono">Fundo Inicial</th>
                      <th className="py-3 px-4 font-mono">Valor Contado</th>
                      <th className="py-3 px-4 font-mono">Diferença</th>
                      <th className="py-3 px-4 text-right">Ação Master</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {allCashSessions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500">
                          Nenhuma sessão de caixa cadastrada ainda.
                        </td>
                      </tr>
                    ) : (
                      allCashSessions.map(session => {
                        const isOpen = session.status === 'open';

                        return (
                          <tr key={session.id} className="hover:bg-surface-elevated/40 transition-colors">
                            {/* ID e Status */}
                            <td className="py-3 px-4 font-mono">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-status-free animate-pulse' : 'bg-slate-600'}`} />
                                <span className="font-bold text-slate-200">#{session.id.slice(0, 6)}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isOpen ? 'bg-status-free/10 text-status-free border border-status-free/20' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {isOpen ? 'Aberto' : 'Fechado'}
                                </span>
                              </div>
                            </td>

                            {/* Abertura */}
                            <td className="py-3 px-4 font-mono tabular-nums text-slate-300">
                              {new Date(session.openedAt).toLocaleDateString('pt-BR')} {new Date(session.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            {/* Fechamento */}
                            <td className="py-3 px-4 font-mono tabular-nums text-slate-400">
                              {session.closedAt 
                                ? `${new Date(session.closedAt).toLocaleDateString('pt-BR')} ${new Date(session.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : <span className="text-status-free font-medium">Em andamento</span>
                              }
                            </td>

                            {/* Operador */}
                            <td className="py-3 px-4 text-slate-200">
                              {session.openedBy || 'Operador'}
                            </td>

                            {/* Fundo Inicial */}
                            <td className="py-3 px-4 font-mono tabular-nums text-slate-300">
                              R$ {session.initialAmount.toFixed(2)}
                            </td>

                            {/* Valor Contado */}
                            <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-200">
                              {session.finalAmount !== undefined ? `R$ ${session.finalAmount.toFixed(2)}` : '—'}
                            </td>

                            {/* Diferença */}
                            <td className="py-3 px-4 font-mono tabular-nums">
                              {session.varianceAmount !== undefined ? (
                                <span className={session.varianceAmount >= 0 ? 'text-status-free font-bold' : 'text-status-danger font-bold'}>
                                  {session.varianceAmount >= 0 ? `+ R$ ${session.varianceAmount.toFixed(2)}` : `- R$ ${Math.abs(session.varianceAmount).toFixed(2)}`}
                                </span>
                              ) : '—'}
                            </td>

                            {/* Botão de Excluir */}
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSessionToDelete(session);
                                  setAdminPasswordInput('');
                                  setAdminActionError('');
                                }}
                                className="py-1 px-2.5 bg-status-danger/10 hover:bg-status-danger/20 text-status-danger border border-status-danger/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1"
                                title="Excluir este caixa e expurgar suas vendas de teste"
                              >
                                <Trash2 size={13} /> Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (MASTER ADMIN) */}
        {sessionToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-surface-card border border-surface-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-status-danger pb-3 border-b border-surface-border">
                <ShieldAlert size={24} />
                <div>
                  <h3 className="text-base font-bold text-white">Excluir Caixa de Teste</h3>
                  <span className="text-xs text-slate-400 font-mono">Sessão #{sessionToDelete.id.slice(0, 8)}</span>
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                <p>
                  Você está prestes a excluir permanentemente esta sessão de caixa e <strong>expurgar todas as vendas realizadas durante o turno</strong>.
                </p>
                <div className="p-3 bg-surface-ground rounded-lg border border-surface-border space-y-1 font-mono tabular-nums text-[11px]">
                  <div>Aberto em: <strong className="text-slate-200">{new Date(sessionToDelete.openedAt).toLocaleString('pt-BR')}</strong></div>
                  <div>Operador: <strong className="text-slate-200">{sessionToDelete.openedBy}</strong></div>
                  <div>Fundo inicial: <strong className="text-slate-200">R$ {sessionToDelete.initialAmount.toFixed(2)}</strong></div>
                </div>
                <p className="text-status-occupied text-[11px]">
                  ⚠️ Esta ação é irreversível e recalculará o faturamento e o DRE da empresa imediatamente.
                </p>
              </div>

              <form onSubmit={handleConfirmDeleteSession} className="space-y-3 pt-1">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">
                    Digite a Senha do Administrador Master para confirmar:
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Senha Master (ex: admin)"
                    value={adminPasswordInput}
                    onChange={e => setAdminPasswordInput(e.target.value)}
                    className="w-full input-util text-sm"
                    autoFocus
                  />
                </div>

                {adminActionError && (
                  <div className="p-2.5 rounded-lg bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs font-semibold">
                    {adminActionError}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setSessionToDelete(null)}
                    className="flex-1 py-2 bg-surface-ground hover:bg-surface-elevated text-slate-300 border border-surface-border rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isDeleting || !adminPasswordInput.trim()}
                    className="flex-1 py-2 bg-status-danger hover:bg-red-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIGURAÇÃO DE CUSTOS FIXOS MENSAIS (BREAK-EVEN) */}
        {showFixedExpensesModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-surface-card border border-surface-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div className="flex items-center gap-2.5 text-brand-primary">
                  <Settings2 size={22} />
                  <div>
                    <h3 className="text-base font-bold text-white">Custos Fixos Mensais da Hamburgueria</h3>
                    <p className="text-xs text-slate-400">Parâmetros reais para cálculo do Ponto de Equilíbrio e Lucro Líquido</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFixedExpensesModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveExpensesForm} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">🏠 Aluguel do Ponto (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expensesForm.rent}
                      onChange={e => setExpensesForm({ ...expensesForm, rent: Number(e.target.value) || 0 })}
                      className="w-full input-util font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">⚡ Energia Elétrica / Luz (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expensesForm.electricity}
                      onChange={e => setExpensesForm({ ...expensesForm, electricity: Number(e.target.value) || 0 })}
                      className="w-full input-util font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">🔥 Gás Industrial P45 (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expensesForm.gas}
                      onChange={e => setExpensesForm({ ...expensesForm, gas: Number(e.target.value) || 0 })}
                      className="w-full input-util font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">💧 Água e Saneamento (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expensesForm.water}
                      onChange={e => setExpensesForm({ ...expensesForm, water: Number(e.target.value) || 0 })}
                      className="w-full input-util font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">🌐 Internet & Softwares / SaaS (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expensesForm.internetSoftware}
                      onChange={e => setExpensesForm({ ...expensesForm, internetSoftware: Number(e.target.value) || 0 })}
                      className="w-full input-util font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">👥 Folha de Pagamento Equipe (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expensesForm.payroll}
                      onChange={e => setExpensesForm({ ...expensesForm, payroll: Number(e.target.value) || 0 })}
                      className="w-full input-util font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">💼 Pró-labore dos Sócios (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expensesForm.proLabore}
                      onChange={e => setExpensesForm({ ...expensesForm, proLabore: Number(e.target.value) || 0 })}
                      className="w-full input-util font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">📦 Outras Despesas Fixas (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expensesForm.otherExpenses}
                      onChange={e => setExpensesForm({ ...expensesForm, otherExpenses: Number(e.target.value) || 0 })}
                      className="w-full input-util font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    📅 Dias de Operação por Mês (para Rateio Diário)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={expensesForm.operatingDaysPerMonth}
                    onChange={e => setExpensesForm({ ...expensesForm, operatingDaysPerMonth: Number(e.target.value) || 26 })}
                    className="w-full input-util font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Ex: 26 dias (fechando apenas às segundas-feiras) ou 30 dias (aberto todos os dias).
                  </span>
                </div>

                {/* Box de Resumo Proporcional */}
                <div className="p-3.5 bg-surface-ground rounded-xl border border-surface-border space-y-1 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Fixo Mensal:</span>
                    <strong className="text-white font-bold">
                      R$ {(
                        Number(expensesForm.rent || 0) + Number(expensesForm.electricity || 0) + Number(expensesForm.gas || 0) +
                        Number(expensesForm.water || 0) + Number(expensesForm.internetSoftware || 0) + Number(expensesForm.payroll || 0) +
                        Number(expensesForm.proLabore || 0) + Number(expensesForm.otherExpenses || 0)
                      ).toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Custo Diário Rateado:</span>
                    <strong className="text-brand-accent font-bold">
                      R$ {(
                        (Number(expensesForm.rent || 0) + Number(expensesForm.electricity || 0) + Number(expensesForm.gas || 0) +
                        Number(expensesForm.water || 0) + Number(expensesForm.internetSoftware || 0) + Number(expensesForm.payroll || 0) +
                        Number(expensesForm.proLabore || 0) + Number(expensesForm.otherExpenses || 0)) / (Number(expensesForm.operatingDaysPerMonth) || 26)
                      ).toFixed(2)} / dia
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFixedExpensesModal(false)}
                    className="flex-1 py-2.5 bg-surface-ground hover:bg-surface-elevated text-slate-300 border border-surface-border rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Salvar Custos Fixos
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
