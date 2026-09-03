'use client';
import { useState, useMemo } from 'react';
import { useInventory, AuditAction, SaleItem } from '@/lib/store';
import { 
  ArrowLeft, ShieldCheck, ShieldAlert, DollarSign, 
  Lock, Unlock, AlertTriangle, Search, Filter, 
  Download, Printer, RefreshCw, FileText, User, 
  Tag, Clock, History, Flame, Package, Gift, Heart, Calendar, HelpCircle
} from 'lucide-react';
import Link from 'next/link';

export default function AuditoriaPage() {
  const { auditLogs, sales, getProductCmv, isLoaded } = useInventory();
  
  // Abas Principais
  const [activeView, setActiveView] = useState<'logs' | 'brindes'>('logs');

  // Filtros dos Logs Gerais
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'todos' | 'cancelamento' | 'caixa' | 'preco' | 'estoque' | 'brindes' | 'descontos'>('todos');

  // Filtro de Mês para o Relatório de Brindes (AAAA-MM)
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // Filtro de Categoria
      if (selectedFilter === 'cancelamento' && log.action !== 'CANCELAMENTO_VENDA') return false;
      if (selectedFilter === 'caixa' && !['FECHAMENTO_CAIXA', 'ABERTURA_CAIXA', 'SANGRIA', 'SUPRIMENTO'].includes(log.action)) return false;
      if (selectedFilter === 'preco' && log.action !== 'ALTERACAO_PRECO') return false;
      if (selectedFilter === 'estoque' && !['AJUSTE_ESTOQUE', 'EXCLUSAO_ITEM', 'CADASTRO_PRODUTO', 'DESATIVACAO_PRODUTO'].includes(log.action)) return false;
      if (selectedFilter === 'brindes' && log.action !== 'ITEM_BRINDE') return false;
      if (selectedFilter === 'descontos' && !['DESCONTO_CONCEDIDO', 'CUPOM_HITS_IFOOD'].includes(log.action)) return false;

      // Filtro de Texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchDetails = log.details.toLowerCase().includes(term);
        const matchOperator = log.operator.toLowerCase().includes(term);
        const matchAction = log.action.toLowerCase().includes(term);
        return matchDetails || matchOperator || matchAction;
      }

      return true;
    });
  }, [auditLogs, selectedFilter, searchTerm]);

  // Estatísticas Rápidas dos Logs
  const stats = useMemo(() => {
    const cancelamentos = auditLogs.filter(l => l.action === 'CANCELAMENTO_VENDA').length;
    const fechamentos = auditLogs.filter(l => l.action === 'FECHAMENTO_CAIXA').length;
    const sangrias = auditLogs.filter(l => l.action === 'SANGRIA').length;
    const alteracoesPreco = auditLogs.filter(l => l.action === 'ALTERACAO_PRECO').length;
    const brindes = auditLogs.filter(l => l.action === 'ITEM_BRINDE').length;

    return { cancelamentos, fechamentos, sangrias, alteracoesPreco, brindes, total: auditLogs.length };
  }, [auditLogs]);

  // === ANÁLISE DETALHADA DE BRINDES & CORTESIAS ===
  const giftsAnalysis = useMemo(() => {
    interface GiftOccurrence {
      saleId: string;
      date: string;
      customerName: string;
      channel: string;
      item: SaleItem;
      originalValue: number;
      cmvCost: number;
    }

    const occurrences: GiftOccurrence[] = [];
    let totalDiscountInMonth = 0;
    let totalStoreCouponInMonth = 0;

    // Filtra vendas do mês selecionado
    sales.forEach(sale => {
      const saleMonth = sale.date?.slice(0, 7);
      if (selectedMonth !== 'todos' && saleMonth !== selectedMonth) return;
      if (sale.status === 'cancelled') return;

      if (sale.discount && sale.discount > 0) {
        totalDiscountInMonth += sale.discount;
      }
      if (sale.storeCouponSubsidy && sale.storeCouponSubsidy > 0) {
        totalStoreCouponInMonth += sale.storeCouponSubsidy;
      }

      sale.items?.forEach(it => {
        if (it.isGift) {
          const originalVal = (it.originalPrice || it.unitPrice || 0) * it.quantity;
          // Estima CMV proporcional
          const cmvCost = 5.50 * it.quantity; // Estimativa média de custo do brinde caso sem ficha
          occurrences.push({
            saleId: sale.id,
            date: sale.date,
            customerName: sale.customerName || 'Cliente',
            channel: sale.channel,
            item: it,
            originalValue: originalVal,
            cmvCost
          });
        }
      });
    });

    // Agrupamento por motivo
    const reasonGroups: Record<string, { count: number; totalValue: number; label: string; icon: string }> = {
      falta_pedido_anterior: { count: 0, totalValue: 0, label: 'Falta / Esquecimento no pedido anterior (ex: batata)', icon: '🍟' },
      fidelidade_cliente: { count: 0, totalValue: 0, label: 'Fidelidade / Excelente cliente', icon: '⭐' },
      atraso_preparo: { count: 0, totalValue: 0, label: 'Compensação por atraso na cozinha / entrega', icon: '⏱️' },
      cortesia_casa: { count: 0, totalValue: 0, label: 'Cortesia da casa / Degustação / Parceria', icon: '🎁' },
      outro: { count: 0, totalValue: 0, label: 'Outros motivos com justificativa', icon: '📝' }
    };

    let totalGiftsCount = 0;
    let totalOriginalValue = 0;

    occurrences.forEach(occ => {
      const reasonKey = occ.item.giftReason || 'outro';
      if (!reasonGroups[reasonKey]) {
        reasonGroups[reasonKey] = { count: 0, totalValue: 0, label: 'Outros motivos', icon: '📝' };
      }
      reasonGroups[reasonKey].count += occ.item.quantity;
      reasonGroups[reasonKey].totalValue += occ.originalValue;

      totalGiftsCount += occ.item.quantity;
      totalOriginalValue += occ.originalValue;
    });

    return {
      occurrences,
      totalGiftsCount,
      totalOriginalValue,
      totalDiscountInMonth,
      totalStoreCouponInMonth,
      reasonGroups
    };
  }, [sales, selectedMonth]);

  // Exportar Logs Gerais para CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Data/Hora', 'Acao', 'Operador', 'Detalhes', 'Valor_Anterior', 'Valor_Novo'];
    const rows = filteredLogs.map(l => [
      `"${new Date(l.timestamp).toLocaleString('pt-BR')}"`,
      `"${l.action}"`,
      `"${l.operator}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${(l.oldValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_hum_vicio_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Relatório de Brindes para CSV
  const handleExportGiftsCsv = () => {
    if (giftsAnalysis.occurrences.length === 0) return;
    const headers = ['Data/Hora', 'Pedido_ID', 'Cliente', 'Canal', 'Produto', 'Quantidade', 'Motivo', 'Observacoes', 'Valor_Original_R$'];
    const rows = giftsAnalysis.occurrences.map(occ => [
      `"${new Date(occ.date).toLocaleString('pt-BR')}"`,
      `"${occ.saleId}"`,
      `"${occ.customerName}"`,
      `"${occ.channel}"`,
      `"${occ.item.productName}"`,
      occ.item.quantity,
      `"${occ.item.giftReason || 'cortesia'}"`,
      `"${(occ.item.giftNotes || '').replace(/"/g, '""')}"`,
      occ.originalValue.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_brindes_hum_vicio_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'CANCELAMENTO_VENDA':
        return { label: 'Estorno de Venda', bg: 'bg-red-500/20 text-red-400 border-red-500/30', icon: ShieldAlert };
      case 'FECHAMENTO_CAIXA':
        return { label: 'Fechamento Caixa', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Lock };
      case 'ABERTURA_CAIXA':
        return { label: 'Abertura Caixa', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Unlock };
      case 'SANGRIA':
        return { label: 'Sangria de Gaveta', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: DollarSign };
      case 'SUPRIMENTO':
        return { label: 'Suprimento', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: DollarSign };
      case 'ALTERACAO_PRECO':
        return { label: 'Alteração de Preço', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Tag };
      case 'AJUSTE_ESTOQUE':
        return { label: 'Ajuste de Estoque', bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Package };
      case 'EXCLUSAO_ITEM':
      case 'DESATIVACAO_PRODUTO':
        return { label: 'Item Desativado', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/30', icon: AlertTriangle };
      case 'CADASTRO_PRODUTO':
        return { label: 'Novo Produto', bg: 'bg-teal-500/20 text-teal-400 border-teal-500/30', icon: Package };
      case 'ITEM_BRINDE':
        return { label: 'Brinde Concedido', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: Gift };
      case 'DESCONTO_CONCEDIDO':
        return { label: 'Desconto no Pedido', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Tag };
      case 'CUPOM_HITS_IFOOD':
        return { label: 'Cupom Loja (Hits)', bg: 'bg-red-500/20 text-red-300 border-red-500/30', icon: Flame };
      default:
        return { label: action, bg: 'bg-slate-700 text-slate-300 border-slate-600', icon: FileText };
    }
  };

  if (!isLoaded) return null;

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      
      {/* Topo / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all cursor-pointer shadow-sm hover:border-slate-700"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="inline-flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck size={16} /> Segurança & Auditoria do Administrador
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Central de Auditoria & Conformidade</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Rastreamento de cancelamentos, sangrias, fechamentos, alterações de preços e brindes/cortesias.
            </p>
          </div>
        </div>

        {/* Alternador de Abas */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveView('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeView === 'logs'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History size={15} /> Linha do Tempo
          </button>
          <button
            type="button"
            onClick={() => setActiveView('brindes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeView === 'brindes'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gift size={15} /> Relatório de Brindes & Cortesias
          </button>
        </div>
      </div>

      {/* VISTA 1: LINHA DO TEMPO GERAL DE AUDITORIA */}
      {activeView === 'logs' && (
        <div className="space-y-6">
          
          {/* Métricas Gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Estornos de Vendas</span>
              <p className="text-2xl font-mono font-black text-red-400">{stats.cancelamentos}</p>
              <span className="text-[10px] text-slate-500">Exigem senha supervisor</span>
            </div>

            <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Fechamentos Caixa</span>
              <p className="text-2xl font-mono font-black text-purple-400">{stats.fechamentos}</p>
              <span className="text-[10px] text-slate-500">Contagem cega registrada</span>
            </div>

            <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Sangrias de Gaveta</span>
              <p className="text-2xl font-mono font-black text-orange-400">{stats.sangrias}</p>
              <span className="text-[10px] text-slate-500">Retiradas manuais</span>
            </div>

            <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Ajustes de Preço</span>
              <p className="text-2xl font-mono font-black text-amber-400">{stats.alteracoesPreco}</p>
              <span className="text-[10px] text-slate-500">Cardápio & iFood</span>
            </div>

            <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Brindes Concedidos</span>
              <p className="text-2xl font-mono font-black text-emerald-400">{stats.brindes}</p>
              <span className="text-[10px] text-slate-500">Motivo auditado</span>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="glass-card p-4 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              {[
                { id: 'todos', label: 'Todos os Logs' },
                { id: 'cancelamento', label: '🚫 Cancelamentos' },
                { id: 'caixa', label: '🔒 Caixa & Sangrias' },
                { id: 'preco', label: '🏷️ Preços' },
                { id: 'estoque', label: '📦 Estoque' },
                { id: 'brindes', label: '🎁 Brindes' },
                { id: 'descontos', label: '💰 Descontos' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedFilter === f.id
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-64">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar ação, operador ou comanda..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <Download size={14} /> Exportar CSV
              </button>
            </div>
          </div>

          {/* Timeline de Eventos */}
          <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Eventos Auditados ({filteredLogs.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Registros protegidos contra exclusão
              </span>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs">
              {filteredLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <ShieldCheck size={40} className="mx-auto mb-2 opacity-30" />
                  <p>Nenhum registro de auditoria encontrado para os filtros selecionados.</p>
                </div>
              ) : (
                filteredLogs.map(log => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  const dateStr = new Date(log.timestamp).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <div key={log.id} className="p-4 hover:bg-slate-900/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl border mt-0.5 ${badge.bg}`}>
                          <Icon size={16} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badge.bg}`}>
                              {badge.label}
                            </span>
                            <span className="font-bold text-white text-xs">{log.operator}</span>
                            <span className="text-[10px] text-slate-500 font-mono">• {dateStr}</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed text-xs">{log.details}</p>
                        </div>
                      </div>

                      {(log.oldValue || log.newValue) && (
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono space-y-0.5 min-w-[200px] text-right">
                          {log.oldValue && (
                            <div className="text-slate-500">
                              Anterior: <span className="text-slate-400">{log.oldValue}</span>
                            </div>
                          )}
                          {log.newValue && (
                            <div className="text-emerald-400 font-bold">
                              Novo: {log.newValue}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: RELATÓRIO MENSAL DE BRINDES & CORTESIAS */}
      {activeView === 'brindes' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Barra de Controle de Período */}
          <div className="glass-card p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40">
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider mb-1">
                <Gift size={16} /> Gestão de Cortesias & Prevenção de Falhas
              </div>
              <h2 className="text-2xl font-black text-white">Relatório Mensal de Brindes e Cortesias</h2>
              <p className="text-xs text-slate-400">
                Audite quantos itens foram doados, o valor total que saiu da loja e os principais motivos apontados pela equipe.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <Calendar size={15} className="text-emerald-400" />
                <span className="text-slate-400 font-bold">Mês de Referência:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-white font-mono font-bold outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleExportGiftsCsv}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Download size={15} /> Exportar Relatório (.CSV)
              </button>
            </div>
          </div>

          {/* Cards de Métricas do Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Itens Doados no Mês</span>
              <h3 className="text-3xl font-mono font-black text-emerald-400">
                {giftsAnalysis.totalGiftsCount} itens
              </h3>
              <span className="text-[10px] text-slate-500">Marcados como brinde no caixa</span>
            </div>

            <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Valor Doado (Preço Venda)</span>
              <h3 className="text-3xl font-mono font-black text-white">
                R$ {giftsAnalysis.totalOriginalValue.toFixed(2)}
              </h3>
              <span className="text-[10px] text-slate-500">Receita bruta estornada</span>
            </div>

            <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Descontos no Mês</span>
              <h3 className="text-3xl font-mono font-black text-amber-400">
                R$ {giftsAnalysis.totalDiscountInMonth.toFixed(2)}
              </h3>
              <span className="text-[10px] text-slate-500">Descontos avulsos concedidos</span>
            </div>

            <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Cupons iFood da Loja (Hits)</span>
              <h3 className="text-3xl font-mono font-black text-red-400">
                R$ {giftsAnalysis.totalStoreCouponInMonth.toFixed(2)}
              </h3>
              <span className="text-[10px] text-slate-500">Subsídios bancados pela loja</span>
            </div>
          </div>

          {/* Diagnóstico dos Principais Motivos */}
          <div className="glass-card rounded-3xl p-6 md:p-8 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Ranking de Motivos dos Brindes Concedidos
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Total de {giftsAnalysis.totalGiftsCount} itens distribuídos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(giftsAnalysis.reasonGroups).map(([key, info]) => {
                const pct = giftsAnalysis.totalGiftsCount > 0 
                  ? (info.count / giftsAnalysis.totalGiftsCount) * 100 
                  : 0;

                const isFalta = key === 'falta_pedido_anterior';

                return (
                  <div 
                    key={key} 
                    className={`p-4 rounded-2xl border space-y-2 transition-all ${
                      isFalta && info.count > 0 
                        ? 'bg-amber-950/20 border-amber-500/30' 
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{info.icon}</span>
                        <span className="text-xs font-bold text-slate-200">{info.label}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-900 text-white">
                        {info.count} un
                      </span>
                    </div>

                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isFalta ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1">
                      <span>{pct.toFixed(0)}% do total</span>
                      <strong className="text-white">R$ {info.totalValue.toFixed(2)}</strong>
                    </div>

                    {isFalta && info.count > 0 && (
                      <p className="text-[10px] text-amber-300 leading-tight pt-1">
                        ⚠️ Atenção da Gerência: Verifique a montagem das embalagens na cozinha para diminuir esquecimentos.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela de Ocorrências Detalhadas */}
          <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Lista Analítica de Brindes Entregues ({giftsAnalysis.occurrences.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Registrado diretamente no PDV
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-4">Data / Hora</th>
                    <th className="p-4">Cliente & Canal</th>
                    <th className="p-4">Item Concedido</th>
                    <th className="p-4">Motivo Apontado</th>
                    <th className="p-4 text-right">Valor Estornado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {giftsAnalysis.occurrences.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        Nenhum brinde concedido neste mês de referência.
                      </td>
                    </tr>
                  ) : (
                    giftsAnalysis.occurrences.map((occ, idx) => {
                      const dateStr = new Date(occ.date).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      });

                      const reasonText = 
                        occ.item.giftReason === 'falta_pedido_anterior' ? '🍟 Falta no pedido anterior' :
                        occ.item.giftReason === 'fidelidade_cliente' ? '⭐ Excelente cliente / Fidelidade' :
                        occ.item.giftReason === 'atraso_preparo' ? '⏱️ Atraso no preparo' :
                        occ.item.giftReason === 'cortesia_casa' ? '🎁 Cortesia da casa' : '📝 Outro motivo';

                      return (
                        <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                          <td className="p-4 font-mono text-slate-400">
                            {dateStr}
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-white block">{occ.customerName}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{occ.channel}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-extrabold text-emerald-400">
                              {occ.item.quantity}x {occ.item.productName}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-slate-300 block">{reasonText}</span>
                            {occ.item.giftNotes && (
                              <span className="text-[10px] text-slate-500 italic block mt-0.5">
                                &quot;{occ.item.giftNotes}&quot;
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono font-black text-white text-sm">
                            R$ {occ.originalValue.toFixed(2)}
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

    </main>
  );
}
