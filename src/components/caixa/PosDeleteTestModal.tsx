'use client';
import React, { useState } from 'react';
import { Dialog } from '@/components/ui';
import { CashSession } from '@/lib/store';
import { Trash2, ShieldAlert } from 'lucide-react';

interface PosDeleteTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCashSession: CashSession | null;
  allCashSessions: CashSession[];
  onConfirmDelete: (sessionId: string, password: string) => Promise<{ success: boolean; count?: number; error?: string }>;
  onSuccess: (count: number) => void;
}

export default function PosDeleteTestModal({
  isOpen,
  onClose,
  activeCashSession,
  allCashSessions,
  onConfirmDelete,
  onSuccess,
}: PosDeleteTestModalProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(activeCashSession?.id || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Informe a senha do Administrador.');
      return;
    }
    const targetId = selectedSessionId || activeCashSession?.id;
    if (!targetId) {
      setError('Nenhuma sessão selecionada para expurgo.');
      return;
    }

    setIsDeleting(true);
    setError('');
    try {
      const res = await onConfirmDelete(targetId, password);
      if (res.success) {
        onSuccess(res.count || 0);
        setPassword('');
        onClose();
      } else {
        setError(res.error || 'Senha incorreta ou erro no expurgo.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Apagar Caixa de Teste & Expurgo de Vendas"
      description="Ação restrita a testes. As comandas e movimentações serão canceladas sem afetar relatórios fiscais reais."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 space-y-2">
          <p className="font-bold flex items-center gap-1.5 text-rose-300">
            <ShieldAlert size={16} /> ATENÇÃO: EXPURGO CONTÁBIL TOTAL
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-300/90 pl-1">
            <li>Todas as vendas deste turno serão expurgadas.</li>
            <li>Não afetará o DRE ou contabilidade real.</li>
            <li>A sessão de caixa será encerrada e removida.</li>
          </ul>
        </div>

        {/* Seleção de Sessão */}
        <div>
          <label className="block text-slate-300 font-bold text-xs mb-1">
            Sessão de Caixa a Excluir:
          </label>
          <select
            value={selectedSessionId || activeCashSession?.id || ''}
            onChange={e => setSelectedSessionId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-bold outline-none focus:border-rose-500 cursor-pointer"
          >
            {activeCashSession && (
              <option value={activeCashSession.id}>
                🟢 Caixa Atual (#{activeCashSession.id.slice(0, 6)} - {activeCashSession.openedBy || 'Operador'})
              </option>
            )}
            {allCashSessions.filter(s => s.id !== activeCashSession?.id).slice(0, 5).map(s => (
              <option key={s.id} value={s.id}>
                {s.status === 'open' ? '🟢' : '⚪'} Caixa #{s.id.slice(0, 6)} ({s.openedBy || 'Operador'})
              </option>
            ))}
          </select>
        </div>

        {/* Senha Master */}
        <div>
          <label className="block text-slate-300 font-bold text-xs mb-1">
            Senha do Administrador:
          </label>
          <input
            type="password"
            required
            placeholder="Digite a senha de supervisor/admin"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              setError('');
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm outline-none focus:border-rose-500"
          />
          {error && (
            <p className="text-xs text-rose-400 font-bold mt-1">
              ⚠️ {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 size={14} /> {isDeleting ? 'Expurgando...' : 'Confirmar Expurgo'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
