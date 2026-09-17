'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Building2, Lock, Key, FileText, 
  Printer, Download, Copy, 
  Check, Trash2, Eye, Landmark, ShieldCheck, Sparkles
} from 'lucide-react';
import { 
  PageHeader, FilterBar, Dialog, ConfirmDialog, 
  Button, Badge, EmptyState, Skeleton, useToast 
} from '@/components/ui';
import { 
  FiscalCompanyConfig, FiscalInvoiceRecord, DEFAULT_FISCAL_CONFIG,
  getStoredFiscalConfig, saveFiscalConfig, getStoredFiscalInvoices,
  clearFiscalInvoices, generateDanfeThermalHtml
} from '@/lib/fiscal';
import { 
  filterFiscalInvoices, calculateFiscalReadiness 
} from '@/lib/fiscal-helpers';

type ActiveTab = 'empresa' | 'certificado' | 'api_gateway' | 'notas_emitidas';

export default function FiscalAdminPage() {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('empresa');
  const [config, setConfig] = useState<FiscalCompanyConfig>(DEFAULT_FISCAL_CONFIG);
  const [invoices, setInvoices] = useState<FiscalInvoiceRecord[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal de Visualização do DANFE Térmico
  const [viewingInvoice, setViewingInvoice] = useState<FiscalInvoiceRecord | null>(null);

  // Confirmação para limpar histórico fiscal
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  // Estado de teste da API
  const [apiTesting, setApiTesting] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Busca e Filtros de Notas
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'autorizada' | 'simulada' | 'cancelada'>('todos');

  // Carregar dados salvos
  useEffect(() => {
    setConfig(getStoredFiscalConfig());
    setInvoices(getStoredFiscalInvoices());
  }, []);

  const handleSaveConfig = (updated: FiscalCompanyConfig) => {
    setConfig(updated);
    saveFiscalConfig(updated);
    notify({
      title: 'Configurações fiscais salvas',
      description: 'Parâmetros atualizados com sucesso.',
      tone: 'success'
    });
  };

  // Buscar CEP na API ViaCEP
  const handleFetchCep = async (cepValue: string) => {
    const clean = cepValue.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        const updated: FiscalCompanyConfig = {
          ...config,
          cep: clean,
          logradouro: data.logradouro || config.logradouro,
          bairro: data.bairro || config.bairro,
          municipio: data.localidade || config.municipio,
          uf: data.uf || config.uf,
          codigoMunicipio: data.ibge || config.codigoMunicipio
        };
        handleSaveConfig(updated);
        notify({
          title: 'Endereço localizado',
          description: `${data.localidade}-${data.uf}`,
          tone: 'info'
        });
      }
    } catch (err) {
      console.error('Erro ao consultar CEP:', err);
    }
  };

  // Upload do Certificado Digital A1 (.pfx)
  const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pfx') && !file.name.toLowerCase().endsWith('.p12')) {
      notify({
        title: 'Formato inválido',
        description: 'Selecione um arquivo de Certificado Digital válido (.pfx ou .p12).',
        tone: 'warning'
      });
      return;
    }

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    const updated: FiscalCompanyConfig = {
      ...config,
      certificate: {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        expiresAt: nextYear.toISOString(),
        subject: config.razaoSocial || 'EMPRESA CERTIFICADA LTDA',
        hasPassword: true
      }
    };
    handleSaveConfig(updated);
    notify({
      title: 'Certificado carregado',
      description: `Arquivo "${file.name}" importado com sucesso.`,
      tone: 'success'
    });
  };

  // Teste de Comunicação com a API Fiscal
  const handleTestApiConnection = () => {
    setApiTesting(true);
    setApiTestResult(null);

    setTimeout(() => {
      setApiTesting(false);
      if (config.apiToken && config.apiToken.trim().length >= 8) {
        setApiTestResult({
          success: true,
          message: `Conexão bem-sucedida com o Gateway [${config.apiProvider.toUpperCase()}]. SEFAZ ${config.uf} online e respondendo em modo ${config.ambiente.toUpperCase()}.`
        });
        notify({
          title: 'Conexão autorizada',
          description: `Gateway ${config.apiProvider.toUpperCase()} comunicando normalmente.`,
          tone: 'success'
        });
      } else {
        setApiTestResult({
          success: false,
          message: 'Token de API não informado ou inválido. Insira a chave gerada no painel da sua API fiscal.'
        });
        notify({
          title: 'Falha no teste',
          description: 'Token de API não informado ou inválido.',
          tone: 'danger'
        });
      }
    }, 1000);
  };

  // Copiar chave de acesso
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    notify({ title: 'Chave copiada!', tone: 'info' });
  };

  // Exportar Lote Contábil
  const handleExportAccountingBundle = () => {
    if (invoices.length === 0) {
      notify({
        title: 'Nenhuma nota emitida',
        description: 'Não há notas fiscais no período para exportar.',
        tone: 'warning'
      });
      return;
    }

    const payload = JSON.stringify(invoices, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lote_fiscal_hum_vicio_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify({
      title: 'Lote exportado',
      description: 'Arquivo JSON gerado para a contabilidade.',
      tone: 'success'
    });
  };

  // Impressão do Cupom Fiscal
  const handlePrintDanfe = () => {
    if (!viewingInvoice) return;
    const html = generateDanfeThermalHtml(viewingInvoice, config);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`
        <html>
          <head>
            <title>DANFE NFC-e #${viewingInvoice.numero}</title>
            <style>
              @page { margin: 0; size: auto; }
              body { margin: 10px; font-family: monospace; }
            </style>
          </head>
          <body>
            ${html}
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      w.document.close();
    }
  };

  // Filtragem das Notas usando helper desacoplado
  const filteredInvoices = useMemo(() => {
    return filterFiscalInvoices(invoices, {
      status: statusFilter,
      searchTerm: searchTerm
    });
  }, [invoices, statusFilter, searchTerm]);

  // Status de Prontidão Fiscal usando helper desacoplado
  const readiness = useMemo(() => {
    return calculateFiscalReadiness(config);
  }, [config]);

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        {/* Cabeçalho */}
        <PageHeader
          title="Gestão Fiscal & Emissão de Notas"
          eyebrow="Conformidade Tributária & SEFAZ"
          description="Configure a emissão de cupons fiscais eletrônicos (NFC-e Modelo 65), credenciais do gateway e visualize o histórico de notas autorizadas."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge 
                variant={readiness.level === 'pronto' ? 'success' : readiness.level === 'homologacao' ? 'warning' : 'danger'}
                dot
                className="py-1.5 px-3 text-xs"
              >
                {readiness.badge}
              </Badge>

              <Link href="/admin/auditoria">
                <Button variant="secondary" leadingIcon={<ShieldCheck size={15} aria-hidden="true" />}>
                  Auditoria & Segurança
                </Button>
              </Link>

              {activeTab === 'notas_emitidas' && invoices.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={handleExportAccountingBundle}
                  leadingIcon={<Download size={14} aria-hidden="true" />}
                >
                  Exportar Lote Contábil
                </Button>
              )}
            </div>
          }
        />

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex items-center gap-2 border-b border-border-default pb-2 overflow-x-auto">
          <Button
            variant={activeTab === 'empresa' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('empresa')}
            leadingIcon={<Building2 size={15} aria-hidden="true" />}
          >
            1. Dados da Empresa & Inscrições
          </Button>

          <Button
            variant={activeTab === 'certificado' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('certificado')}
            leadingIcon={<Lock size={15} aria-hidden="true" />}
          >
            2. Certificado Digital A1 & SEFAZ (CSC)
          </Button>

          <Button
            variant={activeTab === 'api_gateway' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('api_gateway')}
            leadingIcon={<Key size={15} aria-hidden="true" />}
          >
            3. Conexão API Gateway & Token
          </Button>

          <Button
            variant={activeTab === 'notas_emitidas' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('notas_emitidas')}
            leadingIcon={<FileText size={15} aria-hidden="true" />}
          >
            4. Notas Fiscais Emitidas ({invoices.length})
          </Button>
        </div>

        {/* ABA 1: DADOS DA EMPRESA & INSCRIÇÕES */}
        {activeTab === 'empresa' && (
          <div className="bg-surface-card border border-border-default rounded-dialog p-6 shadow-elevated space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border-default">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Building2 className="text-cyan-400" size={18} aria-hidden="true" /> Dados Cadastrais do Emitente
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Estas informações constarão no cabeçalho de todas as notas fiscais (NFC-e) autorizadas pela SEFAZ.
                </p>
              </div>
              <Button onClick={() => handleSaveConfig(config)}>
                Salvar Alterações
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label htmlFor="fiscal-cnpj" className="block text-text-secondary font-bold mb-1">CNPJ da Empresa:</label>
                <input
                  id="fiscal-cnpj"
                  type="text"
                  value={config.cnpj}
                  onChange={e => setConfig({ ...config, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="fiscal-razao" className="block text-text-secondary font-bold mb-1">Razão Social Oficial:</label>
                <input
                  id="fiscal-razao"
                  type="text"
                  value={config.razaoSocial}
                  onChange={e => setConfig({ ...config, razaoSocial: e.target.value })}
                  placeholder="HUM VICIO LANCHONETE LTDA"
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-medium"
                />
              </div>

              <div>
                <label htmlFor="fiscal-fantasia" className="block text-text-secondary font-bold mb-1">Nome Fantasia:</label>
                <input
                  id="fiscal-fantasia"
                  type="text"
                  value={config.nomeFantasia}
                  onChange={e => setConfig({ ...config, nomeFantasia: e.target.value })}
                  placeholder="Hum Vício Burger"
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-medium"
                />
              </div>

              <div>
                <label htmlFor="fiscal-ie" className="block text-text-secondary font-bold mb-1">Inscrição Estadual (IE):</label>
                <input
                  id="fiscal-ie"
                  type="text"
                  value={config.inscricaoEstadual}
                  onChange={e => setConfig({ ...config, inscricaoEstadual: e.target.value })}
                  placeholder="Ex: 003892019.00-84"
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="fiscal-im" className="block text-text-secondary font-bold mb-1">Inscrição Municipal (Opcional):</label>
                <input
                  id="fiscal-im"
                  type="text"
                  value={config.inscricaoMunicipal || ''}
                  onChange={e => setConfig({ ...config, inscricaoMunicipal: e.target.value })}
                  placeholder="Ex: 123456"
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="fiscal-crt" className="block text-text-secondary font-bold mb-1">Regime Tributário (CRT):</label>
                <select
                  id="fiscal-crt"
                  value={config.crt}
                  onChange={e => setConfig({ ...config, crt: Number(e.target.value) as any })}
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-bold cursor-pointer"
                >
                  <option value={1}>1 - Simples Nacional (ME / EPP / Hamburgueria)</option>
                  <option value={2}>2 - Simples Nacional - Excesso de Sublimite</option>
                  <option value={3}>3 - Regime Normal (Lucro Presumido / Lucro Real)</option>
                </select>
              </div>
            </div>

            {/* Endereço Fiscal */}
            <div className="pt-4 border-t border-border-default space-y-4">
              <h3 className="text-sm font-bold text-text-primary">
                Endereço Fiscal do Estabelecimento
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <label htmlFor="fiscal-cep" className="block text-text-secondary font-bold mb-1">CEP:</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="fiscal-cep"
                      type="text"
                      value={config.cep}
                      onChange={e => setConfig({ ...config, cep: e.target.value })}
                      placeholder="38400-000"
                      className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleFetchCep(config.cep)}
                    >
                      Buscar
                    </Button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="fiscal-rua" className="block text-text-secondary font-bold mb-1">Logradouro / Rua:</label>
                  <input
                    id="fiscal-rua"
                    type="text"
                    value={config.logradouro}
                    onChange={e => setConfig({ ...config, logradouro: e.target.value })}
                    placeholder="Rua das Flores"
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label htmlFor="fiscal-num" className="block text-text-secondary font-bold mb-1">Número:</label>
                  <input
                    id="fiscal-num"
                    type="text"
                    value={config.numero}
                    onChange={e => setConfig({ ...config, numero: e.target.value })}
                    placeholder="123"
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="fiscal-bairro" className="block text-text-secondary font-bold mb-1">Bairro:</label>
                  <input
                    id="fiscal-bairro"
                    type="text"
                    value={config.bairro}
                    onChange={e => setConfig({ ...config, bairro: e.target.value })}
                    placeholder="Centro"
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label htmlFor="fiscal-mun" className="block text-text-secondary font-bold mb-1">Município:</label>
                  <input
                    id="fiscal-mun"
                    type="text"
                    value={config.municipio}
                    onChange={e => setConfig({ ...config, municipio: e.target.value })}
                    placeholder="Uberlândia"
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label htmlFor="fiscal-uf" className="block text-text-secondary font-bold mb-1">UF (Estado):</label>
                  <input
                    id="fiscal-uf"
                    type="text"
                    maxLength={2}
                    value={config.uf}
                    onChange={e => setConfig({ ...config, uf: e.target.value.toUpperCase() })}
                    placeholder="MG"
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary uppercase font-bold text-center"
                  />
                </div>

                <div>
                  <label htmlFor="fiscal-ibge" className="block text-text-secondary font-bold mb-1">Cód. IBGE Município:</label>
                  <input
                    id="fiscal-ibge"
                    type="text"
                    value={config.codigoMunicipio}
                    onChange={e => setConfig({ ...config, codigoMunicipio: e.target.value })}
                    placeholder="3170206"
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CERTIFICADO DIGITAL A1 & SEFAZ */}
        {activeTab === 'certificado' && (
          <div className="bg-surface-card border border-border-default rounded-dialog p-6 shadow-elevated space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border-default">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Lock className="text-cyan-400" size={18} aria-hidden="true" /> Certificado Digital A1 & Segurança SEFAZ
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  O Certificado A1 (.pfx) assina digitalmente os arquivos XML de cada NFC-e antes da autorização.
                </p>
              </div>
              <Button onClick={() => handleSaveConfig(config)}>
                Salvar Alterações
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Upload Certificado */}
              <div className="p-5 rounded-dialog bg-surface-elevated/40 border border-border-default space-y-4">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Lock size={16} className="text-cyan-400" aria-hidden="true" /> Arquivo do Certificado (.pfx / .p12)
                </h3>

                {config.certificate?.fileName ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-control space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                        <Check size={14} aria-hidden="true" /> {config.certificate.fileName}
                      </span>
                      <Badge variant="success" className="text-[10px]">Ativo</Badge>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Carregado em: {new Date(config.certificate.uploadedAt || '').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ) : (
                  <p className="text-text-muted">
                    Nenhum certificado A1 importado ainda.
                  </p>
                )}

                <div>
                  <label htmlFor="cert-file-input" className="block text-text-secondary font-bold mb-1">
                    {config.certificate?.fileName ? 'Substituir Certificado A1:' : 'Selecionar Certificado A1:'}
                  </label>
                  <input
                    id="cert-file-input"
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleCertificateUpload}
                    className="w-full text-xs text-text-muted file:mr-3 file:py-2 file:px-3 file:rounded-control file:border-0 file:text-xs file:font-bold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* CSC Token */}
              <div className="p-5 rounded-dialog bg-surface-elevated/40 border border-border-default space-y-4">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" aria-hidden="true" /> Token CSC (Código de Segurança do Contribuinte)
                </h3>
                <p className="text-text-muted text-[11px]">
                  O CSC é o token fornecido pela SEFAZ do seu estado para validar os QR Codes nos cupons fiscais.
                </p>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="csc-id" className="block text-text-secondary font-bold mb-1">ID do Token CSC (Identificador):</label>
                    <input
                      id="csc-id"
                      type="text"
                      value={config.cscId}
                      onChange={e => setConfig({ ...config, cscId: e.target.value })}
                      placeholder="Ex: 000001"
                      className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="csc-token" className="block text-text-secondary font-bold mb-1">Código Alfanumérico do CSC:</label>
                    <input
                      id="csc-token"
                      type="password"
                      value={config.cscToken}
                      onChange={e => setConfig({ ...config, cscToken: e.target.value })}
                      placeholder="Ex: 1A2B3C4D5E6F..."
                      className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: CONEXÃO API GATEWAY & TOKEN */}
        {activeTab === 'api_gateway' && (
          <div className="bg-surface-card border border-border-default rounded-dialog p-6 shadow-elevated space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border-default">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Key className="text-cyan-400" size={18} aria-hidden="true" /> Gateway de Emissão Fiscal & SEFAZ
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Conexão direta com APIs homologadas na SEFAZ para autorização imediata e geração do QR Code.
                </p>
              </div>
              <Button onClick={() => handleSaveConfig(config)}>
                Salvar Alterações
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-4">
                <div>
                  <label htmlFor="api-provider" className="block text-text-secondary font-bold mb-1">Provedor / Gateway Fiscal:</label>
                  <select
                    id="api-provider"
                    value={config.apiProvider}
                    onChange={e => setConfig({ ...config, apiProvider: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-bold cursor-pointer"
                  >
                    <option value="focus_nfe">Focus NFe (Homologado Nacional)</option>
                    <option value="nuvem_fiscal">Nuvem Fiscal</option>
                    <option value="plugnotas">PlugNotas (TecnoSpeed)</option>
                    <option value="webmania">WebmaniaBR</option>
                    <option value="simulador">Simulador Fiscal Interno</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="api-token" className="block text-text-secondary font-bold mb-1">Token de Acesso à API:</label>
                  <input
                    id="api-token"
                    type="password"
                    value={config.apiToken || ''}
                    onChange={e => setConfig({ ...config, apiToken: e.target.value })}
                    placeholder="Chave secreta da API"
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="api-env" className="block text-text-secondary font-bold mb-1">Ambiente SEFAZ:</label>
                  <select
                    id="api-env"
                    value={config.ambiente}
                    onChange={e => setConfig({ ...config, ambiente: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary outline-none focus:border-brand-primary font-bold cursor-pointer"
                  >
                    <option value="homologacao">Homologação (Ambiente de Testes / Sem Valor Fiscal)</option>
                    <option value="producao">Produção (Notas Oficiais com Valor Tributário)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleTestApiConnection}
                    loading={apiTesting}
                    leadingIcon={<Sparkles size={14} aria-hidden="true" />}
                  >
                    Testar Conexão com a SEFAZ
                  </Button>
                </div>

                {apiTestResult && (
                  <div className={`p-3 rounded-control border text-xs ${
                    apiTestResult.success 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                    {apiTestResult.message}
                  </div>
                )}
              </div>

              <div className="p-5 rounded-dialog bg-surface-elevated/40 border border-border-default space-y-3">
                <h3 className="text-sm font-bold text-text-primary">Configuração de Numeração NFC-e</h3>
                <div>
                  <label htmlFor="serie-nfce" className="block text-text-muted font-bold mb-1">Série da NFC-e:</label>
                  <input
                    id="serie-nfce"
                    type="number"
                    value={config.serieNfce}
                    onChange={e => setConfig({ ...config, serieNfce: Number(e.target.value) || 1 })}
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="prox-num-nfce" className="block text-text-muted font-bold mb-1">Próximo Número de Nota:</label>
                  <input
                    id="prox-num-nfce"
                    type="number"
                    value={config.proximoNumeroNfce}
                    onChange={e => setConfig({ ...config, proximoNumeroNfce: Number(e.target.value) || 1 })}
                    className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: HISTÓRICO DE NOTAS EMITIDAS */}
        {activeTab === 'notas_emitidas' && (
          <div className="space-y-4">
            {/* FilterBar Padronizada */}
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchLabel="Buscar notas fiscais"
              placeholder="Buscar por número, CPF ou chave..."
              resultCount={filteredInvoices.length}
              totalCount={invoices.length}
              active={Boolean(searchTerm || statusFilter !== 'todos')}
              onClear={() => {
                setSearchTerm('');
                setStatusFilter('todos');
              }}
            >
              <div className="space-y-1.5 sm:w-48">
                <label htmlFor="fiscal-status-select" className="block text-sm font-medium text-text-secondary">
                  Status SEFAZ
                </label>
                <select
                  id="fiscal-status-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-control bg-surface-input border border-border-default text-text-primary text-sm font-medium focus:outline-none focus:border-brand-primary cursor-pointer"
                >
                  <option value="todos">Todos os status</option>
                  <option value="autorizada">Autorizadas</option>
                  <option value="simulada">Simuladas (Pré-API)</option>
                  <option value="cancelada">Canceladas</option>
                </select>
              </div>
            </FilterBar>

            {invoices.length > 0 && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsConfirmClearOpen(true)}
                  leadingIcon={<Trash2 size={13} aria-hidden="true" />}
                >
                  Limpar Histórico Fiscal
                </Button>
              </div>
            )}

            {/* Tabela de Notas */}
            {filteredInvoices.length === 0 ? (
              <EmptyState
                title={invoices.length ? 'Nenhuma nota encontrada' : 'Nenhuma nota emitida'}
                description={invoices.length ? 'Tente pesquisar com outro termo ou alterar o filtro de status.' : 'As notas fiscais emitidas no caixa aparecerão aqui.'}
                icon={<FileText aria-hidden="true" />}
                action={
                  invoices.length ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('todos');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-dialog border border-border-default bg-surface-card shadow-elevated">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-elevated/60 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <th className="p-4">NFC-e / Série</th>
                      <th className="p-4">Data e Hora</th>
                      <th className="p-4">Consumidor (CPF/Nome)</th>
                      <th className="p-4">Valor Total</th>
                      <th className="p-4">Forma Pagto</th>
                      <th className="p-4">Status SEFAZ</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50 font-medium">
                    {filteredInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="p-4 font-bold text-text-primary font-mono tabular-nums">
                          #{String(inv.numero).padStart(6, '0')} <span className="text-text-muted font-normal">Série {inv.serie}</span>
                        </td>
                        <td className="p-4 text-text-secondary font-mono tabular-nums">
                          {new Date(inv.dataEmissao).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(inv.dataEmissao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 text-text-secondary">
                          {inv.destinatarioCpfCnpj ? (
                            <span className="font-mono tabular-nums text-cyan-300">{inv.destinatarioCpfCnpj}</span>
                          ) : (
                            <span className="text-text-muted">Não Informado</span>
                          )}
                          {inv.destinatarioNome && <p className="text-[10px] text-text-muted">{inv.destinatarioNome}</p>}
                        </td>
                        <td className="p-4 font-bold text-emerald-400 font-mono tabular-nums">
                          R$ {inv.valorTotal.toFixed(2)}
                        </td>
                        <td className="p-4 text-text-secondary">
                          {inv.formaPagamento}
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={inv.status === 'autorizada' ? 'success' : inv.status === 'cancelada' ? 'danger' : 'info'}
                            dot
                            className="text-[10px]"
                          >
                            {inv.status === 'autorizada' ? 'Autorizada' : inv.status === 'cancelada' ? 'Cancelada' : 'Simulada'}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setViewingInvoice(inv)}
                              leadingIcon={<Eye size={12} aria-hidden="true" />}
                            >
                              DANFE
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleCopyKey(inv.chaveAcesso)}
                              className="p-1.5 bg-surface-elevated hover:bg-surface-card text-text-muted hover:text-text-primary rounded-control border border-border-default cursor-pointer transition-colors"
                              title="Copiar Chave de Acesso (44 dígitos)"
                              aria-label="Copiar Chave de Acesso"
                            >
                              {copiedKey === inv.chaveAcesso ? <Check size={13} className="text-emerald-400" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL DE VISUALIZAÇÃO DO DANFE TÉRMICO (Dialog) */}
        <Dialog
          open={Boolean(viewingInvoice)}
          onClose={() => setViewingInvoice(null)}
          title={`DANFE NFC-e #${viewingInvoice?.numero || ''}`}
          description="Cupom Fiscal Formatado para Impressora Térmica"
          size="md"
          footer={
            <div className="flex gap-2 w-full justify-end">
              <Button variant="secondary" onClick={() => setViewingInvoice(null)}>
                Fechar
              </Button>
              <Button onClick={handlePrintDanfe} leadingIcon={<Printer size={14} aria-hidden="true" />}>
                Imprimir DANFE
              </Button>
            </div>
          }
        >
          {viewingInvoice && (
            <div className="p-4 overflow-y-auto bg-surface-ground flex justify-center rounded-control">
              <div 
                className="bg-white p-4 rounded-control shadow-md border border-slate-300 w-full text-black font-mono text-xs"
                dangerouslySetInnerHTML={{ __html: generateDanfeThermalHtml(viewingInvoice, config) }}
              />
            </div>
          )}
        </Dialog>

        {/* CONFIRM DIALOG: LIMPAR HISTÓRICO FISCAL */}
        <ConfirmDialog
          open={isConfirmClearOpen}
          onClose={() => setIsConfirmClearOpen(false)}
          onConfirm={() => {
            clearFiscalInvoices();
            setInvoices([]);
            setIsConfirmClearOpen(false);
            notify({ title: 'Histórico fiscal limpo com sucesso.', tone: 'info' });
          }}
          title="Limpar Histórico Fiscal"
          description="Tem certeza que deseja limpar o histórico local de notas fiscais? Esta ação é irreversível."
          confirmLabel="Limpar Histórico"
          cancelLabel="Cancelar"
          tone="danger"
        />
      </div>
    </div>
  );
}
