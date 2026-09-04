'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Users, Plus, Search, Shield, KeyRound, 
  CheckCircle2, AlertTriangle, Edit2, Trash2, Eye, EyeOff, 
  Phone, Clock, Check, X, ShieldAlert, Sparkles, UserCheck, UserX,
  Calendar, DollarSign, Wallet, History, Gift, CheckSquare, 
  FileText, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';
import SlidingSheet from '@/components/ui/SlidingSheet';
import StatusBadge, { StatusBadgeVariant } from '@/components/ui/StatusBadge';
import { 
  Collaborator, CollaboratorRole, PayType,
  getStoredCollaborators, setLocalCollaboratorsCache
} from '@/lib/collaborators';
import { 
  WageEntry, DAYS_OF_WEEK, DayKey,
  getStoredWageEntries, saveStoredWageEntry, deleteStoredWageEntry, 
  computeCollaboratorBalance, getStoredWeeklySchedules, saveStoredWeeklySchedule
} from '@/lib/diarias';
import {
  getCollaboratorsAction,
  saveCollaboratorAction,
  toggleActiveCollaboratorAction,
  deleteCollaboratorAction,
  checkCloudStatusAction
} from './actions';

export default function ColaboradoresPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [filterRole, setFilterRole] = useState<'todos' | CollaboratorRole>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPinId, setShowPinId] = useState<string | null>(null);

  // Sub-Aba Principal Ativa
  const [activeMainTab, setActiveMainTab] = useState<'equipe' | 'escala_diarias'>('equipe');

  // Status de Sincronização
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [isLoadingServer, setIsLoadingServer] = useState<boolean>(true);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Drawer / SlidingSheet de Cadastro e Edição
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingCollab, setEditingCollab] = useState<Collaborator | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Formulário - Campos Padrão e de Remuneração / Diária
  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState<CollaboratorRole>('caixa');
  const [pinInput, setPinInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [shiftInput, setShiftInput] = useState<'manha' | 'tarde' | 'noite' | 'integral'>('integral');
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [payTypeInput, setPayTypeInput] = useState<PayType>('mensalista');
  const [dailyRateInput, setDailyRateInput] = useState<string>('100');
  const [weeklyScheduleInput, setWeeklyScheduleInput] = useState<string[]>(['qui', 'sex', 'sab', 'dom']);

  // Estado das Diárias, Agrados e Acertos
  const [wageEntries, setWageEntries] = useState<WageEntry[]>([]);
  const [weeklySchedules, setWeeklySchedules] = useState<Record<string, string[]>>({});

  // Modais de Ação de Diárias
  const [bonusModalCollab, setBonusModalCollab] = useState<Collaborator | null>(null);
  const [bonusAmount, setBonusAmount] = useState<string>('30');
  const [bonusNotes, setBonusNotes] = useState<string>('');

  const [acertoModalCollab, setAcertoModalCollab] = useState<Collaborator | null>(null);
  const [acertoAmount, setAcertoAmount] = useState<string>('');
  const [acertoMethod, setAcertoMethod] = useState<'pix' | 'dinheiro' | 'transferencia' | 'outro'>('pix');
  const [acertoNotes, setAcertoNotes] = useState<string>('');

  const [historyModalCollab, setHistoryModalCollab] = useState<Collaborator | null>(null);

  const [extraShiftModalCollab, setExtraShiftModalCollab] = useState<Collaborator | null>(null);
  const [extraShiftAmount, setExtraShiftAmount] = useState<string>('100');
  const [extraShiftDate, setExtraShiftDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [extraShiftNotes, setExtraShiftNotes] = useState<string>('Diária extra / Cobertura');

  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Carregamento Híbrido: Cache Local imediato + Sincronização do Servidor/Nuvem
  useEffect(() => {
    // 1. Mostrar cache local instantâneo
    const cached = getStoredCollaborators();
    setCollaborators(cached);
    setWageEntries(getStoredWageEntries());
    setWeeklySchedules(getStoredWeeklySchedules());

    // 2. Buscar versão oficial autoritativa do servidor
    async function loadServerData() {
      try {
        setIsLoadingServer(true);
        const res = await getCollaboratorsAction();
        if (res.collaborators && res.collaborators.length > 0) {
          setCollaborators(res.collaborators);
          setLocalCollaboratorsCache(res.collaborators);
        }
        setIsCloudSynced(res.isCloudSynced);
      } catch (err) {
        console.warn('Erro ao carregar colaboradores do servidor:', err);
      } finally {
        setIsLoadingServer(false);
      }
    }
    loadServerData();
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Cálculos de Diárias e Saldos
  const diaristasList = useMemo(() => {
    return collaborators.filter(c => c.payType === 'diarista');
  }, [collaborators]);

  const balancesMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeCollaboratorBalance>> = {};
    diaristasList.forEach(c => {
      map[c.id] = computeCollaboratorBalance(c.id, c.name, wageEntries);
    });
    return map;
  }, [diaristasList, wageEntries]);

  const totalDueAllDiaristas = useMemo(() => {
    return Object.values(balancesMap).reduce((acc, b) => acc + b.totalDue, 0);
  }, [balancesMap]);

  const totalPaidMonth = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return wageEntries
      .filter(e => e.type === 'pagamento_acerto' && e.date.startsWith(currentMonthStr))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [wageEntries]);

  const totalWorkedShiftsMonth = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return wageEntries.filter(e => (e.type === 'diaria' || e.type === 'diaria_extra') && e.date.startsWith(currentMonthStr)).length;
  }, [wageEntries]);

  // Ações de Lançamento de Diária / Agrado / Acerto
  const handleQuickLogShift = (collab: Collaborator) => {
    const amount = Number(collab.dailyRate) || 100;
    const todayStr = new Date().toISOString().slice(0, 10);
    const newEntry: WageEntry = {
      id: 'wage_' + Date.now().toString(36),
      collaboratorId: collab.id,
      collaboratorName: collab.name,
      date: todayStr,
      type: 'diaria',
      amount,
      notes: 'Diária trabalhada regular',
      registeredBy: 'Administrador Master',
      createdAt: new Date().toISOString()
    };
    const updated = saveStoredWageEntry(newEntry);
    setWageEntries(updated);
    showFeedback(`+1 Diária de R$ ${amount.toFixed(2)} lançada para ${collab.name}!`);
  };

  const handleConfirmBonus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusModalCollab) return;
    const val = parseFloat(bonusAmount) || 0;
    if (val <= 0) {
      showFeedback('Digite um valor de agrado válido.', 'error');
      return;
    }
    const newEntry: WageEntry = {
      id: 'bonus_' + Date.now().toString(36),
      collaboratorId: bonusModalCollab.id,
      collaboratorName: bonusModalCollab.name,
      date: new Date().toISOString().slice(0, 10),
      type: 'agrado',
      amount: val,
      notes: bonusNotes.trim() || 'Agrado / Bônus do dia',
      registeredBy: 'Administrador Master',
      createdAt: new Date().toISOString()
    };
    const updated = saveStoredWageEntry(newEntry);
    setWageEntries(updated);
    setBonusModalCollab(null);
    setBonusNotes('');
    showFeedback(`Agrado de R$ ${val.toFixed(2)} registrado para ${bonusModalCollab.name}!`);
  };

  const handleConfirmExtraShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraShiftModalCollab) return;
    const val = parseFloat(extraShiftAmount) || 0;
    if (val <= 0) {
      showFeedback('Digite um valor de diária extra válido.', 'error');
      return;
    }
    const newEntry: WageEntry = {
      id: 'extra_' + Date.now().toString(36),
      collaboratorId: extraShiftModalCollab.id,
      collaboratorName: extraShiftModalCollab.name,
      date: extraShiftDate || new Date().toISOString().slice(0, 10),
      type: 'diaria_extra',
      amount: val,
      notes: extraShiftNotes.trim() || 'Diária extra / Cobertura',
      registeredBy: 'Administrador Master',
      createdAt: new Date().toISOString()
    };
    const updated = saveStoredWageEntry(newEntry);
    setWageEntries(updated);
    setExtraShiftModalCollab(null);
    showFeedback(`Diária extra de R$ ${val.toFixed(2)} registrada para ${extraShiftModalCollab.name}!`);
  };

  const handleConfirmAcerto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acertoModalCollab) return;
    const val = parseFloat(acertoAmount) || 0;
    if (val <= 0) {
      showFeedback('Digite um valor válido para o acerto.', 'error');
      return;
    }
    const newEntry: WageEntry = {
      id: 'acerto_' + Date.now().toString(36),
      collaboratorId: acertoModalCollab.id,
      collaboratorName: acertoModalCollab.name,
      date: new Date().toISOString().slice(0, 10),
      type: 'pagamento_acerto',
      amount: val,
      paymentMethod: acertoMethod,
      notes: acertoNotes.trim() || `Acerto de diárias pago via ${acertoMethod.toUpperCase()}`,
      registeredBy: 'Administrador Master',
      createdAt: new Date().toISOString()
    };
    const updated = saveStoredWageEntry(newEntry);
    setWageEntries(updated);
    setAcertoModalCollab(null);
    setAcertoNotes('');
    showFeedback(`Acerto de R$ ${val.toFixed(2)} pago e abatido do saldo de ${acertoModalCollab.name}!`);
  };

  const handleDeleteEntry = (id: string) => {
    if (confirm('Deseja excluir este lançamento do extrato?')) {
      const updated = deleteStoredWageEntry(id);
      setWageEntries(updated);
      showFeedback('Lançamento removido com sucesso.');
    }
  };

  const handleToggleScheduleDay = (collabId: string, dayKey: string) => {
    const currentDays = weeklySchedules[collabId] || [];
    const exists = currentDays.includes(dayKey);
    const updatedDays = exists ? currentDays.filter(d => d !== dayKey) : [...currentDays, dayKey];
    const newSchedule = { ...weeklySchedules, [collabId]: updatedDays };
    setWeeklySchedules(newSchedule);
    saveStoredWeeklySchedule(newSchedule);
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
    setPayTypeInput('mensalista');
    setDailyRateInput('100');
    setWeeklyScheduleInput(['qui', 'sex', 'sab', 'dom']);
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
    setPayTypeInput(collab.payType || 'mensalista');
    setDailyRateInput(collab.dailyRate ? String(collab.dailyRate) : '100');
    setWeeklyScheduleInput(collab.weeklySchedule || ['qui', 'sex', 'sab', 'dom']);
    setIsSheetOpen(true);
  };

  // Salvar Colaborador via Server Action
  const handleSaveCollaborator = async (e: React.FormEvent) => {
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
      payType: payTypeInput,
      dailyRate: payTypeInput === 'diarista' ? (parseFloat(dailyRateInput) || 100) : undefined,
      weeklySchedule: payTypeInput === 'diarista' ? weeklyScheduleInput : undefined,
      isActive: isActiveInput,
      createdAt: editingCollab ? editingCollab.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      const res = await saveCollaboratorAction(itemToSave);
      if (res.success) {
        setCollaborators(res.updatedList);
        setLocalCollaboratorsCache(res.updatedList);
        setIsCloudSynced(res.isCloudSynced);
        setIsSheetOpen(false);

        if (res.isCloudSynced) {
          showFeedback(
            editingCollab 
              ? `Colaborador "${itemToSave.name}" atualizado e sincronizado na Nuvem!` 
              : `Colaborador "${itemToSave.name}" cadastrado e sincronizado na Nuvem!`
          );
        } else {
          showFeedback(
            editingCollab 
              ? `Senha e dados de "${itemToSave.name}" salvos no servidor local!` 
              : `Colaborador "${itemToSave.name}" salvo no servidor local!`
          );
        }
      } else {
        showFeedback(res.error || 'Erro ao salvar colaborador.', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Falha na conexão com o servidor.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Alternar Status Ativo/Inativo
  const handleToggleActive = async (id: string, name: string, currentlyActive: boolean) => {
    try {
      const res = await toggleActiveCollaboratorAction(id);
      if (res.success) {
        setCollaborators(res.updatedList);
        setLocalCollaboratorsCache(res.updatedList);
        setIsCloudSynced(res.isCloudSynced);
        showFeedback(`Colaborador ${name} ${currentlyActive ? 'desativado' : 'reativado'}!`);
      }
    } catch {
      showFeedback(`Falha ao alterar status de ${name}.`, 'error');
    }
  };

  // Excluir Colaborador
  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir permanentemente o cadastro de ${name}?`)) {
      try {
        const res = await deleteCollaboratorAction(id);
        if (res.success) {
          setCollaborators(res.updatedList);
          setLocalCollaboratorsCache(res.updatedList);
          setIsCloudSynced(res.isCloudSynced);
          showFeedback(`Colaborador ${name} excluído com sucesso!`);
        }
      } catch {
        showFeedback(`Falha ao excluir ${name}.`, 'error');
      }
    }
  };

  const handleCopySql = () => {
    const sql = `-- HUM VÍCIO ERP: TABELA DE COLABORADORES & DIÁRIAS
CREATE TABLE IF NOT EXISTS collaborators (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'gerente', 'caixa', 'cozinha')),
    pin VARCHAR(50) NOT NULL,
    phone VARCHAR(30),
    shift VARCHAR(30) DEFAULT 'integral' CHECK (shift IN ('manha', 'tarde', 'noite', 'integral')),
    pay_type VARCHAR(30) DEFAULT 'mensalista',
    daily_rate NUMERIC(10, 2) DEFAULT 0,
    weekly_schedule TEXT DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS pay_type VARCHAR(30) DEFAULT 'mensalista';
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS weekly_schedule TEXT DEFAULT '[]';

CREATE TABLE IF NOT EXISTS collaborator_diarias (
    id VARCHAR(100) PRIMARY KEY,
    collaborator_id VARCHAR(100) NOT NULL,
    collaborator_name VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('diaria', 'diaria_extra', 'agrado', 'pagamento_acerto')),
    amount NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    payment_method VARCHAR(50),
    registered_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collaborators_pin ON collaborators(pin);
CREATE INDEX IF NOT EXISTS idx_collaborators_role ON collaborators(role);
CREATE INDEX IF NOT EXISTS idx_diarias_collab ON collaborator_diarias(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_diarias_date ON collaborator_diarias(date);

ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collaborators_all" ON collaborators;
CREATE POLICY "collaborators_all" ON collaborators FOR ALL USING (true);

ALTER TABLE collaborator_diarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "diarias_all" ON collaborator_diarias;
CREATE POLICY "diarias_all" ON collaborator_diarias FOR ALL USING (true);`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
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

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Badge de Sincronização */}
          {isCloudSynced ? (
            <div className="py-1.5 px-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1.5" title="Sincronizado na nuvem Supabase em tempo real com todos os dispositivos">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Nuvem Ativa</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Clique para ativar a sincronização na nuvem Supabase"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Servidor Local Ativo</span>
              <span className="underline ml-1 font-bold text-[10px]">Ativar Nuvem</span>
            </button>
          )}

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

      {/* Sub-Abas de Navegação Principal */}
      <div className="flex items-center gap-2 border-b border-surface-border pb-3">
        <button
          type="button"
          onClick={() => setActiveMainTab('equipe')}
          className={`py-2 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'equipe'
              ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
              : 'bg-surface-card hover:bg-surface-elevated text-slate-400 hover:text-slate-200 border border-surface-border'
          }`}
        >
          <Users size={16} /> Equipe & Senhas ({collaborators.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('escala_diarias')}
          className={`py-2 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'escala_diarias'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
              : 'bg-surface-card hover:bg-surface-elevated text-slate-400 hover:text-slate-200 border border-surface-border'
          }`}
        >
          <Calendar size={16} /> Escala Semanal & Acerto de Diárias
          {totalDueAllDiaristas > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-rose-600 text-white rounded-full font-mono text-[10px] font-black animate-pulse">
              R$ {totalDueAllDiaristas.toFixed(2)} pendente
            </span>
          )}
        </button>
      </div>

      {activeMainTab === 'equipe' ? (
        <>
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
      </>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* CARDS DE KPIS DE DIÁRIAS */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/40 via-red-950/20 to-surface-card border-2 border-rose-500/40 space-y-1 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                Total Devedor (Diárias Acumuladas)
              </span>
              <p className="text-2xl md:text-3xl font-mono font-black text-white">
                R$ {totalDueAllDiaristas.toFixed(2)}
              </p>
              <span className="text-[11px] text-rose-300/80 font-semibold block">
                {Object.values(balancesMap).filter(b => b.totalDue > 0).length} diarista(s) com saldo a receber
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
              <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                Diaristas Cadastrados
              </span>
              <p className="text-2xl md:text-3xl font-mono font-bold text-amber-400">
                {diaristasList.length}
              </p>
              <span className="text-[11px] text-slate-500">
                Colaboradores remunerados por diária
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
              <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                Diárias no Mês
              </span>
              <p className="text-2xl md:text-3xl font-mono font-bold text-emerald-400">
                {totalWorkedShiftsMonth} turnos
              </p>
              <span className="text-[11px] text-slate-500">
                Trabalhadas neste mês corrente
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
              <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                Total Pago em Acertos (Mês)
              </span>
              <p className="text-2xl md:text-3xl font-mono font-bold text-purple-400">
                R$ {totalPaidMonth.toFixed(2)}
              </p>
              <span className="text-[11px] text-slate-500">
                Valores já quitados via PIX/Dinheiro
              </span>
            </div>
          </div>

          {/* PAINEL DE ACERTO DE DIÁRIAS (CARDS INDIVIDUAIS DE QUITAÇÃO) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-border">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wallet className="text-amber-400" size={20} />
                  Painel de Acerto de Diárias & Agrados
                </h2>
                <p className="text-xs text-slate-400">
                  Acompanhe em tempo real quem está juntando diárias, adicione bônus/agrados e realize acertos parciais ou totais.
                </p>
              </div>
            </div>

            {diaristasList.length === 0 ? (
              <div className="glass-card rounded-2xl p-10 text-center border border-slate-800 space-y-3">
                <Users className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">Nenhum Diarista Cadastrado</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Para utilizar o controle de diárias e acertos, edite um colaborador existente ou cadastre um novo selecionando o regime <strong>Diarista (Recebe por Diária)</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewSheet}
                  className="py-2 px-4 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> Cadastrar Diarista
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {diaristasList.map(collab => {
                  const balance = balancesMap[collab.id] || {
                    totalEarned: 0,
                    totalPaid: 0,
                    totalDue: 0,
                    daysWorkedCount: 0,
                    bonusCount: 0,
                    entries: []
                  };
                  const dailyRate = Number(collab.dailyRate) || 100;
                  const hasDebt = balance.totalDue > 0;

                  return (
                    <div
                      key={collab.id}
                      className={`rounded-2xl p-5 border-2 flex flex-col justify-between gap-4 transition-all shadow-xl ${
                        hasDebt
                          ? 'bg-surface-card border-amber-500/50 hover:border-amber-400'
                          : 'bg-surface-card border-surface-border'
                      }`}
                    >
                      <div>
                        {/* Topo do Card */}
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-surface-border">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-white">{collab.name}</h3>
                              {getRoleBadge(collab.role)}
                            </div>
                            <span className="text-xs text-slate-400 font-medium mt-0.5 block">
                              Diária Base: <strong className="text-slate-200">R$ {dailyRate.toFixed(2)}</strong>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setHistoryModalCollab(collab)}
                            className="p-2 bg-surface-ground hover:bg-surface-elevated text-slate-400 hover:text-white rounded-lg border border-surface-border text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="Ver histórico completo de lançamentos e acertos"
                          >
                            <History size={14} />
                            <span className="text-[11px] font-semibold">Extrato</span>
                          </button>
                        </div>

                        {/* Bloco de Saldo Devedor em Destaque */}
                        <div className={`mt-3.5 p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          hasDebt
                            ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                            : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        }`}>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider block opacity-80">
                              {hasDebt ? 'Saldo Devedor a Pagar' : 'Status Financeiro'}
                            </span>
                            <span className="text-xl md:text-2xl font-mono font-black">
                              {hasDebt ? `R$ ${balance.totalDue.toFixed(2)}` : 'R$ 0,00 (Em dia)'}
                            </span>
                          </div>

                          {hasDebt ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAcertoModalCollab(collab);
                                setAcertoAmount(String(balance.totalDue));
                                setAcertoNotes(`Quitação de diárias acumuladas (${collab.name})`);
                              }}
                              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                            >
                              <DollarSign size={15} /> Pagar / Acerto
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 size={14} /> Quitado
                            </span>
                          )}
                        </div>

                        {/* Detalhamento dos Registros Acumulados */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3 pt-2 border-t border-surface-border/60">
                          <div className="bg-surface-ground p-2 rounded-xl">
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Diárias</span>
                            <span className="font-mono font-bold text-slate-200">{balance.daysWorkedCount}x</span>
                          </div>
                          <div className="bg-surface-ground p-2 rounded-xl">
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Agrados</span>
                            <span className="font-mono font-bold text-amber-400">{balance.bonusCount}x</span>
                          </div>
                          <div className="bg-surface-ground p-2 rounded-xl">
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Pago</span>
                            <span className="font-mono font-bold text-purple-300">R$ {balance.totalPaid.toFixed(0)}</span>
                          </div>
                        </div>

                        {/* Dias da Escala Semanal do Diarista */}
                        <div className="mt-3 flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-slate-500 uppercase font-bold mr-1">Escala:</span>
                          {DAYS_OF_WEEK.map(day => {
                            const isScheduled = (weeklySchedules[collab.id] || collab.weeklySchedule || []).includes(day.key);
                            return (
                              <span
                                key={day.key}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isScheduled
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-surface-ground text-slate-600'
                                }`}
                              >
                                {day.short}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Botões Rápidos de Ação Operacional */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-surface-border">
                        <button
                          type="button"
                          onClick={() => handleQuickLogShift(collab)}
                          className="py-2 px-2 bg-surface-ground hover:bg-surface-elevated text-slate-300 hover:text-white border border-surface-border rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Registra 1 diária de trabalho na data de hoje"
                        >
                          <CheckSquare size={14} className="text-emerald-400" />
                          <span className="text-[10px]">+ Diária Hoje</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setBonusModalCollab(collab);
                            setBonusAmount('30');
                            setBonusNotes('Agrado pelo dia movimentado');
                          }}
                          className="py-2 px-2 bg-surface-ground hover:bg-surface-elevated text-amber-300 hover:text-amber-200 border border-surface-border rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Lançar valor extra de agrado ou bônus"
                        >
                          <Gift size={14} className="text-amber-400" />
                          <span className="text-[10px]">+ Agrado</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setExtraShiftModalCollab(collab);
                            setExtraShiftAmount(String(dailyRate));
                            setExtraShiftDate(new Date().toISOString().slice(0, 10));
                            setExtraShiftNotes('Diária extra / Cobertura');
                          }}
                          className="py-2 px-2 bg-surface-ground hover:bg-surface-elevated text-blue-300 hover:text-blue-200 border border-surface-border rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Lançar turno extra com data e valor ajustável"
                        >
                          <Calendar size={14} className="text-blue-400" />
                          <span className="text-[10px]">+ Extra</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* MATRIZ VISUAL DA ESCALA SEMANAL (SEGUNDA A DOMINGO) */}
          <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden shadow-xl space-y-3 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-border">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="text-brand-primary" size={18} />
                  Matriz de Escala Semanal de Trabalho
                </h3>
                <p className="text-xs text-slate-400">
                  Clique nos dias para definir quem está escalado ou de folga. Os diaristas escalados podem ter sua diária confirmada com 1 clique.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400 uppercase text-[10px] font-semibold bg-surface-ground/60">
                    <th className="py-3 px-3">Colaborador</th>
                    <th className="py-3 px-2 text-center">Regime</th>
                    {DAYS_OF_WEEK.map(d => (
                      <th key={d.key} className="py-3 px-2 text-center">{d.label}</th>
                    ))}
                    <th className="py-3 px-3 text-right">Ação Rápida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {collaborators.filter(c => c.isActive).map(collab => {
                    const assignedDays = weeklySchedules[collab.id] || collab.weeklySchedule || [];
                    const isDiarista = collab.payType === 'diarista';

                    return (
                      <tr key={collab.id} className="hover:bg-surface-ground/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{collab.name}</span>
                            <span className="text-[10px] text-slate-500">({collab.shift})</span>
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center">
                          {isDiarista ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                              Diarista (R$ {Number(collab.dailyRate || 100).toFixed(0)})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[10px] border border-blue-500/30">
                              Mensalista
                            </span>
                          )}
                        </td>

                        {DAYS_OF_WEEK.map(d => {
                          const isScheduled = assignedDays.includes(d.key);
                          return (
                            <td key={d.key} className="py-3 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleScheduleDay(collab.id, d.key)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                  isScheduled
                                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                                    : 'bg-surface-ground text-slate-600 hover:text-slate-400 border border-transparent'
                                }`}
                                title={isScheduled ? 'Escalado para trabalhar (clique para marcar folga)' : 'Folga (clique para escalar)'}
                              >
                                {isScheduled ? 'Trabalha' : 'Folga'}
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-3 px-3 text-right">
                          {isDiarista ? (
                            <button
                              type="button"
                              onClick={() => handleQuickLogShift(collab)}
                              className="py-1.5 px-3 bg-brand-primary/15 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <CheckSquare size={12} /> Confirmar Hoje
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Mensalista</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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

          {/* Regime de Remuneração: Mensalista vs Diarista */}
          <div className="p-3.5 rounded-xl bg-surface-ground border border-surface-border space-y-3">
            <label className="block text-slate-300 font-semibold">
              Regime de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayTypeInput('mensalista')}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                  payTypeInput === 'mensalista'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                    : 'bg-surface-card border-surface-border text-slate-400 hover:text-slate-200'
                }`}
              >
                👔 Salário Mensal (Mensalista)
              </button>
              <button
                type="button"
                onClick={() => setPayTypeInput('diarista')}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                  payTypeInput === 'diarista'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-surface-card border-surface-border text-slate-400 hover:text-slate-200'
                }`}
              >
                📅 Diarista (Recebe por Diária)
              </button>
            </div>

            {payTypeInput === 'diarista' && (
              <div className="space-y-3 pt-2 border-t border-surface-border animate-in fade-in duration-200">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Valor Padrão da Diária (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">R$</span>
                    <input
                      type="number"
                      step="0.50"
                      required
                      placeholder="100.00"
                      value={dailyRateInput}
                      onChange={e => setDailyRateInput(e.target.value)}
                      className="w-full input-util pl-9 text-xs font-mono font-bold text-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Valor base pago por turno trabalhado. Pode receber diárias extras ou agrados avulsos.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Dias da Escala Semanal de Trabalho
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DAYS_OF_WEEK.map(day => {
                      const isSelected = weeklyScheduleInput.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => {
                            setWeeklyScheduleInput(prev => 
                              isSelected ? prev.filter(k => k !== day.key) : [...prev, day.key]
                            );
                          }}
                          className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-surface-card text-slate-400 border-surface-border hover:border-slate-600'
                          }`}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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

      {/* MODAL DE ATIVAÇÃO NA NUVEM (SUPABASE SQL) */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 p-6 text-slate-200">
            
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="text-amber-400" size={20} />
                  Ativar Sincronização na Nuvem (Supabase)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Suas senhas e colaboradores já estão seguros e salvos no servidor local. Para sincronizar em tempo real com celulares, tablets da cozinha e múltiplos computadores, crie a tabela no Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            {/* Passo a Passo Rápido */}
            <div className="bg-surface-ground p-3.5 rounded-xl border border-surface-border text-xs space-y-2 text-slate-300">
              <p className="font-semibold text-white">Como ativar em 3 passos simples:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Abra o painel do seu projeto no <strong className="text-slate-200">Supabase</strong>.</li>
                <li>Clique no menu <strong className="text-slate-200">SQL Editor</strong> no menu lateral esquerdo.</li>
                <li>Cole o código SQL abaixo e clique em <strong className="text-emerald-400">Run</strong>.</li>
              </ol>
            </div>

            {/* Bloco de Código SQL com Botão Copiar */}
            <div className="relative">
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 max-h-48 overflow-y-auto leading-relaxed select-all">
{`-- HUM VÍCIO ERP: TABELA DE COLABORADORES & DIÁRIAS
CREATE TABLE IF NOT EXISTS collaborators (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'gerente', 'caixa', 'cozinha')),
    pin VARCHAR(50) NOT NULL,
    phone VARCHAR(30),
    shift VARCHAR(30) DEFAULT 'integral' CHECK (shift IN ('manha', 'tarde', 'noite', 'integral')),
    pay_type VARCHAR(30) DEFAULT 'mensalista',
    daily_rate NUMERIC(10, 2) DEFAULT 0,
    weekly_schedule TEXT DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS pay_type VARCHAR(30) DEFAULT 'mensalista';
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS weekly_schedule TEXT DEFAULT '[]';

CREATE TABLE IF NOT EXISTS collaborator_diarias (
    id VARCHAR(100) PRIMARY KEY,
    collaborator_id VARCHAR(100) NOT NULL,
    collaborator_name VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('diaria', 'diaria_extra', 'agrado', 'pagamento_acerto')),
    amount NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    payment_method VARCHAR(50),
    registered_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collaborators_pin ON collaborators(pin);
CREATE INDEX IF NOT EXISTS idx_collaborators_role ON collaborators(role);
CREATE INDEX IF NOT EXISTS idx_diarias_collab ON collaborator_diarias(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_diarias_date ON collaborator_diarias(date);

ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collaborators_all" ON collaborators;
CREATE POLICY "collaborators_all" ON collaborators FOR ALL USING (true);

ALTER TABLE collaborator_diarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "diarias_all" ON collaborator_diarias;
CREATE POLICY "diarias_all" ON collaborator_diarias FOR ALL USING (true);`}
              </pre>

              <button
                type="button"
                onClick={handleCopySql}
                className="absolute top-3 right-3 py-1.5 px-3 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                {copiedSql ? <Check size={14} /> : <Sparkles size={14} />}
                {copiedSql ? 'Copiado!' : 'Copiar Código SQL'}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="py-2 px-4 bg-surface-elevated hover:bg-surface-border text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Entendido / Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: LANÇAR AGRADO / BÔNUS */}
      {bonusModalCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-surface-card border border-amber-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Gift className="text-amber-400" size={18} />
                  Lançar Agrado / Bônus
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Colaborador: <strong className="text-amber-300">{bonusModalCollab.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBonusModalCollab(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmBonus} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Valor do Agrado / Bônus (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">R$</span>
                  <input
                    type="number"
                    step="0.50"
                    required
                    min="1"
                    placeholder="30.00"
                    value={bonusAmount}
                    onChange={e => setBonusAmount(e.target.value)}
                    className="w-full input-util pl-9 text-sm font-mono font-bold text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Motivo / Observação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Noite puxada, muito capricho no fechamento"
                  value={bonusNotes}
                  onChange={e => setBonusNotes(e.target.value)}
                  className="w-full input-util text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setBonusModalCollab(null)}
                  className="py-2 px-3 bg-surface-ground hover:bg-surface-elevated text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Gift size={14} /> Confirmar Agrado (+R$)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LANÇAR DIÁRIA EXTRA */}
      {extraShiftModalCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-surface-card border border-blue-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="text-blue-400" size={18} />
                  Lançar Diária Extra / Cobertura
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Colaborador: <strong className="text-blue-300">{extraShiftModalCollab.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExtraShiftModalCollab(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmExtraShift} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Data do Turno Trabalhado *
                </label>
                <input
                  type="date"
                  required
                  value={extraShiftDate}
                  onChange={e => setExtraShiftDate(e.target.value)}
                  className="w-full input-util text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Valor da Diária (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">R$</span>
                  <input
                    type="number"
                    step="0.50"
                    required
                    min="1"
                    value={extraShiftAmount}
                    onChange={e => setExtraShiftAmount(e.target.value)}
                    className="w-full input-util pl-9 text-sm font-mono font-bold text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Observação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cobriu folga de colega na chapa"
                  value={extraShiftNotes}
                  onChange={e => setExtraShiftNotes(e.target.value)}
                  className="w-full input-util text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setExtraShiftModalCollab(null)}
                  className="py-2 px-3 bg-surface-ground hover:bg-surface-elevated text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check size={14} /> Registrar Diária Extra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REALIZAR ACERTO DE DIÁRIAS (PAGAR) */}
      {acertoModalCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-surface-card border border-emerald-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="text-emerald-400" size={20} />
                  Realizar Acerto de Diárias
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Colaborador: <strong className="text-emerald-300">{acertoModalCollab.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAcertoModalCollab(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Saldo Devedor Atual */}
            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 uppercase">Saldo Devedor Atual:</span>
              <span className="text-lg font-mono font-black text-white">
                R$ {(balancesMap[acertoModalCollab.id]?.totalDue || 0).toFixed(2)}
              </span>
            </div>

            <form onSubmit={handleConfirmAcerto} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Valor a Pagar / Quitar (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">R$</span>
                  <input
                    type="number"
                    step="0.50"
                    required
                    min="1"
                    value={acertoAmount}
                    onChange={e => setAcertoAmount(e.target.value)}
                    className="w-full input-util pl-9 text-sm font-mono font-bold text-emerald-400"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Você pode pagar o valor total acumulado ou fazer um pagamento parcial.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Forma de Pagamento *
                </label>
                <select
                  value={acertoMethod}
                  onChange={e => setAcertoMethod(e.target.value as any)}
                  className="w-full input-util text-xs cursor-pointer font-semibold"
                >
                  <option value="pix">PIX (Chave Celular / CPF / Banco)</option>
                  <option value="dinheiro">Dinheiro Físico (Espécie)</option>
                  <option value="transferencia">Transferência Bancária / TED</option>
                  <option value="outro">Outro Meio de Pagamento</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Observação / Comprovante
                </label>
                <input
                  type="text"
                  placeholder="Ex: PIX enviado às 23:45, comprovante arquivado"
                  value={acertoNotes}
                  onChange={e => setAcertoNotes(e.target.value)}
                  className="w-full input-util text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setAcertoModalCollab(null)}
                  className="py-2 px-3 bg-surface-ground hover:bg-surface-elevated text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check size={14} /> Confirmar Pagamento do Acerto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EXTRATO COMPLETO DE DIÁRIAS & ACERTOS */}
      {historyModalCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-slate-200">
            <div className="p-5 border-b border-surface-border flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="text-amber-400" size={18} />
                  Extrato Completo: {historyModalCollab.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Histórico detalhado de diárias trabalhadas, bônus, agrados e pagamentos realizados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalCollab(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumo do Saldo no Topo do Extrato */}
            <div className="p-4 bg-surface-ground border-b border-surface-border grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Ganho</span>
                <p className="font-mono font-bold text-white text-sm">
                  R$ {(balancesMap[historyModalCollab.id]?.totalEarned || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Já Pago</span>
                <p className="font-mono font-bold text-purple-300 text-sm">
                  R$ {(balancesMap[historyModalCollab.id]?.totalPaid || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-rose-300">Saldo Devedor</span>
                <p className="font-mono font-black text-rose-300 text-sm">
                  R$ {(balancesMap[historyModalCollab.id]?.totalDue || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Lista com Rolagem dos Lançamentos */}
            <div className="p-5 overflow-y-auto flex-1 space-y-2.5 text-xs">
              {(!balancesMap[historyModalCollab.id]?.entries || balancesMap[historyModalCollab.id]?.entries.length === 0) ? (
                <div className="p-8 text-center text-slate-500 italic">
                  Nenhum lançamento registrado para este colaborador até o momento.
                </div>
              ) : (
                balancesMap[historyModalCollab.id]?.entries.map(entry => {
                  const isPayment = entry.type === 'pagamento_acerto';
                  const isBonus = entry.type === 'agrado';
                  const isExtra = entry.type === 'diaria_extra';

                  return (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isPayment
                          ? 'bg-blue-950/20 border-blue-500/30'
                          : isBonus
                            ? 'bg-amber-950/20 border-amber-500/30'
                            : isExtra
                              ? 'bg-purple-950/20 border-purple-500/30'
                              : 'bg-surface-ground border-surface-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          isPayment 
                            ? 'bg-blue-600/20 text-blue-400' 
                            : isBonus 
                              ? 'bg-amber-500/20 text-amber-400' 
                              : 'bg-emerald-600/20 text-emerald-400'
                        }`}>
                          {isPayment ? <ArrowDownCircle size={16} /> : isBonus ? <Gift size={16} /> : <ArrowUpCircle size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {isPayment ? 'Acerto / Pagamento Realizado' : isBonus ? 'Agrado / Bônus' : isExtra ? 'Diária Extra' : 'Diária de Trabalho'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {entry.notes || 'Sem observações'}
                            {entry.paymentMethod && ` • Via ${entry.paymentMethod.toUpperCase()}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`font-mono font-extrabold text-sm ${
                          isPayment ? 'text-blue-300' : isBonus ? 'text-amber-300' : 'text-emerald-400'
                        }`}>
                          {isPayment ? '-' : '+'} R$ {Number(entry.amount).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg cursor-pointer transition-colors"
                          title="Excluir este lançamento"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-surface-border flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalCollab(null)}
                className="py-2 px-4 bg-surface-elevated hover:bg-surface-border text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Fechar Extrato
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
