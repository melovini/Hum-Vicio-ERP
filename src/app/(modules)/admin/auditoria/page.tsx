'use client';
import { useState, useMemo } from 'react';
import { useInventory, AuditAction } from '@/lib/store';
import { 
  ArrowLeft, ShieldCheck, ShieldAlert, DollarSign, 
  Lock, Unlock, AlertTriangle, Search, Filter, 
  Download, Printer, RefreshCw, FileText, User, 
  Tag, Clock, History, Flame, Package
} from 'lucide-react';
import Link from 'next/link';

export default function AuditoriaPage() {
  const { auditLogs, isLoaded } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'todos' | 'cancelamento' | 'caixa' | 'preco' | 'estoque'>('todos');

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // Filtro de Categoria
      if (selectedFilter === 'cancelamento' && log.action !== 'CANCELAMENTO_VENDA') return false;
      if (selectedFilter === 'caixa' && !['FECHAMENTO_CAIXA', 'ABERTURA_CAIXA', 'SANGRIA', 'SUPRIMENTO'].includes(log.action)) return false;
      if (selectedFilter === 'preco' && log.action !== 'ALTERACAO_PRECO') return false;
      if (selectedFilter === 'estoque' && !['AJUSTE_ESTOQUE', 'EXCLUSAO_ITEM', 'CADASTRO_PRODUTO', 'DESATIVACAO_PRODUTO'].includes(log.action)) return false;

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

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const cancelamentos = auditLogs.filter(l => l.action === 'CANCELAMENTO_VENDA').length;
    const fechamentos = auditLogs.filter(l => l.action === 'FECHAMENTO_CAIXA').length;
    const sangrias = auditLogs.filter(l => l.action === 'SANGRIA').length;
    const alteracoesPreco = auditLogs.filter(l => l.action === 'ALTERACAO_PRECO').length;

    return { cancelamentos, fechamentos, sangrias, alteracoesPreco, total: auditLogs.length };
  }, [auditLogs]);

  // Exportar Logs para CSV
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
      default:
        return { label: action, bg: 'bg-slate-700 text-slate-300 border-slate-600', icon: FileText };
    }
  };

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
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <ShieldCheck className="text-emerald-500" /> Central de Auditoria & Segurança
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Rastreabilidade imutável: acompanhe estornos, fechamentos de caixa, sangrias e alterações críticas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download size={16} /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/30"
          >
            <Printer size={16} /> Imprimir Relatório
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-3xl border border-slate-800/80 flex items-center gap-4">
          <div className="p-3.5 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
            <ShieldAlert size={26} />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Vendas Estornadas</span>
            <h3 className="text-2xl font-mono font-black text-white">{stats.cancelamentos}</h3>
            <span className="text-[10px] text-red-400">Requerem justificativa</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-800/80 flex items-center gap-4">
          <div className="p-3.5 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
            <Lock size={26} />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Fechamentos Caixa</span>
            <h3 className="text-2xl font-mono font-black text-white">{stats.fechamentos}</h3>
            <span className="text-[10px] text-purple-400">Conferência cega</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-800/80 flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 text-orange-400 rounded-2xl border border-orange-500/20">
            <DollarSign size={26} />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Sangrias de Gaveta</span>
            <h3 className="text-2xl font-mono font-black text-white">{stats.sangrias}</h3>
            <span className="text-[10px] text-orange-400">Saídas registradas</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-800/80 flex items-center gap-4">
          <div className="p-3.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <Tag size={26} />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Alterações de Preço</span>
            <h3 className="text-2xl font-mono font-black text-white">{stats.alteracoesPreco}</h3>
            <span className="text-[10px] text-amber-400">Auditoria de cardápio</span>
          </div>
        </div>
      </div>

      {/* Controles de Filtro e Busca */}
      <div className="glass-card p-4 md:p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Abas Rápidas */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80">
          {[
            { id: 'todos', label: 'Todos os Eventos' },
            { id: 'cancelamento', label: '🚫 Estornos' },
            { id: 'caixa', label: '💰 Caixa / Gaveta' },
            { id: 'preco', label: '🏷️ Preços' },
            { id: 'estoque', label: '📦 Estoque & Cardápio' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFilter(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedFilter === tab.id
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Campo de Pesquisa */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por operador, comanda ou detalhe..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Linha do Tempo / Tabela de Eventos */}
      <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History size={18} className="text-emerald-400" /> Registro Cronológico ({filteredLogs.length} eventos)
          </h2>
          <span className="text-xs text-slate-400">Ordenado por data mais recente</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <ShieldCheck size={56} className="mx-auto mb-3 opacity-20 text-emerald-500" />
            <p className="text-base font-bold text-slate-400">Nenhum evento registrado com os filtros selecionados.</p>
            <p className="text-xs text-slate-600 mt-1">Todas as ações críticas do sistema serão registradas aqui automaticamente.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredLogs.map(log => {
              const badge = getActionBadge(log.action);
              const Icon = badge.icon;
              const dateObj = new Date(log.timestamp);
              const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <div key={log.id} className="p-5 hover:bg-slate-900/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl border shrink-0 mt-0.5 ${badge.bg}`}>
                      <Icon size={20} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                          <User size={13} className="text-slate-500" /> {log.operator}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-white leading-relaxed">
                        {log.details}
                      </p>
                      {(log.oldValue || log.newValue) && (
                        <div className="text-xs text-slate-400 flex flex-wrap gap-3 pt-1">
                          {log.oldValue && (
                            <span>Anterior: <strong className="text-slate-300 font-mono">{log.oldValue}</strong></span>
                          )}
                          {log.newValue && (
                            <span>Novo: <strong className="text-emerald-400 font-mono">{log.newValue}</strong></span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono text-xs text-slate-400 md:self-center">
                    <div className="flex items-center gap-1 md:justify-end text-slate-300 font-bold">
                      <Clock size={13} /> {formattedTime}
                    </div>
                    <span className="text-[11px] text-slate-500">{formattedDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
