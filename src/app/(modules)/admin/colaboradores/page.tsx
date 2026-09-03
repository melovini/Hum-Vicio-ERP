'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Users, Plus, Search, Shield, KeyRound, 
  CheckCircle2, AlertTriangle, Edit2, Trash2, Eye, EyeOff, 
  Phone, Clock, Check, X, ShieldAlert, Sparkles, UserCheck, UserX
} from 'lucide-react';
import SlidingSheet from '@/components/ui/SlidingSheet';
import StatusBadge, { StatusBadgeVariant } from '@/components/ui/StatusBadge';
import { 
  Collaborator, CollaboratorRole, 
  getStoredCollaborators, saveStoredCollaborator, 
  toggleActiveStoredCollaborator, deleteStoredCollaborator 
} from '@/lib/collaborators';

export default function ColaboradoresPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [filterRole, setFilterRole] = useState<'todos' | CollaboratorRole>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPinId, setShowPinId] = useState<string | null>(null);

  // Drawer / SlidingSheet de Cadastro e Edição
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingCollab, setEditingCollab] = useState<Collaborator | null>(null);

  // Formulário
  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState<CollaboratorRole>('caixa');
  const [pinInput, setPinInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [shiftInput, setShiftInput] = useState<'manha' | 'tarde' | 'noite' | 'integral'>('integral');
  const [isActiveInput, setIsActiveInput] = useState(true);

  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setCollaborators(getStoredCollaborators());
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Abrir Sheet para Novo Colaborador
  const handleOpenNewSheet = () => {
    setEditingCollab(null);
    setNameInput('');
    setRoleInput('caixa');
    setPinInput('');
    setPhoneInput('');
    setShiftInput('integral');
    setIsActiveInput(true);
    setIsSheetOpen(true);
  };

  // Abrir Sheet para Edição
  const handleOpenEditSheet = (collab: Collaborator) => {
    setEditingCollab(collab);
    setNameInput(collab.name);
    setRoleInput(collab.role);
    setPinInput(collab.pin);
    setPhoneInput(collab.phone || '');
    setShiftInput(collab.shift || 'integral');
    setIsActiveInput(collab.isActive);
    setIsSheetOpen(true);
  };

  // Salvar Colaborador
  const handleSaveCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      showFeedback('O nome do colaborador é obrigatório.', 'error');
      return;
    }
    if (!pinInput.trim()) {
      showFeedback('O PIN ou senha individual é obrigatório.', 'error');
      return;
    }

    // Validar se o PIN já existe em outro colaborador
    const pinClean = pinInput.trim();
    const existing = collaborators.find(
      c => c.pin.trim() === pinClean && (!editingCollab || c.id !== editingCollab.id)
    );
    if (existing) {
      showFeedback(`O PIN "${pinClean}" já está em uso por ${existing.name}. Escolha outro PIN.`, 'error');
      return;
    }

    const itemToSave: Collaborator = {
      id: editingCollab ? editingCollab.id : 'collab_' + Date.now().toString(36),
      name: nameInput.trim(),
      role: roleInput,
      pin: pinClean,
      phone: phoneInput.trim() || undefined,
      shift: shiftInput,
      isActive: isActiveInput,
      createdAt: editingCollab ? editingCollab.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = saveStoredCollaborator(itemToSave);
    setCollaborators(updated);
    setIsSheetOpen(false);
    showFeedback(
      editingCollab 
        ? `Colaborador "${itemToSave.name}" atualizado!` 
        : `Colaborador "${itemToSave.name}" cadastrado com sucesso!`
    );
  };

  // Alternar Status Ativo/Inativo
  const handleToggleActive = (id: string, name: string, currentlyActive: boolean) => {
    const updated = toggleActiveStoredCollaborator(id);
    setCollaborators(updated);
    showFeedback(`Colaborador ${name} ${currentlyActive ? 'desativado' : 'reativado'}!`);
  };

  // Excluir Colaborador
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir permanentemente o cadastro de ${name}?`)) {
      const updated = deleteStoredCollaborator(id);
      setCollaborators(updated);
      showFeedback(`Colaborador ${name} excluído com sucesso!`);
    }
  };

  // Filtragem e Busca
  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(c => {
      const matchesRole = filterRole === 'todos' || c.role === filterRole;
      const matchesQuery = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery));
      return matchesRole && matchesQuery;
    });
  }, [collaborators, filterRole, searchQuery]);

  // KPIs
  const kpis = useMemo(() => {
    const total = collaborators.length;
    const ativos = collaborators.filter(c => c.isActive).length;
    const caixas = collaborators.filter(c => c.role === 'caixa' && c.isActive).length;
    const cozinha = collaborators.filter(c => c.role === 'cozinha' && c.isActive).length;
    const gerentes = collaborators.filter(c => (c.role === 'gerente' || c.role === 'admin') && c.isActive).length;

    return { total, ativos, caixas, cozinha, gerentes };
  }, [collaborators]);

  const getRoleBadge = (role: CollaboratorRole) => {
    switch (role) {
      case 'admin':
        return <StatusBadge status="danger" label="Administrador Master" />;
      case 'gerente':
        return <StatusBadge status="partial" label="Gerente Operacional" />;
      case 'caixa':
        return <StatusBadge status="occupied" label="Operador de Caixa" />;
      case 'cozinha':
        return <StatusBadge status="free" label="Equipe Cozinha" />;
      default:
        return <StatusBadge status="neutral" label="Colaborador" />;
    }
  };

  return (
    <div className="min-h-screen bg-surface-ground text-slate-100 p-4 md:p-6 space-y-6">
      
      {/* Toast Flutuante Discreto */}
      {feedback && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top duration-200 ${
          feedback.type === 'success' 
            ? 'bg-surface-card border-status-free/40 text-status-free' 
            : 'bg-surface-card border-status-danger/40 text-status-danger'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Cabeçalho com Navegação & Ações */}
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
              <Users size={14} /> Gestão de Pessoas & Acessos
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Equipe & Colaboradores</h1>
            <p className="text-xs text-slate-400">
              Cadastre operadores de Caixa, Chapeiros de Cozinha e Gerentes com credenciais e PINs individuais.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/dashboard"
            className="py-2 px-3.5 bg-surface-card hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            📊 DRE & Dashboard
          </Link>

          <button
            type="button"
            onClick={handleOpenNewSheet}
            className="py-2 px-4 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={15} /> + Novo Colaborador
          </button>
        </div>
      </div>

      {/* Cards de KPIs da Equipe */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Total Cadastrado</span>
          <p className="text-xl font-mono tabular-nums font-bold text-slate-100">{kpis.total}</p>
          <span className="text-[10px] text-slate-500 font-medium">{kpis.ativos} ativos no sistema</span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Frente de Caixa</span>
          <p className="text-xl font-mono tabular-nums font-bold text-status-occupied">{kpis.caixas}</p>
          <span className="text-[10px] text-status-occupied/80 font-medium">PDV & Mesas</span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Cozinha & KDS</span>
          <p className="text-xl font-mono tabular-nums font-bold text-status-free">{kpis.cozinha}</p>
          <span className="text-[10px] text-status-free/80 font-medium">Chapa & Perdas</span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Gerentes & Admins</span>
          <p className="text-xl font-mono tabular-nums font-bold text-status-partial">{kpis.gerentes}</p>
          <span className="text-[10px] text-status-partial/80 font-medium">Acesso Executivo</span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Segurança de PIN</span>
          <p className="text-xl font-mono tabular-nums font-bold text-brand-accent">Individual</p>
          <span className="text-[10px] text-slate-500 font-medium">Rastreável por turno</span>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="bg-surface-card p-3 rounded-xl border border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Filtro por Papel / Cargo */}
        <div className="flex flex-wrap items-center gap-1 bg-surface-ground p-1 rounded-lg border border-surface-border w-full sm:w-auto">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'caixa', label: 'Caixa' },
            { id: 'cozinha', label: 'Cozinha' },
            { id: 'gerente', label: 'Gerente' },
            { id: 'admin', label: 'Admin' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterRole(f.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                filterRole === f.id
                  ? 'bg-surface-elevated text-slate-100 border border-surface-borderHover shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full input-util pl-9 text-xs"
          />
        </div>
      </div>

      {/* Tabela de Colaboradores (Data Grid) */}
      <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-border bg-surface-ground/60">
                <th className="py-3 px-4 text-[10px] font-medium tracking-wider text-slate-400 uppercase">Colaborador</th>
                <th className="py-3 px-4 text-[10px] font-medium tracking-wider text-slate-400 uppercase">Cargo / Perfil</th>
                <th className="py-3 px-4 text-[10px] font-medium tracking-wider text-slate-400 uppercase">Turno</th>
                <th className="py-3 px-4 text-[10px] font-medium tracking-wider text-slate-400 uppercase">PIN de Acesso</th>
                <th className="py-3 px-4 text-[10px] font-medium tracking-wider text-slate-400 uppercase">Status</th>
                <th className="py-3 px-4 text-[10px] font-medium tracking-wider text-slate-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-xs">
              {filteredCollaborators.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Users size={32} className="mx-auto opacity-30 mb-2" />
                    <p className="text-xs font-medium">Nenhum colaborador encontrado com os filtros atuais.</p>
                  </td>
                </tr>
              ) : (
                filteredCollaborators.map(c => {
                  const isPinVisible = showPinId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-surface-elevated/40 transition-colors">
                      {/* Nome e Telefone */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-surface-elevated border border-surface-border flex items-center justify-center font-bold text-brand-primary text-xs uppercase">
                            {c.name.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-100 block">{c.name}</span>
                            {c.phone ? (
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Phone size={10} /> {c.phone}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-600">Sem telefone</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cargo */}
                      <td className="py-3.5 px-4">
                        {getRoleBadge(c.role)}
                      </td>

                      {/* Turno */}
                      <td className="py-3.5 px-4 capitalize text-slate-300">
                        <span className="inline-flex items-center gap-1.5 text-slate-400">
                          <Clock size={12} className="text-slate-500" />
                          {c.shift || 'Integral'}
                        </span>
                      </td>

                      {/* PIN de Acesso */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-2 bg-surface-ground px-2.5 py-1 rounded-md border border-surface-border font-mono tabular-nums">
                          <KeyRound size={12} className="text-brand-accent" />
                          <span className="text-slate-200 font-bold tracking-widest">
                            {isPinVisible ? c.pin : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPinId(isPinVisible ? null : c.id)}
                            className="text-slate-500 hover:text-slate-300 cursor-pointer p-0.5 ml-1"
                            title={isPinVisible ? 'Ocultar PIN' : 'Visualizar PIN'}
                          >
                            {isPinVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(c.id, c.name, c.isActive)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors border ${
                            c.isActive
                              ? 'bg-status-free/10 text-status-free border-status-free/20 hover:bg-status-free/20'
                              : 'bg-status-danger/10 text-status-danger border-status-danger/20 hover:bg-status-danger/20'
                          }`}
                          title="Clique para alternar o status do colaborador"
                        >
                          {c.isActive ? <UserCheck size={12} /> : <UserX size={12} />}
                          {c.isActive ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSheet(c)}
                            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-surface-elevated rounded-md cursor-pointer transition-colors"
                            title="Editar Dados do Colaborador"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id, c.name)}
                            className="p-1.5 text-slate-500 hover:text-status-danger hover:bg-surface-elevated rounded-md cursor-pointer transition-colors"
                            title="Excluir Colaborador"
                          >
                            <Trash2 size={14} />
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

      {/* GAVETA LATERAL DESLIZANTE (SLIDING SHEET): CADASTRO / EDIÇÃO */}
      <SlidingSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Shield className="text-brand-primary" size={18} />
            <span>{editingCollab ? `Editar: ${editingCollab.name}` : 'Cadastrar Colaborador'}</span>
          </div>
        }
        description="Defina as credenciais, nível de permissão e função operacional do colaborador."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="flex-1 py-2.5 bg-surface-ground hover:bg-surface-elevated text-slate-300 border border-surface-border rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveCollaborator}
              className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              {editingCollab ? 'Salvar Alterações' : 'Confirmar Cadastro'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveCollaborator} className="space-y-4 text-xs">
          
          {/* Nome */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Nome Completo do Colaborador *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: João da Silva"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              className="w-full input-util text-sm"
            />
          </div>

          {/* Cargo / Perfil */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Função / Perfil de Acesso *
            </label>
            <select
              value={roleInput}
              onChange={e => setRoleInput(e.target.value as CollaboratorRole)}
              className="w-full input-util text-xs cursor-pointer"
            >
              <option value="caixa">Operador de Caixa (Frente de Caixa, PDV & Mesas)</option>
              <option value="cozinha">Equipe de Cozinha (KDS Chapa, Fila & Perdas)</option>
              <option value="gerente">Gerente Operacional (Gestão Executiva, DRE, Estoque, Caixa & KDS)</option>
              <option value="admin">Administrador Master (Acesso Irrestrito + Gestão de Pessoas)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {roleInput === 'caixa' && 'Acesso restrito ao Caixa, lançamento de pedidos e mapa do salão.'}
              {roleInput === 'cozinha' && 'Acesso restrito à tela do KDS da chapa e controle de perdas.'}
              {roleInput === 'gerente' && 'Acesso a DRE, compras, suprimentos, auditoria e fechamento de turnos.'}
              {roleInput === 'admin' && 'Controle total da infraestrutura, configurações e exclusões.'}
            </span>
          </div>

          {/* PIN de Acesso */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              PIN / Senha de Acesso Individual *
            </label>
            <input
              type="password"
              required
              placeholder="Ex: 1234, 9876"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              className="w-full input-util font-mono tabular-nums text-sm tracking-widest text-brand-accent font-bold"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Este é o código pessoal que o colaborador digitará na tela de login para iniciar seu turno.
            </span>
          </div>

          {/* Turno */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Turno de Trabalho
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'manha', label: 'Manhã' },
                { id: 'tarde', label: 'Tarde' },
                { id: 'noite', label: 'Noite' },
                { id: 'integral', label: 'Integral' }
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShiftInput(s.id as any)}
                  className={`py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    shiftInput === s.id
                      ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                      : 'bg-surface-ground border-surface-border text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Telefone / WhatsApp */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Telefone / Contato (Opcional)
            </label>
            <input
              type="text"
              placeholder="(11) 99999-9999"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              className="w-full input-util text-xs font-mono tabular-nums"
            />
          </div>

          {/* Status Ativo */}
          <div className="pt-2 border-t border-surface-border">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isActiveInput}
                onChange={e => setIsActiveInput(e.target.checked)}
                className="rounded border-surface-border accent-brand-primary cursor-pointer w-4 h-4"
              />
              <span className="text-xs font-semibold text-slate-200">
                Colaborador ativo na escala de trabalho
              </span>
            </label>
          </div>

        </form>
      </SlidingSheet>

    </div>
  );
}
