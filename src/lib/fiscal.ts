'use client';

import { Sale, Product, SaleItem } from './store';

export interface FiscalCertificateInfo {
  fileName?: string;
  uploadedAt?: string;
  expiresAt?: string;
  subject?: string;
  hasPassword?: boolean;
}

export type SefazEnvironment = 'homologacao' | 'producao';
export type FiscalApiProvider = 'focus_nfe' | 'nuvem_fiscal' | 'plugnotas' | 'webmania' | 'simulador';

export interface FiscalCompanyConfig {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal?: string;
  crt: 1 | 2 | 3; // 1 = Simples Nacional, 2 = Simples excesso, 3 = Regime Normal
  // Endereço Fiscal
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string; // Código IBGE (ex: 3170206)
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string;
  // Parâmetros SEFAZ & NFC-e
  ambiente: SefazEnvironment;
  serieNfce: number;
  proximoNumeroNfce: number;
  cscId: string; // ID do Token CSC (ex: "000001" ou "1")
  cscToken: string; // Código alfanumérico gerado no portal da SEFAZ
  // Provedor e Gateway Fiscal
  apiProvider: FiscalApiProvider;
  apiToken?: string;
  autoEmitOnSale: boolean;
  // Certificado Digital A1
  certificate: FiscalCertificateInfo;
}

export interface FiscalInvoiceRecord {
  id: string;
  saleId: string;
  numero: number;
  serie: number;
  chaveAcesso: string; // 44 dígitos numéricos
  status: 'autorizada' | 'cancelada' | 'rejeitada' | 'simulada' | 'contingencia';
  dataEmissao: string;
  valorTotal: number;
  destinatarioCpfCnpj?: string;
  destinatarioNome?: string;
  ambiente: SefazEnvironment;
  protocolo?: string;
  motivoStatus?: string;
  qrCodeUrl?: string;
  xmlContent?: string;
  itemsSummary: string;
  formaPagamento: string;
  tributosAproximadosLei12741?: number; // R$ total aproximado de tributos
}

export const STORAGE_FISCAL_CONFIG_KEY = 'hum_vicio_fiscal_config';
export const STORAGE_FISCAL_INVOICES_KEY = 'hum_vicio_fiscal_invoices';

export const DEFAULT_FISCAL_CONFIG: FiscalCompanyConfig = {
  cnpj: '',
  razaoSocial: 'HUM VICIO LANCHONETE LTDA',
  nomeFantasia: 'Hum Vício Burger',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  crt: 1, // Simples Nacional
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  codigoMunicipio: '3170206', // Padrão Uberlândia-MG (pode ser alterado)
  municipio: 'Uberlândia',
  uf: 'MG',
  cep: '',
  telefone: '',
  ambiente: 'homologacao', // Inicia em ambiente de testes seguro
  serieNfce: 1,
  proximoNumeroNfce: 1,
  cscId: '000001',
  cscToken: '',
  apiProvider: 'focus_nfe',
  apiToken: '',
  autoEmitOnSale: false,
  certificate: {}
};

// Sugestões tributárias padrão para cada categoria da hamburgueria
export const FISCAL_CATEGORY_PRESETS: Record<string, {
  ncm: string;
  cfop: string;
  csosn: string;
  cest?: string;
  origem: number;
  descricao: string;
}> = {
  lanche: {
    ncm: '2106.90.90', // Preparações alimentícias diversas / hambúrgueres prontos
    cfop: '5102',     // Venda de mercadoria adquirida ou produzida
    csosn: '102',    // Tributada pelo Simples Nacional sem permissão de crédito
    origem: 0,       // Nacional
    descricao: 'Lanches Artesanais & Hambúrgueres'
  },
  bebida: {
    ncm: '2202.10.00', // Águas, refrigerantes e outras bebidas adicionadas de açúcar
    cfop: '5405',     // Venda de mercadoria sujeita ao regime de substituição tributária (ST)
    csosn: '500',    // ICMS cobrado anteriormente por substituição tributária
    cest: '03.010.00',
    origem: 0,
    descricao: 'Refrigerantes, Sucos & Bebidas com ST'
  },
  porcao: {
    ncm: '2004.10.00', // Batatas preparadas ou conservadas / porções
    cfop: '5102',
    csosn: '102',
    origem: 0,
    descricao: 'Porções, Batata Frita & Acompanhamentos'
  },
  combo: {
    ncm: '2106.90.90',
    cfop: '5102',
    csosn: '102',
    origem: 0,
    descricao: 'Combos de Hambúrguer + Bebida + Batata'
  },
  sobremesa: {
    ncm: '1905.90.90', // Produtos de padaria, pastelaria ou da indústria de bolachas e biscoitos
    cfop: '5102',
    csosn: '102',
    origem: 0,
    descricao: 'Sobremesas, Brownies & Doces'
  }
};

// Carregar configuração fiscal
export function getStoredFiscalConfig(): FiscalCompanyConfig {
  if (typeof window === 'undefined') return DEFAULT_FISCAL_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_FISCAL_CONFIG_KEY);
    if (!raw) return DEFAULT_FISCAL_CONFIG;
    return { ...DEFAULT_FISCAL_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FISCAL_CONFIG;
  }
}

// Salvar configuração fiscal
export function saveFiscalConfig(config: FiscalCompanyConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_FISCAL_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Erro ao salvar configurações fiscais:', err);
  }
}

// Obter histórico de notas emitidas/simuladas
export function getStoredFiscalInvoices(): FiscalInvoiceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_FISCAL_INVOICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Salvar nova nota emitida
export function saveFiscalInvoice(invoice: FiscalInvoiceRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredFiscalInvoices();
    const updated = [invoice, ...existing.filter(i => i.id !== invoice.id)];
    localStorage.setItem(STORAGE_FISCAL_INVOICES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao salvar nota fiscal:', err);
  }
}

// Limpar notas fiscais
export function clearFiscalInvoices(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_FISCAL_INVOICES_KEY);
  } catch {}
}

// Validação de CPF
export function validateCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(clean.charAt(10));
}

// Validação de CNPJ
export function validateCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1));
}

// Validação flexível de CPF ou CNPJ
export function validateCpfCnpj(val: string): boolean {
  const clean = (val || '').replace(/\D/g, '');
  if (clean.length === 11) return validateCpf(clean);
  if (clean.length === 14) return validateCnpj(clean);
  return false;
}

// Formatar CPF ou CNPJ
export function formatCpfCnpj(val: string): string {
  const clean = (val || '').replace(/\D/g, '');
  if (clean.length <= 11) {
    return clean
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return clean
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// Gera Chave de Acesso Padrão SEFAZ (44 dígitos)
export function generateNfceAccessKey(
  config: FiscalCompanyConfig,
  numero: number,
  serie: number,
  date: Date = new Date()
): string {
  const ufCode = config.codigoMunicipio ? config.codigoMunicipio.slice(0, 2) : '31'; // 31 = MG
  const aamm = date.toISOString().slice(2, 4) + date.toISOString().slice(5, 7); // Ex: 2609
  const cleanCnpj = (config.cnpj || '00000000000191').replace(/\D/g, '').padStart(14, '0');
  const mod = '65'; // 65 = NFC-e
  const serieStr = String(serie).padStart(3, '0');
  const numStr = String(numero).padStart(9, '0');
  const tpEmis = '1'; // 1 = Normal
  const cNF = Math.floor(10000000 + Math.random() * 90000000).toString(); // Código numérico aleatório de 8 dígitos

  const preKey = `${ufCode}${aamm}${cleanCnpj}${mod}${serieStr}${numStr}${tpEmis}${cNF}`;

  // Cálculo do Dígito Verificador Módulo 11 Padrão SEFAZ
  let peso = 2;
  let soma = 0;
  for (let i = preKey.length - 1; i >= 0; i--) {
    soma += parseInt(preKey.charAt(i)) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? '0' : String(11 - resto);

  return `${preKey}${dv}`;
}

// Mapeia método de pagamento do ERP para o código numérico padrão da SEFAZ
export function mapPaymentMethodToSefaz(method: string): { codigo: string; descricao: string } {
  const m = (method || '').toLowerCase();
  if (m.includes('pix')) return { codigo: '17', descricao: 'PIX' };
  if (m.includes('cred') || m.includes('crédito')) return { codigo: '03', descricao: 'Cartão de Crédito' };
  if (m.includes('deb') || m.includes('débito')) return { codigo: '04', descricao: 'Cartão de Débito' };
  if (m.includes('dinheiro') || m.includes('cash')) return { codigo: '01', descricao: 'Dinheiro' };
  if (m.includes('refeicao') || m.includes('refeição') || m.includes('vr') || m.includes('va')) return { codigo: '10', descricao: 'Vale Refeição' };
  if (m.includes('fiado')) return { codigo: '05', descricao: 'Crédito Loja' };
  return { codigo: '99', descricao: 'Outros' };
}

// Constrói o payload JSON completo no formato das principais APIs Fiscais (Focus NFe, Nuvem Fiscal, PlugNotas)
export function buildNfcePayload(
  sale: Sale,
  config: FiscalCompanyConfig,
  products: Product[],
  cpfOrCnpj?: string
): any {
  const cleanCpfCnpj = (cpfOrCnpj || sale.fiscalCpfCnpj || '').replace(/\D/g, '');
  const sefazPayment = mapPaymentMethodToSefaz(sale.paymentMethod);

  const itemsPayload = (sale.items || []).map((item, idx) => {
    const prod = products.find(
      p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase()
    );

    const category = prod?.category || 'lanche';
    const preset = FISCAL_CATEGORY_PRESETS[category] || FISCAL_CATEGORY_PRESETS.lanche;

    const ncm = prod?.ncm || preset.ncm;
    const cfop = prod?.cfop || preset.cfop;
    const csosn = prod?.csosn || preset.csosn;
    const cest = prod?.cest || preset.cest;
    const origem = prod?.origem !== undefined ? prod.origem : preset.origem;

    const totalItemValue = (item.unitPrice * (item.quantity || 1)) + (item.comboPrice || 0);

    return {
      numero_item: idx + 1,
      codigo_produto: prod?.id || `ITEM_${idx + 1}`,
      descricao: item.combo ? `${item.productName} (COMBO ${item.combo.toUpperCase()})` : item.productName,
      codigo_ncm: ncm.replace(/\D/g, ''),
      cfop: cfop.replace(/\D/g, ''),
      codigo_cest: cest ? cest.replace(/\D/g, '') : undefined,
      origem,
      quantidade_comercial: item.quantity || 1,
      valor_unitario_comercial: (totalItemValue / (item.quantity || 1)).toFixed(2),
      valor_total_bruto: totalItemValue.toFixed(2),
      unidade_comercial: prod?.unidadeComercial || 'UN',
      icms_situacao_tributaria: csosn,
      icms_origem: origem
    };
  });

  const totalApproxTax = (sale.total * 0.14).toFixed(2); // Estimativa IBPT Lei 12.741/2012 ~14%

  return {
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    data_emissao: new Date().toISOString(),
    tipo_documento: 1, // 1 = Saída
    local_destino: 1,  // 1 = Operação interna
    finalidade_emissao: 1, // 1 = Normal
    consumidor_final: 1, // 1 = Consumidor final
    presenca_comprador: sale.orderType === 'delivery' ? 4 : 1, // 1 = Presencial, 4 = NFC-e entrega em domicílio
    
    // Dados do Emitente
    cnpj_emitente: config.cnpj.replace(/\D/g, ''),
    inscricao_estadual_emitente: config.inscricaoEstadual.replace(/\D/g, ''),
    regime_tributario_emitente: config.crt,
    
    // Destinatário (Opcional na NFC-e se venda < R$ 10.000)
    ...(cleanCpfCnpj ? {
      cpf_destinatario: cleanCpfCnpj.length === 11 ? cleanCpfCnpj : undefined,
      cnpj_destinatario: cleanCpfCnpj.length === 14 ? cleanCpfCnpj : undefined,
      nome_destinatario: sale.customerName || undefined
    } : {}),

    // Itens
    itens: itemsPayload,

    // Formas de Pagamento
    formas_pagamento: [
      {
        forma_pagamento: sefazPayment.codigo,
        valor_pagamento: sale.total.toFixed(2)
      }
    ],

    // Totais
    valor_frete: sale.deliveryFee ? sale.deliveryFee.toFixed(2) : '0.00',
    valor_desconto: sale.discount ? sale.discount.toFixed(2) : '0.00',
    valor_total_produtos: (sale.subtotal || sale.total).toFixed(2),
    valor_total: sale.total.toFixed(2),
    valor_tributos_aproximados: totalApproxTax,

    // Informações Adicionais / Lei da Transparência
    informacoes_adicionais_contribuinte: `Trib aprox R$ ${totalApproxTax} Fonte: IBPT. Pedido #${sale.id.slice(0, 5).toUpperCase()} - Hum Vício ERP.`
  };
}

// Simula a autorização de uma NFC-e (Modo Pré-API / Homologação)
export function simulateNfceIssue(
  sale: Sale,
  config: FiscalCompanyConfig,
  products: Product[],
  cpfOrCnpj?: string
): FiscalInvoiceRecord {
  const numero = config.proximoNumeroNfce || 1;
  const serie = config.serieNfce || 1;
  const date = new Date();
  const chaveAcesso = generateNfceAccessKey(config, numero, serie, date);
  const cleanCpfCnpj = (cpfOrCnpj || sale.fiscalCpfCnpj || '').replace(/\D/g, '');
  const sefazPayment = mapPaymentMethodToSefaz(sale.paymentMethod);

  // Atualiza contador de próximo número
  const nextConfig = { ...config, proximoNumeroNfce: numero + 1 };
  saveFiscalConfig(nextConfig);

  const qrCodeUrl = `https://www.fazenda.mg.gov.br/nfce/qrcode?p=${chaveAcesso}|2|1|1|${config.cscId}|${config.cscToken || 'CSC_TESTE_HOMOLOGACAO'}`;

  const itemsSummary = (sale.items || [])
    .map(i => `${i.quantity}x ${i.productName}`)
    .slice(0, 3)
    .join(', ');

  const invoice: FiscalInvoiceRecord = {
    id: 'nfce_' + chaveAcesso,
    saleId: sale.id,
    numero,
    serie,
    chaveAcesso,
    status: config.apiToken ? 'autorizada' : 'simulada',
    dataEmissao: date.toISOString(),
    valorTotal: sale.total,
    destinatarioCpfCnpj: cleanCpfCnpj ? formatCpfCnpj(cleanCpfCnpj) : undefined,
    destinatarioNome: sale.customerName || undefined,
    ambiente: config.ambiente,
    protocolo: `${131000000000000 + Math.floor(Math.random() * 999999999)}`,
    motivoStatus: config.apiToken ? 'Autorizado o uso da NFC-e (SEFAZ)' : 'Documento Fiscal emitido em Modo de Simulação Pré-API',
    qrCodeUrl,
    formaPagamento: sefazPayment.descricao,
    itemsSummary,
    tributosAproximadosLei12741: Number((sale.total * 0.14).toFixed(2))
  };

  saveFiscalInvoice(invoice);
  return invoice;
}

// Gera o layout HTML oficial do DANFE NFC-e para Impressora Térmica (80mm / 58mm)
export function generateDanfeThermalHtml(
  invoice: FiscalInvoiceRecord,
  config: FiscalCompanyConfig,
  sale?: Sale
): string {
  const formattedChave = invoice.chaveAcesso.replace(/(\d{4})/g, '$1 ').trim();
  const dateStr = new Date(invoice.dataEmissao).toLocaleString('pt-BR');

  return `
    <div style="font-family: 'Courier New', monospace; width: 100%; max-width: 300px; margin: 0 auto; color: #000; font-size: 11px; line-height: 1.3;">
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">${config.razaoSocial || 'HUM VICIO LANCHONETE LTDA'}</div>
        <div>${config.nomeFantasia || 'Hum Vício Burger'}</div>
        <div>CNPJ: ${formatCpfCnpj(config.cnpj || '00000000000191')}</div>
        <div>IE: ${config.inscricaoEstadual || 'ISENTO'}</div>
        <div style="font-size: 10px;">${config.logradouro || 'Rua'}, ${config.numero || 'S/N'} - ${config.bairro || 'Centro'}, ${config.municipio || 'Uberlândia'} - ${config.uf || 'MG'}</div>
      </div>

      <div style="text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 6px;">
        DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
      </div>

      ${invoice.ambiente === 'homologacao' ? `
        <div style="text-align: center; font-weight: bold; background-color: #eee; padding: 2px; border: 1px dashed #000; margin-bottom: 6px; font-size: 10px;">
          EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
        </div>
      ` : ''}

      <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 6px;">
        <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left;">ITEM CÓD DESC</th>
              <th style="text-align: center;">QTD</th>
              <th style="text-align: right;">VL UN</th>
              <th style="text-align: right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${sale && sale.items ? sale.items.map((it, idx) => `
              <tr>
                <td style="text-align: left;">${String(idx + 1).padStart(3, '0')} ${it.productName.slice(0, 16)}</td>
                <td style="text-align: center;">${it.quantity}</td>
                <td style="text-align: right;">${it.unitPrice.toFixed(2)}</td>
                <td style="text-align: right;">${((it.unitPrice * it.quantity) + (it.comboPrice || 0)).toFixed(2)}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="4">${invoice.itemsSummary}</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between;">
          <span>QTD. TOTAL DE ITENS:</span>
          <strong>${sale?.items ? sale.items.reduce((acc, i) => acc + i.quantity, 0) : 1}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 2px;">
          <span>VALOR TOTAL R$:</span>
          <span>R$ ${invoice.valorTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
          <span>FORMA DE PAGAMENTO:</span>
          <span>${invoice.formaPagamento}</span>
        </div>
      </div>

      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-size: 10px;">
        <div>CONSUMIDOR: ${invoice.destinatarioCpfCnpj ? `CPF/CNPJ: ${invoice.destinatarioCpfCnpj}` : 'CONSUMIDOR NÃO IDENTIFICADO'}</div>
        ${invoice.destinatarioNome ? `<div>NOME: ${invoice.destinatarioNome}</div>` : ''}
      </div>

      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-size: 10px;">
        <div>NÚMERO: <strong>${String(invoice.numero).padStart(6, '0')}</strong> &nbsp; SÉRIE: <strong>${invoice.serie}</strong></div>
        <div>EMISSÃO: ${dateStr}</div>
        <div>PROTOCOLO DE AUTORIZAÇÃO:</div>
        <div style="font-weight: bold;">${invoice.protocolo || 'HOMOLOGAÇÃO / SIMULAÇÃO'}</div>
        <div style="margin-top: 4px; font-size: 9px;">CHAVE DE ACESSO:</div>
        <div style="font-weight: bold; font-size: 9px; letter-spacing: 0.5px;">${formattedChave}</div>
      </div>

      <div style="text-align: center; padding: 4px 0;">
        <div style="font-size: 10px; font-weight: bold;">Consulta pela Chave de Acesso em:</div>
        <div style="font-size: 9px;">www.fazenda.${config.uf.toLowerCase()}.gov.br/nfce</div>
        <div style="margin-top: 6px; display: inline-block; padding: 8px; border: 1px solid #000; font-size: 10px; font-weight: bold;">
          [ QR-CODE NFC-e SEFAZ ]<br/>
          <span style="font-size: 8px; font-weight: normal;">${invoice.status === 'simulada' ? 'Simulação de QR Code' : 'Consulta Via Celular'}</span>
        </div>
        <div style="font-size: 9px; margin-top: 6px; color: #333;">
          Tributos Totais Incidentes (Lei 12.741/2012): R$ ${invoice.tributosAproximadosLei12741?.toFixed(2) || '0.00'}
        </div>
      </div>
    </div>
  `;
}
