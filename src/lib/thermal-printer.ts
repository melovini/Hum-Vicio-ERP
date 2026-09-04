/**
 * Utilitário de Impressão Térmica ESC/POS de Alta Legibilidade e Contraste
 * Otimizado para bobinas térmicas de 80mm / 72mm imprimível (Tanca, Bematech, Elgin, Epson).
 * Utiliza tipografia encorpada (Arial Bold/Black) em 100% preto (#000000) para cabeças de 203 DPI,
 * e controle rigoroso de debounce para evitar impressões duplicadas na mesma bobina.
 */

let isGlobalPrintingLock = false;

export function printThermalElement(elementIdOrHtml: string, title = 'Comprovante Hum Vício') {
  if (typeof window === 'undefined') return;

  // Trava de segurança para impedir disparos múltiplos acidentais
  if (isGlobalPrintingLock) {
    console.warn('Impressão já em andamento. Aguardando...');
    return;
  }
  isGlobalPrintingLock = true;
  setTimeout(() => {
    isGlobalPrintingLock = false;
  }, 2500);

  // 1. Obter o HTML a ser impresso
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

  // 2. Abrir janela popup dedicada para impressão
  // Contexto isolado do Chrome que evita quebra de sandbox/iframe do motor PDF
  const popup = window.open(
    '', 
    '_blank', 
    'width=420,height=700,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
  );

  const receiptDocumentHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          /* Reset estrito para bobinas térmicas de 80mm (72mm imprimível) */
          @page {
            margin: 0 !important;
            size: auto !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000000 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 72mm !important;
            max-width: 72mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            /* Fonte grossa sem serifa para acionamento firme dos micro-aquecedores de 203 DPI */
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
            font-size: 13px !important;
            font-weight: 800 !important;
            line-height: 1.25 !important;
            -webkit-font-smoothing: antialiased !important;
            text-rendering: geometricPrecision !important;
          }
          body {
            padding: 2mm 1mm 4mm 1mm !important;
          }

          /* Barra superior de suporte (visível apenas na tela da popup, oculta na impressão) */
          .print-toolbar {
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: #ffffff !important;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            border-bottom: 2px solid #1e293b;
          }
          .print-toolbar * {
            color: #ffffff !important;
          }
          .print-actions {
            display: flex;
            gap: 6px;
          }
          .print-toolbar button {
            flex: 1;
            padding: 9px 10px;
            border-radius: 8px;
            border: none;
            font-weight: 900;
            cursor: pointer;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .btn-print {
            background: #10b981 !important;
            color: #ffffff !important;
          }
          .btn-close {
            background: #334155 !important;
            color: #ffffff !important;
          }
          .print-tip {
            font-size: 11px;
            line-height: 1.3;
            color: #fbbf24 !important;
            background: rgba(251, 191, 36, 0.15);
            border: 1px solid rgba(251, 191, 36, 0.3);
            padding: 6px 8px;
            border-radius: 6px;
            text-align: center;
            font-weight: 700;
          }

          /* Utilitários tipográficos encorpados (alto contraste térmico) */
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          
          .font-normal { font-weight: 700 !important; }
          .font-semibold { font-weight: 800 !important; }
          .font-bold { font-weight: 800 !important; }
          .font-black, .font-extrabold { font-weight: 900 !important; }
          .uppercase { text-transform: uppercase !important; }
          .italic { font-style: italic !important; }
          .line-through { text-decoration: line-through !important; }
          
          .text-[9px] { font-size: 11px !important; font-weight: 700 !important; }
          .text-[10px] { font-size: 11px !important; font-weight: 800 !important; }
          .text-[11px] { font-size: 12px !important; font-weight: 800 !important; }
          .text-xs { font-size: 12px !important; font-weight: 800 !important; }
          .text-sm { font-size: 14px !important; font-weight: 800 !important; }
          .text-base { font-size: 16px !important; font-weight: 900 !important; }
          .text-lg { font-size: 18px !important; font-weight: 900 !important; }
          .text-xl { font-size: 20px !important; font-weight: 900 !important; }
          
          /* Divisores térmicos nítidos (2px sólidos ou tracejados grossos) */
          .border-b { border-bottom: 2px solid #000000 !important; }
          .border-b-2 { border-bottom: 2px solid #000000 !important; }
          .border-t { border-top: 2px solid #000000 !important; }
          .border-t-2 { border-top: 2px solid #000000 !important; }
          .border-l-2 { border-left: 3px solid #000000 !important; }
          .border-dashed { border-style: dashed !important; }
          .border-dotted { border-style: solid !important; }
          .border-black { border-color: #000000 !important; }
          
          .flex { display: flex !important; }
          .justify-between { justify-content: space-between !important; }
          .items-start { align-items: flex-start !important; }
          .items-center { align-items: center !important; }
          .shrink-0 { flex-shrink: 0 !important; }
          .inline-block { display: inline-block !important; }
          .block { display: block !important; }
          
          .space-y-1 > * + * { margin-top: 3px !important; }
          .space-y-1.5 > * + * { margin-top: 4px !important; }
          .space-y-2 > * + * { margin-top: 6px !important; }
          .space-y-3 > * + * { margin-top: 8px !important; }
          .space-y-4 > * + * { margin-top: 10px !important; }
          
          .p-1 { padding: 2px 4px !important; }
          .p-2 { padding: 4px 6px !important; }
          .p-5 { padding: 0 !important; }
          .py-0.5 { padding-top: 1px !important; padding-bottom: 1px !important; }
          .py-1 { padding-top: 3px !important; padding-bottom: 3px !important; }
          .py-1.5 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .py-2 { padding-top: 6px !important; padding-bottom: 6px !important; }
          .px-1 { padding-left: 3px !important; padding-right: 3px !important; }
          .px-1.5 { padding-left: 4px !important; padding-right: 4px !important; }
          .px-2 { padding-left: 5px !important; padding-right: 5px !important; }
          
          .pt-1 { padding-top: 3px !important; }
          .pt-2 { padding-top: 5px !important; }
          .pt-4 { padding-top: 8px !important; }
          .pb-1 { padding-bottom: 2px !important; }
          .pb-2 { padding-bottom: 5px !important; }
          .pb-3 { padding-bottom: 6px !important; }
          .pl-1 { padding-left: 3px !important; }
          .pl-2 { padding-left: 5px !important; }
          .pl-3 { padding-left: 8px !important; }
          .pr-2 { padding-right: 5px !important; }
          
          .mt-0.5 { margin-top: 2px !important; }
          .mt-1 { margin-top: 3px !important; }
          .mt-2 { margin-top: 5px !important; }
          .my-1 { margin-top: 3px !important; margin-bottom: 3px !important; }
          .my-1.5 { margin-top: 4px !important; margin-bottom: 4px !important; }
          .mb-1 { margin-bottom: 2px !important; }
          .mb-2 { margin-bottom: 5px !important; }
          
          /* Destaques Térmicos Sólidos (Preto Invertido 100% Opaco) */
          .bg-black {
            background-color: #000000 !important;
            color: #ffffff !important;
            border: 1px solid #000000 !important;
            padding: 2px 5px !important;
          }
          .bg-black * {
            color: #ffffff !important;
          }
          .text-white { color: #ffffff !important; }
          .text-black { color: #000000 !important; }
          
          /* Forçar preto absoluto em todas as classes cinzas do Tailwind (impede pontilhado/halftone) */
          .text-zinc-500, .text-zinc-600, .text-zinc-700, .text-zinc-800, 
          .text-slate-400, .text-slate-500, .text-slate-600, .text-slate-700, .text-slate-800 {
            color: #000000 !important;
            font-weight: 800 !important;
          }
          .bg-gray-100 {
            background-color: #ffffff !important;
            border: 1px solid #000000 !important;
          }
          
          .w-48 { width: 180px !important; }
          .mx-auto { margin-left: auto !important; margin-right: auto !important; }
          
          /* Prevenir corte no meio de itens */
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          @media print {
            .no-print, .print-toolbar { display: none !important; }
            html, body {
              width: 72mm !important;
              max-width: 72mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        </style>
        <script>
          var isPrintingInProgress = false;
          function executePrint() {
            if (isPrintingInProgress) return;
            isPrintingInProgress = true;
            window.print();
            setTimeout(function() {
              isPrintingInProgress = false;
            }, 3000);
          }

          // Auto-fecha a popup após a conclusão ou cancelamento da impressão
          window.onafterprint = function() {
            setTimeout(function() {
              window.close();
            }, 600);
          };
        </script>
      </head>
      <body>
        <div class="print-toolbar no-print">
          <div class="print-actions">
            <button class="btn-print" onclick="executePrint()">🖨️ Imprimir Cupom</button>
            <button class="btn-close" onclick="window.close()">✕ Fechar</button>
          </div>
          <div class="print-tip">
            ⚡ Se a caixa do Chrome travar, pressione <b>Ctrl + Shift + P</b> para imprimir direto na Tanca!
          </div>
        </div>
        <div style="padding: 2px 0;">
          ${contentHtml}
        </div>
      </body>
    </html>
  `;

  if (popup) {
    popup.document.open();
    popup.document.write(receiptDocumentHtml);
    popup.document.close();

    // Aguarda renderização para disparar a impressão uma única vez
    setTimeout(() => {
      try {
        popup.focus();
        if (typeof (popup as any).executePrint === 'function') {
          (popup as any).executePrint();
        } else {
          popup.print();
        }
      } catch (err) {
        console.warn('Erro ao disparar impressão na janela popup:', err);
      }
    }, 350);
    return;
  }

  // Fallback se o navegador bloqueou popups
  window.print();
}
