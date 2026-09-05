/**
 * Utilitário de Impressão Térmica ESC/POS de Alta Legibilidade e Estritamente 1 Página
 * Resolve o problema de duplicação (Páginas 1 e 2) montando um nó exclusivo direto no body
 * e ocultando todo o restante da aplicação com 'display: none !important', garantindo que
 * o documento tenha altura exata de 1 página.
 */

let isGlobalPrintingLock = false;

const PRINT_ENGINE_CSS = `
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
      width: 72mm !important;
      max-width: 72mm !important;
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

    #thermal-print-mount {
      display: block !important;
      position: static !important;
      width: 72mm !important;
      max-width: 72mm !important;
      margin: 0 !important;
      padding: 1mm 1mm 2mm 1mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    #thermal-print-mount * {
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Destaques Térmicos Sólidos (Preto Invertido 100% Opaco) */
    #thermal-print-mount .bg-black {
      background-color: #000000 !important;
      color: #ffffff !important;
      border: 1px solid #000000 !important;
      padding: 2px 5px !important;
    }
    #thermal-print-mount .bg-black * {
      color: #ffffff !important;
    }
    #thermal-print-mount .text-white {
      color: #ffffff !important;
    }

    /* Divisores Térmicos Escuros (2px) */
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

    /* Tipografia de Alta Visibilidade */
    #thermal-print-mount .font-normal { font-weight: 700 !important; }
    #thermal-print-mount .font-semibold,
    #thermal-print-mount .font-bold { font-weight: 800 !important; }
    #thermal-print-mount .font-black,
    #thermal-print-mount .font-extrabold { font-weight: 900 !important; }

    #thermal-print-mount .text-[9px] { font-size: 11px !important; font-weight: 700 !important; }
    #thermal-print-mount .text-[10px] { font-size: 11px !important; font-weight: 800 !important; }
    #thermal-print-mount .text-[11px] { font-size: 12px !important; font-weight: 800 !important; }
    #thermal-print-mount .text-xs { font-size: 12px !important; font-weight: 800 !important; }
    #thermal-print-mount .text-sm { font-size: 14px !important; font-weight: 800 !important; }
    #thermal-print-mount .text-base { font-size: 16px !important; font-weight: 900 !important; }
    #thermal-print-mount .text-lg { font-size: 18px !important; font-weight: 900 !important; }
  }
`;

function ensurePrintEngineStyles() {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById('thermal-print-engine-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'thermal-print-engine-style';
    styleEl.textContent = PRINT_ENGINE_CSS;
    document.head.appendChild(styleEl);
  }
}

export function printThermalElement(elementIdOrHtml: string, title = 'Comprovante Hum Vício') {
  if (typeof window === 'undefined') return;

  if (isGlobalPrintingLock) {
    console.warn('Impressão já em andamento. Aguardando...');
    return;
  }
  isGlobalPrintingLock = true;
  setTimeout(() => {
    isGlobalPrintingLock = false;
  }, 2000);

  // 1. Obter conteúdo HTML a ser impresso
  let contentHtml = '';
  const el = document.getElementById(elementIdOrHtml);
  if (el) {
    contentHtml = el.innerHTML;
  } else {
    contentHtml = elementIdOrHtml;
  }

  if (!contentHtml || !contentHtml.trim()) {
    alert('Nenhum conteúdo disponível para impressão.');
    isGlobalPrintingLock = false;
    return;
  }

  // 2. Injetar folha de estilo de impressão estrita de 1 página
  ensurePrintEngineStyles();

  // 3. Montar nó exclusivo no document.body
  let printMount = document.getElementById('thermal-print-mount');
  if (!printMount) {
    printMount = document.createElement('div');
    printMount.id = 'thermal-print-mount';
    document.body.appendChild(printMount);
  }

  printMount.innerHTML = contentHtml;

  // 4. Configurar limpeza após impressão
  const handleAfterPrint = () => {
    if (printMount) {
      printMount.innerHTML = '';
    }
    window.removeEventListener('afterprint', handleAfterPrint);
  };
  window.addEventListener('afterprint', handleAfterPrint);

  // 5. Disparar impressão nativa direta (garantidamente 1 página!)
  setTimeout(() => {
    try {
      window.print();
    } catch (err) {
      console.warn('Erro ao disparar impressão:', err);
    }
  }, 100);
}
