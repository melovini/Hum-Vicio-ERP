'use client';
import { useState } from 'react';
import { Sale } from '@/lib/store';
import { Printer, X, ChefHat, Receipt, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export default function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  const [type, setType] = useState<'cozinha' | 'cliente'>('cozinha');

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(sale.date).toLocaleDateString('pt-BR');
  const formattedTime = new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Estilos CSS específicos de impressão térmica */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt-container, #thermal-receipt-container * {
            visibility: visible;
          }
          #thermal-receipt-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            max-width: 80mm;
            margin: 0;
            padding: 8px;
            color: #000 !important;
            background: #fff !important;
            font-family: 'Courier New', Courier, monospace !important;
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
            <span>Imprimir Cupom Térmico</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Seleção de Via */}
        <div className="flex gap-2 mb-4 no-print">
          <button 
            type="button" 
            onClick={() => setType('cozinha')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
              type === 'cozinha' 
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' 
                : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            <ChefHat size={16} /> VIA COZINHA (CHAPA)
          </button>
          <button 
            type="button" 
            onClick={() => setType('cliente')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
              type === 'cliente' 
                ? 'bg-blue-500 text-white shadow-md font-extrabold' 
                : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            <Receipt size={16} /> VIA CLIENTE / MESA
          </button>
        </div>

        {/* Pré-visualização da Bobina Térmica (80mm) */}
        <div className="flex-1 overflow-y-auto bg-white text-black p-6 rounded-2xl font-mono text-xs shadow-inner select-none border-2 border-slate-300">
          <div id="thermal-receipt-container">
            {type === 'cozinha' ? (
              /* --- VIA DA COZINHA --- */
              <div className="space-y-3">
                <div className="text-center border-b-2 border-dashed border-black pb-3">
                  <h3 className="font-extrabold text-lg uppercase tracking-wider">HUM VÍCIO BURGER</h3>
                  <p className="font-bold text-sm bg-black text-white px-2 py-0.5 mt-1 inline-block uppercase">
                    VIA DE PRODUÇÃO (CHAPA)
                  </p>
                  <p className="text-xs mt-1">PEDIDO #{sale.id.slice(0, 6).toUpperCase()} • {sale.channel.toUpperCase()}</p>
                  <p className="text-[11px]">{formattedDate} - {formattedTime}</p>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black">
                  <p className="font-bold mb-2 uppercase text-xs">ITENS DO PEDIDO:</p>
                  <div className="space-y-2 text-sm">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start font-bold">
                        <span className="text-base">[{item.quantity}x] {item.productName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center text-[11px] pt-1 font-bold">
                  *** AGILIDADE & QUALIDADE ***
                </div>
              </div>
            ) : (
              /* --- VIA DO CLIENTE --- */
              <div className="space-y-3">
                <div className="text-center border-b-2 border-dashed border-black pb-3">
                  <h3 className="font-extrabold text-lg uppercase tracking-wider">HUM VÍCIO BURGER</h3>
                  <p className="text-[10px]">CUPOM NÃO FISCAL DE CONFERÊNCIA</p>
                  <p className="text-xs font-bold mt-1">PEDIDO #{sale.id.slice(0, 6).toUpperCase()}</p>
                  <p className="text-[11px]">{formattedDate} às {formattedTime}</p>
                  <p className="text-[11px] font-bold">Canal: {sale.channel.toUpperCase()}</p>
                </div>

                <div className="py-2 border-b-2 border-dashed border-black space-y-1">
                  <div className="flex justify-between font-bold text-[11px] border-b border-black pb-1 mb-1">
                    <span>ITEM</span>
                    <span>QTD x VALOR</span>
                  </div>
                  {sale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <span className="font-bold">{item.productName}</span>
                      <span>{item.quantity} x R$ {item.unitPrice.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 pt-1 border-b-2 border-dashed border-black pb-2 text-xs">
                  <div className="flex justify-between font-extrabold text-sm">
                    <span>TOTAL A PAGAR:</span>
                    <span>R$ {sale.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>FORMA DE PAGAMENTO:</span>
                    <span className="uppercase font-bold">{sale.paymentMethod}</span>
                  </div>
                </div>

                <div className="text-center text-[10px] pt-2">
                  <p className="font-bold">Obrigado pela preferência!</p>
                  <p>Volte Sempre ao Hum Vício Burger 🍔</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botão de Imprimir */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex gap-3 no-print">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm cursor-pointer"
          >
            Fechar
          </button>
          <button 
            type="button" 
            onClick={handlePrint}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer size={18} /> Imprimir Bobina
          </button>
        </div>
      </div>
    </div>
  );
}
