'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useInventory, AuditAction, SaleItem } from '@/lib/store';
import { 
  ShieldCheck, ShieldAlert, DollarSign, 
  Lock, Unlock, AlertTriangle, 
  Download, FileText, 
  Tag, History, Flame, Package, Gift, Calendar,
  BellRing, Send, Layers
} from 'lucide-react';
import { 
  PageHeader, FilterBar, Button, Badge, 
  EmptyState, Skeleton, useToast 
} from '@/components/ui';
import { getOwnerWebhookUrl, saveOwnerWebhookUrl, testOwnerWebhook } from '@/lib/notifications';
import { filterAuditLogs, computeAuditStats } from '@/lib/fiscal-helpers';

export default function AuditoriaPage() {
  const { auditLogs, sales, isLoaded } = useInventory();
  const { notify } = useToast();
  
  // Abas Principais
  const [activeView, setActiveView] = useState<'logs' | 'brindes' | 'webhook'>('logs');

  // Configuração de Webhook do Dono
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  useEffect(() => {
    setWebhookUrl(getOwnerWebhookUrl());
  }, []);

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      notify({ title: 'URL inválida', description: 'Informe uma URL de Webhook válida.', tone: 'warning' });
      return;
    }
    setWebhookStatus({ type: 'testing', message: 'Enviando notificação de teste...' });
    const res = await testOwnerWebhook(webhookUrl.trim());
    if (res.success) {
      setWebhookStatus({ type: 'success', message: res.message });
      notify({ title: 'Webhook enviado', description: res.message, tone: 'success' });
    } else {
      setWebhookStatus({ type: 'error', message: res.message });
      notify({ title: 'Falha no Webhook', description: res.message, tone: 'danger' });
    }
  };

  const handleSaveWebhook = () => {
    saveOwnerWebhookUrl(webhookUrl.trim());
    setWebhookStatus({ type: 'success', message: 'URL do Webhook salva com sucesso!' });
    notify({ title: 'Webhook configurado', description: 'URL salva com sucesso.', tone: 'success' });
    setTimeout(() => setWebhookStatus({ type: 'idle', message: '' }), 3000);
  };

  // Filtros dos Logs Gerais
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'todos' | 'cancelamento' | 'caixa' | 'preco' | 'estoque' | 'brindes' | 'descontos'>('todos');

  // Filtro de Mês para o Relatório de Brindes (AAAA-MM)
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Filtragem dos logs via helper desacoplado
  const filteredLogs = useMemo(() => {
    return filterAuditLogs(auditLogs, {
      category: selectedFilter,
      searchTerm: searchTerm
    });
  }, [auditLogs, selectedFilter, searchTerm]);

  // Estatísticas Rápidas dos Logs via helper desacoplado
  const stats = useMemo(() => {
    return computeAuditStats(auditLogs);
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
          const cmvCost = 5.50 * it.quantity;
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
      falta_pedido_anterior: { count: 0, totalValue: 0, label: 'Falta / Esquecimento no pedido anterior', icon: '🍟' },
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
    notify({ title: 'Logs exportados em CSV', tone: 'success' });
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
    notify({ title: 'Relatório de brindes exportado em CSV', tone: 'success' });
  };

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'CANCELAMENTO_VENDA':
        return { label: 'Estorno de Venda', variant: 'danger' as const, icon: ShieldAlert };
      case 'FECHAMENTO_CAIXA':
        return { label: 'Fechamento Caixa', variant: 'neutral' as const, icon: Lock };
      case 'ABERTURA_CAIXA':
        return { label: 'Abertura Caixa', variant: 'success' as const, icon: Unlock };
      case 'SANGRIA':
        return { label: 'Sangria de Gaveta', variant: 'warning' as const, icon: DollarSign };
      case 'SUPRIMENTO':
        return { label: 'Suprimento', variant: 'info' as const, icon: DollarSign };
      case 'ALTERACAO_PRECO':
        return { label: 'Alteração de Preço', variant: 'warning' as const, icon: Tag };
      case 'AJUSTE_ESTOQUE':
        return { label: 'Ajuste de Estoque', variant: 'info' as const, icon: Package };
      case 'EXCLUSAO_ITEM':
      case 'DESATIVACAO_PRODUTO':
        return { label: 'Item Desativado', variant: 'danger' as const, icon: AlertTriangle };
      case 'CADASTRO_PRODUTO':
        return { label: 'Novo Produto', variant: 'success' as const, icon: Package };
      case 'ITEM_BRINDE':
        return { label: 'Brinde Concedido', variant: 'success' as const, icon: Gift };
      case 'DESCONTO_CONCEDIDO':
        return { label: 'Desconto no Pedido', variant: 'warning' as const, icon: Tag };
      case 'CUPOM_HITS_IFOOD':
        return { label: 'Cupom Loja (Hits)', variant: 'danger' as const, icon: Flame };
      case 'VINCULO_LOTE_RECEITAS':
        return { label: 'Vínculo Ficha Técnica', variant: 'info' as const, icon: Layers };
      default:
        return { label: action, variant: 'neutral' as const, icon: FileText };
    }
  };

  if (!isLoaded) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" data-testid="auditoria-skeleton">
        <Skeleton className="h-14 w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Skeleton className="h-24 rounded-dialog" />
          <Skeleton className="h-24 rounded-dialog" />
          <Skeleton className="h-24 rounded-dialog" />
          <Skeleton className="h-24 rounded-dialog" />
          <Skeleton className="h-24 rounded-dialog" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-dialog" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        {/* Cabeçalho */}
        <PageHeader
          title="Central de Auditoria & Conformidade"
          eyebrow="Segurança & Auditoria do Administrador"
          description="Rastreamento de cancelamentos, sangrias, fechamentos, alterações de preços e brindes/cortesias."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/fiscal">
                <Button variant="secondary" leadingIcon={<FileText size={15} aria-hidden="true" />}>
                  Conformidade Fiscal
                </Button>
              </Link>
              <Link href="/admin/dashboard">
                <Button variant="secondary" leadingIcon={<ShieldCheck size={15} aria-hidden="true" />}>
                  DRE & Gestão
                </Button>
              </Link>
              {activeView === 'logs' && filteredLogs.length > 0 && (
                <Button variant="secondary" onClick={handleExportCsv} leadingIcon={<Download size={14} aria-hidden="true" />}>
                  Exportar CSV
                </Button>
              )}
              {activeView === 'brindes' && giftsAnalysis.occurrences.length > 0 && (
                <Button variant="secondary" onClick={handleExportGiftsCsv} leadingIcon={<Download size={14} aria-hidden="true" />}>
                  Exportar CSV
                </Button>
              )}
            </div>
          }
        />

        {/* Sub-Abas de Navegação */}
        <div className="flex items-center gap-2 border-b border-border-default pb-2 overflow-x-auto">
          <Button
            variant={activeView === 'logs' ? 'primary' : 'secondary'}
            onClick={() => setActiveView('logs')}
            leadingIcon={<History size={15} aria-hidden="true" />}
          >
            Linha do Tempo
          </Button>
          <Button
            variant={activeView === 'brindes' ? 'primary' : 'secondary'}
            onClick={() => setActiveView('brindes')}
            leadingIcon={<Gift size={15} aria-hidden="true" />}
          >
            Relatório de Brindes & Cortesias
          </Button>
          <Button
            variant={activeView === 'webhook' ? 'primary' : 'secondary'}
            onClick={() => setActiveView('webhook')}
            leadingIcon={<BellRing size={15} aria-hidden="true" />}
          >
            Webhook do Dono (WhatsApp/Telegram)
          </Button>
        </div>

        {/* VISTA 1: LINHA DO TEMPO GERAL DE AUDITORIA */}
        {activeView === 'logs' && (
          <div className="space-y-6">
            {/* Métricas Gerais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Estornos de Vendas</span>
                <p className="text-2xl font-mono font-black text-status-danger tabular-nums">{stats.cancelamentos}</p>
                <span className="text-[10px] text-text-muted">Exigem senha supervisor</span>
              </div>

              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Fechamentos Caixa</span>
                <p className="text-2xl font-mono font-black text-purple-400 tabular-nums">{stats.fechamentos}</p>
                <span className="text-[10px] text-text-muted">Contagem cega registrada</span>
              </div>

              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Sangrias de Gaveta</span>
                <p className="text-2xl font-mono font-black text-status-warning tabular-nums">{stats.sangrias}</p>
                <span className="text-[10px] text-text-muted">Retiradas manuais</span>
              </div>

              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Ajustes de Preço</span>
                <p className="text-2xl font-mono font-black text-amber-400 tabular-nums">{stats.alteracoesPreco}</p>
                <span className="text-[10px] text-text-muted">Cardápio & iFood</span>
              </div>

              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Brindes Concedidos</span>
                <p className="text-2xl font-mono font-black text-emerald-400 tabular-nums">{stats.brindes}</p>
                <span className="text-[10px] text-text-muted">Motivo auditado</span>
              </div>
            </div>

            {/* FilterBar Padronizada */}
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchLabel="Buscar auditoria"
              placeholder="Buscar ação, operador ou detalhes..."
              resultCount={filteredLogs.length}
              totalCount={auditLogs.length}
              active={Boolean(searchTerm || selectedFilter !== 'todos')}
              onClear={() => {
                setSearchTerm('');
                setSelectedFilter('todos');
              }}
            >
              <div className="space-y-1.5 sm:w-56">
                <label htmlFor="audit-filter-select" className="block text-sm font-medium text-text-secondary">
                  Filtrar por Categoria
                </label>
                <select
                  id="audit-filter-select"
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary text-sm font-medium focus:outline-none focus:border-brand-primary cursor-pointer"
                >
                  <option value="todos">Todos os logs</option>
                  <option value="cancelamento">Cancelamentos</option>
                  <option value="caixa">Caixa & Sangrias</option>
                  <option value="preco">Alterações de Preço</option>
                  <option value="estoque">Ajustes de Estoque</option>
                  <option value="brindes">Brindes Concedidos</option>
                  <option value="descontos">Descontos & Cupons</option>
                </select>
              </div>
            </FilterBar>

            {/* Timeline de Eventos */}
            {filteredLogs.length === 0 ? (
              <EmptyState
                title={auditLogs.length ? 'Nenhum registro encontrado' : 'Nenhum registro de auditoria'}
                description={auditLogs.length ? 'Tente pesquisar com outro termo ou alterar o filtro.' : 'As ações sensíveis da equipe aparecerão aqui.'}
                icon={<ShieldCheck aria-hidden="true" />}
                action={
                  auditLogs.length ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedFilter('todos');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="rounded-dialog border border-border-default bg-surface-card overflow-hidden shadow-elevated">
                <div className="p-4 border-b border-border-default flex justify-between items-center bg-surface-elevated/40">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Eventos Auditados ({filteredLogs.length})
                  </span>
                  <span className="text-[11px] text-text-muted font-mono">
                    Registros protegidos contra exclusão
                  </span>
                </div>

                <div className="divide-y divide-border-default/50 text-xs">
                  {filteredLogs.map(log => {
                    const badge = getActionBadge(log.action);
                    const Icon = badge.icon;
                    const dateStr = new Date(log.timestamp).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    });

                    return (
                      <div key={log.id} className="p-4 hover:bg-surface-elevated/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-control bg-surface-elevated border border-border-default mt-0.5 shrink-0">
                            <Icon size={16} className="text-brand-primary" aria-hidden="true" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={badge.variant} className="text-[10px]">
                                {badge.label}
                              </Badge>
                              <span className="font-bold text-text-primary text-xs">{log.operator}</span>
                              <span className="text-[10px] text-text-muted font-mono tabular-nums">• {dateStr}</span>
                            </div>
                            <p className="text-text-secondary leading-relaxed text-xs">{log.details}</p>
                          </div>
                        </div>

                        {(log.oldValue || log.newValue) && (
                          <div className="bg-surface-input p-2.5 rounded-control border border-border-default text-[11px] font-mono tabular-nums space-y-0.5 min-w-[200px] text-right">
                            {log.oldValue && (
                              <div className="text-text-muted">
                                Anterior: <span className="text-text-secondary">{log.oldValue}</span>
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
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VISTA 2: RELATÓRIO MENSAL DE BRINDES & CORTESIAS */}
        {activeView === 'brindes' && (
          <div className="space-y-6">
            {/* Barra de Controle de Período */}
            <div className="bg-surface-card p-5 rounded-dialog border border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card">
              <div>
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <Gift className="text-emerald-400" size={20} aria-hidden="true" />
                  Relatório Mensal de Brindes e Cortesias
                </h2>
                <p className="text-xs text-text-muted">
                  Audite quantos itens foram doados, o valor total que saiu da loja e os principais motivos apontados pela equipe.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-surface-input border border-border-default rounded-control px-3 py-1.5 text-xs">
                  <Calendar size={15} className="text-emerald-400" aria-hidden="true" />
                  <label htmlFor="ref-month" className="text-text-muted font-bold">Mês:</label>
                  <input
                    id="ref-month"
                    type="month"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="bg-transparent text-text-primary outline-none font-bold font-mono tabular-nums cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* KPIs de Brindes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Itens Doados</span>
                <p className="text-2xl font-mono font-black text-emerald-400 tabular-nums">{giftsAnalysis.totalGiftsCount} un</p>
                <span className="text-[10px] text-text-muted">No período selecionado</span>
              </div>

              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Preço Cardápio Doado</span>
                <p className="text-2xl font-mono font-black text-text-primary tabular-nums">R$ {giftsAnalysis.totalOriginalValue.toFixed(2)}</p>
                <span className="text-[10px] text-text-muted">Valor bruto de venda</span>
              </div>

              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Descontos no Caixa</span>
                <p className="text-2xl font-mono font-black text-amber-400 tabular-nums">R$ {giftsAnalysis.totalDiscountInMonth.toFixed(2)}</p>
                <span className="text-[10px] text-text-muted">Abatimentos manuais</span>
              </div>

              <div className="bg-surface-card p-4 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-xs font-semibold text-text-muted uppercase">Cupons Próprios (iFood)</span>
                <p className="text-2xl font-mono font-black text-status-danger tabular-nums">R$ {giftsAnalysis.totalStoreCouponInMonth.toFixed(2)}</p>
                <span className="text-[10px] text-text-muted">Hits & Campanhas</span>
              </div>
            </div>

            {/* Tabela de Ocorrências de Brindes */}
            {giftsAnalysis.occurrences.length === 0 ? (
              <EmptyState
                title="Nenhum brinde registrado neste mês"
                description="Quando o operador marcar um item como brinde ou cortesia na venda, o registro detalhado aparecerá aqui."
                icon={<Gift aria-hidden="true" />}
              />
            ) : (
              <div className="rounded-dialog border border-border-default bg-surface-card overflow-hidden shadow-elevated">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <th className="p-4">Data / Pedido</th>
                      <th className="p-4">Cliente / Canal</th>
                      <th className="p-4">Item Concedido</th>
                      <th className="p-4">Motivo / Justificativa</th>
                      <th className="p-4 text-right">Valor Cardápio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50">
                    {giftsAnalysis.occurrences.map((occ, idx) => (
                      <tr key={idx} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="p-4 font-mono tabular-nums text-text-primary">
                          {new Date(occ.date).toLocaleDateString('pt-BR')} #{occ.saleId.slice(0, 6)}
                        </td>
                        <td className="p-4 text-text-secondary">
                          <span className="font-bold text-text-primary block">{occ.customerName}</span>
                          <span className="text-[10px] text-text-muted uppercase">{occ.channel}</span>
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          {occ.item.quantity}x {occ.item.productName}
                        </td>
                        <td className="p-4 text-text-secondary">
                          <Badge variant="neutral" className="text-[10px] mb-1 block w-fit">
                            {occ.item.giftReason || 'cortesia'}
                          </Badge>
                          {occ.item.giftNotes && (
                            <p className="text-[11px] text-text-muted italic">{occ.item.giftNotes}</p>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-text-primary tabular-nums">
                          R$ {occ.originalValue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VISTA 3: WEBHOOK DO DONO */}
        {activeView === 'webhook' && (
          <div className="bg-surface-card border border-border-default rounded-dialog p-6 shadow-elevated space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <BellRing className="text-brand-primary" size={20} aria-hidden="true" />
                Alertas em Tempo Real via Webhook
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Receba notificações automáticas no WhatsApp ou Telegram sempre que uma sangria, cancelamento ou fechamento for efetuado.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="webhook-input" className="block text-text-secondary font-bold mb-1">
                  URL do Webhook (n8n, Make, Z-API ou Evolution API):
                </label>
                <input
                  id="webhook-input"
                  type="url"
                  placeholder="https://seu-servidor.com/webhook/alerta-dono"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary font-mono text-xs focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveWebhook}>
                  Salvar URL
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleTestWebhook}
                  loading={webhookStatus.type === 'testing'}
                  leadingIcon={<Send size={13} aria-hidden="true" />}
                >
                  Enviar Mensagem de Teste
                </Button>
              </div>

              {webhookStatus.message && (
                <div className={`p-3 rounded-control border text-xs ${
                  webhookStatus.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : webhookStatus.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-surface-elevated border-border-default text-text-secondary'
                }`}>
                  {webhookStatus.message}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
