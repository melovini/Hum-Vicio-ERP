'use client';
import { useState } from 'react';
import { Sale, SaleItem } from '@/lib/store';
import { Printer, X, ChefHat, Receipt, CheckCircle, Copy, AlertTriangle, GitCompare } from 'lucide-react';
import { printThermalElement } from '@/lib/thermal-printer';

export interface OrderDiff {
  added: SaleItem[];
  removed: SaleItem[];
  modified: { item: SaleItem; oldNotes?: string; newNotes?: string }[];
}

interface ReceiptModalProps {
  sale: Sale | null;
  diff?: OrderDiff;
  onClose: () => void;
}

export default function ReceiptModal({ sale, diff, onClose }: ReceiptModalProps) {
  const [type, setType] = useState<'cozinha' | 'cliente' | 'diferencial'>(diff || sale?.orderDiff ? 'diferencial' : 'cozinha');
  const [copiedRaw, setCopiedRaw] = useState(false);

  if (!sale) return null;

  const activeDiff = diff || sale.orderDiff;

  const handlePrint = () => {
    printThermalElement('thermal-receipt-printable', `Comprovante #${sale.id.slice(0, 6).toUpperCase()} - Hum Vicio`);
  };

  const formattedDate = new Date(sale.date).toLocaleDateString('pt-BR');
  const formattedTime = new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Gerador de Texto RAW ESC/POS (40 colunas contínuas para impressoras seriais, bluetooth e drivers diretos)
  const generateRawEscPosText = () => {
    const divider = '========================================\n';
    const subDivider = '----------------------------------------\n';
    let text = '';

    text += '          HUM VICIO HAMBURGUERIA        \n';
    text += '           CNPJ: 32.588.610/0001-44     \n';
    text += divider;

    if (type === 'diferencial' && activeDiff) {
      text += '*** ALTERACAO / ADICAO DE ITENS ***\n';
      text += `PEDIDO #${sale.id.slice(0, 6).toUpperCase()} • ${sale.channel.toUpperCase()}\n`;
      if (sale.customerName) text += `CLIENTE: ${sale.customerName.toUpperCase()}\n`;
      text += `DATA/HORA: ${formattedDate} ${formattedTime}\n`;
      text += subDivider;
      text += 'ITENS DIFERENCIAIS:\n';
      activeDiff.added.forEach(item => {
        text += `[+] ${item.quantity}x ${item.productName} (ADICIONADO)\n`;
        if (item.notes) text += `    OBS: ${item.notes}\n`;
      });
      activeDiff.removed.forEach(item => {
        text += `[-] ${item.quantity}x ${item.productName} (CANCELADO)\n`;
      });
      activeDiff.modified.forEach(m => {
        text += `[*] ${m.item.quantity}x ${m.item.productName} (MODIFICADO)\n`;
        text += `    DE: ${m.oldNotes || 'Sem obs'}\n`;
        text += `    PARA: ${m.newNotes || 'Sem obs'}\n`;
      });
      text += divider;
      text += '*** ATENCAO CHAPA / PRODUCAO ***\n';
      return text;
    }

    if (type === 'cozinha') {
      text += '       VIA DE PRODUCAO (CHAPA)          \n';
      text += `PEDIDO #${sale.id.slice(0, 6).toUpperCase()} • ${sale.channel.toUpperCase()}\n`;
      if (sale.orderType) text += `MODALIDADE: [${sale.orderType.toUpperCase()}]\n`;
      if (sale.customerName) text += `CLIENTE: ${sale.customerName.toUpperCase()}\n`;
      text += `HORA: ${formattedDate} - ${formattedTime}\n`;
      text += subDivider;
      text += 'ITENS PARA PREPARO:\n';
      sale.items.forEach(item => {
        text += `[${item.quantity}x] ${item.productName}\n`;
        if (item.combo) text += `    + COMBO: ${item.combo}\n`;
        if (item.additionals && item.additionals.length > 0) {
          text += `    + ADICIONAIS: ${item.additionals.map(a => a.name).join(', ')}\n`;
        }
        if (item.notes) text += `    *** OBS: ${item.notes.toUpperCase()} ***\n`;
      });
      text += divider;
      text += '        *** AGILIDADE & QUALIDADE ***   \n';
    } else {
      text += '    CUPOM NAO FISCAL DE CONFERENCIA     \n';
      text += `PEDIDO #${sale.id.slice(0, 6).toUpperCase()} • ${sale.channel.toUpperCase()}\n`;
      if (sale.customerName) text += `CLIENTE: ${sale.customerName}\n`;
      text += `DATA/HORA: ${formattedDate} ${formattedTime}\n`;
      text += subDivider;
      text += 'ITEM                            QTD  R$ TOTAL\n';
      sale.items.forEach(item => {
        const itemTot = ((item.unitPrice || 0) * item.quantity).toFixed(2);
        const namePad = item.productName.slice(0, 26).padEnd(28, ' ');
        text += `${namePad} ${item.quantity}x ${itemTot}\n`;
        if (item.combo) text += `  + ${item.combo}\n`;
      });
      text += subDivider;
      if (sale.subtotal) text += `SUBTOTAL:                    R$ ${sale.subtotal.toFixed(2)}\n`;
      if (sale.discount) text += `DESCONTO:                   -R$ ${sale.discount.toFixed(2)}\n`;
      if (sale.deliveryFee) text += `TAXA DE ENTREGA:            +R$ ${sale.deliveryFee.toFixed(2)}\n`;
      text += `TOTAL A PAGAR:               R$ ${sale.total.toFixed(2)}\n`;
      text += `FORMA DE PAGAMENTO: ${sale.paymentMethod.toUpperCase()}\n`;
      text += divider;
      text += '          OBRIGADO PELA PREFERENCIA!    \n';
      text += '             VOLTE SEMPRE! 🍔           \n';
    }

    return text;
  };

  const handleCopyRaw = async () => {
    try {
      const rawText = generateRawEscPosText();
      await navigator.clipboard.writeText(rawText);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 3000);
    } catch {
      alert('Não foi possível copiar automaticamente para a área de transferência.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Folha de Estilo Térmica Estrita ESC/POS (80mm contínuo) */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0 !important;
            size: auto !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 72mm !important;
            min-width: 72mm !important;
            max-width: 72mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-printable, #thermal-receipt-printable * {
            visibility: visible !important;
          }
          #thermal-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            color: #000000 !important;
            background: #ffffff !important;
            font-family: 'Courier New', Courier, monospace !important;
            box-sizing: border-box !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800 no-print">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Printer size={22} className="text-emerald-400" />
            <span>Impressão Térmica ESC/POS</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Seleção de Via */}
        <div className="flex gap-2 mb-4 no-print">
          {activeDiff && (
            <button 
              type="button" 
              onClick={() => setType('diferencial')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                type === 'diferencial' 
                  ? 'bg-red-500 text-white shadow-md font-extrabold ring-2 ring-red-400' 
                  : 'bg-slate-950 text-red-400 border border-red-500/40'
              }`}
            >
              <GitCompare size={14} /> VIA ALTERAÇÃO (DELTA)
            </button>
          )}

          <button 
            type="button" 
            onClick={() => setType('cozinha')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              type === 'cozinha' 
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' 
                : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            <ChefHat size={14} /> CHAPA
          </button>

          <button 
            type="button" 
            onClick={() => setType('cliente')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              type === 'cliente' 
                ? 'bg-blue-500 text-white shadow-md font-extrabold' 
                : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            <Receipt size={14} /> CLIENTE
          </button>
        </div>

        {/* Pré-visualização da Bobina Térmica (80mm) */}
        <div className="flex-1 overflow-y-auto bg-white text-black p-5 rounded-2xl font-mono text-xs shadow-inner select-none border-2 border-slate-300">
          <div id="thermal-receipt-printable">
            {type === 'diferencial' && activeDiff ? (
              /* --- VIA DIFERENCIAL (ALTERAÇÕES / ADIÇÕES) --- */
              <div className="space-y-3">
                <div className="text-center border-b-2 border-dashed border-black pb-3">
                  <h3 className="font-extrabold text-base uppercase tracking-wider">HUM VÍCIO HAMBURGUERIA</h3>
                  <div className="bg-black text-white px-2 py-1 my-1.5 font-black text-sm uppercase">
                    *** ALTERAÇÃO / ADIÇÃO ***
                  </div>
                  <p className="text-xs font-bold">
                    PEDIDO #{sale.id.slice(0, 6).toUpperCase()} • {sale.channel.toUpperCase()}
                  </p>
                  {sale.customerName && (
                    <p className="text-sm font-black mt-1 uppercase">
                      {sale.orderType ? `${sale.orderType.toUpperCase()}: ` : 'CLIENTE: '}{sale.customerName}
                    </p>
                  )}
                  <p className="text-[10px] mt-1">{formattedDate} - {formattedTime}</p>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black space-y-2">
                  <p className="font-black text-xs uppercase bg-black text-white px-1">
                    ITENS MODIFICADOS NA COZINHA:
                  </p>

                  {/* Adicionados */}
                  {activeDiff.added.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-black text-black uppercase">ITENS ADICIONADOS (+):</p>
                      {activeDiff.added.map((item, idx) => (
                        <div key={idx} className="pl-2 border-l-2 border-black font-bold">
                          <span className="text-sm">[+] {item.quantity}x {item.productName} (ADICIONADO)</span>
                          {item.notes && <p className="text-xs italic pl-2">OBS: {item.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cancelados / Removidos */}
                  {activeDiff.removed.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-black text-black uppercase">ITENS CANCELADOS (-):</p>
                      {activeDiff.removed.map((item, idx) => (
                        <div key={idx} className="pl-2 border-l-2 border-dashed border-black font-bold line-through">
                          <span className="text-sm">[-] {item.quantity}x {item.productName} (CANCELADO)</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Observações Modificadas */}
                  {activeDiff.modified.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-black text-black uppercase">OBSERVAÇÕES ALTERADAS (*):</p>
                      {activeDiff.modified.map((m, idx) => (
                        <div key={idx} className="pl-2 border-l-2 border-black text-xs">
                          <span className="font-bold">[*] {m.item.quantity}x {m.item.productName}</span>
                          <p className="text-[11px] pl-2 line-through">DE: {m.oldNotes || 'Sem obs'}</p>
                          <p className="text-[11px] pl-2 font-black">PARA: {m.newNotes || 'Sem obs'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-center text-[10px] pt-1 font-bold">
                  *** NÃO REPETIR ITENS JÁ PREPARADOS ***
                </div>
              </div>
            ) : type === 'cozinha' ? (
              /* --- VIA DA COZINHA (CHAPA) --- */
              <div className="space-y-3">
                <div className="text-center border-b-2 border-dashed border-black pb-3">
                  <h3 className="font-extrabold text-base uppercase tracking-wider">HUM VÍCIO HAMBURGUERIA</h3>
                  <p className="font-bold text-xs bg-black text-white px-2 py-0.5 mt-1 inline-block uppercase">
                    VIA DE PRODUÇÃO (CHAPA)
                  </p>
                  <p className="text-xs mt-1">
                    PEDIDO #{sale.id.slice(0, 6).toUpperCase()} • {sale.channel.toUpperCase()}
                    {sale.orderType && ` [${sale.orderType.toUpperCase()}]`}
                  </p>
                  {sale.customerName && (
                    <p className="text-sm font-black mt-1 bg-black text-white px-2 py-0.5 inline-block uppercase">
                      {sale.orderType ? `${sale.orderType.toUpperCase()}: ` : 'CLIENTE: '}{sale.customerName}
                    </p>
                  )}
                  <p className="text-[10px] mt-1">{formattedDate} - {formattedTime}</p>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black">
                  <p className="font-bold mb-2 uppercase text-xs">ITENS DO PEDIDO:</p>
                  <div className="space-y-3 text-sm">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="border-b border-dashed border-black/50 pb-2 last:border-0">
                        <div className="flex justify-between items-start font-bold">
                          <span className="text-sm">[{item.quantity}x] {item.productName}</span>
                        </div>
                        {item.combo && (
                          <p className="text-xs font-bold pl-3">
                            + {item.combo.toUpperCase()}
                          </p>
                        )}
                        {item.additionals && item.additionals.length > 0 && (
                          <p className="text-xs font-bold pl-3">
                            + ADICIONAIS: {item.additionals.map(a => a.name.toUpperCase()).join(', ')}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs font-black bg-black text-white px-1.5 py-0.5 mt-1 ml-2 inline-block">
                            *** OBS: {item.notes.toUpperCase()} ***
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center text-[10px] pt-1 font-bold">
                  *** AGILIDADE & QUALIDADE ***
                </div>
              </div>
            ) : (
              /* --- VIA DO CLIENTE --- */
              <div className="space-y-3">
                <div className="text-center border-b-2 border-dashed border-black pb-3">
                  <h3 className="font-extrabold text-base uppercase tracking-wider">HUM VÍCIO HAMBURGUERIA</h3>
                  <p className="text-[10px]">CUPOM NÃO FISCAL DE CONFERÊNCIA</p>
                  <p className="text-xs font-bold mt-1">PEDIDO #{sale.id.slice(0, 6).toUpperCase()} • {sale.channel.toUpperCase()}</p>
                  {sale.customerName && (
                    <p className="text-xs font-bold mt-0.5">CLIENTE: {sale.customerName}</p>
                  )}
                  <p className="text-[10px] text-slate-600 mt-0.5">{formattedDate} - {formattedTime}</p>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black">
                  <div className="flex justify-between font-bold text-[11px] mb-2 border-b border-black pb-1">
                    <span>ITEM</span>
                    <span>QTD x VALOR</span>
                  </div>
                  <div className="space-y-2">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs">
                        <div className="pr-2">
                          <p className="font-bold">{item.productName}</p>
                          {item.combo && <p className="text-[10px] text-slate-700 pl-2">+ {item.combo}</p>}
                        </div>
                        <span className="font-bold shrink-0">
                          {item.quantity}x R$ {(item.unitPrice || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black space-y-1 font-bold text-xs">
                  {sale.subtotal !== undefined && (
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotal Itens:</span>
                      <span>R$ {sale.subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {sale.discount !== undefined && sale.discount > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Desconto:</span>
                      <span>- R$ {sale.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {sale.deliveryFee !== undefined && sale.deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Taxa de Entrega:</span>
                      <span>+ R$ {sale.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base pt-1 border-t border-black">
                    <span>TOTAL:</span>
                    <span>R$ {sale.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 text-slate-800">
                    <span>FORMA DE PAGAMENTO:</span>
                    <span className="uppercase font-bold">
                      {sale.paymentMethod === 'ifood_online' 
                        ? 'iFood Online (App)' 
                        : sale.paymentMethod === 'ifood_entrega' 
                          ? 'iFood na Entrega' 
                          : sale.paymentMethod}
                    </span>
                  </div>
                </div>

                <div className="text-center text-[10px] pt-2 border-t border-dashed border-black mt-2 space-y-0.5">
                  <p className="font-bold text-xs uppercase tracking-wider">HUM VÍCIO HAMBURGUERIA</p>
                  <p className="font-bold text-[10px]">CNPJ: 32.588.610/0001-44</p>
                  <p className="pt-1 font-semibold">Obrigado pela preferência!</p>
                  <p>Volte Sempre ao Hum Vício! 🍔</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2 no-print">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-xs cursor-pointer transition-colors"
          >
            Fechar
          </button>
          <button 
            type="button" 
            onClick={handleCopyRaw}
            className="py-3 px-3.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            title="Copiar texto puro ESC/POS sem abrir caixa de diálogo do SO"
          >
            <Copy size={15} className={copiedRaw ? 'text-emerald-400' : ''} />
            <span>{copiedRaw ? 'Copiado!' : 'RAW'}</span>
          </button>
          <button 
            type="button" 
            onClick={handlePrint}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer size={16} /> Imprimir Cupom
          </button>
        </div>
      </div>
    </div>
  );
}
