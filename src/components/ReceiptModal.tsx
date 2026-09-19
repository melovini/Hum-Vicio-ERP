'use client';
import { useState } from 'react';
import { Sale, SaleItem, useInventory, Product, InventoryItem } from '@/lib/store';
import { Printer, X, ChefHat, Receipt, CheckCircle, Copy, AlertTriangle, GitCompare } from 'lucide-react';
import { printThermalElement } from '@/lib/thermal-printer';
import { getBurgerPrintDetails } from '@/lib/production-calculator';

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
        const details = getBurgerPrintDetails(item, allProducts, allInventoryItems);
        text += `[+] ${item.quantity}x ${item.productName} (ADICIONADO)\n`;
        if (showMontagem && details.recipeIngredients.length > 0) {
          text += `    MONTAGEM: ${details.recipeIngredients.join(', ')}\n`;
        }
        if (details.chapaItems.length > 0) {
          text += `    * CHAPA: ${details.chapaItems.join(' + ')}\n`;
        }
        if (details.fryerItems.length > 0) {
          text += `    * FRITADEIRA: ${details.fryerItems.join(' + ')}\n`;
        }
        if (details.comboDetails) {
          text += `    ------------------------------------\n`;
          text += `    >> ${details.comboDetails.title} <<\n`;
          text += `    * FRITADEIRA: ${details.comboDetails.fryerItem.toUpperCase()}\n`;
          if (details.comboDetails.chapaItem) {
            text += `    * CHAPA/MONTAGEM: ${details.comboDetails.chapaItem.toUpperCase()}\n`;
          }
          if (details.comboDetails.drinkItem) {
            text += `    * BEBIDA: ${details.comboDetails.drinkItem.toUpperCase()}\n`;
          }
          text += `    ------------------------------------\n`;
        } else if (item.combo) {
          text += `    + COMBO: ${item.combo.toUpperCase()}\n`;
        }
        if (item.additionals && item.additionals.length > 0) {
          text += `    + ADICIONAIS: ${item.additionals.map(a => a.name).join(', ')}\n`;
        }
        if (item.removals && item.removals.length > 0) {
          text += `    *** 🚫 ATENCAO RETIRAR: ${item.removals.join(', ').toUpperCase()} ***\n`;
        }
        if (item.notes) text += `    *** OBS: ${item.notes.toUpperCase()} ***\n`;
      });
      activeDiff.removed.forEach(item => {
        text += `[-] ${item.quantity}x ${item.productName} (CANCELADO)\n`;
      });
      activeDiff.modified.forEach(m => {
        text += `[*] ${m.item.quantity}x ${m.item.productName} (MODIFICADO)\n`;
        text += `    DE: ${(m.oldNotes || 'Sem obs').toUpperCase()}\n`;
        text += `    PARA: ${(m.newNotes || 'Sem obs').toUpperCase()}\n`;
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
      if (sale.paymentStatus === 'pendente_retirada') {
        text += '****************************************\n';
        text += '*** ATENCAO: PAGAR NA RETIRADA       ***\n';
        text += `*** COBRAR DO CLIENTE: R$ ${sale.total.toFixed(2)} ***\n`;
        text += '****************************************\n';
      }
      text += subDivider;
      text += 'ITENS PARA PREPARO:\n';
      sale.items.forEach(item => {
        const details = getBurgerPrintDetails(item, allProducts, allInventoryItems);
        text += `[${item.quantity}x] ${item.productName}\n`;
        if (showMontagem && details.recipeIngredients.length > 0) {
          text += `    MONTAGEM: ${details.recipeIngredients.join(', ')}\n`;
        }
        if (details.chapaItems.length > 0) {
          text += `    * CHAPA: ${details.chapaItems.join(' + ')}\n`;
        }
        if (details.fryerItems.length > 0) {
          text += `    * FRITADEIRA: ${details.fryerItems.join(' + ')}\n`;
        }
        if (details.comboDetails) {
          text += `    ------------------------------------\n`;
          text += `    >> ${details.comboDetails.title} <<\n`;
          text += `    * FRITADEIRA: ${details.comboDetails.fryerItem.toUpperCase()}\n`;
          if (details.comboDetails.chapaItem) {
            text += `    * CHAPA/MONTAGEM: ${details.comboDetails.chapaItem.toUpperCase()}\n`;
          }
          if (details.comboDetails.drinkItem) {
            text += `    * BEBIDA: ${details.comboDetails.drinkItem.toUpperCase()}\n`;
          }
          text += `    ------------------------------------\n`;
        } else if (item.combo) {
          text += `    + COMBO: ${item.combo.toUpperCase()}\n`;
        }
        if (details.effectiveMeatPoint && details.chapaItems.length === 0) {
          text += `    * PONTO: ${details.effectiveMeatPoint.toUpperCase()} *\n`;
        }
        if (item.additionals && item.additionals.length > 0) {
          text += `    + ADICIONAIS: ${item.additionals.map(a => a.name).join(', ')}\n`;
        }
        if (item.removals && item.removals.length > 0) {
          text += `    *** 🚫 ATENCAO RETIRAR: ${item.removals.join(', ').toUpperCase()} ***\n`;
        }
        if (item.notes) text += `    *** OBS: ${item.notes.toUpperCase()} ***\n`;
        text += subDivider;
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
                      {activeDiff.added.map((item, idx) => {
                        const details = getBurgerPrintDetails(item, allProducts, allInventoryItems);
                        return (
                          <div key={idx} className="pl-2 border-l-2 border-black font-bold space-y-0.5">
                            <span className="text-sm">[+] {item.quantity}x {item.productName} (ADICIONADO)</span>
                            {showMontagem && details.recipeIngredients.length > 0 && (
                              <p className="text-[11px] font-semibold text-black leading-tight">
                                <span className="font-extrabold uppercase">Montagem: </span>
                                {details.recipeIngredients.join(' • ')}
                              </p>
                            )}
                            {details.chapaItems.length > 0 && (
                              <p className="text-xs font-black text-black">
                                🔥 CHAPA: {details.chapaItems.join(' + ')}
                              </p>
                            )}
                            {details.fryerItems.length > 0 && (
                              <p className="text-xs font-black text-black">
                                🍟 FRITADEIRA: {details.fryerItems.join(' + ')}
                              </p>
                            )}
                            {/* Combo Detalhado */}
                            {details.comboDetails ? (
                              <div className="my-1.5 p-1.5 bg-black text-white rounded-none border border-black space-y-0.5">
                                <p className="font-black text-xs uppercase tracking-wide text-white flex items-center gap-1">
                                  <span>{details.comboDetails.icon}</span>
                                  <span>{details.comboDetails.title}</span>
                                </p>
                                <div className="pl-1.5 border-l-2 border-white text-[11px] font-semibold space-y-0.5 text-white">
                                  <p>🍟 <span className="font-black uppercase">Fritadeira:</span> {details.comboDetails.fryerItem}</p>
                                  {details.comboDetails.chapaItem && (
                                    <p>🔥 <span className="font-black uppercase">Chapa/Montagem:</span> {details.comboDetails.chapaItem}</p>
                                  )}
                                  {details.comboDetails.drinkItem && (
                                    <p>🥤 <span className="font-black uppercase">Bebida:</span> {details.comboDetails.drinkItem}</p>
                                  )}
                                </div>
                              </div>
                            ) : item.combo ? (
                              <p className="text-xs font-bold text-black">
                                + COMBO: {item.combo.toUpperCase()}
                              </p>
                            ) : null}
                            {item.additionals && item.additionals.length > 0 && (
                              <p className="text-xs font-bold text-black">
                                + ADICIONAIS: {item.additionals.map(a => a.name.toUpperCase()).join(', ')}
                              </p>
                            )}
                            {item.removals && item.removals.length > 0 && (
                              <div>
                                <span className="bg-black text-white px-2 py-0.5 text-xs font-black uppercase tracking-wider inline-block">
                                  🚫 RETIRAR: {item.removals.join(', ').toUpperCase()}
                                </span>
                              </div>
                            )}
                            {item.notes && (
                              <div>
                                <p className="text-xs font-black bg-black text-white px-1.5 py-0.5 mt-1 inline-block uppercase">
                                  *** OBS: {item.notes.toUpperCase()} ***
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                          <p className="text-[11px] pl-2 line-through uppercase">DE: {(m.oldNotes || 'Sem obs').toUpperCase()}</p>
                          <p className="text-[11px] pl-2 font-black uppercase">PARA: {(m.newNotes || 'Sem obs').toUpperCase()}</p>
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
                  {sale.paymentStatus === 'pendente_retirada' && (
                    <div className="bg-black text-white p-1.5 mt-1.5 text-center border border-black">
                      <p className="font-black text-xs uppercase tracking-wider">⚠️ ATENÇÃO: PAGAR NA RETIRADA</p>
                      <p className="text-[11px] font-extrabold uppercase">COBRAR NO BALCÃO: R$ {sale.total.toFixed(2)}</p>
                    </div>
                  )}
                  <p className="text-[10px] mt-1">{formattedDate} - {formattedTime}</p>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black">
                  <p className="font-bold mb-2 uppercase text-xs">ITENS DO PEDIDO:</p>
                  <div className="space-y-3 text-sm">
                    {sale.items.map((item, idx) => {
                      const details = getBurgerPrintDetails(item, allProducts, allInventoryItems);
                      return (
                        <div key={idx} className="border-b-2 border-dashed border-black pb-2.5 last:border-0 last:pb-0 space-y-1">
                          <div className="flex justify-between items-start font-bold">
                            <span className="text-base font-black text-black leading-tight">
                              [{item.quantity}x] {item.productName}
                            </span>
                          </div>

                          {/* Ficha Técnica / Montagem da Receita (Opcional) */}
                          {showMontagem && details.recipeIngredients.length > 0 && (
                            <div className="pl-2 border-l-2 border-black text-[11px] font-semibold text-black leading-tight">
                              <span className="font-black uppercase">Montagem: </span>
                              <span>{details.recipeIngredients.join(' • ')}</span>
                            </div>
                          )}

                          {/* Estação Chapa */}
                          {details.chapaItems.length > 0 && (
                            <p className="text-xs font-black text-black pl-2">
                              🔥 CHAPA: {details.chapaItems.join(' + ')}
                            </p>
                          )}

                          {/* Estação Fritadeira */}
                          {details.fryerItems.length > 0 && (
                            <p className="text-xs font-black text-black pl-2">
                              🍟 FRITADEIRA: {details.fryerItems.join(' + ')}
                            </p>
                          )}

                          {/* Combo Detalhado com Destaque Máximo para Chapeiro e Montador */}
                          {details.comboDetails ? (
                            <div className="my-1.5 p-2 bg-black text-white rounded-none border border-black space-y-1">
                              <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-white">
                                <span>{details.comboDetails.icon}</span>
                                <span>{details.comboDetails.title}</span>
                              </div>
                              <div className="pl-2 border-l-2 border-white text-[11px] font-semibold space-y-0.5 text-white">
                                <p>
                                  🍟 <span className="font-black uppercase">Fritadeira:</span> {details.comboDetails.fryerItem}
                                </p>
                                {details.comboDetails.chapaItem && (
                                  <p>
                                    🔥 <span className="font-black uppercase">Chapa/Montagem:</span> {details.comboDetails.chapaItem}
                                  </p>
                                )}
                                {details.comboDetails.drinkItem && (
                                  <p>
                                    🥤 <span className="font-black uppercase">Bebida:</span> {details.comboDetails.drinkItem}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : item.combo ? (
                            <p className="text-xs font-bold pl-2 text-black">
                              + COMBO: {item.combo.toUpperCase()}
                            </p>
                          ) : null}

                          {/* Ponto da Carne (se não incluso acima) */}
                          {details.effectiveMeatPoint && details.chapaItems.length === 0 && (
                            <p className="text-xs font-black pl-2 text-black">
                              🥩 PONTO: {details.effectiveMeatPoint.toUpperCase()}
                            </p>
                          )}

                          {/* Adicionais */}
                          {item.additionals && item.additionals.length > 0 && (
                            <p className="text-xs font-black pl-2 text-black">
                              + ADICIONAIS: {item.additionals.map(a => a.name.toUpperCase()).join(', ')}
                            </p>
                          )}

                          {/* Retiradas com Destaque Máximo (Fundo Preto / Texto Branco Invertido) */}
                          {item.removals && item.removals.length > 0 && (
                            <div>
                              <span className="bg-black text-white px-2 py-1 text-xs font-black uppercase tracking-wider inline-block">
                                🚫 RETIRAR: {item.removals.join(', ').toUpperCase()}
                              </span>
                            </div>
                          )}

                          {/* Observações */}
                          {item.notes && (
                            <div>
                              <p className="text-xs font-black bg-black text-white px-1.5 py-0.5 mt-0.5 inline-block uppercase">
                                *** OBS: {item.notes.toUpperCase()} ***
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
