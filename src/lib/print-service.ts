/**
 * Serviço Unificado de Impressão Térmica, Fila de Trabalhos e Deduplicação
 * 
 * Atende às Seções 4, 5 e 6 de PLANO-TECNICO-PDV-CARRINHO-IMPRESSAO-E-SEGURANCA.md:
 * - Fila de trabalhos tipada com deduplicação de cliques múltiplos
 * - Reimpressão explícita com rastreabilidade e marcação
 * - Renderização de HTML independente de modais da tela
 * - Suporte a perfis de 80mm e 58mm sem corte de rodapé
 */

import { Sale, Product, InventoryItem } from './store/types';
import {
  PrinterProfile,
  ReceiptTemplateConfig,
  DEFAULT_PRINTER_PROFILE,
  DEFAULT_RECEIPT_TEMPLATE,
  getActiveCentralConfig
} from './central-config';
import { buildKitchenTicket, KitchenTicketData } from './kitchen-ticket';
import { getBurgerPrintDetails } from './production-calculator';
import { printThermalHtml } from './thermal-printer';

export type TicketType = 'cozinha' | 'cliente' | 'diferencial';
export type TicketDestination = 'cozinha' | 'balcao' | 'ambos';
export type PrintJobStatus = 'pendente' | 'enviando' | 'aceito_transporte' | 'falhou' | 'desconhecido';

export interface PrintJob {
  id: string;
  saleId: string;
  saleRevision: number;
  ticketType: TicketType;
  destination: TicketDestination;
  layoutVersion: number;
  copyNumber: number;
  isReprint: boolean;
  reprintReason?: string;
  operator: string;
  status: PrintJobStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrintJobInput {
  sale: Sale;
  ticketType: TicketType;
  destination?: TicketDestination;
  operator?: string;
  isReprint?: boolean;
  reprintReason?: string;
  products?: Product[];
  inventoryItems?: InventoryItem[];
  printerProfile?: PrinterProfile;
  receiptTemplate?: ReceiptTemplateConfig;
}

export interface PrintJobResult {
  job: PrintJob;
  isDuplicate: boolean;
  success: boolean;
  error?: string;
}

const RECENT_JOBS_STORAGE_KEY = 'hum_vicio_recent_print_jobs_v1';
const DEDUPLICATION_WINDOW_MS = 10_000; // 10 segundos contra duplo clique acidental

// Fila em memória dos últimos jobs
const activeJobsMap = new Map<string, PrintJob>();

function generateJobKey(saleId: string, revision: number, type: TicketType, dest: TicketDestination): string {
  return `${saleId}:${revision}:${type}:${dest}`;
}

export function generatePrintJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Renderiza o documento HTML da Comanda da Cozinha
 */
export function renderKitchenTicketHtml(
  ticket: KitchenTicketData,
  options: {
    template: ReceiptTemplateConfig;
    profile: PrinterProfile;
    isPendingSync?: boolean;
  }
): string {
  const { header, items, productionSummary, diff } = ticket;
  const is58mm = options.profile.paperWidth === '58mm';

  let html = `
    <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: ${is58mm ? '11px' : '12px'}; color: #000; line-height: 1.25;">
  `;

  // Identificação de pedido pendente de sincronização
  if (options.isPendingSync) {
    html += `
      <div style="border: 2px solid #000; padding: 2px 4px; margin-bottom: 4px; text-align: center; font-weight: 900; font-size: 11px;">
        *** AGUARDANDO SINCRONIZAÇÃO (OFFLINE) ***
      </div>
    `;
  }

  // Se for via diferencial
  if (header.isDifferential && diff) {
    html += `
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="border: 1px solid #000; padding: 2px; margin-bottom: 4px; font-weight: 900; text-transform: uppercase;">
          *** ALTERAÇÃO DO PEDIDO ***
        </div>
        <div style="font-weight: 900; font-size: ${is58mm ? '13px' : '14px'}; text-transform: uppercase;">
          CLIENTE: ${header.customerName}
        </div>
        <div style="font-weight: 700; font-size: 11px;">
          Pedido ${header.orderIdShort} • ${header.time} ${header.orderType ? `• ${header.orderType.toUpperCase()}` : ''}
        </div>
      </div>
    `;

    // Itens adicionados / cancelados / modificados
    if (diff.added.length > 0) {
      html += `<div style="font-weight: 900; font-size: 11px; margin-top: 4px;">ITENS ADICIONADOS (+):</div>`;
      for (const item of diff.added) {
        html += `
          <div style="padding-left: 6px; border-left: 2px solid #000; margin-bottom: 4px;">
            <div style="font-weight: 900; font-size: 12px;">[+] ${item.quantity}x ${item.productName.toUpperCase()}</div>
            ${item.pattiesComposition ? `<div style="font-weight: 700;">${item.pattiesComposition}</div>` : ''}
            ${item.comboInfo ? `<div style="font-weight: 800;">${item.comboInfo.label}</div>` : ''}
            ${item.meatPoint ? `<div style="font-weight: 800;">Ponto: ${item.meatPoint}</div>` : ''}
            ${item.additionals.map(a => `<div style="font-weight: 800;">${a.label}</div>`).join('')}
            ${item.removals.map(r => `<div style="font-weight: 900;">RETIRAR: ${r.toUpperCase()}</div>`).join('')}
            ${item.notes ? `<div style="font-weight: 900;">OBS: ${item.notes.toUpperCase()}</div>` : ''}
          </div>
        `;
      }
    }

    if (diff.removed.length > 0) {
      html += `<div style="font-weight: 900; font-size: 11px; margin-top: 4px;">ITENS CANCELADOS (-):</div>`;
      for (const item of diff.removed) {
        html += `
          <div style="padding-left: 6px; border-left: 2px dashed #000; text-decoration: line-through; font-weight: 800;">
            [-] ${item.quantity}x ${item.productName.toUpperCase()} (CANCELADO)
          </div>
        `;
      }
    }

    html += `
      <div style="text-align: center; font-weight: 900; font-size: 11px; border-top: 2px dashed #000; padding-top: 6px; margin-top: 8px;">
        *** NÃO REPETIR ITENS JÁ PREPARADOS ***
      </div>
      </div>
    `;
    return html;
  }

  // --- VIA REGULAR DA COZINHA ---
  html += `
    <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
      ${header.isReprint ? `
        <div style="border: 2px solid #000; padding: 2px 4px; margin-bottom: 4px; font-weight: 900; text-transform: uppercase;">
          *** REIMPRESSÃO — MESMO PEDIDO ***
        </div>
      ` : ''}
      <div style="font-weight: 900; font-size: ${is58mm ? '13px' : '15px'}; text-transform: uppercase;">
        CLIENTE: ${header.customerName}
      </div>
      <div style="font-weight: 800; font-size: 11px; margin-top: 2px;">
        Pedido ${header.orderIdShort} | ${header.time} ${header.orderType ? `| ${header.orderType === 'mesa' && header.tableNumber ? `Mesa ${header.tableNumber}` : header.orderType.toUpperCase()}` : ''}
      </div>
    </div>
  `;

  // Itens
  html += `<div style="border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">`;
  for (const item of items) {
    html += `
      <div class="break-inside-avoid" style="margin-bottom: 6px; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-weight: 900; font-size: ${is58mm ? '12px' : '13px'};">
          ${item.quantity}x ${item.productName.toUpperCase()}
        </div>
        <div style="padding-left: 8px; font-size: 11px;">
          ${item.pattiesComposition ? `<div style="font-weight: 700;">${item.pattiesComposition}</div>` : ''}
          ${item.comboInfo ? `<div style="font-weight: 800;">${item.comboInfo.label}</div>` : ''}
          ${item.meatPoint ? `<div style="font-weight: 800;">Ponto: ${item.meatPoint}</div>` : ''}
          ${item.additionals.map(a => `<div style="font-weight: 800;">${a.label}</div>`).join('')}
          ${item.removals.map(r => `<div style="font-weight: 900;">RETIRAR: ${r.toUpperCase()}</div>`).join('')}
          ${item.notes ? `<div style="font-weight: 900;">OBS: ${item.notes.toUpperCase()}</div>` : ''}
          ${options.template.showMontagem && item.recipeIngredients && item.recipeIngredients.length > 0
            ? `<div style="font-size: 10px; font-weight: 700; color: #333; margin-top: 2px;">Montagem: ${item.recipeIngredients.join(' • ')}</div>`
            : ''}
        </div>
      </div>
    `;
  }
  html += `</div>`;

  // Resumo de Produção (Chapa e Fritadeira)
  if (options.template.showStationSummary) {
    html += `
      <div class="break-inside-avoid" style="margin-top: 4px; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-weight: 900; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
          RESUMO DE PRODUÇÃO
        </div>
    `;

    // Chapa
    if (productionSummary.chapa.status === 'a_conferir') {
      html += `<div style="font-weight: 900; text-transform: uppercase;">CHAPA: QUANTIDADE A CONFERIR</div>`;
    } else if (productionSummary.chapa.status !== 'sem_carnes') {
      html += `
        <div style="font-weight: 900; text-transform: uppercase;">CHAPA — ${productionSummary.chapa.pattiesLabel}</div>
        ${productionSummary.chapa.pattiesBreakdown.map(p => `<div style="padding-left: 6px; font-weight: 700;">${p.label}</div>`).join('')}
      `;
    }

    if (productionSummary.chapa.otherItems.length > 0) {
      html += `
        <div style="font-weight: 900; text-transform: uppercase; margin-top: 4px;">OUTROS NA CHAPA</div>
        ${productionSummary.chapa.otherItems.map(o => `<div style="padding-left: 6px; font-weight: 700;">${o.label}</div>`).join('')}
      `;
    }

    // Fritadeira
    if (productionSummary.fritadeira.status === 'a_conferir') {
      html += `<div style="font-weight: 900; text-transform: uppercase; margin-top: 4px;">FRITADEIRA: QUANTIDADE A CONFERIR</div>`;
    } else if (productionSummary.fritadeira.status !== 'sem_itens') {
      html += `
        <div style="font-weight: 900; text-transform: uppercase; margin-top: 4px;">FRITADEIRA</div>
        ${productionSummary.fritadeira.items.map(f => `<div style="padding-left: 6px; font-weight: 700;">${f.label}</div>`).join('')}
      `;
    }

    if (productionSummary.otherStations) {
      for (const [station, entries] of Object.entries(productionSummary.otherStations)) {
        const stationLabel = ({ oven: 'FORNO', cold: 'PREPARO FRIO', assembly: 'MONTAGEM', other: 'OUTROS' } as Record<string, string>)[station] || station.toUpperCase();
        html += `
          <div style="font-weight: 900; text-transform: uppercase; margin-top: 4px;">${stationLabel}</div>
          ${entries.map(e => `<div style="padding-left: 6px; font-weight: 700;">${e.label}</div>`).join('')}
        `;
      }
    }

    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/**
 * Renderiza o documento HTML do Cupom de Conferência do Cliente
 */
export function renderClientReceiptHtml(
  sale: Sale,
  options: {
    template: ReceiptTemplateConfig;
    profile: PrinterProfile;
    products?: Product[];
    inventoryItems?: InventoryItem[];
  }
): string {
  const is58mm = options.profile.paperWidth === '58mm';
  const formattedDate = new Date(sale.date).toLocaleDateString('pt-BR');
  const formattedTime = new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let html = `
    <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: ${is58mm ? '11px' : '12px'}; color: #000; line-height: 1.25;">
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: 900; font-size: ${is58mm ? '13px' : '15px'}; text-transform: uppercase;">
          ${options.template.storeName}
        </div>
        <div style="font-size: 10px; font-weight: 700;">CNPJ: ${options.template.storeCnpj}</div>
        <div style="font-size: 10px; font-weight: 800; margin-top: 2px;">CUPOM NÃO FISCAL DE CONFERÊNCIA</div>
        <div style="font-weight: 800; font-size: 11px; margin-top: 2px;">
          PEDIDO #${sale.id.slice(0, 6).toUpperCase()} • ${(sale.channel || 'BALCÃO').toUpperCase()}
        </div>
        ${sale.customerName ? `<div style="font-weight: 800; font-size: 11px;">CLIENTE: ${sale.customerName}</div>` : ''}
        <div style="font-size: 10px; font-weight: 700;">${formattedDate} - ${formattedTime}</div>
      </div>

      <div style="border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
          <span>ITEM</span>
          <span>VALOR</span>
        </div>
  `;

  for (const item of sale.items || []) {
    const details = getBurgerPrintDetails(item, options.products || [], options.inventoryItems || []);
    const totalLine = ((item.unitPrice || 0) * item.quantity).toFixed(2);

    html += `
      <div style="margin-bottom: 4px;">
        <div style="display: flex; justify-content: space-between; font-weight: 800;">
          <span style="max-width: 75%;">${item.quantity}x ${item.productName}</span>
          <span>R$ ${totalLine}</span>
        </div>
        <div style="padding-left: 8px; font-size: 10px; font-weight: 700;">
          ${details.comboDetails ? `<div>+ ${details.comboDetails.title}</div>` : item.combo ? `<div>+ ${item.combo.toUpperCase()}</div>` : ''}
          ${item.meatPoint ? `<div>* PONTO: ${item.meatPoint.toUpperCase()}</div>` : ''}
          ${item.additionals && item.additionals.length > 0 ? `<div>+ ADIC: ${item.additionals.map(a => a.name).join(', ')}</div>` : ''}
          ${item.removals && item.removals.length > 0 ? `<div>- RETIRAR: ${item.removals.map(r => r.toUpperCase()).join(', ')}</div>` : ''}
          ${item.notes ? `<div>*** OBS: ${item.notes.toUpperCase()} ***</div>` : ''}
        </div>
      </div>
    `;
  }

  html += `
      </div>

      <div style="border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-weight: 800; font-size: 11px;">
        ${sale.subtotal !== undefined ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>R$ ${sale.subtotal.toFixed(2)}</span>
          </div>
        ` : ''}
        ${sale.discount ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Desconto:</span>
            <span>- R$ ${sale.discount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${sale.deliveryFee ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Taxa de Entrega:</span>
            <span>+ R$ ${sale.deliveryFee.toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: ${is58mm ? '13px' : '14px'}; font-weight: 900; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px;">
          <span>TOTAL:</span>
          <span>R$ ${sale.total.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 3px; font-size: 10px;">
          <span>PAGAMENTO:</span>
          <span style="font-weight: 900; text-transform: uppercase;">${sale.paymentMethod}</span>
        </div>
      </div>

      <div style="text-align: center; font-size: 10px; font-weight: 700; margin-top: 4px;">
        <div>OBRIGADO PELA PREFERÊNCIA!</div>
        <div>VOLTE SEMPRE! 🍔</div>
      </div>
    </div>
  `;

  return html;
}

/**
 * Enfileira e despacha um trabalho de impressão com deduplicação
 */
export async function enqueuePrintJob(input: CreatePrintJobInput): Promise<PrintJobResult> {
  const config = getActiveCentralConfig();
  const profile = input.printerProfile || config.printerProfile || DEFAULT_PRINTER_PROFILE;
  const template = input.receiptTemplate || config.receiptTemplate || DEFAULT_RECEIPT_TEMPLATE;
  const destination = input.destination || (input.ticketType === 'cliente' ? 'balcao' : 'cozinha');
  const revision = typeof (input.sale as { revision?: number }).revision === 'number' ? (input.sale as { revision?: number }).revision! : 1;
  const operator = input.operator || 'Operador Balcão';

  const jobKey = generateJobKey(input.sale.id, revision, input.ticketType, destination);

  // 1. Verificação de deduplicação (mesmo pedido, revisão, tipo e destino recente)
  const existingJob = activeJobsMap.get(jobKey);
  const now = Date.now();
  if (existingJob && !input.isReprint) {
    const elapsed = now - new Date(existingJob.createdAt).getTime();
    if (elapsed < DEDUPLICATION_WINDOW_MS || existingJob.status === 'enviando') {
      console.warn(`[PrintService] Impressão duplicada suprimida para ${jobKey} (${elapsed}ms atrás)`);
      return {
        job: existingJob,
        isDuplicate: true,
        success: true,
      };
    }
  }

  // 2. Criar novo job
  const jobId = generatePrintJobId();
  const copyNumber = existingJob ? existingJob.copyNumber + 1 : 1;
  const isReprint = Boolean(input.isReprint || copyNumber > 1);

  const job: PrintJob = {
    id: jobId,
    saleId: input.sale.id,
    saleRevision: revision,
    ticketType: input.ticketType,
    destination,
    layoutVersion: 2,
    copyNumber,
    isReprint,
    reprintReason: input.reprintReason,
    operator,
    status: 'enviando',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  activeJobsMap.set(jobKey, job);

  // 3. Renderizar documento HTML de acordo com o tipo
  let contentHtml = '';
  if (input.ticketType === 'cozinha' || input.ticketType === 'diferencial') {
    const ticketData = buildKitchenTicket({
      sale: input.sale,
      products: input.products,
      inventoryItems: input.inventoryItems,
      showMontagem: template.showMontagem,
      isReprint,
    });
    contentHtml = renderKitchenTicketHtml(ticketData, {
      template,
      profile,
      isPendingSync: Boolean((input.sale as { isDraft?: boolean }).isDraft || (input.sale as { isPendingSync?: boolean }).isPendingSync),
    });
  } else {
    contentHtml = renderClientReceiptHtml(input.sale, {
      template,
      profile,
      products: input.products,
      inventoryItems: input.inventoryItems,
    });
  }

  // 4. Despachar para o motor térmico sem cortes
  try {
    const title = `${input.ticketType === 'cozinha' ? 'Comanda Cozinha' : 'Cupom'} #${input.sale.id.slice(0, 6).toUpperCase()}`;
    const printed = await printThermalHtml(contentHtml, {
      title,
      printerProfile: profile,
    });

    job.status = printed ? 'aceito_transporte' : 'falhou';
    job.updatedAt = new Date().toISOString();
    activeJobsMap.set(jobKey, job);

    return {
      job,
      isDuplicate: false,
      success: printed,
    };
  } catch (err) {
    job.status = 'falhou';
    job.updatedAt = new Date().toISOString();
    activeJobsMap.set(jobKey, job);

    return {
      job,
      isDuplicate: false,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Solicitação explícita de Reimpressão de um pedido já impresso
 */
export async function requestReprint(
  sale: Sale,
  ticketType: TicketType,
  options?: {
    reason?: string;
    operator?: string;
    products?: Product[];
    inventoryItems?: InventoryItem[];
  }
): Promise<PrintJobResult> {
  return enqueuePrintJob({
    sale,
    ticketType,
    isReprint: true,
    reprintReason: options?.reason || 'Reimpressão solicitada pelo operador',
    operator: options?.operator,
    products: options?.products,
    inventoryItems: options?.inventoryItems,
  });
}

/**
 * Consulta o status de um trabalho de impressão
 */
export function getPrintJobStatus(saleId: string, ticketType: TicketType = 'cozinha'): PrintJob | undefined {
  const revision = 1;
  const key = generateJobKey(saleId, revision, ticketType, ticketType === 'cliente' ? 'balcao' : 'cozinha');
  return activeJobsMap.get(key);
}
