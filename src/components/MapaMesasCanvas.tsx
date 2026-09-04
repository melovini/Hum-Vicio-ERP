'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, Plus, Users, Move, Trash2, RotateCcw, 
  CheckCircle2, Clock, DollarSign, ArrowRight, Link2, 
  Unlink2, History, AlertTriangle, X, ShieldAlert, 
  ChevronRight, Sparkles, CreditCard, Banknote, QrCode, Search,
  SlidersHorizontal, Check
} from 'lucide-react';
import Link from 'next/link';
import SlidingSheet from '@/components/ui/SlidingSheet';
import StatusBadge, { StatusBadgeVariant } from '@/components/ui/StatusBadge';
import { 
  SessaoCaixaSalao, SalaoMesaInstancia, LayoutTemplate,
  getStoredLayoutTemplates, createInitialSessionFromTemplate,
  atualizarPosicaoMesaInstancia, adicionarMesaExtraInstancia,
  guardarMesaInstancia, juntarMesasInstancias, separarMesaInstancia,
  lancarPagamentoMesa, liberarMesaInstancia, restaurarPosicoesPadraoInstancias
} from '@/lib/mesas';

interface MapaMesasCanvasProps {
  floorSession: SessaoCaixaSalao;
  onUpdateSession: (newSession: SessaoCaixaSalao) => void;
  onSelectTableForOrder: (table: SalaoMesaInstancia) => void;
  operatorName?: string;
}

export default function MapaMesasCanvas({
  floorSession,
  onUpdateSession,
  onSelectTableForOrder,
  operatorName = 'Operador'
}: MapaMesasCanvasProps) {
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todas' | 'livres' | 'ocupadas' | 'pagas'>('todas');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Arraste livre (Drag & Drop com pointer events)
  const [draggingMesaId, setDraggingMesaId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Gavetas Laterais Deslizantes (Sliding Sheets - Sem Bloquear a Tela)
  const [mesaParaPagamento, setMesaParaPagamento] = useState<SalaoMesaInstancia | null>(null);
  const [valorPagamentoInput, setValorPagamentoInput] = useState<string>('');
  const [metodoPagamento, setMetodoPagamento] = useState<string>('cartao_credito');
  
  const [mesaParaJuntar, setMesaParaJuntar] = useState<SalaoMesaInstancia | null>(null);
  const [mesaMasterAlvoId, setMesaMasterAlvoId] = useState<string>('');

  const [mesaParaHistorico, setMesaParaHistorico] = useState<SalaoMesaInstancia | null>(null);
  const [showExtraTableModal, setShowExtraTableModal] = useState<boolean>(false);
  const [extraTableNameInput, setExtraTableNameInput] = useState<string>('');

  const [showTemplateSwitchModal, setShowTemplateSwitchModal] = useState<boolean>(false);
  const [selectedTemplateToSwitch, setSelectedTemplateToSwitch] = useState<string>('');

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setTemplates(getStoredLayoutTemplates());
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Mesas visíveis no Salão (statusVisual !== 'GUARDADA')
  const mesasNoSalao = useMemo(() => {
    return floorSession.mesas.filter(m => m.statusVisual !== 'GUARDADA');
  }, [floorSession.mesas]);

  // Mesas filtradas por status
  const mesasFiltradas = useMemo(() => {
    return mesasNoSalao.filter(m => {
      if (statusFilter === 'livres') return m.statusConsumo === 'LIVRE';
      if (statusFilter === 'ocupadas') return m.statusConsumo === 'OCUPADA_ABERTA' || m.statusConsumo === 'PARCIALMENTE_PAGA';
      if (statusFilter === 'pagas') return m.statusConsumo === 'PAGA_AGUARDANDO';
      return true;
    });
  }, [mesasNoSalao, statusFilter]);

  // KPIs do Salão em tempo real
  const kpis = useMemo(() => {
    const total = mesasNoSalao.length;
    const livres = mesasNoSalao.filter(m => m.statusConsumo === 'LIVRE').length;
    const ocupadas = mesasNoSalao.filter(m => m.statusConsumo === 'OCUPADA_ABERTA' || m.statusConsumo === 'PARCIALMENTE_PAGA').length;
    const pagas = mesasNoSalao.filter(m => m.statusConsumo === 'PAGA_AGUARDANDO').length;
    const totalEmAberto = mesasNoSalao.reduce((acc, m) => {
      const saldo = Math.max(0, (m.totalConsumo || 0) - (m.totalPago || 0));
      return acc + saldo;
    }, 0);
    const taxaOcupacao = total > 0 ? ((ocupadas + pagas) / total) * 100 : 0;

    return { total, livres, ocupadas, pagas, totalEmAberto, taxaOcupacao };
  }, [mesasNoSalao]);

  // Manipulação de Arraste (Drag & Drop)
  const handleMouseDown = (e: React.MouseEvent, mesaId: string) => {
    const mesa = floorSession.mesas.find(m => m.id === mesaId);
    if (!mesa || !canvasRef.current) return;

    setSelectedMesaId(mesaId);
    setDraggingMesaId(mesaId);

    const rect = canvasRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    setDragOffset({
      x: cursorX - mesa.posX,
      y: cursorY - mesa.posY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingMesaId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left - dragOffset.x;
    let newY = e.clientY - rect.top - dragOffset.y;

    if (snapToGrid) {
      newX = Math.round(newX / 20) * 20;
      newY = Math.round(newY / 20) * 20;
    }

    newX = Math.max(10, Math.min(newX, rect.width - 120));
    newY = Math.max(30, Math.min(newY, rect.height - 120));

    const updated = atualizarPosicaoMesaInstancia(floorSession, draggingMesaId, newX, newY);
    onUpdateSession(updated);
  };

  const handleMouseUp = () => {
    setDraggingMesaId(null);
  };

  // Guardar Mesa (Recolher do Salão com Bloqueio de Segurança)
  const handleGuardarMesa = (mesaId: string) => {
    const res = guardarMesaInstancia(floorSession, mesaId, operatorName);
    if (!res.success) {
      showFeedback(res.error || 'Ação bloqueada.', 'error');
    } else {
      onUpdateSession(res.sessao);
      showFeedback('Mesa guardada com sucesso!');
    }
  };

  // Restaurar Posições Padrão
  const handleRestaurarPadrao = () => {
    if (confirm('Restaurar posições originais de todas as mesas livres para o layout inicial?')) {
      const updated = restaurarPosicoesPadraoInstancias(floorSession);
      onUpdateSession(updated);
      showFeedback('Posições das mesas livres restauradas!');
    }
  };

  // Adicionar Mesa Extra
  const handleConfirmAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraTableNameInput.trim()) return;

    const res = adicionarMesaExtraInstancia(floorSession, extraTableNameInput.trim(), operatorName);
    onUpdateSession(res.sessao);
    setExtraTableNameInput('');
    setShowExtraTableModal(false);
    showFeedback(`Mesa extra "${extraTableNameInput.trim()}" adicionada ao salão!`);
  };

  // Trocar Template de Salão
  const handleConfirmSwitchTemplate = () => {
    if (!selectedTemplateToSwitch) return;
    const tpl = templates.find(t => t.id === selectedTemplateToSwitch);
    if (!tpl) return;

    const mesasOcupadas = floorSession.mesas.filter(m => m.statusConsumo !== 'LIVRE' && m.statusVisual !== 'GUARDADA');
    if (mesasOcupadas.length > 0) {
      if (!confirm(`Atenção: Existem ${mesasOcupadas.length} mesa(s) em atendimento. Trocar o layout preservará as comandas abertas mas reorganizará as mesas livres. Deseja continuar?`)) {
        return;
      }
    }

    const novaSessao = createInitialSessionFromTemplate(floorSession.sessaoCaixaId, tpl.id);
    novaSessao.mesas = novaSessao.mesas.map(nm => {
      const oc = mesasOcupadas.find(o => o.numeroIdentificador.toLowerCase() === nm.numeroIdentificador.toLowerCase());
      if (oc) {
        return { ...nm, ...oc, posX: nm.posX, posY: nm.posY };
      }
      return nm;
    });

    onUpdateSession(novaSessao);
    setShowTemplateSwitchModal(false);
    showFeedback(`Layout alterado para "${tpl.nome}"!`);
  };

  // Abrir Gaveta de Pagamento
  const handleOpenPaymentModal = (mesa: SalaoMesaInstancia) => {
    setMesaParaPagamento(mesa);
    const saldo = Math.max(0, (mesa.totalConsumo || 0) - (mesa.totalPago || 0));
    setValorPagamentoInput(saldo.toFixed(2));
  };

  // Confirmar Pagamento
  const handleConfirmPayment = () => {
    if (!mesaParaPagamento) return;
    const valor = Number(valorPagamentoInput) || 0;
    if (valor <= 0) {
      showFeedback('Informe um valor de pagamento válido.', 'error');
      return;
    }

    const res = lancarPagamentoMesa(floorSession, mesaParaPagamento.id, valor, metodoPagamento, operatorName);
    if (!res.success) {
      showFeedback(res.error || 'Erro ao processar pagamento.', 'error');
    } else {
      onUpdateSession(res.sessao);
      setMesaParaPagamento(null);
      showFeedback(`Pagamento de R$ ${valor.toFixed(2)} registrado com sucesso!`);
    }
  };

  // Liberar Mesa
  const handleLiberarMesa = (mesaId: string) => {
    const updated = liberarMesaInstancia(floorSession, mesaId, operatorName);
    onUpdateSession(updated);
    showFeedback('Mesa liberada e pronta para o próximo cliente!');
  };

  // Juntar Mesas (Merge)
  const handleConfirmMerge = () => {
    if (!mesaParaJuntar || !mesaMasterAlvoId) return;
    const res = juntarMesasInstancias(floorSession, mesaParaJuntar.id, mesaMasterAlvoId, operatorName);
    if (!res.success) {
      showFeedback(res.error || 'Erro ao juntar mesas.', 'error');
    } else {
      onUpdateSession(res.sessao);
      setMesaParaJuntar(null);
      setMesaMasterAlvoId('');
      showFeedback('Mesas unificadas com sucesso!');
    }
  };

  // Separar Mesa (Split)
  const handleSepararMesa = (mesaId: string) => {
    const res = separarMesaInstancia(floorSession, mesaId, operatorName);
    if (!res.success) {
      showFeedback(res.error || 'Erro ao separar mesa.', 'error');
    } else {
      onUpdateSession(res.sessao);
      showFeedback('Mesa desvinculada com sucesso!');
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Toast Flutuante Discreto (Canto Superior Direito) */}
      {feedbackMsg && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top duration-200 ${
          feedbackMsg.type === 'success' 
            ? 'bg-surface-card border-status-free/40 text-status-free' 
            : 'bg-surface-card border-status-danger/40 text-status-danger'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Topo: KPIs Executivos do Salão com Alta Densidade */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Mesas no Salão</span>
          <p className="text-xl font-mono tabular-nums font-bold text-slate-100">{kpis.total}</p>
          <span className="text-[10px] text-slate-500 truncate block">Layout: {floorSession.layoutNome}</span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Livres</span>
          <p className="text-xl font-mono tabular-nums font-bold text-status-free">{kpis.livres}</p>
          <span className="text-[10px] text-status-free/80 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-free" /> Disponíveis
          </span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Em Consumo</span>
          <p className="text-xl font-mono tabular-nums font-bold text-status-occupied">{kpis.ocupadas}</p>
          <span className="text-[10px] text-status-occupied/80 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-occupied animate-pulse" /> Ativas
          </span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Aguardando Limpeza</span>
          <p className="text-xl font-mono tabular-nums font-bold text-status-paid">{kpis.pagas}</p>
          <span className="text-[10px] text-status-paid/80 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-paid" /> Quitadas
          </span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Total a Receber</span>
          <p className="text-xl font-mono tabular-nums font-bold text-status-partial">
            R$ {kpis.totalEmAberto.toFixed(2)}
          </p>
          <span className="text-[10px] text-slate-500">Saldo em salão</span>
        </div>

        <div className="bg-surface-card p-3.5 rounded-xl border border-surface-border space-y-1">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Taxa de Ocupação</span>
          <p className="text-xl font-mono tabular-nums font-bold text-brand-accent">{kpis.taxaOcupacao.toFixed(0)}%</p>
          <div className="w-full bg-surface-ground rounded-full h-1 overflow-hidden">
            <div className="bg-brand-accent h-full rounded-full transition-all duration-300" style={{ width: `${kpis.taxaOcupacao}%` }} />
          </div>
        </div>
      </div>

      {/* Barra de Ações Rápidas do Salão */}
      <div className="bg-surface-card p-3 rounded-xl border border-surface-border flex flex-wrap items-center justify-between gap-3">
        
        {/* Filtros de Status em Chips Compactos */}
        <div className="flex flex-wrap items-center gap-1 bg-surface-ground p-1 rounded-lg border border-surface-border">
          {[
            { id: 'todas', label: `Todas (${kpis.total})` },
            { id: 'livres', label: `Livres (${kpis.livres})` },
            { id: 'ocupadas', label: `Ocupadas (${kpis.ocupadas})` },
            { id: 'pagas', label: `Pagas (${kpis.pagas})` }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-surface-elevated text-slate-100 border border-surface-borderHover shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Botões Utilitários de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Adicionar Mesa Extra */}
          <button
            type="button"
            onClick={() => setShowExtraTableModal(true)}
            className="py-1.5 px-3 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={14} /> + Mesa Extra
          </button>

          {/* Restaurar Posições Padrão */}
          <button
            type="button"
            onClick={handleRestaurarPadrao}
            className="py-1.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Reposiciona mesas livres para o layout mestre"
          >
            <RotateCcw size={13} /> Restaurar
          </button>

          {/* Trocar Template de Salão */}
          <button
            type="button"
            onClick={() => {
              setSelectedTemplateToSwitch(floorSession.layoutOrigemId);
              setShowTemplateSwitchModal(true);
            }}
            className="py-1.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <LayoutGrid size={13} /> Mudar Layout
          </button>

          {/* Grade Magnética */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-400 bg-surface-ground px-2.5 py-1.5 rounded-lg border border-surface-border">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={e => setSnapToGrid(e.target.checked)}
              className="rounded border-surface-border accent-brand-primary cursor-pointer"
            />
            <span>Snap 20px</span>
          </label>

          {/* Link para Editor Admin */}
          <Link
            href="/admin/mesas"
            className="py-1.5 px-3 bg-surface-ground hover:bg-surface-elevated text-slate-400 hover:text-slate-200 border border-surface-border rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <SlidersHorizontal size={13} /> Editor Mestre
          </Link>
        </div>

      </div>

      {/* Canvas 2D Interativo do Salão (Estética Linear / Dot Grid) */}
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative w-full h-[620px] bg-surface-ground dot-grid rounded-xl border border-surface-border overflow-hidden select-none"
      >
        {/* Marcador de Entrada / Balcão */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-surface-card/80 border-b border-surface-border flex items-center justify-center text-[10px] font-medium tracking-widest uppercase text-slate-500 pointer-events-none">
          FRENTE DE CAIXA / ENTRADA DO SALÃO
        </div>

        {/* Mesas Renderizadas como Nós Arrastáveis */}
        {mesasFiltradas.map(mesa => {
          const isSelected = selectedMesaId === mesa.id;
          const isDragging = draggingMesaId === mesa.id;
          const isMerged = !!mesa.mesaPaiId;
          const masterTable = isMerged ? floorSession.mesas.find(m => m.id === mesa.mesaPaiId) : null;

          // Configuração semântica de status
          let badgeVariant: StatusBadgeVariant = 'free';
          let borderAccent = 'border-surface-border hover:border-surface-borderHover';
          let bgCard = 'bg-surface-card';

          if (mesa.statusConsumo === 'OCUPADA_ABERTA') {
            badgeVariant = 'occupied';
            borderAccent = 'border-status-occupied/40 shadow-xs';
          } else if (mesa.statusConsumo === 'PARCIALMENTE_PAGA') {
            badgeVariant = 'partial';
            borderAccent = 'border-status-partial/40 shadow-xs';
          } else if (mesa.statusConsumo === 'PAGA_AGUARDANDO') {
            badgeVariant = 'paid';
            borderAccent = 'border-status-paid/60 ring-1 ring-status-paid/20 shadow-xs';
          }

          if (isMerged) {
            borderAccent += ' ring-1 ring-purple-400/40 border-dashed';
          }

          const saldoRestante = Math.max(0, (mesa.totalConsumo || 0) - (mesa.totalPago || 0));

          return (
            <div
              key={mesa.id}
              onMouseDown={e => handleMouseDown(e, mesa.id)}
              style={{
                left: `${mesa.posX}px`,
                top: `${mesa.posY}px`,
                width: `${mesa.largura || 110}px`,
                minHeight: `${mesa.altura || 110}px`,
                borderRadius: mesa.formato === 'redonda' ? '9999px' : '12px'
              }}
              className={`absolute cursor-grab active:cursor-grabbing transition-all flex flex-col justify-between p-2.5 border ${bgCard} ${borderAccent} ${
                isSelected ? 'ring-2 ring-brand-primary z-30' : 'z-10'
              } ${isDragging ? 'opacity-90 scale-105 z-40 shadow-xl ring-2 ring-brand-primary' : 'shadow-sm'}`}
            >
              {/* Topo do Card */}
              <div>
                <div className="flex justify-between items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-100 text-xs tracking-tight truncate block">
                      {mesa.numeroIdentificador}
                    </span>
                    {mesa.clienteNome && mesa.statusConsumo !== 'LIVRE' && (
                      <span className="text-[10px] font-black text-amber-400 truncate block mt-0.5" title={`Cliente: ${mesa.clienteNome}`}>
                        👤 {mesa.clienteNome}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-slate-400 flex items-center gap-0.5 shrink-0 mt-0.5">
                    <Users size={10} /> {mesa.capacidade}
                  </span>
                </div>

                {/* Badge de Status Glow Translúcido */}
                <div className="mt-1">
                  <StatusBadge 
                    status={badgeVariant} 
                    label={isMerged ? `🔗 Junto à ${masterTable?.numeroIdentificador || 'Pai'}` : undefined}
                    pulse={mesa.statusConsumo === 'OCUPADA_ABERTA'}
                  />
                </div>
              </div>

              {/* Informação Financeira Central com Fonte Tabular */}
              <div className="my-1 text-center">
                {mesa.statusConsumo !== 'LIVRE' && !isMerged && (
                  <div className="font-mono tabular-nums">
                    <p className="text-[10px] text-slate-400">Saldo a Pagar</p>
                    <p className="text-xs font-bold text-slate-100">
                      R$ {saldoRestante.toFixed(2)}
                    </p>
                    {mesa.totalPago > 0 && (
                      <p className="text-[9px] text-status-free font-medium">
                        (Pago R$ {mesa.totalPago.toFixed(2)})
                      </p>
                    )}
                  </div>
                )}
                {mesa.statusConsumo === 'LIVRE' && !isMerged && (
                  <p className="text-[10px] text-slate-500 font-medium">Disponível</p>
                )}
              </div>

              {/* Barra de Ações Rápidas por Estado */}
              <div className="flex items-center justify-center gap-1 pt-1 border-t border-surface-border">
                {mesa.statusConsumo === 'LIVRE' && !isMerged && (
                  <>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectTableForOrder(mesa);
                      }}
                      className="px-2 py-1 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-md text-[10px] font-semibold cursor-pointer transition-colors"
                      title="Lançar comanda nesta mesa"
                    >
                      + Pedido
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleGuardarMesa(mesa.id);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-300 hover:bg-surface-elevated rounded-md cursor-pointer transition-colors"
                      title="Guardar mesa livre"
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                )}

                {mesa.statusConsumo === 'OCUPADA_ABERTA' && !isMerged && (
                  <>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectTableForOrder(mesa);
                      }}
                      className="px-1.5 py-1 bg-surface-elevated hover:bg-surface-border text-slate-200 rounded-md text-[10px] font-medium cursor-pointer transition-colors"
                      title="Adicionar mais itens"
                    >
                      + Item
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenPaymentModal(mesa);
                      }}
                      className="px-2 py-1 bg-status-free/20 hover:bg-status-free/30 text-status-free border border-status-free/30 rounded-md text-[10px] font-semibold cursor-pointer transition-colors"
                    >
                      Pagar
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setMesaParaJuntar(mesa);
                      }}
                      className="p-1 text-purple-400 hover:bg-purple-950/40 rounded-md cursor-pointer transition-colors"
                      title="Juntar à outra mesa"
                    >
                      <Link2 size={11} />
                    </button>
                  </>
                )}

                {mesa.statusConsumo === 'PARCIALMENTE_PAGA' && !isMerged && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenPaymentModal(mesa);
                    }}
                    className="px-2 py-1 bg-status-partial/20 hover:bg-status-partial/30 text-status-partial border border-status-partial/30 rounded-md text-[10px] font-semibold cursor-pointer transition-colors"
                  >
                    Quitar
                  </button>
                )}

                {mesa.statusConsumo === 'PAGA_AGUARDANDO' && !isMerged && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleLiberarMesa(mesa.id);
                    }}
                    className="px-2 py-1 bg-status-paid/20 hover:bg-status-paid/30 text-status-paid border border-status-paid/30 rounded-md text-[10px] font-semibold cursor-pointer transition-colors"
                  >
                    Liberar
                  </button>
                )}

                {isMerged && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleSepararMesa(mesa.id);
                    }}
                    className="px-2 py-1 bg-surface-elevated hover:bg-surface-border text-slate-300 rounded-md text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    title="Desvincular da mesa master"
                  >
                    <Unlink2 size={10} /> Separar
                  </button>
                )}

                {/* Histórico do Turno (Achados & Perdidos) */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setMesaParaHistorico(mesa);
                  }}
                  className="p-1 text-slate-500 hover:text-slate-300 hover:bg-surface-elevated rounded-md cursor-pointer transition-colors"
                  title="Ver Histórico do Turno (Achados & Perdidos)"
                >
                  <History size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* GAVETA LATERAL DESLIZANTE (SLIDING SHEET): RECEBER PAGAMENTO */}
      <SlidingSheet
        isOpen={!!mesaParaPagamento}
        onClose={() => setMesaParaPagamento(null)}
        title={
          <div className="flex items-center gap-2">
            <DollarSign className="text-status-free" size={18} />
            <span>
              Pagamento: {mesaParaPagamento?.numeroIdentificador}
              {mesaParaPagamento?.clienteNome ? ` (${mesaParaPagamento.clienteNome})` : ''}
            </span>
          </div>
        }
        description="Amortização parcial ou quitação total da conta da mesa."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMesaParaPagamento(null)}
              className="flex-1 py-2.5 bg-surface-ground hover:bg-surface-elevated text-slate-300 border border-surface-border rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmPayment}
              className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Confirmar Pagamento
            </button>
          </div>
        }
      >
        {mesaParaPagamento && (
          <div className="space-y-4">
            
            {/* Extrato com Tipografia Tabular */}
            <div className="bg-surface-ground p-3.5 rounded-lg border border-surface-border space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Total Consumido:</span>
                <strong className="font-mono tabular-nums text-slate-200">
                  R$ {mesaParaPagamento.totalConsumo.toFixed(2)}
                </strong>
              </div>
              <div className="flex justify-between text-status-free">
                <span>Já Pago / Amortizado:</span>
                <strong className="font-mono tabular-nums">
                  - R$ {(mesaParaPagamento.totalPago || 0).toFixed(2)}
                </strong>
              </div>
              <div className="pt-2 border-t border-surface-border flex justify-between font-semibold">
                <span className="text-slate-300">Saldo Restante a Pagar:</span>
                <span className="font-mono tabular-nums text-status-occupied font-bold">
                  R$ {Math.max(0, mesaParaPagamento.totalConsumo - (mesaParaPagamento.totalPago || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Atalhos Rápidos de Divisão */}
            <div>
              <label className="block text-[10px] font-medium tracking-wider text-slate-400 mb-1.5 uppercase">
                Atalhos de Amortização
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '100%', val: Math.max(0, mesaParaPagamento.totalConsumo - (mesaParaPagamento.totalPago || 0)) },
                  { label: '50%', val: Math.max(0, mesaParaPagamento.totalConsumo - (mesaParaPagamento.totalPago || 0)) / 2 },
                  { label: '1/3', val: Math.max(0, mesaParaPagamento.totalConsumo - (mesaParaPagamento.totalPago || 0)) / 3 },
                  { label: '1/4', val: Math.max(0, mesaParaPagamento.totalConsumo - (mesaParaPagamento.totalPago || 0)) / 4 },
                ].map(chip => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setValorPagamentoInput(chip.val.toFixed(2))}
                    className="py-1.5 bg-surface-ground hover:bg-surface-elevated text-slate-300 rounded-md text-xs font-mono tabular-nums font-semibold border border-surface-border cursor-pointer transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Utilitário de Valor */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Valor a Receber Agora (R$):
              </label>
              <input
                type="number"
                step="0.50"
                value={valorPagamentoInput}
                onChange={e => setValorPagamentoInput(e.target.value)}
                className="w-full input-util font-mono tabular-nums text-lg font-bold text-status-free"
              />
            </div>

            {/* Método de Pagamento em Grade Compacta */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Método de Pagamento:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard },
                  { id: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard },
                  { id: 'pix', label: 'PIX Direto', icon: QrCode },
                  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodoPagamento(m.id)}
                    className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                      metodoPagamento === m.id
                        ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-semibold'
                        : 'bg-surface-ground border-surface-border text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <m.icon size={14} /> {m.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </SlidingSheet>

      {/* GAVETA LATERAL DESLIZANTE (SLIDING SHEET): HISTÓRICO DO TURNO (ACHADOS & PERDIDOS) */}
      <SlidingSheet
        isOpen={!!mesaParaHistorico}
        onClose={() => setMesaParaHistorico(null)}
        title={
          <div className="flex items-center gap-2">
            <History className="text-brand-accent" size={18} />
            <span>Histórico: {mesaParaHistorico?.numeroIdentificador}</span>
          </div>
        }
        description="Registro de ocupações do turno para devolução de pertences esquecidos."
        width="lg"
      >
        {mesaParaHistorico && (
          <div className="space-y-4">
            
            {/* Status Atual da Mesa */}
            <div className="bg-surface-ground p-3 rounded-lg border border-surface-border flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-medium">Estado no Salão</span>
                <p className="text-xs font-semibold text-slate-200">
                  {mesaParaHistorico.statusConsumo} ({mesaParaHistorico.capacidade} Lugares)
                </p>
              </div>
              <StatusBadge status={mesaParaHistorico.statusConsumo === 'LIVRE' ? 'free' : 'occupied'} />
            </div>

            {/* Linha do Tempo dos Clientes Recentes */}
            <div className="space-y-2">
              <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                Atendimentos Concluídos Neste Turno
              </span>

              {(!mesaParaHistorico.historicoTurno || mesaParaHistorico.historicoTurno.length === 0) ? (
                <div className="p-8 text-center bg-surface-ground rounded-lg border border-dashed border-surface-border">
                  <History size={24} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Nenhum atendimento anterior registrado nesta mesa hoje.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {mesaParaHistorico.historicoTurno.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 bg-surface-ground rounded-lg border border-surface-border space-y-1.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-xs font-bold text-slate-100">{item.clienteNome || 'Cliente Não Identificado'}</strong>
                          <span className="text-[10px] text-slate-500 block">Atendente: {item.garcomOuOperador || 'Operador'}</span>
                        </div>
                        <span className="text-xs font-mono tabular-nums font-bold text-status-free">
                          R$ {item.totalConsumo.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-surface-border font-mono tabular-nums">
                        <span>Entrada: {new Date(item.abertaEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>Saída: {new Date(item.fechadaEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </SlidingSheet>

      {/* GAVETA LATERAL DESLIZANTE (SLIDING SHEET): ADICIONAR MESA EXTRA */}
      <SlidingSheet
        isOpen={showExtraTableModal}
        onClose={() => setShowExtraTableModal(false)}
        title={
          <div className="flex items-center gap-2">
            <Plus className="text-brand-primary" size={18} />
            <span>Adicionar Mesa Extra</span>
          </div>
        }
        description="Insira uma mesa avulsa ou desdobre o salão para alta demanda."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowExtraTableModal(false)}
              className="flex-1 py-2.5 bg-surface-ground hover:bg-surface-elevated text-slate-300 border border-surface-border rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmAddExtra}
              className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Adicionar ao Mapa
            </button>
          </div>
        }
      >
        <form onSubmit={handleConfirmAddExtra} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Identificador da Mesa
            </label>
            <input
              type="text"
              autoFocus
              required
              value={extraTableNameInput}
              onChange={e => setExtraTableNameInput(e.target.value)}
              placeholder="Ex: Mesa 10, Bistrô 02, Varanda 01"
              className="w-full input-util text-sm"
            />
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            A mesa surgirá imediatamente no centro do canvas e poderá ser posicionada por arraste.
          </p>
        </form>
      </SlidingSheet>

      {/* GAVETA LATERAL DESLIZANTE (SLIDING SHEET): JUNTAR MESAS (MERGE) */}
      <SlidingSheet
        isOpen={!!mesaParaJuntar}
        onClose={() => setMesaParaJuntar(null)}
        title={
          <div className="flex items-center gap-2">
            <Link2 className="text-purple-400" size={18} />
            <span>Juntar: {mesaParaJuntar?.numeroIdentificador}</span>
          </div>
        }
        description="Vincule esta mesa a outra mesa master para unificar o atendimento."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMesaParaJuntar(null)}
              className="flex-1 py-2.5 bg-surface-ground hover:bg-surface-elevated text-slate-300 border border-surface-border rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmMerge}
              disabled={!mesaMasterAlvoId}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Confirmar Junção
            </button>
          </div>
        }
      >
        {mesaParaJuntar && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Selecione a Mesa Master (Concentradora)
              </label>
              <select
                value={mesaMasterAlvoId}
                onChange={e => setMesaMasterAlvoId(e.target.value)}
                className="w-full input-util text-xs cursor-pointer"
              >
                <option value="">Selecione uma mesa...</option>
                {mesasNoSalao
                  .filter(m => m.id !== mesaParaJuntar.id && !m.mesaPaiId)
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.numeroIdentificador} ({m.statusConsumo})
                    </option>
                  ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              A mesa vinculada permanecerá no mapa sinalizada visualmente com anel de junção e poderá ser desvinculada a qualquer instante.
            </p>
          </div>
        )}
      </SlidingSheet>

      {/* GAVETA LATERAL DESLIZANTE (SLIDING SHEET): MUDAR LAYOUT */}
      <SlidingSheet
        isOpen={showTemplateSwitchModal}
        onClose={() => setShowTemplateSwitchModal(false)}
        title={
          <div className="flex items-center gap-2">
            <LayoutGrid className="text-brand-accent" size={18} />
            <span>Alternar Layout de Salão</span>
          </div>
        }
        description="Mude a disposição padrão das mesas no salão para o turno atual."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowTemplateSwitchModal(false)}
              className="flex-1 py-2.5 bg-surface-ground hover:bg-surface-elevated text-slate-300 border border-surface-border rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmSwitchTemplate}
              className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Aplicar Layout
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          {templates.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelectedTemplateToSwitch(tpl.id)}
              className={`w-full p-3 rounded-lg border text-left cursor-pointer transition-colors flex items-center justify-between ${
                selectedTemplateToSwitch === tpl.id
                  ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                  : 'bg-surface-ground border-surface-border text-slate-300 hover:border-surface-borderHover'
              }`}
            >
              <div>
                <p className="text-xs font-semibold">{tpl.nome}</p>
                <p className="text-[10px] text-slate-500">{tpl.items.length} mesas configuradas</p>
              </div>
              {selectedTemplateToSwitch === tpl.id && (
                <Check size={16} className="text-brand-primary" />
              )}
            </button>
          ))}
        </div>
      </SlidingSheet>

    </div>
  );
}
