'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, Plus, Users, Move, Trash2, RotateCcw, 
  CheckCircle2, Clock, DollarSign, ArrowRight, Link2, 
  Unlink2, History, AlertTriangle, X, ShieldAlert, 
  ChevronRight, Sparkles, CreditCard, Banknote, QrCode, Search
} from 'lucide-react';
import Link from 'next/link';
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

  // Modais de Ação do Salão
  const [mesaParaPagamento, setMesaParaPagamento] = useState<SalaoMesaInstancia | null>(null);
  const [valorPagamentoInput, setValorPagamentoInput] = useState<string>('');
  const [metodoPagamento, setMetodoPagamento] = useState<string>('cartao');
  
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

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    setDraggingMesaId(mesaId);
    setSelectedMesaId(mesaId);
    setDragOffset({
      x: mouseX - mesa.posX,
      y: mouseY - mesa.posY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingMesaId || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    let rawX = e.clientX - canvasRect.left - dragOffset.x;
    let rawY = e.clientY - canvasRect.top - dragOffset.y;

    if (snapToGrid) {
      rawX = Math.round(rawX / 20) * 20;
      rawY = Math.round(rawY / 20) * 20;
    }

    rawX = Math.max(10, Math.min(canvasRect.width - 120, rawX));
    rawY = Math.max(10, Math.min(canvasRect.height - 120, rawY));

    const updated = atualizarPosicaoMesaInstancia(floorSession, draggingMesaId, rawX, rawY);
    onUpdateSession(updated);
  };

  const handleMouseUp = () => {
    setDraggingMesaId(null);
  };

  // Ações Operacionais
  const handleGuardarMesa = (mesaId: string) => {
    const res = guardarMesaInstancia(floorSession, mesaId, operatorName);
    if (!res.success) {
      showFeedback(res.error || 'Não foi possível guardar a mesa.', 'error');
    } else {
      onUpdateSession(res.sessao);
      showFeedback('Mesa recolhida para a gaveta virtual com sucesso!');
      if (selectedMesaId === mesaId) setSelectedMesaId(null);
    }
  };

  const handleConfirmExtraTable = () => {
    const res = adicionarMesaExtraInstancia(floorSession, extraTableNameInput, operatorName);
    onUpdateSession(res.sessao);
    setExtraTableNameInput('');
    setShowExtraTableModal(false);
    showFeedback(`${res.mesaAdicionada.numeroIdentificador} adicionada ao mapa!`);
  };

  const handleRestaurarPadrao = () => {
    if (confirm('Deseja reorganizar as mesas livres de volta para as posições do layout mestre?')) {
      const updated = restaurarPosicoesPadraoInstancias(floorSession);
      onUpdateSession(updated);
      showFeedback('Posições padrão restauradas para as mesas livres!');
    }
  };

  const handleConfirmSwitchTemplate = () => {
    if (!selectedTemplateToSwitch) return;
    const novaSessao = createInitialSessionFromTemplate(floorSession.sessaoCaixaId, selectedTemplateToSwitch);
    onUpdateSession(novaSessao);
    setShowTemplateSwitchModal(false);
    showFeedback(`Layout alterado para "${novaSessao.layoutNome}"!`);
  };

  // Abrir Modal de Pagamento
  const handleOpenPaymentModal = (mesa: SalaoMesaInstancia) => {
    const saldo = Math.max(0, (mesa.totalConsumo || 0) - (mesa.totalPago || 0));
    setMesaParaPagamento(mesa);
    setValorPagamentoInput(saldo.toFixed(2));
  };

  const handleConfirmPayment = () => {
    if (!mesaParaPagamento) return;
    const valor = parseFloat(valorPagamentoInput);
    if (isNaN(valor) || valor <= 0) {
      showFeedback('Informe um valor de pagamento válido.', 'error');
      return;
    }

    const res = lancarPagamentoMesa(floorSession, mesaParaPagamento.id, valor, metodoPagamento, operatorName);
    onUpdateSession(res.sessao);
    setMesaParaPagamento(null);
    showFeedback(`Pagamento de R$ ${valor.toFixed(2)} registrado com sucesso!`);
  };

  // Liberar / Limpar Mesa
  const handleLiberarMesa = (mesaId: string) => {
    const updated = liberarMesaInstancia(floorSession, mesaId, operatorName);
    onUpdateSession(updated);
    showFeedback('Mesa limpa e liberada com sucesso! Atendimento arquivado no histórico.');
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
    <div className="space-y-6 animate-fade-in">
      
      {/* Toast de Feedback */}
      {feedbackMsg && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl border shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-950 border-emerald-500 text-emerald-300' 
            : 'bg-red-950 border-red-500 text-red-300'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Topo: KPIs Executivos do Salão */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Mesas no Salão</span>
          <p className="text-2xl font-mono font-black text-white">{kpis.total}</p>
          <span className="text-[10px] text-slate-500 font-mono">Layout: {floorSession.layoutNome}</span>
        </div>

        <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Mesas Livres</span>
          <p className="text-2xl font-mono font-black text-emerald-400">{kpis.livres}</p>
          <span className="text-[10px] text-emerald-500/80 font-bold">🟢 Prontas p/ receber</span>
        </div>

        <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Mesas Ocupadas</span>
          <p className="text-2xl font-mono font-black text-amber-400">{kpis.ocupadas}</p>
          <span className="text-[10px] text-amber-500/80 font-bold">🟠 Em consumo</span>
        </div>

        <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Aguardando Limpeza</span>
          <p className="text-2xl font-mono font-black text-teal-400">{kpis.pagas}</p>
          <span className="text-[10px] text-teal-500/80 font-bold">🔵 Contas quitadas</span>
        </div>

        <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total em Aberto</span>
          <p className="text-2xl font-mono font-black text-purple-400">R$ {kpis.totalEmAberto.toFixed(2)}</p>
          <span className="text-[10px] text-slate-500 font-mono">A receber no salão</span>
        </div>

        <div className="glass-card p-4 rounded-3xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Taxa de Ocupação</span>
          <p className="text-2xl font-mono font-black text-blue-400">{kpis.taxaOcupacao.toFixed(0)}%</p>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-400 h-full rounded-full" style={{ width: `${kpis.taxaOcupacao}%` }} />
          </div>
        </div>
      </div>

      {/* Barra de Ações Rápidas do Salão */}
      <div className="glass-card p-4 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
        
        {/* Filtros de Status */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          {[
            { id: 'todas', label: `Todas (${kpis.total})` },
            { id: 'livres', label: `🟢 Livres (${kpis.livres})` },
            { id: 'ocupadas', label: `🟠 Ocupadas (${kpis.ocupadas})` },
            { id: 'pagas', label: `🔵 Prontas (${kpis.pagas})` }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-emerald-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Botões de Ação do Mapa */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Adicionar Mesa Extra */}
          <button
            type="button"
            onClick={() => setShowExtraTableModal(true)}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
          >
            <Plus size={15} /> + Adicionar Mesa Extra
          </button>

          {/* Restaurar Posições Padrão */}
          <button
            type="button"
            onClick={handleRestaurarPadrao}
            className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            title="Reposiciona apenas as mesas livres para o layout inicial"
          >
            <RotateCcw size={14} /> Restaurar Posições
          </button>

          {/* Trocar Template de Salão */}
          <button
            type="button"
            onClick={() => {
              setSelectedTemplateToSwitch(floorSession.layoutOrigemId);
              setShowTemplateSwitchModal(true);
            }}
            className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <LayoutGrid size={14} /> Mudar Layout
          </button>

          {/* Grade Magnética */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={e => setSnapToGrid(e.target.checked)}
              className="rounded border-slate-700 accent-emerald-500"
            />
            <span>Grade (Snap 20px)</span>
          </label>

          {/* Link para Editor Admin */}
          <Link
            href="/admin/mesas"
            className="py-2.5 px-3.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            ⚙️ Editor Mestre
          </Link>
        </div>

      </div>

      {/* Canvas 2D Interativo do Salão */}
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative w-full h-[620px] bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden select-none"
        style={{
          backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        {/* Entrada / Balcão */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-center text-[10px] font-black uppercase text-slate-500 tracking-widest pointer-events-none">
          🚪 Frente de Caixa / Entrada do Salão
        </div>

        {/* Mesas Renderizadas no Canvas */}
        {mesasFiltradas.map(mesa => {
          const isSelected = selectedMesaId === mesa.id;
          const isDragging = draggingMesaId === mesa.id;
          const isMerged = !!mesa.mesaPaiId;
          const masterTable = isMerged ? floorSession.mesas.find(m => m.id === mesa.mesaPaiId) : null;

          // Status colors & styles
          let statusBg = 'bg-slate-900/90 border-slate-700';
          let badgeText = '🟢 LIVRE';
          let badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

          if (mesa.statusConsumo === 'OCUPADA_ABERTA') {
            statusBg = 'bg-amber-950/40 border-amber-500 shadow-amber-500/10 shadow-lg';
            badgeText = '🟠 EM CONSUMO';
            badgeColor = 'text-amber-400 bg-amber-500/20 border-amber-500/30';
          } else if (mesa.statusConsumo === 'PARCIALMENTE_PAGA') {
            statusBg = 'bg-purple-950/40 border-purple-500 shadow-purple-500/10 shadow-lg';
            badgeText = '🟣 PARCIAL';
            badgeColor = 'text-purple-300 bg-purple-500/20 border-purple-500/30';
          } else if (mesa.statusConsumo === 'PAGA_AGUARDANDO') {
            statusBg = 'bg-teal-950/40 border-teal-400 shadow-teal-500/20 shadow-xl animate-pulse';
            badgeText = '🔵 PAGA / LIMPAR';
            badgeColor = 'text-teal-300 bg-teal-500/20 border-teal-500/30';
          }

          if (isMerged) {
            statusBg += ' ring-2 ring-purple-400/50 border-dashed';
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
                borderRadius: mesa.formato === 'redonda' ? '9999px' : '24px'
              }}
              className={`absolute cursor-grab active:cursor-grabbing transition-shadow flex flex-col justify-between p-3 border-2 ${statusBg} ${
                isSelected ? 'ring-4 ring-emerald-500/30 scale-105 z-30' : 'z-10'
              } ${isDragging ? 'opacity-90 scale-110 z-40 shadow-2xl' : 'shadow-lg'}`}
            >
              {/* Topo do Card da Mesa */}
              <div>
                <div className="flex justify-between items-center gap-1">
                  <span className="font-black text-white text-xs tracking-tight truncate">
                    {mesa.numeroIdentificador}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-0.5">
                    <Users size={10} /> {mesa.capacidade}
                  </span>
                </div>

                {/* Badge de Status */}
                <div className="mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${badgeColor} inline-block`}>
                    {isMerged ? `🔗 Junto à ${masterTable?.numeroIdentificador || 'Pai'}` : badgeText}
                  </span>
                </div>
              </div>

              {/* Corpo com Informações Financeiras */}
              <div className="my-1 space-y-0.5 text-center">
                {mesa.statusConsumo !== 'LIVRE' && !isMerged && (
                  <div className="font-mono">
                    <span className="text-xs font-black text-white block">
                      R$ {mesa.totalConsumo.toFixed(2)}
                    </span>
                    {mesa.statusConsumo === 'PARCIALMENTE_PAGA' && (
                      <span className="text-[10px] text-purple-300 font-bold block">
                        Falta: R$ {saldoRestante.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
                {mesa.clienteNome && (
                  <p className="text-[10px] text-slate-400 truncate max-w-[90px] mx-auto">
                    {mesa.clienteNome}
                  </p>
                )}
              </div>

              {/* Botões de Ação Rápida */}
              <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap gap-1 justify-center">
                {mesa.statusConsumo === 'LIVRE' && !isMerged && (
                  <>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectTableForOrder(mesa);
                      }}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-sm"
                      title="Abrir Comanda / Lançar Pedido"
                    >
                      Lançar Pedido
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleGuardarMesa(mesa.id);
                      }}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-all"
                      title="Guardar Mesa na Gaveta Virtual"
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
                      className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold cursor-pointer"
                      title="Adicionar mais itens"
                    >
                      + Pedido
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenPaymentModal(mesa);
                      }}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-sm"
                    >
                      Pagar
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setMesaParaJuntar(mesa);
                      }}
                      className="p-1 bg-purple-950/60 hover:bg-purple-900 text-purple-300 rounded-lg cursor-pointer"
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
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-sm"
                  >
                    Quitar Saldo
                  </button>
                )}

                {mesa.statusConsumo === 'PAGA_AGUARDANDO' && !isMerged && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleLiberarMesa(mesa.id);
                    }}
                    className="px-2 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer shadow-md"
                  >
                    ✨ Liberar
                  </button>
                )}

                {isMerged && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleSepararMesa(mesa.id);
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Desvincular da mesa master"
                  >
                    <Unlink2 size={10} /> Separar
                  </button>
                )}

                {/* Botão de Histórico (Achados e Perdidos RF07) */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setMesaParaHistorico(mesa);
                  }}
                  className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer"
                  title="Ver Histórico do Turno (Achados & Perdidos)"
                >
                  <History size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: RECEBER PAGAMENTO PARCIAL OU TOTAL */}
      {mesaParaPagamento && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-fade-in space-y-5">
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <DollarSign size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Pagamento: {mesaParaPagamento.numeroIdentificador}</h3>
                <p className="text-xs text-slate-400">Amortização parcial ou quitação total da comanda.</p>
              </div>
            </div>

            {/* Extrato da Conta */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Total Consumido:</span>
                <strong className="font-mono text-white text-sm">R$ {mesaParaPagamento.totalConsumo.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Já Pago / Amortizado:</span>
                <strong className="font-mono">- R$ {(mesaParaPagamento.totalPago || 0).toFixed(2)}</strong>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                <span className="text-slate-200">Saldo Restante a Pagar:</span>
                <span className="font-mono text-amber-400">
                  R$ {Math.max(0, mesaParaPagamento.totalConsumo - (mesaParaPagamento.totalPago || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Atalhos Rápidos de Divisão da Conta */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
                Atalhos Rápidos de Amortização:
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
                    className="py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-mono font-bold border border-slate-800 cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Campo de Valor */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Valor a Receber Agora (R$):
              </label>
              <input
                type="number"
                step="0.50"
                value={valorPagamentoInput}
                onChange={e => setValorPagamentoInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-lg font-mono font-black text-emerald-400 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Forma de Pagamento */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
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
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                      metodoPagamento === m.id
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <m.icon size={15} /> {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMesaParaPagamento(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: JUNÇÃO DE MESAS (MERGE) */}
      {mesaParaJuntar && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-fade-in space-y-5">
            <div className="flex items-center gap-3 text-purple-400">
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <Link2 size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Juntar Mesas Físicas</h3>
                <p className="text-xs text-slate-400">Vincular <strong>{mesaParaJuntar.numeroIdentificador}</strong> a uma mesa Master.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-purple-950/20 p-3 rounded-xl border border-purple-500/30">
              💡 Os pedidos e o saldo a pagar serão concentrados na mesa Master. A mesa vinculada exibirá um anel conector no mapa.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Selecione a Mesa Master (Concentradora):
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {mesasNoSalao
                  .filter(m => m.id !== mesaParaJuntar.id && !m.mesaPaiId)
                  .map(other => (
                    <button
                      key={other.id}
                      type="button"
                      onClick={() => setMesaMasterAlvoId(other.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                        mesaMasterAlvoId === other.id
                          ? 'bg-purple-600 border-purple-500 text-white font-bold shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>{other.numeroIdentificador}</span>
                      <span className="text-[10px] font-mono opacity-80">
                        {other.statusConsumo}
                      </span>
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMesaParaJuntar(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!mesaMasterAlvoId}
                onClick={handleConfirmMerge}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                Unificar Mesas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: HISTÓRICO RÁPIDO DO TURNO (ACHADOS E PERDIDOS RF07) */}
      {mesaParaHistorico && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-fade-in space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 text-blue-400">
                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                  <History size={26} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Histórico do Turno (Achados & Perdidos)</h3>
                  <p className="text-xs text-slate-400">{mesaParaHistorico.numeroIdentificador} • Ocupações recentes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMesaParaHistorico(null)}
                className="text-slate-500 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              🔍 Utilize este histórico para identificar clientes que deixaram pertences ou para auditar tempos de permanência do turno.
            </p>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {!mesaParaHistorico.historicoTurno || mesaParaHistorico.historicoTurno.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Nenhum atendimento finalizado nesta mesa durante o turno atual.
                </div>
              ) : (
                mesaParaHistorico.historicoTurno.map((h, idx) => {
                  const horaEntrada = new Date(h.abertaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const horaSaida = new Date(h.fechadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={idx} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{h.clienteNome}</span>
                        <span className="font-mono text-emerald-400 font-bold">R$ {h.totalPago.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>Horário: {horaEntrada} até {horaSaida}</span>
                        <span>Atendente: {h.garcomOuOperador}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setMesaParaHistorico(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Fechar Histórico
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: ADICIONAR MESA EXTRA */}
      {showExtraTableModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-fade-in space-y-5">
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <Plus size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Adicionar Mesa Extra</h3>
                <p className="text-xs text-slate-400">Puxar mesa da gaveta virtual para o salão.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Identificador da Mesa:
              </label>
              <input
                type="text"
                value={extraTableNameInput}
                onChange={e => setExtraTableNameInput(e.target.value)}
                placeholder="Ex: Mesa Extra 07 ou Bistrô Jardim"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExtraTableModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmExtraTable}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                Colocar no Salão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: MUDAR LAYOUT DE SALÃO NO TURNO */}
      {showTemplateSwitchModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-fade-in space-y-5">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                <LayoutGrid size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Alterar Layout do Turno</h3>
                <p className="text-xs text-slate-400">Selecione o novo template para reorganizar o salão.</p>
              </div>
            </div>

            <div className="space-y-2">
              {templates.filter(t => t.ativo).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateToSwitch(t.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                    selectedTemplateToSwitch === t.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-bold shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{t.nome}</span>
                  <span className="text-[10px] font-mono">{t.items.length} mesas</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTemplateSwitchModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitchTemplate}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-600/30 cursor-pointer"
              >
                Aplicar Layout
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
