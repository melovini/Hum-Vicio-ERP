'use client';
import React, { useState, useMemo } from 'react';
import { Sale } from '@/lib/store';
import { 
  Receipt, AlertCircle, CreditCard, UserCheck, 
  CheckCircle2, Check, Search, Calendar, Banknote, Printer 
} from 'lucide-react';

interface PosContasReceberTabProps {
  sales: Sale[];
  onOpenSettleModal: (sale: Sale) => void;
  onPrintSale: (sale: Sale) => void;
}

export default function PosContasReceberTab({
  sales,
  onOpenSettleModal,
  onPrintSale,
}: PosContasReceberTabProps) {
  const [filter, setFilter] = useState<'pendentes' | 'quitados' | 'fiado_vip' | 'consumo_funcionario' | 'todos'>('pendentes');
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = useMemo(() => {
    let fiadoPending = 0;
    let collabPending = 0;
    let totalPending = 0;
    let totalPaid = 0;
    let pendingCount = 0;

    sales.forEach(s => {
      const isCredit = s.paymentMethod === 'fiado_vip' || s.paymentMethod === 'consumo_funcionario' || s.creditStatus !== undefined;
      if (!isCredit || s.status === 'cancelled') return;

      if (s.creditStatus === 'quitado') {
        totalPaid += s.total;
      } else {
        totalPending += s.total;
        pendingCount++;
        if (s.paymentMethod === 'consumo_funcionario') {
          collabPending += s.total;
        } else {
          fiadoPending += s.total;
        }
      }
    });

    return { fiadoPending, collabPending, totalPending, totalPaid, pendingCount };
  }, [sales]);

  const creditSales = useMemo(() => {
    return sales.filter(s => {
      const isCredit = s.paymentMethod === 'fiado_vip' || s.paymentMethod === 'consumo_funcionario' || s.creditStatus !== undefined;
      if (!isCredit || s.status === 'cancelled') return false;

      if (filter === 'pendentes' && s.creditStatus === 'quitado') return false;
      if (filter === 'quitados' && s.creditStatus !== 'quitado') return false;
      if (filter === 'fiado_vip' && s.paymentMethod !== 'fiado_vip') return false;
      if (filter === 'consumo_funcionario' && s.paymentMethod !== 'consumo_funcionario') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const client = (s.creditCustomerName || s.customerName || '').toLowerCase();
        const collab = (s.collaboratorName || '').toLowerCase();
        return client.includes(q) || collab.includes(q);
      }

      return true;
    });
  }, [sales, filter, searchQuery]);

  return (
    <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 space-y-6 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="text-amber-500" /> Gestão de Contas a Receber
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Controle de créditos para Clientes VIP (Fiado) e Consumo interno de Colaboradores.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono font-bold">
          {creditSales.length} registro(s)
        </span>
      </div>

      {/* 4 Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center justify-between text-amber-400 text-xs font-bold mb-1">
            <span>Total Pendente</span>
            <AlertCircle size={15} />
          </div>
          <div className="text-xl font-mono font-black text-amber-300">
            R$ {metrics.totalPending.toFixed(2)}
          </div>
          <div className="text-[10px] text-amber-400/80 mt-1">
            {metrics.pendingCount} lançamentos em aberto
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center justify-between text-amber-300 text-xs font-bold mb-1">
            <span>Fiado VIP Pendente</span>
            <CreditCard size={15} />
          </div>
          <div className="text-xl font-mono font-black text-white">
            R$ {metrics.fiadoPending.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Clientes VIP
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-center justify-between text-purple-400 text-xs font-bold mb-1">
            <span>Consumo Equipe</span>
            <UserCheck size={15} />
          </div>
          <div className="text-xl font-mono font-black text-purple-300">
            R$ {metrics.collabPending.toFixed(2)}
          </div>
          <div className="text-[10px] text-purple-400/80 mt-1">
            Desconto em folha
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-bold mb-1">
            <span>Total Quitado</span>
            <CheckCircle2 size={15} />
          </div>
          <div className="text-xl font-mono font-black text-emerald-400">
            R$ {metrics.totalPaid.toFixed(2)}
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-1">
            Já liquidado
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'pendentes', label: '⏳ Pendentes' },
            { id: 'quitados', label: '✅ Quitados' },
            { id: 'fiado_vip', label: '⭐ Fiado VIP' },
            { id: 'consumo_funcionario', label: '👥 Equipe' },
            { id: 'todos', label: 'Todos' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === f.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>
      </div>

      {/* Tabela de Contas */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] font-bold tracking-wider">
              <th className="p-3">Data</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Beneficiário</th>
              <th className="p-3">Itens</th>
              <th className="p-3 text-right">Valor</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {creditSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Nenhum registro de conta a receber encontrado com estes filtros.
                </td>
              </tr>
            ) : (
              creditSales.map(sale => {
                const isCollab = sale.paymentMethod === 'consumo_funcionario';
                const isPending = sale.creditStatus !== 'quitado';
                const personName = isCollab
                  ? (sale.collaboratorName || 'Colaborador')
                  : (sale.creditCustomerName || sale.customerName || 'Cliente VIP');

                return (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono text-slate-400">
                      <div>{new Date(sale.date).toLocaleDateString('pt-BR')}</div>
                      <div className="text-[10px] text-slate-500">
                        #{sale.id.slice(0, 6).toUpperCase()}
                      </div>
                    </td>

                    <td className="p-3">
                      {isCollab ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-300 font-bold text-[10px]">
                          <UserCheck size={11} /> Equipe
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 font-bold text-[10px]">
                          <CreditCard size={11} /> Fiado VIP
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-bold text-white">
                      {personName}
                    </td>

                    <td className="p-3 text-slate-300 max-w-xs truncate">
                      {sale.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-white text-sm">
                      R$ {sale.total.toFixed(2)}
                    </td>

                    <td className="p-3 text-center">
                      {isPending ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                          ⏳ Pendente
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          ✅ Quitado
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => onOpenSettleModal(sale)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                            title="Dar baixa / liquidar"
                          >
                            <Banknote size={12} /> Liquidar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPrintSale(sale)}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer transition-colors"
                          title="Imprimir cupom"
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
