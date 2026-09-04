/**
 * Utilitário de Impressão Térmica ESC/POS de Alta Compatibilidade
 * Resolve o erro 'A visualização de impressão falhou' do Google Chrome
 * isolando o conteúdo em um iframe limpo e livre de conflitos de CSS.
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

  // 2. Localizar ou criar iframe invisível dedicado para impressão
  let iframe = document.getElementById('thermal-print-iframe') as HTMLIFrameElement | null;
  if (iframe) {
    try {
      iframe.remove();
    } catch {}
  }

  iframe = document.createElement('iframe');
  iframe.id = 'thermal-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '72mm';
  iframe.style.height = '100px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  // 3. Montar documento HTML isolado, com CSS térmico estrito para bobinas de 80mm (área útil 72mm)
  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          /* Reset e regras estritas para bobinas térmicas (Tanca, Bematech, Epson, Elgin) */
          @page {
            size: auto;
            margin: 0mm;
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

          /* Utilitários tipográficos e de grid para bobina */
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          .font-bold { font-weight: 700 !important; }
          .font-black, .font-extrabold { font-weight: 900 !important; }
          .font-normal { font-weight: 400 !important; }
          .uppercase { text-transform: uppercase !important; }
          .italic { font-style: italic !important; }
          .line-through { text-decoration: line-through !important; }
          
          .text-\\[9px\\] { font-size: 9px !important; }
          .text-\\[10px\\] { font-size: 10px !important; }
          .text-\\[11px\\] { font-size: 11px !important; }
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
          .space-y-1\\.5 > * + * { margin-top: 5px !important; }
          .space-y-2 > * + * { margin-top: 6px !important; }
          .space-y-3 > * + * { margin-top: 8px !important; }
          .space-y-4 > * + * { margin-top: 12px !important; }
          
          .p-1 { padding: 2px 4px !important; }
          .p-2 { padding: 4px 6px !important; }
          .p-5 { padding: 0 !important; }
          .py-0\\.5 { padding-top: 1px !important; padding-bottom: 1px !important; }
          .py-1 { padding-top: 3px !important; padding-bottom: 3px !important; }
          .py-1\\.5 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .py-2 { padding-top: 6px !important; padding-bottom: 6px !important; }
          .px-1 { padding-left: 3px !important; padding-right: 3px !important; }
          .px-1\\.5 { padding-left: 4px !important; padding-right: 4px !important; }
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
          
          .mt-0\\.5 { margin-top: 2px !important; }
          .mt-1 { margin-top: 3px !important; }
          .mt-2 { margin-top: 5px !important; }
          .my-1 { margin-top: 3px !important; margin-bottom: 3px !important; }
          .my-1\\.5 { margin-top: 4px !important; margin-bottom: 4px !important; }
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
          
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `);
  iframeDoc.close();

  // 4. Disparar a impressão com foco no iframe após renderização
  const triggerPrint = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) {
        window.print();
        return;
      }
      win.focus();
      win.print();
    } catch (err) {
      console.error('Falha ao imprimir via iframe, usando fallback direto:', err);
      window.print();
    }
  };

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc?.fonts?.ready) {
      doc.fonts.ready.then(() => {
        setTimeout(triggerPrint, 100);
      }).catch(() => {
        setTimeout(triggerPrint, 150);
      });
    } else {
      setTimeout(triggerPrint, 200);
    }
  } catch {
    setTimeout(triggerPrint, 200);
  }
}
