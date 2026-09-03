'use client';
import { createClient } from './supabase';

const supabase = createClient();

// ====================================================================
// 1. TIPOS & MODELOS: TEMPLATE MESTRE vs. FLOOR SESSION STATE
// ====================================================================

export interface LayoutTemplateItem {
  id: string;
  layoutTemplateId: string;
  numeroIdentificador: string;
  posX: number;
  posY: number;
  largura: number;
  altura: number;
  capacidade: number;
  formato: 'quadrada' | 'redonda' | 'retangular';
}

export interface LayoutTemplate {
  id: string;
  nome: string;
  ativo: boolean;
  createdAt: string;
  items: LayoutTemplateItem[];
}

export type MesaStatusConsumo = 
  | 'LIVRE' 
  | 'OCUPADA_ABERTA' 
  | 'PARCIALMENTE_PAGA' 
  | 'PAGA_AGUARDANDO';

export type MesaStatusVisual = 'NO_SALAO' | 'GUARDADA';

export interface PagamentoParcial {
  id: string;
  valor: number;
  metodo: string;
  operador: string;
  pagoEm: string;
}

export interface HistoricoMesaOcupacao {
  id: string;
  mesaNumero: string;
  clienteNome: string;
  abertaEm: string;
  fechadaEm: string;
  totalConsumo: number;
  totalPago: number;
  garcomOuOperador: string;
  itensConsumidos: { nome: string; quantidade: number; valorUnitario: number }[];
  pagamentos: PagamentoParcial[];
}

export interface SalaoMesaInstancia {
  id: string;
  sessaoCaixaSalaoId: string;
  numeroIdentificador: string;
  posX: number;
  posY: number;
  largura: number;
  altura: number;
  formato: 'quadrada' | 'redonda' | 'retangular';
  capacidade: number;
  statusVisual: MesaStatusVisual;
  statusConsumo: MesaStatusConsumo;
  mesaPaiId?: string | null; // Auto-relacionamento para mesas agrupadas (Merge)
  comandaIds?: string[];
  totalConsumo: number;
  totalPago: number;
  clienteNome?: string | null;
  garcom?: string | null;
  abertaEm?: string | null;
  fechadaEm?: string | null;
  pagamentosParciais: PagamentoParcial[];
  historicoTurno: HistoricoMesaOcupacao[];
  deletedAt?: string | null;
  updatedAt: string;
}

export interface SessaoCaixaSalao {
  id: string;
  sessaoCaixaId: string;
  layoutOrigemId: string;
  layoutNome: string;
  abertoEm: string;
  fechadoEm?: string | null;
  mesas: SalaoMesaInstancia[];
}

export type AuditEventoMesa = 
  | 'MESA_ABERTA' 
  | 'MESA_JUNTA' 
  | 'MESA_SEPARADA' 
  | 'MESA_EXTRA' 
  | 'MESA_GUARDADA' 
  | 'MESA_REPOSICIONADA' 
  | 'PAGAMENTO_PARCIAL' 
  | 'MESA_PAGA' 
  | 'MESA_LIBERADA' 
  | 'CANCELAMENTO_MESA';

export interface AuditLogSalao {
  id: string;
  sessaoCaixaSalaoId: string;
  operadorId: string;
  mesaId?: string;
  mesaNumero?: string;
  evento: AuditEventoMesa;
  dadosContexto: Record<string, any>;
  createdAt: string;
}

// ====================================================================
// 2. TEMPLATES PADRÃO DE FÁBRICA (SEEDING SEGURO)
// ====================================================================

export const DEFAULT_LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'tpl_padrao_6',
    nome: 'Padrão 6 Mesas (Hamburgueria)',
    ativo: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'item_1', layoutTemplateId: 'tpl_padrao_6', numeroIdentificador: 'Mesa 01', posX: 60, posY: 60, largura: 110, altura: 110, capacidade: 4, formato: 'quadrada' },
      { id: 'item_2', layoutTemplateId: 'tpl_padrao_6', numeroIdentificador: 'Mesa 02', posX: 230, posY: 60, largura: 110, altura: 110, capacidade: 4, formato: 'quadrada' },
      { id: 'item_3', layoutTemplateId: 'tpl_padrao_6', numeroIdentificador: 'Mesa 03', posX: 400, posY: 60, largura: 110, altura: 110, capacidade: 4, formato: 'quadrada' },
      { id: 'item_4', layoutTemplateId: 'tpl_padrao_6', numeroIdentificador: 'Mesa 04', posX: 60, posY: 240, largura: 110, altura: 110, capacidade: 4, formato: 'quadrada' },
      { id: 'item_5', layoutTemplateId: 'tpl_padrao_6', numeroIdentificador: 'Mesa 05', posX: 230, posY: 240, largura: 110, altura: 110, capacidade: 4, formato: 'quadrada' },
      { id: 'item_6', layoutTemplateId: 'tpl_padrao_6', numeroIdentificador: 'Mesa 06', posX: 400, posY: 240, largura: 110, altura: 110, capacidade: 4, formato: 'quadrada' }
    ]
  },
  {
    id: 'tpl_salao_9',
    nome: 'Salão Cheio 9 Mesas (Grid 3x3)',
    ativo: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'item_s1', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 01', posX: 50, posY: 50, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
      { id: 'item_s2', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 02', posX: 210, posY: 50, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
      { id: 'item_s3', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 03', posX: 370, posY: 50, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
      { id: 'item_s4', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 04', posX: 50, posY: 200, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
      { id: 'item_s5', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 05', posX: 210, posY: 200, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
      { id: 'item_s6', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 06', posX: 370, posY: 200, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
      { id: 'item_s7', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 07', posX: 50, posY: 350, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
      { id: 'item_s8', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 08', posX: 210, posY: 350, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
      { id: 'item_s9', layoutTemplateId: 'tpl_salao_9', numeroIdentificador: 'Mesa 09', posX: 370, posY: 350, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' }
    ]
  },
  {
    id: 'tpl_fim_de_semana_12',
    nome: 'Layout Fim de Semana (12 Mesas + Lounge)',
    ativo: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'item_f1', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Mesa 01', posX: 40, posY: 40, largura: 95, altura: 95, capacidade: 2, formato: 'redonda' },
      { id: 'item_f2', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Mesa 02', posX: 170, posY: 40, largura: 95, altura: 95, capacidade: 2, formato: 'redonda' },
      { id: 'item_f3', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Mesa 03', posX: 300, posY: 40, largura: 95, altura: 95, capacidade: 4, formato: 'quadrada' },
      { id: 'item_f4', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Mesa 04', posX: 430, posY: 40, largura: 95, altura: 95, capacidade: 4, formato: 'quadrada' },
      { id: 'item_f5', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Mesa 05', posX: 40, posY: 170, largura: 95, altura: 95, capacidade: 4, formato: 'quadrada' },
      { id: 'item_f6', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Mesa 06', posX: 170, posY: 170, largura: 95, altura: 95, capacidade: 4, formato: 'quadrada' },
      { id: 'item_f7', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Mesa 07', posX: 300, posY: 170, largura: 95, altura: 95, capacidade: 4, formato: 'quadrada' },
      { id: 'item_f8', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Mesa 08', posX: 430, posY: 170, largura: 95, altura: 95, capacidade: 4, formato: 'quadrada' },
      { id: 'item_f9', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Lounge 09', posX: 40, posY: 300, largura: 130, altura: 95, capacidade: 6, formato: 'retangular' },
      { id: 'item_f10', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Lounge 10', posX: 200, posY: 300, largura: 130, altura: 95, capacidade: 6, formato: 'retangular' },
      { id: 'item_f11', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Bistrô 11', posX: 360, posY: 300, largura: 80, altura: 80, capacidade: 2, formato: 'redonda' },
      { id: 'item_f12', layoutTemplateId: 'tpl_fim_de_semana_12', numeroIdentificador: 'Bistrô 12', posX: 460, posY: 300, largura: 80, altura: 80, capacidade: 2, formato: 'redonda' }
    ]
  }
];

// ====================================================================
// 3. PERSISTÊNCIA LOCAL & SINCRONIZAÇÃO NUVEM
// ====================================================================

const STORAGE_KEYS = {
  TEMPLATES: 'hum_vicio_layout_templates',
  ACTIVE_SESSION: 'hum_vicio_sessao_salao_ativa',
  AUDIT_LOGS: 'hum_vicio_audit_salao_logs'
};

// Obter Templates Mestres
export function getStoredLayoutTemplates(): LayoutTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT_TEMPLATES;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(DEFAULT_LAYOUT_TEMPLATES));
      return DEFAULT_LAYOUT_TEMPLATES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_LAYOUT_TEMPLATES;
  } catch (err) {
    console.error('Erro ao ler templates:', err);
    return DEFAULT_LAYOUT_TEMPLATES;
  }
}

// Salvar Template Mestre
export function saveStoredLayoutTemplate(template: LayoutTemplate): LayoutTemplate[] {
  const current = getStoredLayoutTemplates();
  const existingIdx = current.findIndex(t => t.id === template.id);
  let updated: LayoutTemplate[];
  if (existingIdx >= 0) {
    updated = current.map(t => t.id === template.id ? template : t);
  } else {
    updated = [...current, template];
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(updated));
  }

  // Tentar salvar no Supabase em background
  try {
    supabase.from('layout_template').upsert({
      id: template.id.includes('tpl_') ? undefined : template.id,
      nome: template.nome,
      ativo: template.ativo
    }).then();
  } catch {}

  return updated;
}

// Soft Delete Template Mestre
export function deleteStoredLayoutTemplate(templateId: string): LayoutTemplate[] {
  const current = getStoredLayoutTemplates();
  const updated = current.map(t => t.id === templateId ? { ...t, ativo: false } : t);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(updated));
  }
  return updated;
}

// Obter Sessão Ativa de Salão
export function getActiveFloorSession(caixaSessionId: string = 'sessao_padrao'): SessaoCaixaSalao {
  if (typeof window === 'undefined') {
    return createInitialSessionFromTemplate(caixaSessionId, DEFAULT_LAYOUT_TEMPLATES[0].id);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (raw) {
      const sessao: SessaoCaixaSalao = JSON.parse(raw);
      if (sessao && Array.isArray(sessao.mesas) && sessao.mesas.length > 0) {
        return sessao;
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar sessão ativa de salão:', err);
  }

  // Se não existir sessão ativa, cria a partir do primeiro template
  const templates = getStoredLayoutTemplates();
  const firstActive = templates.find(t => t.ativo) || DEFAULT_LAYOUT_TEMPLATES[0];
  const newSessao = createInitialSessionFromTemplate(caixaSessionId, firstActive.id);
  saveFloorSession(newSessao);
  return newSessao;
}

// Criar Sessão a partir de um Template Mestre (Clonagem para Floor Session State)
export function createInitialSessionFromTemplate(caixaSessionId: string, templateId: string): SessaoCaixaSalao {
  const templates = getStoredLayoutTemplates();
  const template = templates.find(t => t.id === templateId) || DEFAULT_LAYOUT_TEMPLATES[0];

  const sessaoId = 'salao_sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  const mesasInstancias: SalaoMesaInstancia[] = template.items.map(it => ({
    id: 'mesa_inst_' + Math.random().toString(36).substring(2, 9),
    sessaoCaixaSalaoId: sessaoId,
    numeroIdentificador: it.numeroIdentificador,
    posX: it.posX,
    posY: it.posY,
    largura: it.largura || 100,
    altura: it.altura || 100,
    formato: it.formato || 'quadrada',
    capacidade: it.capacidade || 4,
    statusVisual: 'NO_SALAO',
    statusConsumo: 'LIVRE',
    mesaPaiId: null,
    totalConsumo: 0,
    totalPago: 0,
    pagamentosParciais: [],
    historicoTurno: [],
    updatedAt: new Date().toISOString()
  }));

  const novaSessao: SessaoCaixaSalao = {
    id: sessaoId,
    sessaoCaixaId: caixaSessionId,
    layoutOrigemId: template.id,
    layoutNome: template.nome,
    abertoEm: new Date().toISOString(),
    fechadoEm: null,
    mesas: mesasInstancias
  };

  return novaSessao;
}

// Salvar Sessão Ativa de Salão
export function saveFloorSession(sessao: SessaoCaixaSalao) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(sessao));
  } catch (e) {
    console.error('Erro ao salvar sessão de salão:', e);
  }
}

// Registrar Auditoria de Salão (Antifraude RN03)
export function logSalaoAudit(
  sessaoId: string,
  evento: AuditEventoMesa,
  mesaNumero: string,
  dadosContexto: Record<string, any>,
  operador: string = 'Operador'
): AuditLogSalao {
  const log: AuditLogSalao = {
    id: 'audit_sal_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    sessaoCaixaSalaoId: sessaoId,
    operadorId: operador,
    mesaNumero,
    evento,
    dadosContexto,
    createdAt: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(log);
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(list.slice(0, 300)));
    } catch {}
  }

  // Tentar persistir no Supabase com fallback seguro
  try {
    supabase.from('audit_log_salao').insert({
      sessao_caixa_salao_id: sessaoId,
      operador_id: operador,
      evento,
      dados_contexto: dadosContexto
    }).then();
  } catch {}

  return log;
}

// Obter Logs de Auditoria do Salão
export function getSalaoAuditLogs(): AuditLogSalao[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ====================================================================
// 4. OPERAÇÕES REATIVAS DO SALÃO (REQUISITOS FUNCIONAIS)
// ====================================================================

// RF03 - Atualizar Coordenadas com Drag-and-Drop (Debounced)
export function atualizarPosicaoMesaInstancia(
  sessao: SessaoCaixaSalao,
  mesaId: string,
  newX: number,
  newY: number
): SessaoCaixaSalao {
  const updatedMesas = sessao.mesas.map(m => {
    if (m.id === mesaId) {
      return { ...m, posX: Math.max(0, newX), posY: Math.max(0, newY), updatedAt: new Date().toISOString() };
    }
    return m;
  });

  const updatedSessao = { ...sessao, mesas: updatedMesas };
  saveFloorSession(updatedSessao);
  return updatedSessao;
}

// RF05 - Adicionar Mesa Extra da "Gaveta Virtual"
export function adicionarMesaExtraInstancia(
  sessao: SessaoCaixaSalao,
  customNome?: string,
  operador: string = 'Operador'
): { sessao: SessaoCaixaSalao; mesaAdicionada: SalaoMesaInstancia } {
  // Determinar próximo número
  const numAtual = sessao.mesas.length + 1;
  const nomeFinal = customNome?.trim() || `Mesa Extra ${numAtual < 10 ? '0' + numAtual : numAtual}`;

  const novaMesa: SalaoMesaInstancia = {
    id: 'mesa_extra_' + Math.random().toString(36).substring(2, 9),
    sessaoCaixaSalaoId: sessao.id,
    numeroIdentificador: nomeFinal,
    posX: 120,
    posY: 120,
    largura: 100,
    altura: 100,
    formato: 'quadrada',
    capacidade: 4,
    statusVisual: 'NO_SALAO',
    statusConsumo: 'LIVRE',
    mesaPaiId: null,
    totalConsumo: 0,
    totalPago: 0,
    pagamentosParciais: [],
    historicoTurno: [],
    updatedAt: new Date().toISOString()
  };

  const updatedSessao: SessaoCaixaSalao = {
    ...sessao,
    mesas: [...sessao.mesas, novaMesa]
  };

  saveFloorSession(updatedSessao);
  logSalaoAudit(sessao.id, 'MESA_EXTRA', novaMesa.numeroIdentificador, { acao: 'Adicionou mesa extra ao mapa' }, operador);

  return { sessao: updatedSessao, mesaAdicionada: novaMesa };
}

// RF05 - Guardar Mesa (Bloqueio se NÃO estiver LIVRE)
export function guardarMesaInstancia(
  sessao: SessaoCaixaSalao,
  mesaId: string,
  operador: string = 'Operador'
): { success: boolean; error?: string; sessao: SessaoCaixaSalao } {
  const mesa = sessao.mesas.find(m => m.id === mesaId);
  if (!mesa) return { success: false, error: 'Mesa não encontrada.', sessao };

  // Regra de Bloqueio RN01 / RF05: Só pode guardar se estiver no estado LIVRE
  if (mesa.statusConsumo !== 'LIVRE') {
    return {
      success: false,
      error: `A ${mesa.numeroIdentificador} possui consumo ativo (${mesa.statusConsumo}) e não pode ser guardada. Encerre os pagamentos primeiro.`,
      sessao
    };
  }

  // Soft Delete visual (statusVisual = 'GUARDADA')
  const updatedMesas = sessao.mesas.map(m => {
    if (m.id === mesaId) {
      return { ...m, statusVisual: 'GUARDADA' as MesaStatusVisual, updatedAt: new Date().toISOString() };
    }
    return m;
  });

  const updatedSessao = { ...sessao, mesas: updatedMesas };
  saveFloorSession(updatedSessao);
  logSalaoAudit(sessao.id, 'MESA_GUARDADA', mesa.numeroIdentificador, { motivo: 'Mesa recolhida para a gaveta' }, operador);

  return { success: true, sessao: updatedSessao };
}

// RF06 - Juntar Mesas (Merge): Mesa Filha vinculada à Mesa Master
export function juntarMesasInstancias(
  sessao: SessaoCaixaSalao,
  mesaFilhaId: string,
  mesaMasterId: string,
  operador: string = 'Operador'
): { success: boolean; error?: string; sessao: SessaoCaixaSalao } {
  if (mesaFilhaId === mesaMasterId) {
    return { success: false, error: 'Uma mesa não pode ser juntada a ela mesma.', sessao };
  }

  const filha = sessao.mesas.find(m => m.id === mesaFilhaId);
  const master = sessao.mesas.find(m => m.id === mesaMasterId);

  if (!filha || !master) {
    return { success: false, error: 'Mesas não encontradas.', sessao };
  }

  // Soma o consumo da filha na master se houver
  const somaConsumo = (master.totalConsumo || 0) + (filha.totalConsumo || 0);
  const somaPago = (master.totalPago || 0) + (filha.totalPago || 0);
  const pagamentosUnificados = [...(master.pagamentosParciais || []), ...(filha.pagamentosParciais || [])];

  const updatedMesas = sessao.mesas.map(m => {
    if (m.id === mesaMasterId) {
      return {
        ...m,
        totalConsumo: somaConsumo,
        totalPago: somaPago,
        pagamentosParciais: pagamentosUnificados,
        statusConsumo: somaConsumo > 0 ? (somaPago >= somaConsumo ? 'PAGA_AGUARDANDO' : somaPago > 0 ? 'PARCIALMENTE_PAGA' : 'OCUPADA_ABERTA') : m.statusConsumo,
        updatedAt: new Date().toISOString()
      };
    }
    if (m.id === mesaFilhaId) {
      return {
        ...m,
        mesaPaiId: mesaMasterId,
        totalConsumo: 0,
        totalPago: 0,
        pagamentosParciais: [],
        updatedAt: new Date().toISOString()
      };
    }
    return m;
  });

  const updatedSessao = { ...sessao, mesas: updatedMesas };
  saveFloorSession(updatedSessao);
  logSalaoAudit(
    sessao.id,
    'MESA_JUNTA',
    filha.numeroIdentificador,
    { vinculadaA: master.numeroIdentificador, masterId: master.id },
    operador
  );

  return { success: true, sessao: updatedSessao };
}

// RF06 - Separar Mesas (Split)
export function separarMesaInstancia(
  sessao: SessaoCaixaSalao,
  mesaFilhaId: string,
  operador: string = 'Operador'
): { success: boolean; error?: string; sessao: SessaoCaixaSalao } {
  const filha = sessao.mesas.find(m => m.id === mesaFilhaId);
  if (!filha || !filha.mesaPaiId) {
    return { success: false, error: 'Esta mesa não possui nenhum vínculo ativo.', sessao };
  }

  const master = sessao.mesas.find(m => m.id === filha.mesaPaiId);
  const nomeMaster = master?.numeroIdentificador || 'Mesa Pai';

  const updatedMesas = sessao.mesas.map(m => {
    if (m.id === mesaFilhaId) {
      return { ...m, mesaPaiId: null, statusConsumo: 'LIVRE' as MesaStatusConsumo, updatedAt: new Date().toISOString() };
    }
    return m;
  });

  const updatedSessao = { ...sessao, mesas: updatedMesas };
  saveFloorSession(updatedSessao);
  logSalaoAudit(
    sessao.id,
    'MESA_SEPARADA',
    filha.numeroIdentificador,
    { desvinculadaDe: nomeMaster },
    operador
  );

  return { success: true, sessao: updatedSessao };
}

// Lançar Consumo na Mesa (Abertura / Inclusão de Pedido)
export function lancarConsumoNaMesa(
  sessao: SessaoCaixaSalao,
  mesaId: string,
  novoTotal: number,
  clienteNome?: string,
  operador: string = 'Operador'
): SessaoCaixaSalao {
  const updatedMesas = sessao.mesas.map(m => {
    if (m.id === mesaId) {
      const consumoAtual = m.totalConsumo || 0;
      const consumoFinal = consumoAtual + novoTotal;
      const statusFinal: MesaStatusConsumo = 
        m.totalPago >= consumoFinal ? 'PAGA_AGUARDANDO' : 
        m.totalPago > 0 ? 'PARCIALMENTE_PAGA' : 'OCUPADA_ABERTA';

      return {
        ...m,
        statusConsumo: statusFinal,
        totalConsumo: consumoFinal,
        clienteNome: clienteNome?.trim() || m.clienteNome || 'Cliente',
        abertaEm: m.abertaEm || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return m;
  });

  const updatedSessao = { ...sessao, mesas: updatedMesas };
  saveFloorSession(updatedSessao);
  const mesaAlvo = sessao.mesas.find(m => m.id === mesaId);
  logSalaoAudit(
    sessao.id,
    'MESA_ABERTA',
    mesaAlvo?.numeroIdentificador || 'Mesa',
    { valorLancado: novoTotal, cliente: clienteNome },
    operador
  );

  return updatedSessao;
}

// Lançar Pagamento Parcial ou Total na Mesa
export function lancarPagamentoMesa(
  sessao: SessaoCaixaSalao,
  mesaId: string,
  valorPago: number,
  metodo: string,
  operador: string = 'Operador'
): { success: boolean; sessao: SessaoCaixaSalao; saldoRestante: number; error?: string } {
  let saldo = 0;
  const mesa = sessao.mesas.find(m => m.id === mesaId);
  if (!mesa) return { success: false, sessao, saldoRestante: 0, error: 'Mesa não encontrada.' };

  const novoTotalPago = (mesa.totalPago || 0) + valorPago;
  saldo = Math.max(0, (mesa.totalConsumo || 0) - novoTotalPago);

  const novoPagamento: PagamentoParcial = {
    id: 'pag_' + Date.now().toString(36),
    valor: valorPago,
    metodo,
    operador,
    pagoEm: new Date().toISOString()
  };

  const statusFinal: MesaStatusConsumo = saldo <= 0.01 ? 'PAGA_AGUARDANDO' : 'PARCIALMENTE_PAGA';

  const updatedMesas = sessao.mesas.map(m => {
    if (m.id === mesaId) {
      return {
        ...m,
        totalPago: novoTotalPago,
        statusConsumo: statusFinal,
        pagamentosParciais: [...(m.pagamentosParciais || []), novoPagamento],
        fechadaEm: statusFinal === 'PAGA_AGUARDANDO' ? new Date().toISOString() : m.fechadaEm,
        updatedAt: new Date().toISOString()
      };
    }
    return m;
  });

  const updatedSessao = { ...sessao, mesas: updatedMesas };
  saveFloorSession(updatedSessao);
  logSalaoAudit(
    sessao.id,
    saldo <= 0.01 ? 'MESA_PAGA' : 'PAGAMENTO_PARCIAL',
    mesa.numeroIdentificador,
    { valor: valorPago, metodo, saldoRestante: saldo },
    operador
  );

  return { success: true, sessao: updatedSessao, saldoRestante: saldo };
}

// Liberar Mesa (Limpeza & Desocupação -> Arquiva no Histórico do Turno para RF07 Achados e Perdidos)
export function liberarMesaInstancia(
  sessao: SessaoCaixaSalao,
  mesaId: string,
  operador: string = 'Operador'
): SessaoCaixaSalao {
  const mesa = sessao.mesas.find(m => m.id === mesaId);
  if (!mesa) return sessao;

  // Cria registro de histórico do atendimento encerrado
  const historicoItem: HistoricoMesaOcupacao = {
    id: 'hist_' + Date.now().toString(36),
    mesaNumero: mesa.numeroIdentificador,
    clienteNome: mesa.clienteNome || 'Cliente Salão',
    abertaEm: mesa.abertaEm || new Date().toISOString(),
    fechadaEm: new Date().toISOString(),
    totalConsumo: mesa.totalConsumo,
    totalPago: mesa.totalPago,
    garcomOuOperador: operador,
    itensConsumidos: [],
    pagamentos: mesa.pagamentosParciais || []
  };

  const updatedMesas = sessao.mesas.map(m => {
    if (m.id === mesaId) {
      return {
        ...m,
        statusConsumo: 'LIVRE' as MesaStatusConsumo,
        totalConsumo: 0,
        totalPago: 0,
        clienteNome: null,
        garcom: null,
        abertaEm: null,
        fechadaEm: null,
        pagamentosParciais: [],
        historicoTurno: [historicoItem, ...(m.historicoTurno || [])],
        updatedAt: new Date().toISOString()
      };
    }
    return m;
  });

  const updatedSessao = { ...sessao, mesas: updatedMesas };
  saveFloorSession(updatedSessao);
  logSalaoAudit(
    sessao.id,
    'MESA_LIBERADA',
    mesa.numeroIdentificador,
    { totalEncerrado: mesa.totalConsumo, cliente: mesa.clienteNome },
    operador
  );

  return updatedSessao;
}

// Restaurar Posições Padrão (Move apenas as mesas LIVRES para a planta do template mestre)
export function restaurarPosicoesPadraoInstancias(
  sessao: SessaoCaixaSalao
): SessaoCaixaSalao {
  const templates = getStoredLayoutTemplates();
  const tpl = templates.find(t => t.id === sessao.layoutOrigemId) || DEFAULT_LAYOUT_TEMPLATES[0];

  const updatedMesas = sessao.mesas.map(m => {
    // Apenas mesas livres são reposicionadas para não atrapalhar atendimentos em andamento!
    if (m.statusConsumo === 'LIVRE' && !m.mesaPaiId) {
      const baseItem = tpl.items.find(it => it.numeroIdentificador.toLowerCase() === m.numeroIdentificador.toLowerCase());
      if (baseItem) {
        return { ...m, posX: baseItem.posX, posY: baseItem.posY, updatedAt: new Date().toISOString() };
      }
    }
    return m;
  });

  const updatedSessao = { ...sessao, mesas: updatedMesas };
  saveFloorSession(updatedSessao);
  return updatedSessao;
}
