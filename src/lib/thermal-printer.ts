/**
 * Utilitário de Impressão Térmica ESC/POS de Alta Legibilidade e Sem Cortes
 * 
 * Suporta bobinas de 80mm (72mm útil) e 58mm (48mm útil), com box-sizing estrito,
 * quebra de palavras segura, avanço de papel inferior para respiro de corte
 * e prontidão verificável por document.fonts.ready e requestAnimationFrame.
 */

import { PrinterProfile, DEFAULT_PRINTER_PROFILE, getActiveCentralConfig } from './central-config';

let isGlobalPrintingLock = false;

export interface ThermalPrintOptions {
  title?: string;
  printerProfile?: PrinterProfile;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

function buildPrintEngineCss(profile: PrinterProfile): string {
  const widthMm = profile.printableWidthMm || (profile.paperWidth === '58mm' ? 48 : 72);
  const feedLines = typeof profile.feedLines === 'number' ? profile.feedLines : 4;
  const bottomPaddingMm = Math.max(8, feedLines * 3.5);

  let fontScaleMulti = 1;
  if (profile.fontSizeScale === 'compact') fontScaleMulti = 0.9;
  if (profile.fontSizeScale === 'large') fontScaleMulti = 1.1;

  return `
    @media screen {
      #thermal-print-mount {
        display: none !important;
      }
    }

    @media print {
      @page {
        margin: 0 !important;
        size: auto !important;
      }

      /* Oculta absolutamente todos os filhos do body exceto o nó térmico exclusivo */
      body > *:not(#thermal-print-mount) {
        display: none !important;
      }

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${widthMm}mm !important;
        max-width: ${widthMm}mm !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
        font-weight: 800 !important;
        line-height: 1.25 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      #thermal-print-mount,
      #thermal-print-mount * {
        box-sizing: border-box !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      #thermal-print-mount {
        display: block !important;
        position: static !important;
        width: ${widthMm}mm !important;
        max-width: ${widthMm}mm !important;
        margin: 0 auto !important;
        padding: 2mm 1.5mm ${bottomPaddingMm}mm 1.5mm !important;
        background: #ffffff !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
      }

      #thermal-print-mount .break-inside-avoid {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      /* Destaques Térmicos Sólidos (Preto Invertido 100% Opaco) */
      #thermal-print-mount .bg-black {
        background-color: #000000 !important;
        color: #ffffff !important;
        border: 1px solid #000000 !important;
        padding: 2px 4px !important;
      }
      #thermal-print-mount .bg-black * {
        color: #ffffff !important;
      }
      #thermal-print-mount .text-white {
        color: #ffffff !important;
      }

      /* Divisores Térmicos Escuros */
      #thermal-print-mount .border-b,
      #thermal-print-mount .border-t,
      #thermal-print-mount .border-b-2,
      #thermal-print-mount .border-t-2 {
        border-color: #000000 !important;
        border-width: 2px !important;
      }
      #thermal-print-mount .border-dashed {
        border-style: dashed !important;
      }
      #thermal-print-mount .border-dotted {
        border-style: solid !important;
      }

      /* Tipografia calibrada de Alta Visibilidade para Bobinas */
      #thermal-print-mount .font-normal { font-weight: 700 !important; }
      #thermal-print-mount .font-semibold,
      #thermal-print-mount .font-bold { font-weight: 800 !important; }
      #thermal-print-mount .font-black,
      #thermal-print-mount .font-extrabold { font-weight: 900 !important; }

      #thermal-print-mount .text-[9px] { font-size: ${Math.round(11 * fontScaleMulti)}px !important; font-weight: 700 !important; }
      #thermal-print-mount .text-[10px] { font-size: ${Math.round(11 * fontScaleMulti)}px !important; font-weight: 800 !important; }
      #thermal-print-mount .text-[11px] { font-size: ${Math.round(12 * fontScaleMulti)}px !important; font-weight: 800 !important; }
      #thermal-print-mount .text-xs { font-size: ${Math.round(12 * fontScaleMulti)}px !important; font-weight: 800 !important; }
      #thermal-print-mount .text-sm { font-size: ${Math.round(14 * fontScaleMulti)}px !important; font-weight: 800 !important; }
      #thermal-print-mount .text-base { font-size: ${Math.round(16 * fontScaleMulti)}px !important; font-weight: 900 !important; }
      #thermal-print-mount .text-lg { font-size: ${Math.round(18 * fontScaleMulti)}px !important; font-weight: 900 !important; }
    }
  `;
}

function updatePrintEngineStyles(profile: PrinterProfile) {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById('thermal-print-engine-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'thermal-print-engine-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildPrintEngineCss(profile);
}

/**
 * Aguarda a prontidão real do documento (fontes carregadas e dois quadros de renderização)
 */
async function waitForPrintReadiness(): Promise<void> {
  if (typeof document === 'undefined') return;

  // 1. Aguarda carregamento das fontes do documento se a API estiver disponível
  if ('fonts' in document && document.fonts && typeof document.fonts.ready?.then === 'function') {
    try {
      await document.fonts.ready;
    } catch {
      // Ignora erro em fontes externas
    }
  }

  // 2. Aguarda ciclos de animação para garantir que o layout shift estabilizou
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

/**
 * Executa a impressão térmica com controle de concorrência e limpeza garantida
 */
export async function printThermalElement(
  elementIdOrHtml: string,
  titleOrOptions: string | ThermalPrintOptions = 'Comprovante Hum Vício'
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const options: ThermalPrintOptions = typeof titleOrOptions === 'string'
    ? { title: titleOrOptions }
    : titleOrOptions;

  if (isGlobalPrintingLock) {
    console.warn('[ThermalPrinter] Impressão já em andamento. Aguardando...');
    return false;
  }
  isGlobalPrintingLock = true;

  const unlockSafetyTimer = setTimeout(() => {
    isGlobalPrintingLock = false;
  }, 4000);

  try {
    // 1. Obter conteúdo HTML a ser impresso
    let contentHtml = '';
    const el = document.getElementById(elementIdOrHtml);
    if (el) {
      contentHtml = el.innerHTML;
    } else {
      contentHtml = elementIdOrHtml;
    }

    if (!contentHtml || !contentHtml.trim()) {
      console.warn('[ThermalPrinter] Nenhum conteúdo disponível para impressão.');
      isGlobalPrintingLock = false;
      clearTimeout(unlockSafetyTimer);
      return false;
    }

    // 2. Obter perfil efetivo da impressora
    const profile = options.printerProfile || getActiveCentralConfig().printerProfile || DEFAULT_PRINTER_PROFILE;

    // 3. Atualizar folha de estilo de acordo com a bobina
    updatePrintEngineStyles(profile);

    // 4. Montar nó exclusivo no document.body
    let printMount = document.getElementById('thermal-print-mount');
    if (!printMount) {
      printMount = document.createElement('div');
      printMount.id = 'thermal-print-mount';
      document.body.appendChild(printMount);
    }

    // Insere o conteúdo com espaçador de rodapé para respiro de corte
    const feedLines = profile.feedLines || 4;
    const feedSpacer = `<div style="height: ${feedLines * 4}mm; display: block; clear: both;" aria-hidden="true"></div>`;
    printMount.innerHTML = contentHtml + feedSpacer;

    // 5. Configurar limpeza pós-impressão
    const handleAfterPrint = () => {
      if (printMount) {
        printMount.innerHTML = '';
      }
      isGlobalPrintingLock = false;
      clearTimeout(unlockSafetyTimer);
      window.removeEventListener('afterprint', handleAfterPrint);
      options.onComplete?.();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    // 6. Aguardar prontidão real antes de abrir diálogo
    await waitForPrintReadiness();

    const previousTitle = document.title;
    if (options.title) {
      document.title = options.title;
    }

    try {
      window.print();
      return true;
    } finally {
      if (options.title) {
        setTimeout(() => {
          document.title = previousTitle;
        }, 500);
      }
    }
  } catch (err) {
    console.error('[ThermalPrinter] Erro durante disparo de impressão:', err);
    isGlobalPrintingLock = false;
    clearTimeout(unlockSafetyTimer);
    options.onError?.(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * Atalho para impressão direta de string HTML renderizada
 */
export async function printThermalHtml(
  html: string,
  options?: ThermalPrintOptions
): Promise<boolean> {
  return printThermalElement(html, options);
}
