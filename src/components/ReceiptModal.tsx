'use client';
import { useState, useMemo } from 'react';
import { Sale, SaleItem, useInventory, Product, InventoryItem } from '@/lib/store';
import { Printer, X, ChefHat, Receipt, CheckCircle, Copy, AlertTriangle, GitCompare } from 'lucide-react';
import { printThermalElement } from '@/lib/thermal-printer';
import { getBurgerPrintDetails } from '@/lib/production-calculator';
import { buildKitchenTicket, formatKitchenTicketEscPos } from '@/lib/kitchen-ticket';
import KitchenTicketView from '@/components/caixa/KitchenTicketView';

export interface OrderDiff {
  added: SaleItem[];
  removed: SaleItem[];
  modified: { item: SaleItem; oldNotes?: string; newNotes?: string }[];
}

export interface ReceiptModalProps {
  sale: Sale | null;
  diff?: OrderDiff;
  products?: Product[];
  inventoryItems?: InventoryItem[];
  onClose: () => void;
}

export { getBurgerPrintDetails };

export default function ReceiptModal({ sale, diff, products, inventoryItems, onClose }: ReceiptModalProps) {
  const [type, setType] = useState<'cozinha' | 'cliente' | 'diferencial'>(diff || sale?.orderDiff ? 'diferencial' : 'cozinha');
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showMontagem, setShowMontagem] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hum_vicio_print_show_montagem');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });

  const handleToggleShowMontagem = (val: boolean) => {
    setShowMontagem(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hum_vicio_print_show_montagem', String(val));
    }
  };

  if (!sale) return null;

  const activeDiff = diff || sale.orderDiff;

  const inventory = useInventory('cozinha');
  const allProducts = (products && products.length > 0) ? products : (inventory.products || []);
  const allInventoryItems = (inventoryItems && inventoryItems.length > 0) ? inventoryItems : (inventory.items || []);

  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);
    printThermalElement('thermal-receipt-printable', `Comprovante #${sale.id.slice(0, 6).toUpperCase()} - Hum Vicio`);
    setTimeout(() => {
      setIsPrinting(false);
    }, 2500);
  };

  const formattedDate = new Date(sale.date).toLocaleDateString('pt-BR');
  const formattedTime = new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const kitchenTicket = useMemo(() => {
    return buildKitchenTicket({
      sale,
      products: allProducts,
      inventoryItems: allInventoryItems,
      kitchenComponents: inventory.kitchenComponents,
      showMontagem,
      diff: activeDiff,
    });
  }, [sale, allProducts, allInventoryItems, inventory.kitchenComponents, showMontagem, activeDiff]);

  // Gerador de Texto RAW ESC/POS (40 colunas contínuas para impressoras seriais, bluetooth e drivers diretos)
  const generateRawEscPosText = () => {
    if (type === 'cozinha' || (type === 'diferencial' && activeDiff)) {
      return formatKitchenTicketEscPos(kitchenTicket);
    }

    const divider = '========================================\n';
    const subDivider = '----------------------------------------\n';
    let text = '';

    text += '          HUM VICIO HAMBURGUERIA        \n';
    text += '           CNPJ: 32.588.610/0001-44     \n';
    text += divider;
    text += '    CUPOM NAO FISCAL DE CONFERENCIA     \n';
    text += `PEDIDO #${sale.id.slice(0, 6).toUpperCase()} • ${sale.channel.toUpperCase()}\n`;
    if (sale.customerName) text += `CLIENTE: ${sale.customerName}\n`;
    text += `DATA/HORA: ${formattedDate} ${formattedTime}\n`;
    text += subDivider;
    text += 'ITEM                            QTD  R$ TOTAL\n';
    sale.items.forEach(item => {
      const details = getBurgerPrintDetails(item, allProducts, allInventoryItems);
      const itemTot = ((item.unitPrice || 0) * item.quantity).toFixed(2);
      const namePad = item.productName.slice(0, 26).padEnd(28, ' ');
      text += `${namePad} ${item.quantity}x ${itemTot}\n`;
      if (details.comboDetails) {
        text += `  + ${details.comboDetails.title}\n`;
        text += `    (Acomp: ${details.comboDetails.fryerItem} + ${details.comboDetails.drinkItem})\n`;
      } else if (item.combo) {
        text += `  + ${item.combo.toUpperCase()}\n`;
      }
      if (item.meatPoint) text += `  * PONTO: ${item.meatPoint.toUpperCase()} *\n`;
      if (item.additionals && item.additionals.length > 0) {
        text += `  + ADICIONAIS: ${item.additionals.map(a => a.name).join(', ')}\n`;
      }
      if (item.removals && item.removals.length > 0) {
        text += `  - RETIRAR: ${item.removals.join(', ').toUpperCase()}\n`;
      }
      if (item.notes) text += `  *** OBS: ${item.notes.toUpperCase()} ***\n`;
    });
    text += subDivider;
    if (sale.subtotal) text += `SUBTOTAL:                    R$ ${sale.subtotal.toFixed(2)}\n`;
    if (sale.discount) text += `DESCONTO:                   -R$ ${sale.discount.toFixed(2)}\n`;
    if (sale.deliveryFee) text += `TAXA DE ENTREGA:            +R$ ${sale.deliveryFee.toFixed(2)}\n`;
    text += `TOTAL A PAGAR:               R$ ${sale.total.toFixed(2)}\n`;
    if (sale.paymentStatus === 'pendente_retirada') {
      text += 'STATUS:                     PAGAR NA RETIRADA\n';
      text += `*** ATENCAO: COBRAR R$ ${sale.total.toFixed(2)} NA ENTREGA ***\n`;
    } else {
      text += `FORMA DE PAGAMENTO: ${sale.paymentMethod.toUpperCase()}\n`;
    }
    text += divider;
    text += '          OBRIGADO PELA PREFERENCIA!    \n';
    text += '             VOLTE SEMPRE! 🍔           \n';

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
      {/* O motor global de 1 página é gerenciado por thermal-print-mount em thermal-printer.ts */}

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

        {/* Opções de Impressão (Ficha Técnica / Montagem) */}
        {type !== 'cliente' && (
          <div className="flex items-center justify-between px-3.5 py-2 mb-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs no-print">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>📋</span> Detalhes da Montagem (Receita)
            </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showMontagem}
                onChange={(e) => handleToggleShowMontagem(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-400 cursor-pointer"
              />
              <span className={`text-[11px] font-bold ${showMontagem ? 'text-amber-400' : 'text-slate-500'}`}>
                {showMontagem ? 'Exibir na Comanda' : 'Ocultar (Economizar papel)'}
              </span>
            </label>
          </div>
        )}

        {/* Pré-visualização da Bobina Térmica (80mm) */}
        <div className="flex-1 overflow-y-auto bg-white text-black p-5 rounded-2xl font-sans font-bold text-xs shadow-inner select-none border-2 border-slate-300">
          <div id="thermal-receipt-printable">
            {type === 'diferencial' || type === 'cozinha' ? (
              <KitchenTicketView ticket={kitchenTicket} showMontagem={showMontagem} />
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
                  <p className="text-[10px] text-black font-bold mt-0.5">{formattedDate} - {formattedTime}</p>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black">
                  <div className="flex justify-between font-bold text-[11px] mb-2 border-b border-black pb-1">
                    <span>ITEM</span>
                    <span>QTD x VALOR</span>
                  </div>
                  <div className="space-y-2">
                    {sale.items.map((item, idx) => {
                      const details = getBurgerPrintDetails(item, allProducts, allInventoryItems);
                      return (
                        <div key={idx} className="flex justify-between items-start text-xs">
                          <div className="pr-2">
                            <p className="font-bold">{item.productName}</p>
                            {details.comboDetails ? (
                              <div className="text-[10px] font-bold text-black pl-2 uppercase">
                                <p>+ {details.comboDetails.title}</p>
                                <p className="text-[9px] text-black font-semibold pl-1.5">
                                  • {details.comboDetails.fryerItem} + {details.comboDetails.drinkItem}
                                </p>
                              </div>
                            ) : item.combo ? (
                              <p className="text-[10px] font-bold text-black pl-2 uppercase">+ {item.combo.toUpperCase()}</p>
                            ) : null}
                            {item.meatPoint && <p className="text-[10px] font-bold text-black pl-2 uppercase">* PONTO: {item.meatPoint.toUpperCase()}</p>}
                            {item.additionals && item.additionals.length > 0 && (
                              <p className="text-[10px] font-bold text-black pl-2 uppercase">+ {item.additionals.map(a => a.name.toUpperCase()).join(', ')}</p>
                            )}
                            {item.removals && item.removals.length > 0 && (
                              <p className="text-[10px] font-bold text-black pl-2 uppercase">- RETIRAR: {item.removals.join(', ').toUpperCase()}</p>
                            )}
                            {item.notes && <p className="text-[10px] font-black text-black pl-2 uppercase">*** OBS: {item.notes.toUpperCase()} ***</p>}
                          </div>
                          <span className="font-bold shrink-0">
                            {item.quantity}x R$ {(item.unitPrice || 0).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black space-y-1 font-bold text-xs">
                  {sale.subtotal !== undefined && (
                    <div className="flex justify-between text-black font-bold">
                      <span>Subtotal Itens:</span>
                      <span>R$ {sale.subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {sale.discount !== undefined && sale.discount > 0 && (
                    <div className="flex justify-between text-black font-bold">
                      <span>Desconto:</span>
                      <span>- R$ {sale.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {sale.deliveryFee !== undefined && sale.deliveryFee > 0 && (
                    <div className="flex justify-between text-black font-bold">
                      <span>Taxa de Entrega:</span>
                      <span>+ R$ {sale.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base pt-1 border-t border-black">
                    <span>TOTAL:</span>
                    <span>R$ {sale.total.toFixed(2)}</span>
                  </div>
                  {sale.paymentStatus === 'pendente_retirada' ? (
                    <div className="bg-black text-white p-1.5 my-1 text-center border border-black">
                      <p className="font-black text-xs uppercase tracking-wider">*** PAGAMENTO NA RETIRADA ***</p>
                      <p className="text-[11px] font-extrabold uppercase">A COBRAR: R$ {sale.total.toFixed(2)}</p>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[11px] pt-1 text-black font-extrabold">
                      <span>FORMA DE PAGAMENTO:</span>
                      <span className="uppercase font-bold">
                        {sale.paymentMethod === 'ifood_online' 
                          ? 'iFood Online (App)' 
                          : sale.paymentMethod === 'ifood_entrega' 
                            ? 'iFood na Entrega' 
                            : sale.paymentMethod}
                      </span>
                    </div>
                  )}
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

        {/* Dica de Impressão Segura */}
        <div className="mt-2 text-[11px] text-emerald-300/90 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-center no-print">
          ⚡ <b>Dica PDV:</b> Clique apenas <b>1 vez</b> em "Imprimir Cupom". A comanda é enviada para a impressora e a janela fecha automaticamente.
        </div>

        {/* Botões de Ação */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex gap-2 no-print">
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
            disabled={isPrinting}
            className={`flex-1 py-3 ${isPrinting ? 'bg-emerald-800 opacity-70 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'} text-white rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2`}
          >
            <Printer size={16} className={isPrinting ? 'animate-pulse' : ''} /> 
            {isPrinting ? 'Enviando p/ Impressora...' : 'Imprimir Cupom'}
          </button>
        </div>
      </div>
    </div>
  );
}
