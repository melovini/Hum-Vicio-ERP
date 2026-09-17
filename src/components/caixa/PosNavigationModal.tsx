'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui';
import { 
  Home, LayoutDashboard, ChefHat, ShieldCheck, 
  UserCheck, Lock, MonitorDot, 
  LogOut, ChevronRight, AlertCircle, Sparkles
} from 'lucide-react';
import { logoutAction, loginAction } from '@/app/login/actions';
import type { UserRole } from '@/lib/session';

interface PosNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole | null;
  userName?: string;
  hasActiveCart?: boolean;
  onSaveDraftBeforeLeave?: () => void;
  isOpenCaixa?: boolean;
}

export default function PosNavigationModal({
  isOpen,
  onClose,
  userRole,
  userName = 'Operador',
  hasActiveCart = false,
  onSaveDraftBeforeLeave,
  isOpenCaixa = false,
}: PosNavigationModalProps) {
  const router = useRouter();
  const [managerPin, setManagerPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const canAccessOtherModules = userRole === 'admin' || userRole === 'gerente';

  const handleNavigate = (url: string) => {
    if (onSaveDraftBeforeLeave) {
      onSaveDraftBeforeLeave();
    }
    onClose();
    router.push(url);
  };

  const handleAuthorizeManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerPin.trim()) return;

    setIsAuthenticating(true);
    setAuthError('');

    try {
      const res = await loginAction(managerPin.trim());
      if (res.success && res.redirectUrl) {
        if (onSaveDraftBeforeLeave) onSaveDraftBeforeLeave();
        onClose();
        router.push(res.redirectUrl);
      } else {
        setAuthError(res.error || 'Credencial inválida ou sem permissão para acessar outros módulos.');
      }
    } catch {
      setAuthError('Erro ao validar credencial. Tente novamente.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Navegação do Sistema & Central de Módulos"
      description="Transite livremente entre a raiz do sistema e outros módulos autorizados."
      size="lg"
    >
      <div className="space-y-4 py-2">
        {/* Identificação do Operador e Nível de Acesso */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              userRole === 'admin' 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                : userRole === 'gerente'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {userRole === 'admin' ? (
                <ShieldCheck size={22} />
              ) : userRole === 'gerente' ? (
                <UserCheck size={22} />
              ) : (
                <MonitorDot size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Operador Atual:</span>
                <strong className="text-sm font-bold text-white">{userName}</strong>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Perfil:{' '}
                <strong className={
                  userRole === 'admin' 
                    ? 'text-amber-400' 
                    : userRole === 'gerente' 
                    ? 'text-blue-400' 
                    : 'text-slate-300'
                }>
                  {userRole === 'admin'
                    ? 'Administrador Geral (Acesso Total)'
                    : userRole === 'gerente'
                    ? 'Gerente Operacional'
                    : userRole === 'caixa'
                    ? 'Operador de Caixa (Restrito ao PDV)'
                    : 'Operação'}
                </strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            {canAccessOtherModules ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Navegação Liberada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                <Lock size={12} /> Acesso Restrito ao Caixa
              </span>
            )}
          </div>
        </div>

        {/* Informação sobre o Turno de Caixa e Carrinho */}
        {(isOpenCaixa || hasActiveCart) && (
          <div className="p-3 bg-blue-950/25 border border-blue-500/25 rounded-xl text-xs text-blue-300 flex items-start gap-2.5">
            <Sparkles size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-blue-200">
                {isOpenCaixa ? 'Seu turno de caixa continua aberto com segurança.' : 'Operação preservada.'}
              </p>
              <p className="text-slate-400">
                {hasActiveCart
                  ? 'Os itens do pedido atual serão preservados como rascunho de atendimento ao sair.'
                  : 'Você pode retornar a este terminal a qualquer momento sem perder dados.'}
              </p>
            </div>
          </div>
        )}

        {/* Se o operador possui permissão: Lista de Módulos para Navegação */}
        {canAccessOtherModules ? (
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
              Selecione o destino desejado:
            </p>

            {/* 1. Raiz do Sistema (Central Geral) */}
            <button
              type="button"
              onClick={() => handleNavigate('/')}
              className="w-full p-4 bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl flex items-center justify-between gap-4 transition-all group text-left cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Home size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                      Central Geral / Início (Raiz)
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-extrabold uppercase">
                      Raiz
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Visão unificada de todos os módulos, status da operação e atalhos rápidos.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0" />
            </button>

            {/* 2. Gestão Executiva & ERP */}
            <button
              type="button"
              onClick={() => handleNavigate('/admin/dashboard')}
              className="w-full p-4 bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-blue-500/40 rounded-2xl flex items-center justify-between gap-4 transition-all group text-left cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <LayoutDashboard size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                      Gestão Executiva & ERP
                    </h3>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-extrabold uppercase">
                      Admin
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    DRE Financeiro, Cardápio & Fichas Técnicas, Precificação, Estoque e Compras.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all shrink-0" />
            </button>

            {/* 3. Cozinha & KDS Chapa */}
            <button
              type="button"
              onClick={() => handleNavigate('/cozinha')}
              className="w-full p-4 bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-red-500/40 rounded-2xl flex items-center justify-between gap-4 transition-all group text-left cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-400 border border-red-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ChefHat size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                      Cozinha & KDS Chapa
                    </h3>
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-[10px] font-extrabold uppercase">
                      Produção
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Painel digital de comandas em tempo real, fila futura e tempos de preparo.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-500 group-hover:text-red-400 group-hover:translate-x-1 transition-all shrink-0" />
            </button>
          </div>
        ) : (
          /* Se o operador é 'caixa' (sem permissão direta): Formulário de Desbloqueio */
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-start gap-3 text-xs text-amber-300">
              <AlertCircle size={18} className="shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold text-amber-200">
                  Acesso Restrito a Outros Módulos
                </p>
                <p className="text-slate-400 mt-0.5">
                  Este terminal está logado com perfil de operador de caixa. Para liberar o retorno à raiz ou acessar os módulos de Gestão/Cozinha, insira a senha ou PIN de um Administrador ou Gerente:
                </p>
              </div>
            </div>

            <form onSubmit={handleAuthorizeManager} className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  PIN ou Senha de Gerente / Administrador
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={managerPin}
                    onChange={(e) => setManagerPin(e.target.value)}
                    placeholder="Digite o PIN ou senha..."
                    className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isAuthenticating || !managerPin.trim()}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                  >
                    {isAuthenticating ? 'Validando...' : 'Liberar e Acessar Raiz'}
                  </button>
                </div>
                {authError && (
                  <p className="text-xs text-rose-400 font-medium pt-1">
                    {authError}
                  </p>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Rodapé da Janela Modal */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs">
          <form action={logoutAction}>
            <button
              type="submit"
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-slate-800 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Encerrar sessão deste operador"
            >
              <LogOut size={14} /> Trocar Usuário / Sair
            </button>
          </form>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Continuar no Caixa (Esc)
          </button>
        </div>
      </div>
    </Dialog>
  );
}
