/**
 * Utilitário de Impressão Térmica ESC/POS de Alta Compatibilidade
 * Utiliza uma janela popup dedicada (top-level browsing context) para contornar
 * o crash de subframe/PrintCompositor sandbox que o Google Chrome sofre em iframes.
 */

export function printThermalElement(elementIdOrHtml: string, title = 'Comprovante Hum Vício') {
  if (typeof window === 'undefined') return;

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
    return;
  }

  // 2. Abrir janela popup dedicada para impressão
  // Janelas popup têm contexto independente e evitam travamentos do motor PDF do Chrome
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
          /* Reset estrito para bobinas térmicas de 80mm (Tanca, Bematech, Elgin, Epson) */
          @page {
            margin: 0;
            size: auto;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 72mm !important;
            max-width: 72mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }
          body {
            padding: 2mm 1mm 12mm 1mm !important;
          }

          /* Barra superior de suporte (visível apenas na tela da popup, oculta na impressão) */
          .print-toolbar {
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: #ffffff;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            border-bottom: 2px solid #1e293b;
          }
          .print-actions {
            display: flex;
            gap: 6px;
          }
          .print-toolbar button {
            flex: 1;
            padding: 8px 10px;
            border-radius: 8px;
            border: none;
            font-weight: 800;
            cursor: pointer;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .btn-print {
            background: #10b981;
            color: white;
          }
          .btn-close {
            background: #334155;
            color: white;
          }
          .print-tip {
            font-size: 10px;
            line-height: 1.3;
            color: #fbbf24;
            background: rgba(251, 191, 36, 0.15);
            border: 1px solid rgba(251, 191, 36, 0.3);
            padding: 6px 8px;
            border-radius: 6px;
            text-align: center;
          }

          /* Utilitários tipográficos e de layout para comprovantes térmicos */
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          .font-bold { font-weight: 700 !important; }
          .font-black, .font-extrabold { font-weight: 900 !important; }
          .font-normal { font-weight: 400 !important; }
          .uppercase { text-transform: uppercase !important; }
          .italic { font-style: italic !important; }
          .line-through { text-decoration: line-through !important; }
          
          .text-[9px] { font-size: 9px !important; }
          .text-[10px] { font-size: 10px !important; }
          .text-[11px] { font-size: 11px !important; }
          .text-xs { font-size: 11px !important; }
          .text-sm { font-size: 13px !important; }
          .text-base { font-size: 14px !important; }
          .text-lg { font-size: 16px !important; }
          
          .border-b { border-bottom: 1px dashed #000000 !important; }
          .border-b-2 { border-bottom: 2px dashed #000000 !important; }
          .border-t { border-top: 1px dashed #000000 !important; }
          .border-t-2 { border-top: 2px dashed #000000 !important; }
          .border-l-2 { border-left: 2px solid #000000 !important; }
          .border-dashed { border-style: dashed !important; }
          .border-dotted { border-style: dotted !important; }
          .border-black { border-color: #000000 !important; }
          .border-gray-400 { border-color: #666666 !important; }
          
          .flex { display: flex !important; }
          .justify-between { justify-content: space-between !important; }
          .items-start { align-items: flex-start !important; }
          .items-center { align-items: center !important; }
          .shrink-0 { flex-shrink: 0 !important; }
          .inline-block { display: inline-block !important; }
          .block { display: block !important; }
          
          .space-y-1 > * + * { margin-top: 3px !important; }
          .space-y-1.5 > * + * { margin-top: 5px !important; }
          .space-y-2 > * + * { margin-top: 6px !important; }
          .space-y-3 > * + * { margin-top: 8px !important; }
          .space-y-4 > * + * { margin-top: 12px !important; }
          
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
          .pt-4 { padding-top: 10px !important; }
          .pb-1 { padding-bottom: 2px !important; }
          .pb-2 { padding-bottom: 5px !important; }
          .pb-3 { padding-bottom: 7px !important; }
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
          
          /* Destaques Térmicos */
          .bg-black {
            background-color: #000000 !important;
            color: #ffffff !important;
            border: 1px solid #000000 !important;
          }
          .bg-black * {
            color: #ffffff !important;
          }
          .text-white { color: #ffffff !important; }
          .text-black { color: #000000 !important; }
          .text-zinc-600, .text-zinc-700, .text-zinc-800, .text-slate-600, .text-slate-700, .text-slate-800 {
            color: #000000 !important;
          }
          .bg-gray-100 {
            background-color: #f3f3f3 !important;
            border: 1px solid #000000 !important;
          }
          
          .w-48 { width: 180px !important; }
          .mx-auto { margin-left: auto !important; margin-right: auto !important; }
          
          @media print {
            .no-print, .print-toolbar { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar no-print">
          <div class="print-actions">
            <button class="btn-print" onclick="window.print()">🖨️ Imprimir Cupom</button>
            <button class="btn-close" onclick="window.close()">✕ Fechar</button>
          </div>
          <div class="print-tip">
            ⚡ Se o preview do Chrome falhar, pressione <b>Ctrl + Shift + P</b> para imprimir direto pelo Windows!
          </div>
        </div>
        <div style="padding: 10px 4px;">
          ${contentHtml}
        </div>
      </body>
    </html>
  `;

  if (popup) {
    popup.document.open();
    popup.document.write(receiptDocumentHtml);
    popup.document.close();

    // Aguarda renderização para chamar print com foco na popup
    setTimeout(() => {
      try {
        popup.focus();
        popup.print();
      } catch (err) {
        console.warn('Erro ao disparar impressão na janela popup:', err);
      }
    }, 300);
    return;
  }

  // Fallback se o navegador bloqueou popups
  window.print();
}
