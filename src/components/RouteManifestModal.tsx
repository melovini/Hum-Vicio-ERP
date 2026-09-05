'use client';
import { useState } from 'react';
import { Sale } from '@/lib/store';
import { DeliveryRouteBlock } from '@/app/(modules)/caixa/page';
import { Printer, X, Truck, Copy, Share2 } from 'lucide-react';
import { printThermalElement } from '@/lib/thermal-printer';

interface RouteManifestModalProps {
  route: DeliveryRouteBlock | null;
  sales: Sale[];
  onClose: () => void;
}

export default function RouteManifestModal({ route, sales, onClose }: RouteManifestModalProps) {
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!route) return null;

  const routeSales = sales.filter(s => route.saleIds.includes(s.id));
  const totalAmount = routeSales.reduce((acc, s) => acc + s.total, 0);
  const cashSales = routeSales.filter(s => s.paymentMethod === 'dinheiro');
  const cashToCollect = cashSales.reduce((acc, s) => acc + s.total, 0);
  const prepaidSales = routeSales.filter(s => s.paymentMethod !== 'dinheiro');
  const prepaidAmount = prepaidSales.reduce((acc, s) => acc + s.total, 0);

  const formattedDate = new Date().toLocaleDateString('pt-BR');
  const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);
    printThermalElement('thermal-route-manifest-printable', `Manifesto de Rota #${route.id ? route.id.slice(0, 6).toUpperCase() : ''} - Hum Vicio`);
    setTimeout(() => {
      setIsPrinting(false);
    }, 2500);
  };

  // Gerador de Texto RAW ESC/POS (40 colunas contínuas)
  const generateRawEscPosText = () => {
    const divider = '========================================\n';
    const subDivider = '----------------------------------------\n';
    let text = '';

    text += '          HUM VICIO HAMBURGUERIA        \n';
    text += '           CNPJ: 32.588.610/0001-44     \n';
    text += divider;
    text += '       MANIFESTO DE ENTREGA / ROTA      \n';
    text += `ENTREGADOR: ${route.courierName.toUpperCase()}\n`;
    text += `DATA/HORA: ${formattedDate} ${formattedTime}\n`;
    text += `TOTAL DE ENTREGAS: ${routeSales.length}\n`;
    text += divider;
    text += 'ORDEM DAS ENTREGAS:\n';

    routeSales.forEach((sale, idx) => {
      text += subDivider;
      text += `[${idx + 1}] PEDIDO #${sale.id.slice(0, 6).toUpperCase()} • ${sale.channel.toUpperCase()}\n`;
      text += `CLIENTE: ${(sale.customerName || 'Cliente').toUpperCase()}\n`;
      text += `FORMA PGTO: ${sale.paymentMethod.toUpperCase()}`;
      if (sale.paymentMethod === 'dinheiro') {
        text += ` [RECEBER: R$ ${sale.total.toFixed(2)}]\n`;
      } else {
        text += ' [JA PAGO]\n';
      }
      text += 'ITENS:\n';
      sale.items.forEach(item => {
        text += `  • ${item.quantity}x ${item.productName}\n`;
        if (item.notes) text += `    *** OBS: ${item.notes.toUpperCase()} ***\n`;
      });
      text += `VALOR TOTAL: R$ ${sale.total.toFixed(2)}\n`;
    });

    text += divider;
    text += 'RESUMO FINANCEIRO DA ROTA:\n';
    text += `TOTAL GERAL (${routeSales.length} pedidos): R$ ${totalAmount.toFixed(2)}\n`;
    text += `A RECEBER EM DINHEIRO: R$ ${cashToCollect.toFixed(2)}\n`;
    text += `JA PAGO (PIX/CARTAO/ONLINE): R$ ${prepaidAmount.toFixed(2)}\n`;
    text += divider;
    text += '\n\n';
    text += '________________________________________\n';
    text += `Assinatura: ${route.courierName}\n`;
    text += '\n';
    text += '________________________________________\n';
    text += 'Assinatura: Operador do Caixa\n';

    return text;
  };

  // Gerador de Texto Formatado para Enviar via WhatsApp para o Motoboy
  const generateWhatsAppText = () => {
    let text = `🛵 *HUM VÍCIO HAMBURGUERIA - ROTA DE ENTREGA*\n`;
    text += `👤 *Entregador:* ${route.courierName}\n`;
    text += `📅 *Horário:* ${formattedDate} às ${formattedTime}\n`;
    text += `📦 *Total de Pedidos:* ${routeSales.length}\n\n`;

    routeSales.forEach((sale, idx) => {
      text += `📍 *Entrega ${idx + 1} - Comanda #${sale.id.slice(0, 6).toUpperCase()}*\n`;
      text += `👤 *Cliente:* ${sale.customerName || 'Cliente'}\n`;
      text += `🍔 *Itens:* ${sale.items.map(i => `${i.quantity}x ${i.productName}${i.notes ? ` (OBS: ${i.notes.toUpperCase()})` : ''}`).join(', ')}\n`;
      text += `💰 *Valor:* R$ ${sale.total.toFixed(2)}\n`;
      if (sale.paymentMethod === 'dinheiro') {
        text += `💵 *Cobrança:* RECEBER R$ ${sale.total.toFixed(2)} EM DINHEIRO\n`;
      } else {
        text += `💳 *Cobrança:* JÁ PAGO (${sale.paymentMethod.toUpperCase()}) - NÃO COBRAR\n`;
      }
      text += `\n`;
    });

    text += `📊 *RESUMO FINANCEIRO:*\n`;
    text += `💵 *Total em Dinheiro a Acertar:* R$ ${cashToCollect.toFixed(2)}\n`;
    text += `💳 *Total Já Pago:* R$ ${prepaidAmount.toFixed(2)}\n`;
    text += `⭐ *Bom trabalho e dirija com segurança!*`;

    return text;
  };

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(generateRawEscPosText());
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } catch {
      alert('Não foi possível copiar o texto RAW.');
    }
  };

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(generateWhatsAppText());
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2000);
    } catch {
      alert('Não foi possível copiar o texto para WhatsApp.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* O motor global de 1 página é gerenciado por thermal-print-mount em thermal-printer.ts */}

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
              <Truck size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">
                Manifesto de Entrega / Romaneio
              </h3>
              <p className="text-xs text-slate-400">
                Entregador: <span className="font-bold text-blue-400">{route.courierName}</span> ({routeSales.length} pedidos)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pré-visualização da Bobina Térmica (80mm) */}
        <div className="flex-1 overflow-y-auto bg-white text-black p-5 my-4 rounded-2xl font-sans font-bold text-xs shadow-inner select-none border-2 border-slate-300">
          <div id="thermal-route-manifest-printable">
            <div className="text-center border-b-2 border-dashed border-black pb-3">
              <h3 className="font-extrabold text-base uppercase tracking-wider">HUM VÍCIO HAMBURGUERIA</h3>
              <p className="text-[10px] text-black font-bold">CNPJ: 32.588.610/0001-44</p>
              <div className="bg-black text-white px-2 py-1 my-1.5 font-black text-sm uppercase">
                *** MANIFESTO DE ROTA ***
              </div>
              <p className="text-sm font-black uppercase text-black">
                ENTREGADOR: {route.courierName}
              </p>
              <p className="text-[10px] mt-1">{formattedDate} - {formattedTime}</p>
              <p className="text-[11px] font-bold">STATUS: {route.status === 'em_rota' ? 'EM TRÂNSITO' : route.status === 'entregue' ? 'ENTREGUE' : 'EM MONTAGEM'}</p>
            </div>

            {/* Lista dos Pedidos da Rota */}
            <div className="py-2 border-b-2 border-dashed border-black space-y-3">
              <p className="font-black text-xs uppercase bg-black text-white px-1">
                PEDIDOS DA ROTA ({routeSales.length}):
              </p>

              {routeSales.map((sale, idx) => (
                <div key={sale.id} className="pb-2 border-b border-dotted border-gray-400 last:border-b-0 space-y-1">
                  <div className="flex justify-between font-black text-sm">
                    <span>#{sale.id.slice(0, 6).toUpperCase()} [{idx + 1}/{routeSales.length}]</span>
                    <span>R$ {sale.total.toFixed(2)}</span>
                  </div>
                  <div className="font-bold text-xs uppercase bg-gray-100 p-1 rounded">
                    {sale.customerName || 'Cliente sem identificação'}
                  </div>
                  <div className="text-[11px] font-semibold text-black font-extrabold">
                    {sale.items.map((i, itemIdx) => (
                      <div key={itemIdx} className="pl-1">
                        • {i.quantity}x {i.productName}
                        {i.notes && <span className="text-[10px] font-black uppercase block pl-2 text-black mt-0.5">*** OBS: {i.notes.toUpperCase()} ***</span>}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-black pt-1">
                    <span className="uppercase">FORMA: {sale.paymentMethod}</span>
                    <span className={sale.paymentMethod === 'dinheiro' ? 'bg-black text-white px-1.5 py-0.5 rounded font-black' : 'text-emerald-800'}>
                      {sale.paymentMethod === 'dinheiro' ? `COBRAR R$ ${sale.total.toFixed(2)}` : 'JÁ PAGO'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totais Financeiros */}
            <div className="py-2 border-b-2 border-dashed border-black space-y-1 text-xs">
              <div className="flex justify-between font-bold">
                <span>TOTAL DE PEDIDOS:</span>
                <span>{routeSales.length} comandas</span>
              </div>
              <div className="flex justify-between font-black text-sm text-black">
                <span>TOTAL DA ROTA:</span>
                <span>R$ {totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold bg-gray-100 p-1 rounded">
                <span>A COBRAR (DINHEIRO):</span>
                <span>R$ {cashToCollect.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-black font-bold">
                <span>JÁ PAGO (PIX/CARTÃO/ONLINE):</span>
                <span>R$ {prepaidAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Linhas de Assinatura */}
            <div className="text-center text-[10px] pt-4 mt-2 space-y-4">
              <div>
                <p className="border-t border-black w-48 mx-auto pt-1 font-bold">{route.courierName}</p>
                <p className="text-[9px] text-black font-bold">Assinatura do Entregador</p>
              </div>
              <div>
                <p className="border-t border-black w-48 mx-auto pt-1 font-bold">Operador de Caixa</p>
                <p className="text-[9px] text-black font-bold">Conferência e Despacho</p>
              </div>
              <p className="text-[9px] italic text-black font-bold pt-1">Hum Vício ERP • Operação de Delivery</p>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        {/* Dica de Impressão Segura */}
        <div className="mt-2 text-[11px] text-emerald-300/90 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-center no-print">
          ⚡ <b>Dica PDV:</b> Clique apenas <b>1 vez</b> em "Imprimir Romaneio".
        </div>

        <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2 no-print">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 min-w-[80px] py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-xs cursor-pointer transition-colors"
          >
            Fechar
          </button>
          <button 
            type="button" 
            onClick={handleCopyWhatsApp}
            className="py-3 px-3.5 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 border border-emerald-500/40 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            title="Copiar texto formatado para colar no WhatsApp do motoboy"
          >
            <Share2 size={15} className={copiedWhatsApp ? 'text-emerald-400' : ''} />
            <span>{copiedWhatsApp ? 'Copiado!' : 'WhatsApp'}</span>
          </button>
          <button 
            type="button" 
            onClick={handleCopyRaw}
            className="py-3 px-3.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            title="Copiar texto RAW ESC/POS contínuo"
          >
            <Copy size={15} className={copiedRaw ? 'text-emerald-400' : ''} />
            <span>{copiedRaw ? 'Copiado!' : 'RAW'}</span>
          </button>
          <button 
            type="button" 
            onClick={handlePrint}
            disabled={isPrinting}
            className={`flex-1 min-w-[140px] py-3 ${isPrinting ? 'bg-blue-800 opacity-70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 cursor-pointer'} text-white rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2`}
          >
            <Printer size={16} className={isPrinting ? 'animate-pulse' : ''} /> 
            {isPrinting ? 'Enviando p/ Impressora...' : 'Imprimir Romaneio'}
          </button>
        </div>
      </div>
    </div>
  );
}
