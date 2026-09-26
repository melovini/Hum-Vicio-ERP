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
  Sparkles
} from 'lucide-react';
import { useToast } from '@/components/ui';
import {
  getActiveCentralConfig,
  publishCentralConfig,
  PrinterProfile,
  ReceiptTemplateConfig,
  DEFAULT_PRINTER_PROFILE,
  DEFAULT_RECEIPT_TEMPLATE,
  CentralStoreConfig
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

  // Carrega configurações centrais ativas
  useEffect(() => {
    const active = getActiveCentralConfig();
    setConfig(active);
    if (active.printerProfile) setProfile(active.printerProfile);
    if (active.receiptTemplate) setTemplate(active.receiptTemplate);
  }, []);

  // Altera largura de papel sincronizando largura útil sugerida
  const handlePaperWidthChange = (paperWidth: '80mm' | '58mm') => {
    setProfile(prev => ({
      ...prev,
      paperWidth,
      printableWidthMm: paperWidth === '58mm' ? 48 : 72,
    }));
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
    notify({
      title: 'Padrões Restaurados',
      description: 'Valores resetados para as configurações recomendadas (80mm com 72mm útil). Clique em "Publicar" para gravar.',
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
            Configure o perfil físico da bobina térmica (80mm vs 58mm), o layout das vias e a impressão direta por 1 botão.
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-default">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Escala da Tipografia
                </label>
                <select
                  value={profile.fontSizeScale}
                  onChange={(e) => setProfile(prev => ({ ...prev, fontSizeScale: e.target.value as any }))}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs text-text-primary focus:border-amber-400 focus:outline-none"
                >
                  <option value="compact">Compacta (Economia de Papel)</option>
                  <option value="normal">Normal (Recomendada)</option>
                  <option value="large">Grande (Alta Visibilidade)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Respiro de Guilhotina (Linhas Extras de Corte)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={profile.feedLines}
                  onChange={(e) => setProfile(prev => ({ ...prev, feedLines: Number(e.target.value) || 4 }))}
                  className="w-full bg-surface-elevated border border-border-default rounded-control px-3 py-2 text-xs font-mono text-text-primary focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[11px] text-text-muted mt-0.5 block">
                  Evita que a guilhotina corte a última linha do resumo.
                </span>
              </div>
            </div>
          </div>

          {/* Seção 2: Opções de Apresentação da Comanda */}
          <div className="bg-surface-card border border-border-default rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm border-b border-border-default pb-2">
              <Layers size={18} className="text-emerald-400" />
              <span>Conteúdo e Apresentação do Cupom</span>
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

          {/* Seção 3: Identidade do Estabelecimento */}
          <div className="bg-surface-card border border-border-default rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm border-b border-border-default pb-2">
              <Store size={18} className="text-blue-400" />
              <span>Identidade Comercial do Estabelecimento</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Nome Fantasia / Razão Social
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
            Largura simulada: <b>{profile.paperWidth}</b> ({profile.printableWidthMm} mm útil) • Linhas extras: {profile.feedLines}
          </div>
        </div>
      </div>
    </div>
  );
}
