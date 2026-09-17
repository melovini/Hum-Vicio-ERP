import type { FiscalCompanyConfig, FiscalInvoiceRecord } from './fiscal';
import type { AuditLog, AuditAction } from './store/types';

export interface FiscalInvoiceFilterOptions {
  status?: 'todos' | 'autorizada' | 'simulada' | 'cancelada' | 'contingencia';
  searchTerm?: string;
}

export interface FiscalReadinessResult {
  level: 'pronto' | 'homologacao' | 'pendente';
  score: number;
  totalChecks: number;
  badge: string;
}

export function filterFiscalInvoices(
  invoices: FiscalInvoiceRecord[],
  options: FiscalInvoiceFilterOptions = {},
): FiscalInvoiceRecord[] {
  const { status = 'todos', searchTerm = '' } = options;
  const q = searchTerm.trim().toLowerCase();

  return invoices.filter((inv) => {
    if (status !== 'todos' && inv.status !== status) {
      return false;
    }

    if (q) {
      const matchKey = inv.chaveAcesso?.toLowerCase().includes(q);
      const matchNum = String(inv.numero).includes(q);
      const matchDestDoc = inv.destinatarioCpfCnpj?.toLowerCase().includes(q);
      const matchDestName = inv.destinatarioNome?.toLowerCase().includes(q);
      if (!matchKey && !matchNum && !matchDestDoc && !matchDestName) {
        return false;
      }
    }

    return true;
  });
}

export function calculateFiscalReadiness(config: FiscalCompanyConfig): FiscalReadinessResult {
  const hasCnpj = Boolean(config.cnpj && config.cnpj.replace(/\D/g, '').length === 14);
  const hasIe = Boolean(config.inscricaoEstadual && config.inscricaoEstadual.trim().length > 4);
  const hasAddress = Boolean(config.logradouro && config.numero && config.municipio);
  const hasCsc = Boolean(config.cscId && config.cscToken);
  const hasCert = Boolean(config.certificate?.fileName);
  const hasApi = Boolean(config.apiToken && config.apiToken.length >= 8);

  const checks = [hasCnpj, hasIe, hasAddress, hasCsc, hasCert, hasApi];
  const score = checks.filter(Boolean).length;

  if (score === 6) {
    return {
      level: 'pronto',
      score,
      totalChecks: 6,
      badge: 'Sistema 100% Pronto para Emissão em Produção',
    };
  }

  if (score >= 4) {
    return {
      level: 'homologacao',
      score,
      totalChecks: 6,
      badge: 'Modo Simulação & Homologação Pronto (Falta Token da API)',
    };
  }

  return {
    level: 'pendente',
    score,
    totalChecks: 6,
    badge: 'Pendente de Dados Cadastrais da Empresa',
  };
}

export interface AuditLogFilterOptions {
  category?: 'todos' | 'cancelamento' | 'caixa' | 'preco' | 'estoque' | 'brindes' | 'descontos';
  searchTerm?: string;
}

export function filterAuditLogs(
  logs: AuditLog[],
  options: AuditLogFilterOptions = {},
): AuditLog[] {
  const { category = 'todos', searchTerm = '' } = options;
  const q = searchTerm.trim().toLowerCase();

  return logs.filter((log) => {
    // Filtro de Categoria
    if (category === 'cancelamento' && log.action !== 'CANCELAMENTO_VENDA') return false;
    if (category === 'caixa' && !['FECHAMENTO_CAIXA', 'ABERTURA_CAIXA', 'SANGRIA', 'SUPRIMENTO'].includes(log.action)) return false;
    if (category === 'preco' && log.action !== 'ALTERACAO_PRECO') return false;
    if (category === 'estoque' && !['AJUSTE_ESTOQUE', 'EXCLUSAO_ITEM', 'CADASTRO_PRODUTO', 'DESATIVACAO_PRODUTO'].includes(log.action)) return false;
    if (category === 'brindes' && log.action !== 'ITEM_BRINDE') return false;
    if (category === 'descontos' && !['DESCONTO_CONCEDIDO', 'CUPOM_HITS_IFOOD'].includes(log.action)) return false;

    // Filtro Textual
    if (q) {
      const matchDetails = log.details?.toLowerCase().includes(q);
      const matchOperator = log.operator?.toLowerCase().includes(q);
      const matchAction = log.action?.toLowerCase().includes(q);
      if (!matchDetails && !matchOperator && !matchAction) {
        return false;
      }
    }

    return true;
  });
}

export function computeAuditStats(logs: AuditLog[]): {
  cancelamentos: number;
  fechamentos: number;
  sangrias: number;
  alteracoesPreco: number;
  brindes: number;
  total: number;
} {
  let cancelamentos = 0;
  let fechamentos = 0;
  let sangrias = 0;
  let alteracoesPreco = 0;
  let brindes = 0;

  for (const l of logs) {
    if (l.action === 'CANCELAMENTO_VENDA') cancelamentos++;
    else if (l.action === 'FECHAMENTO_CAIXA') fechamentos++;
    else if (l.action === 'SANGRIA') sangrias++;
    else if (l.action === 'ALTERACAO_PRECO') alteracoesPreco++;
    else if (l.action === 'ITEM_BRINDE') brindes++;
  }

  return {
    cancelamentos,
    fechamentos,
    sangrias,
    alteracoesPreco,
    brindes,
    total: logs.length,
  };
}
