'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Sliders,
  Store,
  Layers,
  Sparkles,
  Laptop,
  Plus,
  Trash2,
  Scissors,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { useToast } from '@/components/ui';
import {
  getActiveCentralConfig,
  publishCentralConfig,
  PrinterProfile,
  ReceiptTemplateConfig,
  TerminalPrintBinding,
  DEFAULT_PRINTER_PROFILE,
  DEFAULT_RECEIPT_TEMPLATE,
  DEFAULT_TERMINAL_BINDINGS,
  CentralStoreConfig,
  getCurrentTerminalId,
  setCurrentTerminalId
} from '@/lib/central-config';
import { renderKitchenTicketHtml, renderClientReceiptHtml } from '@/lib/print-service';
import { printThermalHtml } from '@/lib/thermal-printer';
import { Sale } from '@/lib/store/types';

// Exemplo representativo de pedido para prévia da comanda
const SAMPLE_PREVIEW_SALE: Sale = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  date: new Date().toISOString(),
  channel: 'balcao',
  orderType: 'retirada',
  customerName: 'CARLOS SILVA',
  paymentMethod: 'pix',
  status: 'completed',
  productionStatus: 'em_producao',
  items: [
    {
      id: 'item-preview-1',
      productId: 'prod-arg',
      productName: 'Hambúrguer Argentina',
      quantity: 2,
      unitPrice: 34.00,
      meatPoint: 'ao ponto',
      combo: 'Combo Batata Pequena + Refrigerante',
      additionals: [{ name: 'Bacon Extra', quantity: 2, unitPrice: 4.00, price: 4.00 }],
      removals: ['Cebola Roxa'],
      notes: 'CAPRICHO NO MOLHO DA CASA',
    },
    {
      id: 'item-preview-2',
      productId: 'prod-fries',
      productName: 'Batata Rústica 150g',
      quantity: 1,
      unitPrice: 16.00,
      notes: 'BEM SEQUINHA',
    }
  ],
  subtotal: 92.00,
  discount: 5.00,
  deliveryFee: 0,
  total: 87.00,
};

export default function ConfiguracoesImpressaoPage() {
  const { notify } = useToast();
  const [config, setConfig] = useState<CentralStoreConfig | null>(null);
  const [previewTab, setPreviewTab] = useState<'cozinha' | 'cliente'>('cozinha');
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados locais do formulário de edição
  const [profile, setProfile] = useState<PrinterProfile>(DEFAULT_PRINTER_PROFILE);
  const [template, setTemplate] = useState<ReceiptTemplateConfig>(DEFAULT_RECEIPT_TEMPLATE);
  const [terminalBindings, setTerminalBindings] = useState<TerminalPrintBinding[]>(DEFAULT_TERMINAL_BINDINGS);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('caixa-01');

  // Novo terminal temporário
  const [newTerminalId, setNewTerminalId] = useState('');
  const [newTerminalName, setNewTerminalName] = useState('');
  const [isAddingTerminal, setIsAddingTerminal] = useState(false);

  // Carrega configurações centrais ativas
  useEffect(() => {
    const active = getActiveCentralConfig();
    setConfig(active);
    if (active.printerProfile) setProfile(active.printerProfile);
    if (active.receiptTemplate) setTemplate(active.receiptTemplate);
    if (active.terminalBindings && active.terminalBindings.length > 0) {
      setTerminalBindings(active.terminalBindings);
    }
    setActiveTerminalId(getCurrentTerminalId());
  }, []);

  // Altera largura de papel sincronizando largura útil e colunas sugeridas
  const handlePaperWidthChange = (paperWidth: '80mm' | '58mm') => {
    setProfile(prev => ({
      ...prev,
      paperWidth,
      printableWidthMm: paperWidth === '58mm' ? 48 : 72,
      columnsCount: paperWidth === '58mm' ? 32 : 48,
    }));
  };

  // Define o terminal deste dispositivo
  const handleSetCurrentDeviceTerminal = (termId: string) => {
    setCurrentTerminalId(termId);
    setActiveTerminalId(termId);
    notify({
      title: 'Terminal Identificado',
      description: `Este navegador está operando como "${termId}".`,
      tone: 'info',
    });
  };

  // Adicionar novo vínculo de terminal
  const handleAddTerminalBinding = () => {
    if (!newTerminalId.trim()) return;
    const cleanId = newTerminalId.trim().toLowerCase().replace(/\s+/g, '-');
    if (terminalBindings.some(t => t.terminalId === cleanId)) {
      notify({
        title: 'Terminal já cadastrado',
        description: `O identificador "${cleanId}" já está na lista.`,
        tone: 'danger',
      });
      return;
    }

    const newBinding: TerminalPrintBinding = {
      terminalId: cleanId,
      terminalName: newTerminalName.trim() || `Terminal ${cleanId}`,
      kitchenPrinterTarget: 'padrao_sistema',
      clientPrinterTarget: 'padrao_sistema',
      autoPrintKitchen: false,
      autoPrintClient: false,
      updatedAt: new Date().toISOString(),
    };

    setTerminalBindings(prev => [...prev, newBinding]);
    setNewTerminalId('');
    setNewTerminalName('');
    setIsAddingTerminal(false);
    notify({
      title: 'Terminal adicionado',
      description: `Terminal "${cleanId}" cadastrado com sucesso.`,
      tone: 'success',
    });
  };

  // Remover vínculo de terminal
  const handleRemoveTerminalBinding = (terminalIdToRemove: string) => {
    if (terminalBindings.length <= 1) {
      notify({
        title: 'Ação não permitida',
        description: 'Mantenha pelo menos um terminal cadastrado no sistema.',
        tone: 'warning',
      });
      return;
    }
    setTerminalBindings(prev => prev.filter(t => t.terminalId !== terminalIdToRemove));
  };

  // Atualizar campo de um terminal específico
  const handleUpdateTerminalBinding = (terminalId: string, updates: Partial<TerminalPrintBinding>) => {
    setTerminalBindings(prev =>
      prev.map(t => (t.terminalId === terminalId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
    );
  };

  // Pré-visualização HTML calculada dinamicamente
  const previewHtml = useMemo(() => {
    if (previewTab === 'cozinha') {
      const sampleTicketData = {
        header: {
          customerName: SAMPLE_PREVIEW_SALE.customerName || 'CLIENTE',
          orderIdShort: `#${SAMPLE_PREVIEW_SALE.id.slice(0, 6).toUpperCase()}`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString('pt-BR'),
          channel: (SAMPLE_PREVIEW_SALE.channel || 'BALCAO').toUpperCase(),
          orderType: SAMPLE_PREVIEW_SALE.orderType,
        },
        items: [
          {
            id: 'p-1',
            quantity: 2,
            productName: 'Hambúrguer Argentina',
            pattiesComposition: '2x Costela 180g',
            meatPoint: 'ao ponto',
            comboInfo: {
              label: 'Combo: 1 batata pequena + refrigerante',
              fryerItem: '1 batata pequena',
              drinkItem: 'refrigerante',
            },
            additionals: [{ name: 'Bacon Extra', quantity: 2, label: 'ADICIONAR: 1 Bacon Extra (por lanche)' }],
            removals: ['Cebola Roxa'],
            notes: 'CAPRICHO NO MOLHO DA CASA',
            recipeIngredients: template.showMontagem ? ['Pão Brioche', 'Maionese Verde', 'Queijo Cheddar'] : undefined,
            rawItem: SAMPLE_PREVIEW_SALE.items[0],
          },
          {
            id: 'p-2',
            quantity: 1,
            productName: 'Batata Rústica 150g',
            additionals: [],
            removals: [],
            notes: 'BEM SEQUINHA',
            rawItem: SAMPLE_PREVIEW_SALE.items[1],
          }
        ],
        productionSummary: {
          chapa: {
            totalPatties: 2,
            pattiesLabel: '2 HAMBÚRGUERES',
            pattiesBreakdown: [{ label: '2x Costela 180g', count: 2 }],
            otherItems: [{ label: '2x Bacon Extra', count: 2 }],
            status: 'ok' as const,
          },
          fritadeira: {
            totalPreparos: 3,
            preparosLabel: '3 PREPAROS',
            items: [
              { label: '2x Batata pequena (combo)', count: 2 },
              { label: '1x Batata Rústica 150g', count: 1 }
            ],
            status: 'ok' as const,
          },
          isComplete: true,
        },
      };

      return renderKitchenTicketHtml(sampleTicketData, {
        template,
        profile,
      });
    } else {
      return renderClientReceiptHtml(SAMPLE_PREVIEW_SALE, {
        template,
        profile,
      });
    }
  }, [previewTab, template, profile]);

  // Imprimir teste físico na impressora conectada
  const handlePrintTest = async () => {
    if (isPrintingTest) return;
    setIsPrintingTest(true);
    try {
      const ok = await printThermalHtml(previewHtml, {
        title: `Teste de Impressão (${profile.paperWidth}) - ${template.storeName}`,
        printerProfile: profile,
      });

      if (ok) {
        notify({
          title: 'Teste Enviado!',
          description: `Comprovante de teste de ${profile.paperWidth} enviado para o spooler de impressão.`,
          tone: 'success',
        });
      } else {
        notify({
          title: 'Aviso de Impressão',
          description: 'Não foi possível disparar o diálogo de impressão.',
          tone: 'warning',
        });
      }
    } catch (err: any) {
      notify({
        title: 'Erro de Impressão',
        description: err?.message || 'Falha ao disparar impressão de teste.',
        tone: 'danger',
      });
    } finally {
      setIsPrintingTest(false);
    }
  };

  // Salvar e publicar configurações com controle de versão
  const handleSaveAndPublish = () => {
    setIsSaving(true);
    try {
      const updated = publishCentralConfig(
        {
          printerProfile: profile,
          receiptTemplate: template,
          terminalBindings,
        },
        'Gestor de Impressão'
      );
      setConfig(updated);
      notify({
        title: 'Configurações Publicadas!',
        description: `Perfil de comanda atualizado para versão v${updated.version}. Todos os terminais usarão este padrão.`,
        tone: 'success',
      });
    } catch (err: any) {
      notify({
        title: 'Falha ao Salvar',
        description: err?.message || 'Não foi possível salvar as configurações de impressão.',
        tone: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Restaurar padrões de fábrica
  const handleResetDefaults = () => {
    setProfile(DEFAULT_PRINTER_PROFILE);
    setTemplate(DEFAULT_RECEIPT_TEMPLATE);
    setTerminalBindings(DEFAULT_TERMINAL_BINDINGS);
    notify({
      title: 'Padrões Restaurados',
      description: 'Valores resetados para as configurações recomendadas. Clique em "Publicar Alterações" para gravar.',
      tone: 'info',
    });
  };

  if (!config) {
    return (
      <div className="p-8 text-center text-text-muted">
        Carregando configurações de impressão...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-default pb-4">
        <div>
          <div className="flex items-center gap-2 text-brand-primary">
            <Printer size={26} />
            <h1 className="text-2xl font-black text-text-primary">Impressão e Comanda</h1>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Configure o perfil físico da bobina térmica (80mm vs 58mm), o layout das vias e a impressão direta por terminal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 bg-surface-elevated hover:bg-surface-elevated/80 text-text-secondary border border-border-default rounded-control text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Restaurar valores de fábrica"
          >
            <RotateCcw size={14} /> Restaurar Padrões
          </button>

          <button
            type="button"
            onClick={handlePrintTest}
            disabled={isPrintingTest}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-control text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Printer size={15} className={isPrintingTest ? 'animate-spin' : ''} />
            {isPrintingTest ? 'Enviando...' : 'Imprimir Teste'}
          </button>

          <button
            type="button"
            onClick={handleSaveAndPublish}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-control text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={15} />
            {isSaving ? 'Publicando...' : 'Publicar Alterações'}
          </button>
        </div>
      </div>

      {/* Grid Principal: Configuração à Esquerda, Prévia à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna de Configurações (7 colunas no desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Seção 1: Perfil da Impressora & Bobina */}
          <div className="bg-surface-card border border-border-default rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm border-b border-border-default pb-2">
              <Sliders size={18} className="text-amber-400" />
              <span>Perfil Físico da Bobina Térmica</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Largura do Papel
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePaperWidthChange('80mm')}
                    className={`py-2 px-3 rounded-control text-xs font-bold border transition-all cursor-pointer ${
                      profile.paperWidth === '80mm'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-surface-elevated border-border-default text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    80 mm (Padrão)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaperWidthChange('58mm')}
                    className={`py-2 px-3 rounded-control text-xs font-bold border transition-all cursor-pointer ${
                      profile.paperWidth === '58mm'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-surface-elevated border-border-default text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    58 mm (Estreito)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Largura Útil de Impressão (mm)
                </label>
                <input
                  type="number"
                  min="40"
                  max="80"
                  value={profile.printableWidthMm}
                  onChange={(e) => setProfile(prev => ({ ...prev, printableWidthMm: Number(e.target.value) || 72 }))}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs font-mono text-text-primary focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[11px] text-text-muted mt-0.5 block">
                  Recomendado: 72 mm para bobinas de 80mm; 48 mm para 58mm.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border-default">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Escala da Tipografia
                </label>
                <select
                  value={profile.fontSizeScale}
                  onChange={(e) => setProfile(prev => ({ ...prev, fontSizeScale: e.target.value as any }))}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs text-text-primary focus:border-amber-400 focus:outline-none"
                >
                  <option value="compact">Compacta (Economia)</option>
                  <option value="normal">Normal (Recomendada)</option>
                  <option value="large">Grande (Alta Visibilidade)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Colunas de Texto
                </label>
                <select
                  value={profile.columnsCount || 48}
                  onChange={(e) => setProfile(prev => ({ ...prev, columnsCount: Number(e.target.value) as any }))}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs text-text-primary focus:border-amber-400 focus:outline-none"
                >
                  <option value={32}>32 Colunas (58mm)</option>
                  <option value={42}>42 Colunas (80mm Font B)</option>
                  <option value={48}>48 Colunas (80mm Font A)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Respiro de Guilhotina (Linhas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={profile.feedLines}
                  onChange={(e) => setProfile(prev => ({ ...prev, feedLines: Number(e.target.value) || 4 }))}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs font-mono text-text-primary focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Controle de Guilhotina Automática */}
            <div className="pt-2 border-t border-border-default flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.autoCut ?? true}
                  onChange={(e) => setProfile(prev => ({ ...prev, autoCut: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-border-default focus:ring-amber-400 cursor-pointer"
                />
                <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Scissors size={14} className="text-amber-400" />
                  Acionar Guilhotina Automática ao Finalizar
                </span>
              </label>

              {profile.autoCut && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Tipo de corte:</span>
                  <select
                    value={profile.cutType || 'partial'}
                    onChange={(e) => setProfile(prev => ({ ...prev, cutType: e.target.value as any }))}
                    className="bg-surface-elevated border border-border-default rounded-control px-2 py-1 text-xs text-text-primary focus:border-amber-400 focus:outline-none"
                  >
                    <option value="partial">Corte Parcial (com lingueta)</option>
                    <option value="full">Corte Total (desprende)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Seção 2: Layout da Comanda da Cozinha / Produção */}
          <div className="bg-surface-card border border-border-default rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-default pb-2">
              <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                <Layers size={18} className="text-emerald-400" />
                <span>Via da Cozinha / Produção</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <ShieldCheck size={12} /> Sigilo Financeiro Garantido
              </span>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-surface-elevated rounded-2xl border border-border-default cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-text-primary block">
                    Exibir Detalhes da Montagem (Receita / Insumos)
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Lista ingredientes de montagem da ficha técnica abaixo do hambúrguer.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={template.showMontagem}
                  onChange={(e) => setTemplate(prev => ({ ...prev, showMontagem: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-border-default focus:ring-amber-400 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-surface-elevated rounded-2xl border border-border-default cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-text-primary block">
                    Exibir Resumo de Produção no Rodapé (Chapa e Fritadeira)
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Agrupa a contagem consolidada de hambúrgueres e preparos de fritura.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={template.showStationSummary}
                  onChange={(e) => setTemplate(prev => ({ ...prev, showStationSummary: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-border-default focus:ring-amber-400 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-surface-elevated rounded-2xl border border-border-default cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-text-primary block">
                    Destacar Observações e Retiradas em Negrito / Linhas Solitárias
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Facilita a leitura imediata pelo chapeiro para evitar erros em alergias ou preferências.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={template.highlightRemovals}
                  onChange={(e) => setTemplate(prev => ({ ...prev, highlightRemovals: e.target.checked, highlightNotes: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-border-default focus:ring-amber-400 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-surface-elevated rounded-2xl border border-border-default cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-text-primary block">
                    Imprimir Cozinha Automaticamente ao Finalizar Venda
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Dispara o trabalho de impressão da comanda imediatamente após o checkout, sem exigir clique.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={template.autoPrintOnFinish}
                  onChange={(e) => setTemplate(prev => ({ ...prev, autoPrintOnFinish: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-border-default focus:ring-amber-400 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Seção 3: Comprovante de Conferência do Cliente */}
          <div className="bg-surface-card border border-border-default rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm border-b border-border-default pb-2">
              <Store size={18} className="text-blue-400" />
              <span>Via do Cliente & Dados Fiscais</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Nome do Estabelecimento
                </label>
                <input
                  type="text"
                  value={template.storeName}
                  onChange={(e) => setTemplate(prev => ({ ...prev, storeName: e.target.value }))}
                  maxLength={60}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs text-text-primary focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={template.storeCnpj}
                  onChange={(e) => setTemplate(prev => ({ ...prev, storeCnpj: e.target.value }))}
                  maxLength={25}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs font-mono text-text-primary focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Inscrição Estadual (IE)
                </label>
                <input
                  type="text"
                  value={template.storeIe || ''}
                  onChange={(e) => setTemplate(prev => ({ ...prev, storeIe: e.target.value }))}
                  placeholder="Ex: 123.456.789.110"
                  maxLength={25}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs font-mono text-text-primary focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-default">
              <label className="flex items-center gap-2 p-2 bg-surface-elevated rounded-xl border border-border-default cursor-pointer">
                <input
                  type="checkbox"
                  checked={template.showFiscalData ?? true}
                  onChange={(e) => setTemplate(prev => ({ ...prev, showFiscalData: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-border-default focus:ring-blue-400 cursor-pointer"
                />
                <span className="text-xs font-semibold text-text-primary">
                  Exibir Cabeçalho Fiscal (CNPJ / IE)
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-surface-elevated rounded-xl border border-border-default cursor-pointer">
                <input
                  type="checkbox"
                  checked={template.showTaxDetails ?? true}
                  onChange={(e) => setTemplate(prev => ({ ...prev, showTaxDetails: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-border-default focus:ring-blue-400 cursor-pointer"
                />
                <span className="text-xs font-semibold text-text-primary">
                  Detalhamento de Tributos (Lei 12.741/12)
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-surface-elevated rounded-xl border border-border-default cursor-pointer">
                <input
                  type="checkbox"
                  checked={template.showQrCodePlaceholder ?? true}
                  onChange={(e) => setTemplate(prev => ({ ...prev, showQrCodePlaceholder: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-border-default focus:ring-blue-400 cursor-pointer"
                />
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <QrCode size={14} className="text-blue-400" />
                  Chave de Acesso / QR Code Eletrônico
                </span>
              </label>
            </div>

            <div className="pt-2 border-t border-border-default">
              <label className="text-xs font-semibold text-text-secondary block mb-1">
                Mensagem de Rodapé do Cupom
              </label>
              <textarea
                rows={2}
                value={template.receiptFooterMessage || ''}
                onChange={(e) => setTemplate(prev => ({ ...prev, receiptFooterMessage: e.target.value }))}
                placeholder="Ex: OBRIGADO PELA PREFERÊNCIA! VOLTE SEMPRE! 🍔"
                className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs text-text-primary focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Seção 4: Vínculo de Terminais (terminal_print_binding) */}
          <div className="bg-surface-card border border-border-default rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-default pb-2">
              <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                <Laptop size={18} className="text-purple-400" />
                <span>Mapeamento de Terminais & Pontos de Venda</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted">Este aparelho:</span>
                <span className="font-mono font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {activeTerminalId}
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted">
              Vincule cada terminal (caixa, tablet de salão, totem) às impressoras de destino e defina o comportamento de auto-impressão.
            </p>

            <div className="space-y-3">
              {terminalBindings.map((binding) => {
                const isCurrent = binding.terminalId === activeTerminalId;
                return (
                  <div
                    key={binding.terminalId}
                    className={`p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-purple-950/20 border-purple-500/40'
                        : 'bg-surface-elevated border-border-default'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-text-primary bg-slate-900 px-2 py-1 rounded">
                          {binding.terminalId}
                        </span>
                        <input
                          type="text"
                          value={binding.terminalName}
                          onChange={(e) => handleUpdateTerminalBinding(binding.terminalId, { terminalName: e.target.value })}
                          className="bg-transparent border-b border-border-default hover:border-border-strong text-xs font-semibold text-text-primary px-1 py-0.5 outline-none"
                        />
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            Dispositivo Atual
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleSetCurrentDeviceTerminal(binding.terminalId)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded text-[11px] font-bold cursor-pointer"
                          >
                            Usar Neste Aparelho
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveTerminalBinding(binding.terminalId)}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                          title="Excluir terminal"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-border-default/60">
                      <div>
                        <label className="text-[11px] font-semibold text-text-secondary block mb-1">
                          Impressora da Cozinha
                        </label>
                        <select
                          value={binding.kitchenPrinterTarget}
                          onChange={(e) => handleUpdateTerminalBinding(binding.terminalId, { kitchenPrinterTarget: e.target.value })}
                          className="w-full bg-slate-950 border border-border-default rounded-control px-2 py-1.5 text-xs text-text-primary focus:border-purple-400 outline-none"
                        >
                          <option value="padrao_sistema">Padrão do Sistema (Navegador)</option>
                          <option value="rede_chapa">Rede / IP Chapa (Cozinha)</option>
                          <option value="rede_fritadeira">Rede / IP Fritadeira</option>
                          <option value="usb_local">USB Local Integrada</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-text-secondary block mb-1">
                          Impressora do Cupom Cliente
                        </label>
                        <select
                          value={binding.clientPrinterTarget}
                          onChange={(e) => handleUpdateTerminalBinding(binding.terminalId, { clientPrinterTarget: e.target.value })}
                          className="w-full bg-slate-950 border border-border-default rounded-control px-2 py-1.5 text-xs text-text-primary focus:border-purple-400 outline-none"
                        >
                          <option value="padrao_sistema">Padrão do Sistema (Navegador)</option>
                          <option value="usb_balcao">USB Térmica Balcão</option>
                          <option value="rede_balcao">Rede Balcão</option>
                          <option value="nenhuma">Não imprimir via do cliente</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isAddingTerminal ? (
                <div className="p-3 bg-surface-elevated rounded-2xl border border-dashed border-purple-500/40 space-y-3">
                  <div className="text-xs font-bold text-purple-300">Novo Terminal</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Identificador (ex: tablet-salao-01)"
                      value={newTerminalId}
                      onChange={(e) => setNewTerminalId(e.target.value)}
                      className="bg-slate-950 border border-border-default rounded-control px-3 py-1.5 text-xs text-text-primary outline-none font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Nome amigável (ex: Tablet Garçom Salão)"
                      value={newTerminalName}
                      onChange={(e) => setNewTerminalName(e.target.value)}
                      className="bg-slate-950 border border-border-default rounded-control px-3 py-1.5 text-xs text-text-primary outline-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsAddingTerminal(false)}
                      className="px-3 py-1 bg-surface-elevated hover:bg-surface-elevated/80 text-text-secondary rounded text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTerminalBinding}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      Salvar Terminal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTerminal(true)}
                  className="w-full py-2 border border-dashed border-border-strong hover:border-purple-400 rounded-xl text-xs font-bold text-purple-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Cadastrar Outro Terminal na Rede
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Pré-visualização Interativa (5 colunas) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
              <Eye size={16} className="text-brand-primary" />
              <span>Prévia da Bobina em Tempo Real</span>
            </div>

            <div className="flex gap-1 bg-surface-elevated p-1 rounded-control border border-border-default">
              <button
                type="button"
                onClick={() => setPreviewTab('cozinha')}
                className={`px-3 py-1 rounded-control text-xs font-bold transition-all cursor-pointer ${
                  previewTab === 'cozinha'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Chapa / Cozinha
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('cliente')}
                className={`px-3 py-1 rounded-control text-xs font-bold transition-all cursor-pointer ${
                  previewTab === 'cliente'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Cliente
              </button>
            </div>
          </div>

          {/* Bobina Simulada */}
          <div className="bg-slate-950/70 p-4 rounded-3xl border border-border-default flex justify-center">
            <div
              style={{
                width: profile.paperWidth === '58mm' ? '240px' : '300px',
                minHeight: '380px',
              }}
              className="bg-white text-black p-4 rounded-xl shadow-2xl border-2 border-slate-300 font-sans transition-all overflow-hidden"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>

          <div className="text-center text-[11px] text-text-muted">
            Largura simulada: <b>{profile.paperWidth}</b> ({profile.printableWidthMm} mm útil) • Linhas extras: {profile.feedLines} • Guilhotina: {profile.autoCut ? (profile.cutType === 'full' ? 'Corte Total' : 'Corte Parcial') : 'Manual'}
          </div>
        </div>
      </div>
    </div>
  );
}
