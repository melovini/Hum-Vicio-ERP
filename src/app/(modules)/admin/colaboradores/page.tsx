'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Users, Plus, Shield, KeyRound, 
  Edit2, Trash2, Eye, EyeOff, 
  Phone, Clock, Check, Sparkles, UserCheck, UserX,
  Calendar, DollarSign, Wallet, History, Gift, CheckSquare, 
  ArrowDownCircle, ArrowUpCircle, Briefcase, Coins,
  ChevronLeft, ChevronRight, BarChart3, Cloud, CloudOff, Info
} from 'lucide-react';
import { 
  PageHeader, FilterBar, Dialog, ConfirmDialog, 
  SlidingSheet, Button, Badge, EmptyState, Skeleton, useToast 
} from '@/components/ui';
import { 
  Collaborator, CollaboratorRole, PayType,
  getStoredCollaborators, setLocalCollaboratorsCache
} from '@/lib/collaborators';
import { 
  filterCollaborators, computeCollaboratorKpis, 
  getRoleLabel, getRoleBadgeVariant 
} from '@/lib/collaborator-filters';
import { 
  WageEntry, CalendarDay, QuinzenaInfo,
  getStoredWageEntries, saveStoredWageEntry, deleteStoredWageEntry, 
  computeCollaboratorBalance, getStoredWeeklySchedules, saveStoredWeeklySchedule,
  getQuinzenaInfo, getCurrentQuinzena
} from '@/lib/diarias';
import {
  getCollaboratorsAction,
  saveCollaboratorAction,
  toggleActiveCollaboratorAction,
  deleteCollaboratorAction
} from './actions';

export default function ColaboradoresPage() {
  const { notify } = useToast();
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

  // Confirmações de Exclusão (Substitutos de confirm nativo)
  const [collabToDelete, setCollabToDelete] = useState<Collaborator | null>(null);
  const [isDeletingCollab, setIsDeletingCollab] = useState(false);
  const [entryToDeleteId, setEntryToDeleteId] = useState<string | null>(null);

  // Formulário - Campos Padrão e de Remuneração / Diária
  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState<CollaboratorRole>('caixa');
  const [pinInput, setPinInput] = useState('');
  const [showModalPin, setShowModalPin] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [shiftInput, setShiftInput] = useState<'manha' | 'tarde' | 'noite' | 'integral'>('integral');
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [payTypeInput, setPayTypeInput] = useState<PayType>('mensalista');
  const [dailyRateInput, setDailyRateInput] = useState<string>('100');
  const [weeklyScheduleInput, setWeeklyScheduleInput] = useState<string[]>(['qui', 'sex', 'sab', 'dom']);

  // Estado das Diárias, Agrados e Acertos
  const [wageEntries, setWageEntries] = useState<WageEntry[]>([]);
  const [weeklySchedules, setWeeklySchedules] = useState<Record<string, string[]>>({});

  // Controle de Navegação da Escala Quinzenal (15 em 15 Dias)
  const [selectedYear, setSelectedYear] = useState<number>(() => getCurrentQuinzena().year);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getCurrentQuinzena().month);
  const [selectedQuinzena, setSelectedQuinzena] = useState<1 | 2>(() => getCurrentQuinzena().quinzena);

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
    notify({
      title: 'Diária lançada com sucesso',
      description: `+1 Diária de R$ ${amount.toFixed(2)} para ${collab.name}.`,
      tone: 'success'
    });
  };

  const handleConfirmBonus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusModalCollab) return;
    const val = parseFloat(bonusAmount) || 0;
    if (val <= 0) {
      notify({ title: 'Valor inválido', description: 'Digite um valor de agrado positivo.', tone: 'warning' });
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
    const collabName = bonusModalCollab.name;
    setBonusModalCollab(null);
    setBonusNotes('');
    notify({
      title: 'Agrado registrado',
      description: `R$ ${val.toFixed(2)} lançado para ${collabName}.`,
      tone: 'success'
    });
  };

  const handleConfirmExtraShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraShiftModalCollab) return;
    const val = parseFloat(extraShiftAmount) || 0;
    if (val <= 0) {
      notify({ title: 'Valor inválido', description: 'Digite um valor válido de diária extra.', tone: 'warning' });
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
    const collabName = extraShiftModalCollab.name;
    setExtraShiftModalCollab(null);
    notify({
      title: 'Diária extra registrada',
      description: `R$ ${val.toFixed(2)} lançado para ${collabName}.`,
      tone: 'success'
    });
  };

  const handleConfirmAcerto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acertoModalCollab) return;
    const val = parseFloat(acertoAmount) || 0;
    if (val <= 0) {
      notify({ title: 'Valor inválido', description: 'Digite um valor válido para o acerto.', tone: 'warning' });
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
    const collabName = acertoModalCollab.name;
    setAcertoModalCollab(null);
    setAcertoNotes('');
    notify({
      title: 'Acerto registrado',
      description: `R$ ${val.toFixed(2)} pago e abatido do saldo de ${collabName}.`,
      tone: 'success'
    });
  };

  // Exclusão de Lançamento no Extrato (Substituto de confirm)
  const handleConfirmDeleteEntry = () => {
    if (!entryToDeleteId) return;
    const updated = deleteStoredWageEntry(entryToDeleteId);
    setWageEntries(updated);
    setEntryToDeleteId(null);
    notify({
      title: 'Lançamento removido',
      description: 'O saldo do colaborador foi recalculado.',
      tone: 'info'
    });
  };

  // Dados computados da Quinzena Selecionada
  const currentQuinzenaInfo = useMemo(() => {
    return getQuinzenaInfo(selectedYear, selectedMonth, selectedQuinzena);
  }, [selectedYear, selectedMonth, selectedQuinzena]);

  const handlePrevQuinzena = () => {
    if (selectedQuinzena === 2) {
      setSelectedQuinzena(1);
    } else {
      if (selectedMonth === 0) {
        setSelectedYear(prev => prev - 1);
        setSelectedMonth(11);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
      setSelectedQuinzena(2);
    }
  };

  const handleNextQuinzena = () => {
    if (selectedQuinzena === 1) {
      setSelectedQuinzena(2);
    } else {
      if (selectedMonth === 11) {
        setSelectedYear(prev => prev + 1);
        setSelectedMonth(0);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
      setSelectedQuinzena(1);
    }
  };

  const handleGoToCurrentQuinzena = () => {
    const cur = getCurrentQuinzena();
    setSelectedYear(cur.year);
    setSelectedMonth(cur.month);
    setSelectedQuinzena(cur.quinzena);
  };

  // Alternar dia de plantão/folga na data do calendário real
  const handleToggleScheduleDate = async (collab: Collaborator, dateStr: string) => {
    const currentDates: string[] = Array.isArray(collab.weeklySchedule) ? collab.weeklySchedule : [];
    const exists = currentDates.includes(dateStr);
    const updatedDates = exists
      ? currentDates.filter(d => d !== dateStr)
      : [...currentDates, dateStr];

    const updatedCollab: Collaborator = {
      ...collab,
      weeklySchedule: updatedDates,
      updatedAt: new Date().toISOString()
    };

    // Atualização otimista na tela
    const updatedList = collaborators.map(c => c.id === collab.id ? updatedCollab : c);
    setCollaborators(updatedList);
    setLocalCollaboratorsCache(updatedList);

    const newSchedules = { ...weeklySchedules, [collab.id]: updatedDates };
    setWeeklySchedules(newSchedules);
    saveStoredWeeklySchedule(newSchedules);

    // Salva silenciosamente no servidor
    try {
      await saveCollaboratorAction(updatedCollab);
    } catch (err) {
      console.error('Erro ao sincronizar escala quinzenal:', err);
    }
  };

  // Abrir Sheet para Novo Colaborador
  const handleOpenNewSheet = () => {
    setEditingCollab(null);
    setNameInput('');
    setRoleInput('caixa');
    setPinInput('');
    setShowModalPin(false);
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
    setPinInput('');
    setShowModalPin(false);
    setPhoneInput(collab.phone || '');
    setShiftInput(collab.shift || 'integral');
    setIsActiveInput(collab.isActive);
    setPayTypeInput(collab.payType || 'mensalista');
    setDailyRateInput(collab.dailyRate ? String(collab.dailyRate) : '100');
    setWeeklyScheduleInput(Array.isArray(collab.weeklySchedule) ? collab.weeklySchedule : ['qui', 'sex', 'sab', 'dom']);
    setIsSheetOpen(true);
  };

  // Salvar Colaborador via Server Action
  const handleSaveCollaborator = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameInput.trim()) {
      notify({ title: 'Campo obrigatório', description: 'O nome do colaborador é obrigatório.', tone: 'warning' });
      return;
    }
    if (!editingCollab && !pinInput.trim()) {
      notify({ title: 'Campo obrigatório', description: 'O PIN ou senha individual é obrigatório.', tone: 'warning' });
      return;
    }

    const pinClean = pinInput.trim();
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

        notify({
          title: editingCollab ? 'Colaborador atualizado' : 'Colaborador cadastrado',
          description: `"${itemToSave.name}" foi salvo ${res.isCloudSynced ? 'e sincronizado na nuvem' : 'no servidor local'}.`,
          tone: 'success'
        });
      } else {
        notify({ title: 'Erro ao salvar', description: res.error || 'Não foi possível salvar.', tone: 'danger' });
      }
    } catch (err: any) {
      notify({ title: 'Falha de conexão', description: err.message || 'Erro ao conectar ao servidor.', tone: 'danger' });
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
        notify({
          title: currentlyActive ? 'Colaborador desativado' : 'Colaborador reativado',
          description: `${name} está agora ${currentlyActive ? 'inativo' : 'ativo'}.`,
          tone: currentlyActive ? 'warning' : 'success'
        });
      } else {
        notify({ title: 'Erro ao alterar', description: res.error || 'Ação rejeitada pelo servidor.', tone: 'danger' });
      }
    } catch {
      notify({ title: 'Erro ao alterar status', description: `Falha ao alterar status de ${name}.`, tone: 'danger' });
    }
  };

  // Excluir Colaborador via ConfirmDialog
  const handleConfirmDeleteCollab = async () => {
    if (!collabToDelete) return;
    setIsDeletingCollab(true);
    try {
      const res = await deleteCollaboratorAction(collabToDelete.id);
      if (res.success) {
        setCollaborators(res.updatedList);
        setLocalCollaboratorsCache(res.updatedList);
        setIsCloudSynced(res.isCloudSynced);
        const name = collabToDelete.name;
        setCollabToDelete(null);
        notify({
          title: 'Colaborador excluído',
          description: `O cadastro de ${name} foi removido com sucesso.`,
          tone: 'success'
        });
      } else {
        notify({ title: 'Não foi possível excluir', description: res.error || 'Ação negada pelo servidor.', tone: 'danger' });
      }
    } catch {
      notify({ title: 'Erro ao excluir', description: `Falha na exclusão de ${collabToDelete.name}.`, tone: 'danger' });
    } finally {
      setIsDeletingCollab(false);
    }
  };

  const handleCopySql = () => {
    const sql = 'Configuração de segurança: consulte SECURITY-SETUP.md no projeto. A migração deve ser aplicada pelo responsável técnico em uma janela de manutenção.';
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
    notify({ title: 'Orientação copiada!', tone: 'info' });
  };

  // Filtragem e Busca usando o helper desacoplado
  const filteredCollaborators = useMemo(() => {
    return filterCollaborators(collaborators, {
      role: filterRole,
      searchQuery: searchQuery,
    });
  }, [collaborators, filterRole, searchQuery]);

  // KPIs usando o helper desacoplado
  const kpis = useMemo(() => {
    return computeCollaboratorKpis(collaborators);
  }, [collaborators]);

  if (isLoadingServer && collaborators.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" data-testid="colaboradores-skeleton">
        <Skeleton className="h-14 w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Skeleton className="h-20 rounded-dialog" />
          <Skeleton className="h-20 rounded-dialog" />
          <Skeleton className="h-20 rounded-dialog" />
          <Skeleton className="h-20 rounded-dialog" />
          <Skeleton className="h-20 rounded-dialog" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-dialog" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        {/* Cabeçalho da Página */}
        <PageHeader
          title="Equipe & Colaboradores"
          eyebrow="Gestão de Pessoas & Acessos"
          description="Cadastre operadores de Caixa, Chapeiros de Cozinha e Gerentes com credenciais e PINs individuais."
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Badge de Sincronização */}
              {isCloudSynced ? (
                <Badge variant="success" dot className="font-semibold text-xs py-1.5 px-3">
                  Nuvem Ativa
                </Badge>
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

              <Link href="/admin/dashboard">
                <Button variant="secondary" leadingIcon={<BarChart3 size={15} aria-hidden="true" />}>
                  DRE & Dashboard
                </Button>
              </Link>

              <Button
                onClick={handleOpenNewSheet}
                leadingIcon={<Plus size={16} aria-hidden="true" />}
              >
                Novo Colaborador
              </Button>
            </div>
          }
        />

        {/* Sub-Abas de Navegação Principal */}
        <div className="flex items-center gap-2 border-b border-border-default pb-3">
          <Button
            variant={activeMainTab === 'equipe' ? 'primary' : 'secondary'}
            onClick={() => setActiveMainTab('equipe')}
            leadingIcon={<Users size={16} aria-hidden="true" />}
          >
            Equipe & Senhas ({collaborators.length})
          </Button>

          <Button
            variant={activeMainTab === 'escala_diarias' ? 'primary' : 'secondary'}
            onClick={() => setActiveMainTab('escala_diarias')}
            leadingIcon={<Calendar size={16} aria-hidden="true" />}
          >
            Escala Quinzenal & Acerto de Diárias
            {totalDueAllDiaristas > 0 && (
              <span className="ml-1.5 px-2 py-0.5 bg-rose-600 text-white rounded-full font-mono text-[10px] font-black animate-pulse tabular-nums">
                R$ {totalDueAllDiaristas.toFixed(2)}
              </span>
            )}
          </Button>
        </div>

        {activeMainTab === 'equipe' ? (
          <>
            {/* Cards de KPIs da Equipe */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-surface-card p-3.5 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">Total Cadastrado</span>
                <p className="text-xl font-mono tabular-nums font-bold text-text-primary">{kpis.total}</p>
                <span className="text-[10px] text-text-muted font-medium">{kpis.ativos} ativos no sistema</span>
              </div>

              <div className="bg-surface-card p-3.5 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">Frente de Caixa</span>
                <p className="text-xl font-mono tabular-nums font-bold text-sky-400">{kpis.caixas}</p>
                <span className="text-[10px] text-sky-400/80 font-medium">PDV & Mesas</span>
              </div>

              <div className="bg-surface-card p-3.5 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">Cozinha & KDS</span>
                <p className="text-xl font-mono tabular-nums font-bold text-emerald-400">{kpis.cozinha}</p>
                <span className="text-[10px] text-emerald-400/80 font-medium">Chapa & Perdas</span>
              </div>

              <div className="bg-surface-card p-3.5 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">Gerentes & Admins</span>
                <p className="text-xl font-mono tabular-nums font-bold text-amber-400">{kpis.gerentes}</p>
                <span className="text-[10px] text-amber-400/80 font-medium">Acesso Executivo</span>
              </div>

              <div className="bg-surface-card p-3.5 rounded-dialog border border-border-default space-y-1 shadow-card">
                <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">Segurança de PIN</span>
                <p className="text-xl font-mono tabular-nums font-bold text-brand-primary">Individual</p>
                <span className="text-[10px] text-text-muted font-medium">Rastreável por turno</span>
              </div>
            </div>

            {/* FilterBar Padronizada */}
            <FilterBar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              searchLabel="Buscar colaboradores"
              placeholder="Buscar por nome ou telefone..."
              resultCount={filteredCollaborators.length}
              totalCount={collaborators.length}
              active={Boolean(searchQuery || filterRole !== 'todos')}
              onClear={() => {
                setSearchQuery('');
                setFilterRole('todos');
              }}
            >
              <div className="space-y-1.5 sm:w-48">
                <label htmlFor="filter-role-select" className="block text-sm font-medium text-text-secondary">
                  Filtrar por Cargo
                </label>
                <select
                  id="filter-role-select"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary text-sm font-medium focus:outline-none focus:border-brand-primary cursor-pointer"
                >
                  <option value="todos">Todos os cargos</option>
                  <option value="caixa">Operador de Caixa</option>
                  <option value="cozinha">Equipe Cozinha</option>
                  <option value="gerente">Gerente Operacional</option>
                  <option value="admin">Administrador Master</option>
                </select>
              </div>
            </FilterBar>

            {/* Data Grid de Colaboradores */}
            {filteredCollaborators.length === 0 ? (
              <EmptyState
                title={collaborators.length ? 'Nenhum colaborador encontrado' : 'Nenhum colaborador cadastrado'}
                description={collaborators.length ? 'Tente buscar com outro termo ou alterar o filtro de cargo.' : 'Cadastre os operadores para controle de acesso seguro.'}
                icon={<Users aria-hidden="true" />}
                action={
                  collaborators.length ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterRole('todos');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button onClick={handleOpenNewSheet} leadingIcon={<Plus size={16} aria-hidden="true" />}>
                      Cadastrar Colaborador
                    </Button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-dialog border border-border-default bg-surface-card shadow-elevated">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <th className="p-4">Colaborador</th>
                      <th className="p-4">Cargo / Perfil</th>
                      <th className="p-4">Turno</th>
                      <th className="p-4">PIN de Acesso</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50 text-sm">
                    {filteredCollaborators.map(c => {
                      const isPinVisible = showPinId === c.id;

                      return (
                        <tr key={c.id} className="hover:bg-surface-elevated/40 transition-colors">
                          {/* Nome e Telefone */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-surface-elevated border border-border-default flex items-center justify-center font-bold text-brand-primary text-xs uppercase shrink-0">
                                {c.name.slice(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-text-primary block">{c.name}</span>
                                {c.phone ? (
                                  <span className="text-xs text-text-muted flex items-center gap-1 font-mono tabular-nums">
                                    <Phone size={11} aria-hidden="true" /> {c.phone}
                                  </span>
                                ) : (
                                  <span className="text-xs text-text-muted">Sem telefone</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Cargo */}
                          <td className="p-4">
                            <Badge variant={getRoleBadgeVariant(c.role)} className="text-xs">
                              {getRoleLabel(c.role)}
                            </Badge>
                          </td>

                          {/* Turno */}
                          <td className="p-4 capitalize text-text-secondary text-xs">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock size={13} className="text-text-muted" aria-hidden="true" />
                              {c.shift || 'Integral'}
                            </span>
                          </td>

                          {/* PIN de Acesso */}
                          <td className="p-4">
                            <div className="inline-flex items-center gap-2 bg-surface-input px-2.5 py-1 rounded-control border border-border-default font-mono tabular-nums">
                              <KeyRound size={13} className="text-brand-primary" aria-hidden="true" />
                              <span className="text-text-primary font-bold tracking-widest text-xs">
                                {isPinVisible ? (c.pin || '••••••') : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowPinId(isPinVisible ? null : c.id)}
                                className="text-text-muted hover:text-text-primary p-0.5 cursor-pointer transition-colors"
                                title={isPinVisible ? 'Ocultar PIN' : 'Ver PIN'}
                                aria-label={isPinVisible ? `Ocultar PIN de ${c.name}` : `Ver PIN de ${c.name}`}
                              >
                                {isPinVisible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                              </button>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <Badge variant={c.isActive ? 'success' : 'neutral'} dot className="text-xs">
                              {c.isActive ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>

                          {/* Ações */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Toggle Ativo */}
                              <button
                                type="button"
                                onClick={() => handleToggleActive(c.id, c.name, c.isActive)}
                                className={`p-1.5 rounded-control transition-colors cursor-pointer ${
                                  c.isActive 
                                    ? 'text-text-muted hover:text-status-warning hover:bg-amber-500/10' 
                                    : 'text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                                title={c.isActive ? 'Desativar colaborador' : 'Reativar colaborador'}
                                aria-label={c.isActive ? `Desativar ${c.name}` : `Reativar ${c.name}`}
                              >
                                {c.isActive ? <UserX size={15} aria-hidden="true" /> : <UserCheck size={15} aria-hidden="true" />}
                              </button>

                              {/* Editar */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditSheet(c)}
                                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded-control transition-colors cursor-pointer"
                                title="Editar colaborador"
                                aria-label={`Editar cadastro de ${c.name}`}
                              >
                                <Edit2 size={15} aria-hidden="true" />
                              </button>

                              {/* Excluir (Abre ConfirmDialog) */}
                              <button
                                type="button"
                                onClick={() => setCollabToDelete(c)}
                                className="p-1.5 text-text-muted hover:text-status-danger hover:bg-rose-500/10 rounded-control transition-colors cursor-pointer"
                                title="Excluir cadastro permanentemente"
                                aria-label={`Excluir cadastro de ${c.name}`}
                              >
                                <Trash2 size={15} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* ABA ESCALA QUINZENAL & DIÁRIAS */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Cards de KPIs de Diárias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-dialog bg-surface-card border-2 border-rose-500/30 space-y-1 shadow-card">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                  Total Devedor (Diárias Acumuladas)
                </span>
                <p className="text-2xl md:text-3xl font-mono font-black text-text-primary tabular-nums">
                  R$ {totalDueAllDiaristas.toFixed(2)}
                </p>
                <span className="text-xs text-rose-300/80 font-semibold block">
                  {Object.values(balancesMap).filter(b => b.totalDue > 0).length} diarista(s) com saldo a receber
                </span>
              </div>

              <div className="p-4 rounded-dialog bg-surface-card border border-border-default space-y-1 shadow-card">
                <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">
                  Diaristas Cadastrados
                </span>
                <p className="text-2xl md:text-3xl font-mono font-bold text-amber-400 tabular-nums">
                  {diaristasList.length}
                </p>
                <span className="text-xs text-text-muted">
                  Colaboradores remunerados por diária
                </span>
              </div>

              <div className="p-4 rounded-dialog bg-surface-card border border-border-default space-y-1 shadow-card">
                <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">
                  Diárias no Mês
                </span>
                <p className="text-2xl md:text-3xl font-mono font-bold text-emerald-400 tabular-nums">
                  {totalWorkedShiftsMonth} turnos
                </p>
                <span className="text-xs text-text-muted">
                  Trabalhadas no mês corrente
                </span>
              </div>

              <div className="p-4 rounded-dialog bg-surface-card border border-border-default space-y-1 shadow-card">
                <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">
                  Total Pago em Acertos (Mês)
                </span>
                <p className="text-2xl md:text-3xl font-mono font-bold text-sky-400 tabular-nums">
                  R$ {totalPaidMonth.toFixed(2)}
                </p>
                <span className="text-xs text-text-muted">
                  Valores já quitados via PIX/Dinheiro
                </span>
              </div>
            </div>

            {/* PAINEL DE ACERTO DE DIÁRIAS (CARDS INDIVIDUAIS DE QUITAÇÃO) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border-default">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Wallet className="text-amber-400" size={20} aria-hidden="true" />
                    Painel de Acerto de Diárias & Agrados
                  </h2>
                  <p className="text-xs text-text-muted">
                    Acompanhe em tempo real quem está acumulando diárias, lance agrados e realize acertos de quitação.
                  </p>
                </div>
              </div>

              {diaristasList.length === 0 ? (
                <EmptyState
                  title="Nenhum diarista cadastrado"
                  description="Para utilizar o controle de diárias e acertos, edite um colaborador existente ou cadastre um novo selecionando o regime Diarista."
                  icon={<Users aria-hidden="true" />}
                  action={
                    <Button onClick={handleOpenNewSheet} leadingIcon={<Plus size={16} aria-hidden="true" />}>
                      Cadastrar Diarista
                    </Button>
                  }
                />
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
                        className={`rounded-dialog p-5 border-2 flex flex-col justify-between gap-4 transition-all shadow-elevated ${
                          hasDebt
                            ? 'bg-surface-card border-amber-500/50 hover:border-amber-400'
                            : 'bg-surface-card border-border-default'
                        }`}
                      >
                        <div>
                          {/* Topo do Card */}
                          <div className="flex items-start justify-between gap-2 pb-3 border-b border-border-default">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-text-primary">{collab.name}</h3>
                                <Badge variant={getRoleBadgeVariant(collab.role)} className="text-[10px]">
                                  {getRoleLabel(collab.role)}
                                </Badge>
                              </div>
                              <span className="text-xs text-text-muted font-medium mt-0.5 block">
                                Diária Base: <strong className="text-text-primary font-mono tabular-nums">R$ {dailyRate.toFixed(2)}</strong>
                              </span>
                            </div>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setHistoryModalCollab(collab)}
                              leadingIcon={<History size={14} aria-hidden="true" />}
                            >
                              Extrato
                            </Button>
                          </div>

                          {/* Bloco de Saldo Devedor em Destaque */}
                          <div className={`mt-3.5 p-3.5 rounded-control border flex items-center justify-between gap-3 ${
                            hasDebt
                              ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                          }`}>
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider block opacity-80">
                                {hasDebt ? 'Saldo Devedor a Pagar' : 'Status Financeiro'}
                              </span>
                              <span className="text-xl md:text-2xl font-mono font-black tabular-nums">
                                {hasDebt ? `R$ ${balance.totalDue.toFixed(2)}` : 'R$ 0,00 (Em dia)'}
                              </span>
                            </div>

                            {hasDebt ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setAcertoModalCollab(collab);
                                  setAcertoAmount(String(balance.totalDue));
                                  setAcertoNotes(`Quitação de diárias acumuladas (${collab.name})`);
                                }}
                                leadingIcon={<DollarSign size={15} aria-hidden="true" />}
                              >
                                Pagar
                              </Button>
                            ) : (
                              <Badge variant="success" dot className="text-xs font-bold">
                                Quitado
                              </Badge>
                            )}
                          </div>

                          {/* Detalhamento dos Registros Acumulados */}
                          <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3 pt-2 border-t border-border-default">
                            <div className="bg-surface-elevated/40 p-2 rounded-control">
                              <span className="text-[10px] text-text-muted block uppercase font-semibold">Diárias</span>
                              <span className="font-mono font-bold text-text-primary tabular-nums">{balance.daysWorkedCount}x</span>
                            </div>
                            <div className="bg-surface-elevated/40 p-2 rounded-control">
                              <span className="text-[10px] text-text-muted block uppercase font-semibold">Agrados</span>
                              <span className="font-mono font-bold text-amber-400 tabular-nums">{balance.bonusCount}x</span>
                            </div>
                            <div className="bg-surface-elevated/40 p-2 rounded-control">
                              <span className="text-[10px] text-text-muted block uppercase font-semibold">Total Pago</span>
                              <span className="font-mono font-bold text-sky-300 tabular-nums">R$ {balance.totalPaid.toFixed(0)}</span>
                            </div>
                          </div>

                          {/* Status na Quinzena Atual */}
                          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-border-default">
                            <span className="text-text-muted font-medium">Plantões na quinzena:</span>
                            <span className="font-mono font-bold text-amber-300 tabular-nums">
                              {currentQuinzenaInfo.days.filter(d => (collab.weeklySchedule || []).includes(d.dateStr)).length} de {currentQuinzenaInfo.days.length} dias
                            </span>
                          </div>
                        </div>

                        {/* Botões Rápidos de Ação Operacional */}
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border-default">
                          <button
                            type="button"
                            onClick={() => handleQuickLogShift(collab)}
                            className="py-2 px-2 bg-surface-elevated/60 hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-default rounded-control text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                            title="Registra 1 diária de trabalho na data de hoje"
                          >
                            <CheckSquare size={14} className="text-emerald-400" aria-hidden="true" />
                            <span className="text-[10px]">+ Diária Hoje</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBonusModalCollab(collab);
                              setBonusAmount('30');
                              setBonusNotes('Agrado pelo dia movimentado');
                            }}
                            className="py-2 px-2 bg-surface-elevated/60 hover:bg-surface-elevated text-amber-300 hover:text-amber-200 border border-border-default rounded-control text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                            title="Lançar valor extra de agrado ou bônus"
                          >
                            <Gift size={14} className="text-amber-400" aria-hidden="true" />
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
                            className="py-2 px-2 bg-surface-elevated/60 hover:bg-surface-elevated text-sky-300 hover:text-sky-200 border border-border-default rounded-control text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                            title="Lançar turno extra com data e valor ajustável"
                          >
                            <Calendar size={14} className="text-sky-400" aria-hidden="true" />
                            <span className="text-[10px]">+ Extra</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MATRIZ VISUAL DA ESCALA QUINZENAL */}
            <div className="bg-surface-card rounded-dialog border border-border-default overflow-hidden shadow-elevated space-y-4 p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-default">
                <div>
                  <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Calendar className="text-amber-400" size={18} aria-hidden="true" />
                    Matriz de Escala Quinzenal (Revezamento 15 em 15 Dias)
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Finais de semana e feriados destacados para planejar folgas alternadas. Clique no dia para alternar entre Plantão (T) e Folga (F).
                  </p>
                </div>

                {/* Seletor e Navegador de Quinzena */}
                <div className="flex items-center gap-2 bg-surface-elevated/40 p-1.5 rounded-control border border-border-default self-start md:self-auto">
                  <button
                    type="button"
                    onClick={handlePrevQuinzena}
                    className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
                    title="Quinzena anterior"
                    aria-label="Quinzena anterior"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>

                  <div className="px-3 py-1 bg-surface-card rounded-control border border-border-default text-center min-w-[210px]">
                    <span className="text-xs font-black text-text-primary block">
                      {currentQuinzenaInfo.label}
                    </span>
                    <span className="text-[10px] text-text-muted font-medium">
                      {currentQuinzenaInfo.monthName} de {currentQuinzenaInfo.year}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextQuinzena}
                    className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
                    title="Próxima quinzena"
                    aria-label="Próxima quinzena"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={handleGoToCurrentQuinzena}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-control bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer ml-1"
                    title="Voltar para a quinzena atual"
                  >
                    Hoje
                  </button>
                </div>
              </div>

              {/* Legenda Explicativa */}
              <div className="flex items-center gap-3 text-xs flex-wrap text-text-muted bg-surface-elevated/30 p-2.5 rounded-control border border-border-default">
                <span className="font-semibold text-text-secondary">Legenda:</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                  <strong className="text-emerald-300">Trabalha</strong> (T)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-surface-ground border border-border-default inline-block" />
                  <span className="text-text-muted">Folga (F)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/40 border border-amber-500 inline-block" />
                  <span className="text-amber-300 font-medium">Fim de Semana (Sáb/Dom)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 ring-2 ring-sky-400 inline-block" />
                  <span className="text-sky-300 font-medium">Dia de Hoje</span>
                </span>
              </div>

              {/* Tabela de Escala Quinzenal */}
              <div className="overflow-x-auto rounded-control border border-border-default">
                <table className="w-full text-xs text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="border-b border-border-default text-text-muted uppercase text-[10px] font-bold bg-surface-elevated/60">
                      <th className="p-3 min-w-[170px] sticky left-0 bg-surface-card z-10">Colaborador</th>
                      <th className="p-2 text-center min-w-[95px]">Regime</th>
                      {currentQuinzenaInfo.days.map(d => {
                        const isWeekend = d.isWeekend;
                        const isToday = d.isToday;
                        return (
                          <th 
                            key={d.dateStr} 
                            className={`py-2 px-1 text-center min-w-[38px] transition-colors ${
                              isToday
                                ? 'bg-sky-600/25 border-x border-sky-500/40'
                                : isWeekend
                                ? 'bg-amber-500/10 border-x border-amber-500/20'
                                : ''
                            }`}
                            title={d.holidayName ? `Feriado: ${d.holidayName}` : undefined}
                          >
                            <div className="flex flex-col items-center font-mono tabular-nums">
                              <span className={`text-xs font-black ${
                                isToday 
                                  ? 'text-sky-400 font-extrabold' 
                                  : isWeekend 
                                  ? 'text-amber-300 font-bold' 
                                  : 'text-text-primary'
                              }`}>
                                {d.dayNumber}
                              </span>
                              <span className={`text-[9px] uppercase font-bold tracking-tight ${
                                isToday 
                                  ? 'text-sky-300' 
                                  : isWeekend 
                                  ? 'text-amber-400' 
                                  : 'text-text-muted'
                              }`}>
                                {d.dayNameShort}
                              </span>
                              {d.holidayName && (
                                <span className="text-[8px] px-1 rounded bg-rose-500/30 text-rose-300 font-bold mt-0.5" title={d.holidayName}>
                                  Feriado
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                      <th className="p-3 text-center min-w-[120px]">Resumo Quinzena</th>
                      <th className="p-3 text-right min-w-[130px]">Ação de Hoje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50">
                    {collaborators.filter(c => c.isActive).map(collab => {
                      const scheduledDates: string[] = Array.isArray(collab.weeklySchedule) ? collab.weeklySchedule : [];
                      const isDiarista = collab.payType === 'diarista';

                      const shiftsInQuinzena = currentQuinzenaInfo.days.filter(d => scheduledDates.includes(d.dateStr)).length;
                      const offDaysInQuinzena = currentQuinzenaInfo.days.length - shiftsInQuinzena;
                      const weekendsWorked = currentQuinzenaInfo.days.filter(d => d.isWeekend && scheduledDates.includes(d.dateStr)).length;
                      const totalWeekends = currentQuinzenaInfo.days.filter(d => d.isWeekend).length;

                      const todayStr = new Date().toISOString().slice(0, 10);
                      const isScheduledToday = scheduledDates.includes(todayStr);
                      const alreadyLoggedToday = wageEntries.some(e => e.collaboratorId === collab.id && e.date === todayStr && (e.type === 'diaria' || e.type === 'diaria_extra'));

                      return (
                        <tr key={collab.id} className="hover:bg-surface-elevated/40 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-text-primary sticky left-0 bg-surface-card z-10 border-r border-border-default">
                            <div className="flex flex-col">
                              <span className="truncate max-w-[150px] font-bold text-text-primary">{collab.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant={getRoleBadgeVariant(collab.role)} className="text-[9px] px-1.5 py-0">
                                  {collab.role.toUpperCase()}
                                </Badge>
                                <span className="text-[10px] text-text-muted capitalize">{collab.shift}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-center">
                            {isDiarista ? (
                              <Badge variant="warning" className="text-[10px] font-mono tabular-nums whitespace-nowrap">
                                Diarista (R$ {Number(collab.dailyRate || 100).toFixed(0)})
                              </Badge>
                            ) : (
                              <Badge variant="info" className="text-[10px]">
                                Mensalista
                              </Badge>
                            )}
                          </td>

                          {currentQuinzenaInfo.days.map(d => {
                            const isScheduled = scheduledDates.includes(d.dateStr);
                            const isWeekend = d.isWeekend;
                            const isToday = d.isToday;

                            return (
                              <td 
                                key={d.dateStr} 
                                className={`py-1 px-1 text-center ${
                                  isToday 
                                    ? 'bg-sky-600/10 border-x border-sky-500/20' 
                                    : isWeekend 
                                    ? 'bg-amber-500/5 border-x border-amber-500/10' 
                                    : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleScheduleDate(collab, d.dateStr)}
                                  className={`w-8 h-8 rounded-control text-xs font-black cursor-pointer transition-all flex items-center justify-center mx-auto shadow-xs ${
                                    isScheduled
                                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                      : 'bg-surface-elevated/40 text-text-muted hover:text-text-primary hover:bg-surface-elevated border border-border-default'
                                  }`}
                                  title={
                                    isScheduled
                                      ? `${collab.name}: Escalado para trabalhar no dia ${d.dayNumber}. Clique para folga.`
                                      : `${collab.name}: Folga no dia ${d.dayNumber}. Clique para escalar plantão.`
                                  }
                                  aria-label={`${collab.name} no dia ${d.dayNumber}: ${isScheduled ? 'Trabalha' : 'Folga'}`}
                                >
                                  {isScheduled ? 'T' : 'F'}
                                </button>
                              </td>
                            );
                          })}

                          {/* Resumo da Quinzena */}
                          <td className="py-2.5 px-3 text-center border-l border-border-default">
                            <div className="flex flex-col items-center font-mono tabular-nums">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-emerald-400 font-bold" title="Dias trabalhados">{shiftsInQuinzena}T</span>
                                <span className="text-text-muted">/</span>
                                <span className="text-text-secondary" title="Folgas">{offDaysInQuinzena}F</span>
                              </div>
                              <span className="text-[10px] text-amber-300/80 font-medium mt-0.5">
                                {weekendsWorked}/{totalWeekends} fds trab.
                              </span>
                              {isDiarista && (
                                <span className="text-[10px] font-bold text-text-primary mt-0.5">
                                  ~ R$ {(shiftsInQuinzena * (Number(collab.dailyRate) || 100)).toFixed(0)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Ação Hoje */}
                          <td className="py-2.5 px-3 text-right">
                            {isDiarista ? (
                              alreadyLoggedToday ? (
                                <Badge variant="success" dot className="text-xs">
                                  Diária Lançada
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={isScheduledToday ? 'primary' : 'secondary'}
                                  onClick={() => handleQuickLogShift(collab)}
                                  leadingIcon={<CheckSquare size={13} aria-hidden="true" />}
                                >
                                  + Diária
                                </Button>
                              )
                            ) : (
                              <span className="text-xs text-text-muted italic">Mensalista</span>
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
      </div>

      {/* GAVETA LATERAL DESLIZANTE (SLIDING SHEET): CADASTRO / EDIÇÃO */}
      <SlidingSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Shield className="text-brand-primary" size={18} aria-hidden="true" />
            <span>{editingCollab ? `Editar: ${editingCollab.name}` : 'Cadastrar Colaborador'}</span>
          </div>
        }
        description="Defina as credenciais, nível de permissão e remuneração do colaborador."
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button
              variant="secondary"
              onClick={() => setIsSheetOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleSaveCollaborator()}
              loading={isSaving}
            >
              {editingCollab ? 'Salvar Alterações' : 'Confirmar Cadastro'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveCollaborator} className="space-y-4 text-xs">
          {/* Nome */}
          <div>
            <label htmlFor="collab-name-input" className="block text-text-secondary font-semibold mb-1">
              Nome Completo do Colaborador *
            </label>
            <input
              id="collab-name-input"
              type="text"
              required
              placeholder="Ex: João da Silva"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary text-sm font-medium focus:outline-none focus:border-brand-primary"
            />
          </div>

          {/* Cargo */}
          <div>
            <label htmlFor="collab-role-input" className="block text-text-secondary font-semibold mb-1">
              Função / Perfil de Acesso *
            </label>
            <select
              id="collab-role-input"
              value={roleInput}
              onChange={e => setRoleInput(e.target.value as CollaboratorRole)}
              className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary text-xs font-medium focus:outline-none focus:border-brand-primary cursor-pointer"
            >
              <option value="caixa">Operador de Caixa (Frente de Caixa, PDV & Mesas)</option>
              <option value="cozinha">Equipe de Cozinha (KDS Chapa, Fila & Perdas)</option>
              <option value="gerente">Gerente Operacional (Gestão Executiva, DRE, Estoque, Caixa & KDS)</option>
              <option value="admin">Administrador Master (Acesso Irrestrito + Gestão de Pessoas)</option>
            </select>
            <span className="text-[10px] text-text-muted mt-1 block">
              {roleInput === 'caixa' && 'Acesso restrito ao Caixa, lançamento de pedidos e mapa do salão.'}
              {roleInput === 'cozinha' && 'Acesso restrito à tela do KDS da chapa e controle de perdas.'}
              {roleInput === 'gerente' && 'Acesso a DRE, compras, suprimentos, auditoria e fechamento de turnos.'}
              {roleInput === 'admin' && 'Controle total da infraestrutura, configurações e exclusões.'}
            </span>
          </div>

          {/* Senha / PIN */}
          <div className="p-3.5 rounded-control bg-surface-elevated/40 border border-border-default space-y-1.5">
            <label htmlFor="collab-pin-input" className="block text-text-primary font-semibold">
              {editingCollab ? 'Alterar Senha / PIN de Acesso' : 'Senha / PIN de Acesso *'}
            </label>
            <div className="relative">
              <input
                id="collab-pin-input"
                type={showModalPin ? 'text' : 'password'}
                required={!editingCollab}
                maxLength={128}
                placeholder={editingCollab ? "Deixe em branco para manter a senha atual" : "Operador: 6+ dígitos | Gestor: 12+ caracteres"}
                value={pinInput} 
                autoComplete="new-password"
                onChange={e => setPinInput(e.target.value)}
                className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default font-mono tabular-nums text-sm pr-10 tracking-wider text-brand-primary font-bold focus:outline-none focus:border-brand-primary"
              />
              <button
                type="button"
                onClick={() => setShowModalPin(prev => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 rounded-control cursor-pointer transition-colors"
                tabIndex={-1}
                title={showModalPin ? 'Ocultar senha' : 'Ver senha digitada'}
                aria-label={showModalPin ? 'Ocultar senha' : 'Ver senha digitada'}
              >
                {showModalPin ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              </button>
            </div>
            <span className="text-[10px] text-text-muted block leading-tight">
              {editingCollab 
                ? 'Deixe o campo vazio para preservar a senha atual.' 
                : 'Mínimo de 6 dígitos numéricos para operadores ou 12 caracteres para gestores.'}
            </span>
          </div>

          {/* Regime de Remuneração */}
          <div className="p-3.5 rounded-control bg-surface-elevated/40 border border-border-default space-y-3">
            <label className="block text-text-secondary font-semibold">
              Regime de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayTypeInput('mensalista')}
                className={`py-2 px-3 rounded-control border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  payTypeInput === 'mensalista'
                    ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                    : 'bg-surface-card border-border-default text-text-muted hover:text-text-primary'
                }`}
              >
                <Briefcase size={14} aria-hidden="true" /> Salário Mensal
              </button>
              <button
                type="button"
                onClick={() => setPayTypeInput('diarista')}
                className={`py-2 px-3 rounded-control border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  payTypeInput === 'diarista'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                    : 'bg-surface-card border-border-default text-text-muted hover:text-text-primary'
                }`}
              >
                <Coins size={14} aria-hidden="true" /> Diarista (Por Turno)
              </button>
            </div>

            {payTypeInput === 'diarista' && (
              <div className="space-y-2 pt-3 border-t border-border-default animate-in fade-in duration-200">
                <label htmlFor="daily-rate-input" className="block text-text-secondary font-semibold">
                  Valor Padrão da Diária (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs pointer-events-none">R$</span>
                  <input
                    id="daily-rate-input"
                    type="number"
                    step="0.50"
                    required
                    placeholder="100.00"
                    value={dailyRateInput}
                    onChange={e => setDailyRateInput(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-control bg-surface-input border border-border-default text-xs font-mono font-bold text-text-primary tabular-nums focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Turno */}
          <div>
            <label className="block text-text-secondary font-semibold mb-1">
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
                  className={`py-2 rounded-control border text-xs font-semibold cursor-pointer transition-colors ${
                    shiftInput === s.id
                      ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold'
                      : 'bg-surface-card border-border-default text-text-muted hover:text-text-primary'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label htmlFor="collab-phone-input" className="block text-text-secondary font-semibold mb-1">
              Telefone / Contato (Opcional)
            </label>
            <input
              id="collab-phone-input"
              type="text"
              placeholder="(11) 99999-9999"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-xs font-mono tabular-nums text-text-primary focus:outline-none focus:border-brand-primary"
            />
          </div>

          {/* Status Ativo */}
          <div className="pt-2 border-t border-border-default">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isActiveInput}
                onChange={e => setIsActiveInput(e.target.checked)}
                className="rounded border-border-default accent-brand-primary cursor-pointer w-4 h-4"
              />
              <span className="text-xs font-semibold text-text-primary">
                Colaborador ativo no sistema e na escala
              </span>
            </label>
          </div>
        </form>
      </SlidingSheet>

      {/* MODAL 1: LANÇAR AGRADO / BÔNUS (Dialog) */}
      <Dialog
        open={Boolean(bonusModalCollab)}
        onClose={() => setBonusModalCollab(null)}
        title="Lançar Agrado / Bônus"
        description={`Colaborador: ${bonusModalCollab?.name}`}
        size="md"
      >
        <form onSubmit={handleConfirmBonus} className="space-y-4 text-xs">
          <div>
            <label htmlFor="bonus-val-input" className="block text-text-secondary font-semibold mb-1">
              Valor do Agrado / Bônus (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs">R$</span>
              <input
                id="bonus-val-input"
                type="number"
                step="0.50"
                required
                min="1"
                placeholder="30.00"
                value={bonusAmount}
                onChange={e => setBonusAmount(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-control bg-surface-input border border-border-default text-sm font-mono font-bold text-text-primary tabular-nums focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bonus-notes-input" className="block text-text-secondary font-semibold mb-1">
              Motivo / Observação
            </label>
            <input
              id="bonus-notes-input"
              type="text"
              placeholder="Ex: Noite movimentada, capricho no fechamento"
              value={bonusNotes}
              onChange={e => setBonusNotes(e.target.value)}
              className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-xs text-text-primary focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-default">
            <Button variant="secondary" onClick={() => setBonusModalCollab(null)}>
              Cancelar
            </Button>
            <Button type="submit" leadingIcon={<Gift size={14} aria-hidden="true" />}>
              Confirmar Agrado
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 2: LANÇAR DIÁRIA EXTRA (Dialog) */}
      <Dialog
        open={Boolean(extraShiftModalCollab)}
        onClose={() => setExtraShiftModalCollab(null)}
        title="Lançar Diária Extra / Cobertura"
        description={`Colaborador: ${extraShiftModalCollab?.name}`}
        size="md"
      >
        <form onSubmit={handleConfirmExtraShift} className="space-y-4 text-xs">
          <div>
            <label htmlFor="extra-shift-date" className="block text-text-secondary font-semibold mb-1">
              Data do Turno Trabalhado *
            </label>
            <input
              id="extra-shift-date"
              type="date"
              required
              value={extraShiftDate}
              onChange={e => setExtraShiftDate(e.target.value)}
              className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-xs font-mono tabular-nums text-text-primary focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label htmlFor="extra-shift-amount" className="block text-text-secondary font-semibold mb-1">
              Valor da Diária (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs">R$</span>
              <input
                id="extra-shift-amount"
                type="number"
                step="0.50"
                required
                min="1"
                value={extraShiftAmount}
                onChange={e => setExtraShiftAmount(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-control bg-surface-input border border-border-default text-sm font-mono font-bold text-text-primary tabular-nums focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="extra-shift-notes" className="block text-text-secondary font-semibold mb-1">
              Observação
            </label>
            <input
              id="extra-shift-notes"
              type="text"
              placeholder="Ex: Cobriu folga de colega na chapa"
              value={extraShiftNotes}
              onChange={e => setExtraShiftNotes(e.target.value)}
              className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-xs text-text-primary focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-default">
            <Button variant="secondary" onClick={() => setExtraShiftModalCollab(null)}>
              Cancelar
            </Button>
            <Button type="submit" leadingIcon={<Check size={14} aria-hidden="true" />}>
              Registrar Diária Extra
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 3: REALIZAR ACERTO DE DIÁRIAS (Dialog) */}
      <Dialog
        open={Boolean(acertoModalCollab)}
        onClose={() => setAcertoModalCollab(null)}
        title="Realizar Acerto de Diárias"
        description={`Colaborador: ${acertoModalCollab?.name}`}
        size="md"
      >
        <div className="space-y-4 text-xs">
          {/* Saldo Devedor Atual */}
          <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-control flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300 uppercase">Saldo Devedor Atual:</span>
            <span className="text-lg font-mono font-black text-text-primary tabular-nums">
              R$ {(acertoModalCollab ? balancesMap[acertoModalCollab.id]?.totalDue || 0 : 0).toFixed(2)}
            </span>
          </div>

          <form onSubmit={handleConfirmAcerto} className="space-y-4">
            <div>
              <label htmlFor="acerto-val-input" className="block text-text-secondary font-semibold mb-1">
                Valor a Pagar / Quitar (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs">R$</span>
                <input
                  id="acerto-val-input"
                  type="number"
                  step="0.50"
                  required
                  min="1"
                  value={acertoAmount}
                  onChange={e => setAcertoAmount(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-control bg-surface-input border border-border-default text-sm font-mono font-bold text-emerald-400 tabular-nums focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="acerto-method-select" className="block text-text-secondary font-semibold mb-1">
                Forma de Pagamento *
              </label>
              <select
                id="acerto-method-select"
                value={acertoMethod}
                onChange={e => setAcertoMethod(e.target.value as any)}
                className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-xs cursor-pointer font-semibold text-text-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="pix">PIX (Chave Celular / CPF / Banco)</option>
                <option value="dinheiro">Dinheiro Físico (Espécie)</option>
                <option value="transferencia">Transferência Bancária / TED</option>
                <option value="outro">Outro Meio de Pagamento</option>
              </select>
            </div>

            <div>
              <label htmlFor="acerto-notes-input" className="block text-text-secondary font-semibold mb-1">
                Observação / Comprovante
              </label>
              <input
                id="acerto-notes-input"
                type="text"
                placeholder="Ex: PIX enviado, comprovante arquivado"
                value={acertoNotes}
                onChange={e => setAcertoNotes(e.target.value)}
                className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-xs text-text-primary focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border-default">
              <Button variant="secondary" onClick={() => setAcertoModalCollab(null)}>
                Cancelar
              </Button>
              <Button type="submit" leadingIcon={<Check size={14} aria-hidden="true" />}>
                Confirmar Pagamento
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* MODAL 4: EXTRATO COMPLETO DE DIÁRIAS (Dialog) */}
      <Dialog
        open={Boolean(historyModalCollab)}
        onClose={() => setHistoryModalCollab(null)}
        title={`Extrato Completo: ${historyModalCollab?.name || ''}`}
        description="Histórico detalhado de diárias trabalhadas, bônus, agrados e pagamentos realizados."
        size="lg"
      >
        {historyModalCollab && (
          <div className="space-y-4 text-xs">
            {/* Resumo do Saldo */}
            <div className="p-4 bg-surface-elevated/40 border border-border-default rounded-control grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-[10px] text-text-muted uppercase font-semibold">Total Ganho</span>
                <p className="font-mono font-bold text-text-primary text-sm tabular-nums">
                  R$ {(balancesMap[historyModalCollab.id]?.totalEarned || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-semibold">Total Já Pago</span>
                <p className="font-mono font-bold text-sky-300 text-sm tabular-nums">
                  R$ {(balancesMap[historyModalCollab.id]?.totalPaid || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-rose-300">Saldo Devedor</span>
                <p className="font-mono font-black text-rose-300 text-sm tabular-nums">
                  R$ {(balancesMap[historyModalCollab.id]?.totalDue || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Lista dos Lançamentos */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {(!balancesMap[historyModalCollab.id]?.entries || balancesMap[historyModalCollab.id]?.entries.length === 0) ? (
                <div className="p-8 text-center text-text-muted italic">
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
                      className={`p-3 rounded-control border flex items-center justify-between gap-3 ${
                        isPayment
                          ? 'bg-sky-950/20 border-sky-500/30'
                          : isBonus
                            ? 'bg-amber-950/20 border-amber-500/30'
                            : isExtra
                              ? 'bg-purple-950/20 border-purple-500/30'
                              : 'bg-surface-elevated/20 border-border-default'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-control shrink-0 ${
                          isPayment 
                            ? 'bg-sky-600/20 text-sky-400' 
                            : isBonus 
                              ? 'bg-amber-500/20 text-amber-400' 
                              : 'bg-emerald-600/20 text-emerald-400'
                        }`}>
                          {isPayment ? <ArrowDownCircle size={16} aria-hidden="true" /> : isBonus ? <Gift size={16} aria-hidden="true" /> : <ArrowUpCircle size={16} aria-hidden="true" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary">
                              {isPayment ? 'Acerto / Pagamento' : isBonus ? 'Agrado / Bônus' : isExtra ? 'Diária Extra' : 'Diária de Trabalho'}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono tabular-nums">
                              {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {entry.notes || 'Sem observações'}
                            {entry.paymentMethod && ` • Via ${entry.paymentMethod.toUpperCase()}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`font-mono font-extrabold text-sm tabular-nums ${
                          isPayment ? 'text-sky-300' : isBonus ? 'text-amber-300' : 'text-emerald-400'
                        }`}>
                          {isPayment ? '-' : '+'} R$ {Number(entry.amount).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEntryToDeleteId(entry.id)}
                          className="p-1.5 text-text-muted hover:text-status-danger hover:bg-rose-500/10 rounded-control cursor-pointer transition-colors"
                          title="Excluir este lançamento"
                          aria-label="Excluir lançamento"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border-default">
              <Button variant="secondary" onClick={() => setHistoryModalCollab(null)}>
                Fechar Extrato
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* MODAL 5: ATIVAÇÃO NA NUVEM / SEGURANÇA (Dialog) */}
      <Dialog
        open={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        title="Ativar Sincronização na Nuvem (Supabase)"
        description="Orientações técnicas para migração e segurança do banco de dados."
        size="md"
      >
        <div className="space-y-4 text-xs text-text-secondary">
          <div className="bg-surface-elevated/40 p-3.5 rounded-control border border-border-default space-y-2">
            <p className="font-semibold text-text-primary">Instruções para o responsável técnico:</p>
            <ol className="list-decimal list-inside space-y-1 text-text-muted">
              <li>Faça backup e programe uma janela de manutenção.</li>
              <li>Configure o acesso privado e aplique a migração de segurança.</li>
              <li>Prepare as credenciais e valide os acessos antes de reabrir o caixa.</li>
            </ol>
          </div>

          <div className="relative">
            <pre className="bg-surface-elevated p-4 rounded-control border border-border-default text-xs font-mono text-emerald-300 max-h-48 overflow-y-auto leading-relaxed select-all">
              Consulte SECURITY-SETUP.md no projeto. A migração deve ser aplicada pelo responsável técnico em janela de manutenção.
            </pre>

            <button
              type="button"
              onClick={handleCopySql}
              className="absolute top-2.5 right-2.5 py-1 px-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-control text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              {copiedSql ? <Check size={13} aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
              {copiedSql ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          <div className="flex justify-end pt-3 border-t border-border-default">
            <Button variant="secondary" onClick={() => setIsSqlModalOpen(false)}>
              Entendido / Fechar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* CONFIRM DIALOG: EXCLUIR COLABORADOR */}
      <ConfirmDialog
        open={Boolean(collabToDelete)}
        onClose={() => setCollabToDelete(null)}
        onConfirm={handleConfirmDeleteCollab}
        title="Excluir Colaborador"
        description={`Tem certeza que deseja excluir permanentemente o cadastro de "${collabToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir Colaborador"
        cancelLabel="Cancelar"
        tone="danger"
        loading={isDeletingCollab}
      />

      {/* CONFIRM DIALOG: EXCLUIR LANÇAMENTO DO EXTRATO */}
      <ConfirmDialog
        open={Boolean(entryToDeleteId)}
        onClose={() => setEntryToDeleteId(null)}
        onConfirm={handleConfirmDeleteEntry}
        title="Excluir Lançamento"
        description="Deseja remover este registro de diária/acerto? O saldo devedor do colaborador será recalculado."
        confirmLabel="Excluir Lançamento"
        cancelLabel="Cancelar"
        tone="danger"
      />
    </div>
  );
}
