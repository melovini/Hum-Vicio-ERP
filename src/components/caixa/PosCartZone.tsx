'use client';
import React from 'react';
import { SaleItem, Sale } from '@/lib/store';
import { SalaoMesaInstancia } from '@/lib/mesas';
import { CustomerProfile, CustomerSearchResult } from '@/lib/crm-clientes';
import PosCustomerAutocomplete from './PosCustomerAutocomplete';
import { 
  ShoppingCart as CartIcon, Plus, Minus, Trash2, 
  Gift, GitCompare, User, MessageSquare, Utensils, Pencil
} from 'lucide-react';

interface PosCartZoneProps {
  cart: SaleItem[];
  customerName: string;
  onCustomerNameChange: (val: string) => void;
  customerProfiles?: CustomerProfile[];
  saleChannel: 'balcao' | 'ifood';
  onSwitchChannel: (channel: 'balcao' | 'ifood') => void;
  orderType: 'retirada' | 'delivery' | 'mesa';
  onOrderTypeChange: (type: 'retirada' | 'delivery' | 'mesa') => void;
  targetMesa: SalaoMesaInstancia | null;
  floorMesas: SalaoMesaInstancia[];
  onSelectTable: (tableId: string | null) => void;
  editingReopenedSale: Sale | null;
  onCancelEditingReopenedSale: () => void;
  onUpdateQty: (index: number, delta: number, itemId?: string) => void;
  onRemoveItem: (index: number, itemId?: string) => void;
  onEditItem?: (item: SaleItem) => void;
  onOpenGiftModal: (index: number, itemId?: string) => void;
  onOpenNotesPrompt: (index: number, itemId?: string) => void;
  onCreateNewDraft: () => void;
  onClearCart: () => void;
  activeDraftLabel?: string;
  onSelectCustomer?: (customer: CustomerSearchResult) => void;
}

export default function PosCartZone({
  cart,
  customerName,
  onCustomerNameChange,
  customerProfiles,
  saleChannel,
  onSwitchChannel,
  orderType,
  onOrderTypeChange,
  targetMesa,
  floorMesas,
  onSelectTable,
  editingReopenedSale,
  onCancelEditingReopenedSale,
  onUpdateQty,
  onRemoveItem,
  onEditItem,
  onOpenGiftModal,
  onOpenNotesPrompt,
  onCreateNewDraft,
  onClearCart,
  activeDraftLabel,
  onSelectCustomer,
}: PosCartZoneProps) {
  return (
    <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 flex flex-col h-full shadow-lg">
      {/* Topo do Pedido: Identificação do Atendimento */}
      <div className="border-b border-slate-800 pb-3 mb-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <CartIcon size={18} className="text-emerald-400" /> Pedido Atual
            </h2>
            {activeDraftLabel && (
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold font-mono">
                🏷️ {activeDraftLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCreateNewDraft}
              className="px-2.5 py-1.5 min-h-[32px] bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
              title="Iniciar novo atendimento paralelo [Alt+N]"
            >
              <Plus size={13} /> + Novo
            </button>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="px-2.5 py-1.5 min-h-[32px] bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                title="Limpar itens da comanda atual [Alt+L]"
              >
                <Trash2 size={13} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Seletores de Canal e Modalidade */}
        <div className="grid grid-cols-2 gap-2">
          {/* Canal: Balcão vs iFood */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => onSwitchChannel('balcao')}
              className={`flex-1 py-1 px-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                saleChannel === 'balcao'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏪 Balcão
            </button>
            <button
              type="button"
              onClick={() => onSwitchChannel('ifood')}
              className={`flex-1 py-1 px-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                saleChannel === 'ifood'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🛵 iFood
            </button>
          </div>

          {/* Modalidade: Retirada / Delivery / Mesa */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => onOrderTypeChange('retirada')}
              className={`flex-1 py-1 px-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                orderType === 'retirada'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🥡 Retirada
            </button>
            <button
              type="button"
              onClick={() => onOrderTypeChange('delivery')}
              className={`flex-1 py-1 px-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                orderType === 'delivery'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🛵 Entrega
            </button>
            {saleChannel !== 'ifood' && (
              <button
                type="button"
                onClick={() => onOrderTypeChange('mesa')}
                className={`flex-1 py-1 px-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                  orderType === 'mesa'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🍽️ Mesa
              </button>
            )}
          </div>
        </div>

        {/* Identificação do Cliente / Mesa */}
        <div className="flex gap-2">
          {orderType === 'mesa' && (
            <div className="w-1/3">
              <select
                value={targetMesa?.id || ''}
                onChange={e => onSelectTable(e.target.value || null)}
                className="w-full py-2 px-2 bg-slate-950 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-bold outline-none cursor-pointer"
                aria-label="Selecionar mesa"
              >
                <option value="">Selecione Mesa...</option>
                {floorMesas.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.numeroIdentificador} ({m.statusConsumo === 'LIVRE' ? 'Livre' : `R$ ${m.totalConsumo.toFixed(2)}`})
                  </option>
                ))}
              </select>
            </div>
          )}

          <PosCustomerAutocomplete
            value={customerName}
            onChange={onCustomerNameChange}
            customerProfiles={customerProfiles}
            orderType={orderType}
            onSelectCustomer={cust => {
              if (orderType === 'mesa' && !targetMesa && cust.name) {
                const matchedMesa = floorMesas.find(
                  m => m.clienteNome && m.clienteNome.trim().toLowerCase() === cust.name.trim().toLowerCase()
                );
                if (matchedMesa) {
                  onSelectTable(matchedMesa.id);
                }
              }
              if (onSelectCustomer) {
                onSelectCustomer(cust);
              }
            }}
          />
        </div>
      </div>

      {/* Banner de Modo de Edição de Pedido Reaberto */}
      {editingReopenedSale && (
        <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-2xl flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold">
            <GitCompare size={15} className="text-amber-400 shrink-0" />
            <span>MODO EDIÇÃO: #{editingReopenedSale.id.slice(0, 6).toUpperCase()}</span>
          </div>
          <button
            type="button"
            onClick={onCancelEditingReopenedSale}
            className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
          >
            Cancelar Edição
          </button>
        </div>
      )}

      {/* Lista de Itens do Pedido */}
      <div data-testid="pos-cart-items" className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[calc(100vh-340px)]">
        {cart.length === 0 ? (
          <div className="py-14 text-center text-slate-500 flex flex-col items-center justify-center">
            <CartIcon size={36} className="mb-2 opacity-20" />
            <p className="text-xs">Nenhum item adicionado ao pedido.</p>
            <p className="text-[11px] text-slate-600 mt-1">Clique nos produtos do catálogo para adicionar.</p>
          </div>
        ) : (
          cart.map((item, idx) => (
            <div
              key={item.id || idx}
              className={`border p-3 rounded-2xl space-y-1 transition-all ${
                item.isGift
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-200 text-xs truncate">
                      {item.productName}
                    </span>
                    {item.isGift && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                        <Gift size={9} /> BRINDE
                      </span>
                    )}
                  </div>
                  {item.combo && (
                    <p className="text-[10px] text-amber-400 font-semibold">
                      + {item.combo}
                    </p>
                  )}
                  {item.meatPoint && (
                    <span className="text-[9px] font-bold text-orange-300 bg-orange-950/50 border border-orange-500/40 px-1.5 py-0.5 rounded inline-block mr-1">
                      🥩 {item.meatPoint}
                    </span>
                  )}
                  {item.additionals && item.additionals.length > 0 && (
                    <p className="text-[10px] text-blue-400 font-medium">
                      + {item.additionals.map(a => a.name).join(', ')}
                    </p>
                  )}
                  {item.removals && item.removals.length > 0 && (
                    <p className="text-[10px] font-bold text-rose-400">
                      🚫 {item.removals.join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-[10px] font-black uppercase text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded inline-block">
                      OBS: {item.notes}
                    </p>
                  )}
                </div>

                <div className="text-right font-mono shrink-0">
                  {item.isGift ? (
                    <div>
                      <span className="line-through text-slate-500 text-[10px] block">
                        R$ {((item.originalPrice || 0) * item.quantity).toFixed(2)}
                      </span>
                      <span className="font-black text-emerald-400 text-xs">
                        GRÁTIS
                      </span>
                    </div>
                  ) : (
                    <span className="font-black text-white text-xs">
                      R$ {(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Barra de Ações do Item: Quantidade, Editar, Brinde, Obs, Excluir */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-900 text-xs gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateQty(idx, -1, item.id)}
                    className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                    title="Diminuir quantidade"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center font-mono font-bold text-xs text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(idx, 1, item.id)}
                    className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                    title="Aumentar quantidade"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {onEditItem && (
                    <button
                      type="button"
                      onClick={() => onEditItem(item)}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-800 active:scale-95"
                      title="Editar personalização deste item"
                      aria-label="Editar item"
                    >
                      <Pencil size={11} className="text-amber-400" />
                      <span>Editar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenNotesPrompt(idx, item.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Adicionar ou editar observação de cozinha"
                    aria-label="Observação do item"
                  >
                    <MessageSquare size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenGiftModal(idx, item.id)}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      item.isGift 
                        ? 'text-emerald-400 bg-emerald-950/40' 
                        : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-900'
                    }`}
                    title="Marcar como cortesia / brinde"
                    aria-label="Brinde"
                  >
                    <Gift size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(idx, item.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Remover item da comanda"
                    aria-label="Remover item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rodapé do Pedido Atual com contagem de itens */}
      {cart.length > 0 && (
        <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
          <span>Total de itens na comanda:</span>
          <span className="font-mono font-bold text-white">
            {cart.reduce((sum, i) => sum + i.quantity, 0)} unidade(s)
          </span>
        </div>
      )}
    </div>
  );
}
