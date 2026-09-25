'use client';
import React from 'react';
import { SaleItem, Sale } from '@/lib/store';
import { calculateCashChange } from '@/lib/pos-financial-helpers';
import type { Collaborator } from '@/lib/collaborators';
import { 
  DollarSign, CreditCard, Banknote, Coins, FileCheck2, 
  Send, RotateCcw, GitCompare, Clock, X, UserCheck,
  Smartphone, Tag
} from 'lucide-react';

interface PosCheckoutZoneProps {
  cart: SaleItem[];
  cartSubtotal: number;
  discountInput: string;
  discountReason?: string;
  onDiscountReasonChange?: (reason: string) => void;
  onDiscountInputChange: (val: string) => void;
  discountAmount: number;
  deliveryFeeInput: string;
  onDeliveryFeeInputChange: (val: string) => void;
  deliveryFeeAmount: number;
  cartTotal: number;
  orderType: 'retirada' | 'delivery' | 'mesa';
  pickupPaymentTiming: 'retirada' | 'imediato';
  onPickupPaymentTimingChange: (timing: 'retirada' | 'imediato') => void;
  saleMethod: string;
  onSaleMethodChange: (method: string) => void;
  cashReceivedInput: string;
  onCashReceivedInputChange: (val: string) => void;
  fiscalCpfInput: string;
  onFiscalCpfInputChange: (val: string) => void;
  hasStoreCoupon: boolean;
  onHasStoreCouponChange: (has: boolean) => void;
  storeCouponInput: string;
  onStoreCouponInputChange: (val: string) => void;
  collaborators: Collaborator[];
  selectedCollaboratorId: string;
  onSelectedCollaboratorIdChange: (id: string) => void;
  creditCustomerInput: string;
  onCreditCustomerInputChange: (val: string) => void;
  creditDueDateInput: string;
  onCreditDueDateInputChange: (val: string) => void;
  editingReopenedSale: Sale | null;
  isSubmittingOrder: boolean;
  onCheckout: () => void;
  saleChannel: 'balcao' | 'ifood';
  customerName?: string;
}

interface PaymentMethodOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  fee: string;
  shortcut?: string;
}

const IFOOD_PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'ifood_online', label: 'iFood Online', icon: Smartphone, fee: 'Taxa 33%' },
  { id: 'ifood_entrega', label: 'iFood Entrega', icon: CreditCard, fee: 'Taxa 23%' },
  { id: 'pix', label: 'PIX Direto', icon: DollarSign, fee: 'Taxa 0%' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, fee: 'Taxa 0%' },
  { id: 'cartao_credito', label: 'Crédito', icon: CreditCard, fee: 'Taxa 3.19%' },
  { id: 'cartao_debito', label: 'Débito', icon: CreditCard, fee: 'Taxa 1.39%' },
];

const BALCAO_PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, shortcut: 'F8', fee: 'Taxa: 0%' },
  { id: 'pix', label: 'PIX', icon: DollarSign, shortcut: 'F9', fee: 'Taxa: 0%' },
  { id: 'cartao_debito', label: 'Débito', icon: CreditCard, shortcut: 'F10', fee: 'Taxa: 1.39%' },
  { id: 'cartao_credito', label: 'Crédito', icon: CreditCard, shortcut: 'F11', fee: 'Taxa: 3.19%' },
  { id: 'ifood_online', label: 'iFood Online', icon: Smartphone, fee: 'Taxa 33%' },
  { id: 'ifood_entrega', label: 'iFood Entrega', icon: CreditCard, fee: 'Taxa 23%' },
  { id: 'fiado_vip', label: 'Fiado VIP', icon: UserCheck, fee: 'A Prazo' },
  { id: 'consumo_funcionario', label: 'Equipe', icon: UserCheck, fee: 'Interno' },
];

export default function PosCheckoutZone({
  cart,
  cartSubtotal,
  discountInput,
  discountReason,
  onDiscountReasonChange,
  onDiscountInputChange,
  discountAmount,
  deliveryFeeInput,
  onDeliveryFeeInputChange,
  deliveryFeeAmount,
  cartTotal,
  orderType,
  pickupPaymentTiming,
  onPickupPaymentTimingChange,
  saleMethod,
  onSaleMethodChange,
  cashReceivedInput,
  onCashReceivedInputChange,
  fiscalCpfInput,
  onFiscalCpfInputChange,
  hasStoreCoupon,
  onHasStoreCouponChange,
  storeCouponInput,
  onStoreCouponInputChange,
  collaborators,
  selectedCollaboratorId,
  onSelectedCollaboratorIdChange,
  creditCustomerInput,
  onCreditCustomerInputChange,
  creditDueDateInput,
  onCreditDueDateInputChange,
  editingReopenedSale,
  isSubmittingOrder,
  onCheckout,
  saleChannel,
  customerName,
}: PosCheckoutZoneProps) {
  const isPickupPending = orderType === 'retirada' && pickupPaymentTiming === 'retirada' && saleChannel !== 'ifood';
  const cashChange = calculateCashChange(cashReceivedInput, cartTotal);
  const isCashInsufficient = saleMethod === 'dinheiro' && !isPickupPending && !cashChange.isEnough;

  const paymentMethods = saleChannel === 'ifood' ? IFOOD_PAYMENT_METHODS : BALCAO_PAYMENT_METHODS;

  const effectiveCreditCustomer = creditCustomerInput.trim() || (customerName && customerName.trim()) || '';

  const isCheckoutDisabled = 
    cart.length === 0 || 
    isSubmittingOrder || 
    isCashInsufficient || 
    (saleMethod === 'consumo_funcionario' && !selectedCollaboratorId) ||
    (saleMethod === 'fiado_vip' && !effectiveCreditCustomer);

  return (
    <div className="bg-slate-900/90 rounded-3xl p-4 sm:p-5 border border-slate-800 flex flex-col h-full shadow-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto pr-1 space-y-3.5">
        <h2 className="text-sm font-bold text-white flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="flex items-center gap-1.5">
            <CreditCard size={18} className="text-blue-400" /> Resumo e Pagamento
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
            saleChannel === 'ifood' 
              ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {saleChannel === 'ifood' ? '🛵 Canal iFood' : '🏪 Canal Balcão'}
          </span>
        </h2>

        {/* Marcação de Cupom iFood da Loja (Subsídio de Faturamento / Hits) */}
        {saleChannel === 'ifood' && (
          <div className="bg-red-950/25 p-3 rounded-2xl border border-red-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-red-200">
                <input
                  type="checkbox"
                  checked={hasStoreCoupon}
                  onChange={e => onHasStoreCouponChange(e.target.checked)}
                  className="rounded border-red-500 accent-red-600 cursor-pointer w-4 h-4"
                />
                <span className="flex items-center gap-1.5">
                  <Tag size={13} className="text-red-400" /> Cupom pago pela Loja? (Ex: Hits / Clube)
                </span>
              </label>
              {hasStoreCoupon && (
                <div className="flex items-center gap-1">
                  <span className="text-red-400 font-mono text-xs font-bold">-R$</span>
                  <input
                    type="number"
                    step="1"
                    value={storeCouponInput}
                    onChange={e => onStoreCouponInputChange(e.target.value)}
                    placeholder="10.00"
                    className="w-16 bg-slate-950 border border-red-500/50 rounded-lg px-2 py-1 text-right text-xs font-mono font-black text-red-400 outline-none focus:border-red-400"
                    aria-label="Valor do cupom da loja"
                  />
                </div>
              )}
            </div>
            {hasStoreCoupon && (
              <div className="flex items-center justify-between pt-1 border-t border-red-500/20 text-[11px]">
                <span className="text-red-300 text-[10px] font-medium">Valores rápidos:</span>
                <div className="flex gap-1">
                  {[5, 10, 12, 15].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onStoreCouponInputChange(v.toFixed(2))}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-all ${
                        parseFloat(storeCouponInput) === v 
                          ? 'bg-red-600 text-white shadow-xs' 
                          : 'bg-slate-950 text-red-300 hover:bg-slate-800 border border-red-900/50'
                      }`}
                    >
                      R$ {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-red-300/80 italic">
              * O subsídio é registrado para auditoria e dedução no cálculo do faturamento líquido.
            </p>
          </div>
        )}

        {/* Retirada: Pagar Agora ou no Balcão */}
        {orderType === 'retirada' && saleChannel !== 'ifood' && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => onPickupPaymentTimingChange('imediato')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                pickupPaymentTiming === 'imediato'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💳 Pagar Agora
            </button>
            <button
              type="button"
              onClick={() => onPickupPaymentTimingChange('retirada')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                pickupPaymentTiming === 'retirada'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⏳ Pagar na Retirada
            </button>
          </div>
        )}

        {/* Formas de Pagamento (Se não for pagamento pendente na retirada) */}
        {!isPickupPending && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Forma de Pagamento:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {paymentMethods.map(m => {
                const Icon = m.icon;
                const isSelected = saleMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSaleMethodChange(m.id)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-400/80 shadow-md ring-1 ring-emerald-400'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    {/* Linha 1: Ícone + Nome Completo + Atalho */}
                    <div className="flex items-center justify-between w-full gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon size={14} className={isSelected ? 'text-white shrink-0' : 'text-slate-400 shrink-0'} />
                        <span className="text-xs font-black tracking-tight leading-none whitespace-nowrap overflow-hidden text-ellipsis">
                          {m.label}
                        </span>
                      </div>
                      {m.shortcut && (
                        <kbd className={`px-1 py-0.2 text-[9px] font-mono font-bold rounded shrink-0 ${
                          isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                        }`}>
                          {m.shortcut}
                        </kbd>
                      )}
                    </div>

                    {/* Linha 2: Detalhes / Taxa / Condição */}
                    <div className="flex items-center justify-between w-full mt-1.5 pt-0.5">
                      <span className={`text-[10px] font-mono leading-none ${
                        isSelected ? 'text-emerald-100 font-bold' : 'text-slate-400 font-medium'
                      }`}>
                        {m.fee}
                      </span>
                      {isSelected && (
                        <span className="text-[9px] font-black uppercase text-emerald-200 bg-emerald-700/80 px-1 py-0.2 rounded">
                          ✓
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagamento em Dinheiro: Calculadora de Troco */}
        {saleMethod === 'dinheiro' && !isPickupPending && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <Coins size={14} /> Troco da Gaveta
              </span>
              <span className="text-[11px] text-emerald-400 font-mono font-bold">
                Total: R$ {cartTotal.toFixed(2)}
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={cashReceivedInput}
                onChange={e => onCashReceivedInputChange(e.target.value)}
                placeholder={`Valor recebido (Ex: ${cartTotal.toFixed(2)})`}
                className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-emerald-500/40 rounded-xl text-xs font-mono font-bold text-emerald-300 placeholder-slate-600 outline-none"
                aria-label="Valor recebido em dinheiro"
              />
              {cashReceivedInput && (
                <button
                  type="button"
                  onClick={() => onCashReceivedInputChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Cédulas Rápidas */}
            <div className="flex items-center gap-1 flex-wrap text-[10px]">
              <button
                type="button"
                onClick={() => onCashReceivedInputChange(cartTotal.toFixed(2))}
                className="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-mono font-bold cursor-pointer"
              >
                Exato
              </button>
              {[20, 50, 100, 200].map(bill => (
                <button
                  key={bill}
                  type="button"
                  onClick={() => onCashReceivedInputChange(bill.toString())}
                  className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold cursor-pointer"
                >
                  R$ {bill}
                </button>
              ))}
            </div>

            {/* Resultado do Troco */}
            {cashChange.isEnough ? (
              <div className="flex justify-between items-center pt-1 border-t border-emerald-500/20 text-xs">
                <span className="text-emerald-300 font-bold">Devolver de Troco:</span>
                <span className="text-sm font-mono font-black text-emerald-400">
                  R$ {cashChange.change.toFixed(2)}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-1 border-t border-rose-500/20 text-xs">
                <span className="text-rose-400 font-bold">Faltando receber:</span>
                <span className="text-sm font-mono font-black text-rose-400">
                  R$ {cashChange.missing.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Consumo de Funcionário: Selecionar Colaborador */}
        {saleMethod === 'consumo_funcionario' && !isPickupPending && (
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 block">
              Colaborador que consumiu:
            </label>
            <select
              value={selectedCollaboratorId}
              onChange={e => onSelectedCollaboratorIdChange(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none cursor-pointer"
            >
              <option value="">Selecione o membro da equipe...</option>
              {collaborators.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Fiado VIP: Dados da Cobrança */}
        {saleMethod === 'fiado_vip' && !isPickupPending && (
          <div className="space-y-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Nome do Cliente VIP:
                </label>
                {!creditCustomerInput && customerName?.trim() && (
                  <span className="text-[10px] text-amber-400 font-semibold">
                    ✓ Vinculado: {customerName.trim()}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={creditCustomerInput}
                onChange={e => onCreditCustomerInputChange(e.target.value)}
                placeholder={customerName?.trim() ? `Padrão: ${customerName.trim()}` : "Ex: João da Silva (VIP)"}
                className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Data de Vencimento:
              </label>
              <input
                type="date"
                value={creditDueDateInput}
                onChange={e => onCreditDueDateInputChange(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none"
              />
            </div>
          </div>
        )}

        {/* Descontos, Taxa e CPF na Nota */}
        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                Desconto (R$ ou %):
              </label>
              <input
                type="text"
                value={discountInput}
                onChange={e => onDiscountInputChange(e.target.value)}
                placeholder="Ex: 5 ou 10%"
                className="w-full py-1.5 px-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none"
              />
            </div>

            {discountAmount > 0 && <label className="col-span-2 text-xs text-slate-300">Justificativa do desconto (obrigatória)
              <input aria-label="Justificativa do desconto" maxLength={300} value={discountReason || ''} onChange={e => onDiscountReasonChange?.(e.target.value)} className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-white" placeholder="Ex.: compensação pelo atraso" />
            </label>}
            {orderType === 'delivery' && (
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  Taxa de Entrega:
                </label>
                <input
                  type="text"
                  value={deliveryFeeInput}
                  onChange={e => onDeliveryFeeInputChange(e.target.value)}
                  placeholder="Ex: 8.00"
                  className="w-full py-1.5 px-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1">
              <FileCheck2 size={12} /> CPF na Nota (NFC-e Opcional):
            </label>
            <input
              type="text"
              value={fiscalCpfInput}
              onChange={e => onFiscalCpfInputChange(e.target.value)}
              placeholder="000.000.000-00 (Opcional)"
              className="w-full py-1.5 px-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none"
            />
          </div>
        </div>
      </div>

      {/* Resumo Financeiro e Ação de Finalização (Fixo no Rodapé) */}
      <div className="pt-2.5 border-t border-slate-800 space-y-2.5 shrink-0 bg-slate-900/95">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal:</span>
            <span className="font-mono text-white font-bold">R$ {cartSubtotal.toFixed(2)}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-amber-400 font-semibold">
              <span>Desconto:</span>
              <span className="font-mono">- R$ {discountAmount.toFixed(2)}</span>
            </div>
          )}

          {deliveryFeeAmount > 0 && (
            <div className="flex justify-between text-blue-400 font-semibold">
              <span>Taxa Entrega:</span>
              <span className="font-mono">+ R$ {deliveryFeeAmount.toFixed(2)}</span>
            </div>
          )}

          {hasStoreCoupon && parseFloat(storeCouponInput) > 0 && (
            <div className="flex justify-between text-red-400 font-semibold">
              <span className="flex items-center gap-1">
                <Tag size={12} /> Subsídio Cupom Loja:
              </span>
              <span className="font-mono tabular-nums">- R$ {parseFloat(storeCouponInput).toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
            <span className="text-slate-200 font-bold text-xs uppercase tracking-wider">Total a Pagar:</span>
            <span className="text-2xl font-mono font-black text-emerald-400">
              R$ {cartTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {isPickupPending && (
          <div className="p-2 bg-amber-500/15 border border-amber-500/40 rounded-xl text-[11px] text-amber-300 font-bold flex items-center gap-1.5">
            <Clock size={13} className="shrink-0 text-amber-400" />
            <span>Pendente: Cobrar R$ {cartTotal.toFixed(2)} na retirada.</span>
          </div>
        )}

        {/* Botão Finalizar Pedido com Proteção contra Duplo Clique e Atalho F4 */}
        <button
          type="button"
          onClick={onCheckout}
          disabled={isCheckoutDisabled}
          className={`w-full py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-md active:scale-95 ${
            isCheckoutDisabled
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : editingReopenedSale
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 ring-2 ring-amber-400'
                : isPickupPending
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
          }`}
          title="Finalizar Pedido [F4]"
        >
          {isSubmittingOrder ? (
            <>
              <RotateCcw className="animate-spin" size={15} />
              <span>Processando Comanda...</span>
            </>
          ) : editingReopenedSale ? (
            <>
              <GitCompare size={15} />
              <span>Salvar Edição & Emitir Diff</span>
            </>
          ) : isPickupPending ? (
            <>
              <Send size={15} />
              <span>Enviar Pedido (Pagar na Retirada ⏳) [F4]</span>
            </>
          ) : (
            <>
              <Send size={15} />
              <span>Finalizar Pedido (R$ {cartTotal.toFixed(2)}) [F4]</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
