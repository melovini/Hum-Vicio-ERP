'use client';
import React from 'react';
import { KitchenTicketData } from '@/lib/kitchen-ticket';

interface KitchenTicketViewProps {
  ticket: KitchenTicketData;
  showMontagem?: boolean;
}

export default function KitchenTicketView({ ticket, showMontagem = false }: KitchenTicketViewProps) {
  const { header, items, productionSummary, diff } = ticket;

  // Se for via diferencial
  if (header.isDifferential && diff) {
    return (
      <div className="space-y-3 font-sans text-black select-none">
        {/* Cabeçalho */}
        <div className="text-center border-b-2 border-dashed border-black pb-2">
          <div className="border border-black px-2 py-0.5 my-1 font-black text-sm uppercase">
            *** ALTERAÇÃO DO PEDIDO ***
          </div>
          <p className="text-sm font-black uppercase mt-1">
            CLIENTE: {header.customerName}
          </p>
          <p className="text-xs font-bold text-slate-800">
            Pedido {header.orderIdShort} • {header.time}
            {header.orderType && ` • ${header.orderType.toUpperCase()}`}
          </p>
        </div>

        {/* Itens Diferenciais */}
        <div className="py-1 border-b-2 border-dashed border-black space-y-2">
          {diff.added.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-black">
                ITENS ADICIONADOS (+):
              </p>
              {diff.added.map((item, idx) => (
                <div key={idx} className="pl-2 border-l-2 border-black space-y-0.5 text-xs">
                  <p className="font-black text-sm">
                    [+] {item.quantity}x {item.productName.toUpperCase()}
                  </p>
                  {item.pattiesComposition && (
                    <p className="font-semibold text-slate-900 pl-1">{item.pattiesComposition}</p>
                  )}
                  {item.comboInfo && (
                    <p className="font-bold text-slate-900 pl-1">{item.comboInfo.label}</p>
                  )}
                  {item.meatPoint && (
                    <p className="font-bold text-slate-900 pl-1">Ponto: {item.meatPoint}</p>
                  )}
                  {item.additionals.map((add, aIdx) => (
                    <p key={aIdx} className="font-bold text-slate-900 pl-1">{add.label}</p>
                  ))}
                  {item.removals.map((rem, rIdx) => (
                    <p key={rIdx} className="font-black text-black pl-1">
                      RETIRAR: {rem.toUpperCase()}
                    </p>
                  ))}
                  {item.notes && (
                    <p key="notes" className="font-black text-black pl-1">
                      OBS: {item.notes.toUpperCase()}
                    </p>
                  )}
                  {showMontagem && item.recipeIngredients && item.recipeIngredients.length > 0 && (
                    <p className="text-[10px] font-semibold text-slate-700 pl-1">
                      Montagem: {item.recipeIngredients.join(' • ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {diff.removed.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-black">
                ITENS CANCELADOS (-):
              </p>
              {diff.removed.map((item, idx) => (
                <div key={idx} className="pl-2 border-l-2 border-dashed border-black text-xs line-through font-bold">
                  [-] {item.quantity}x {item.productName.toUpperCase()} (CANCELADO)
                </div>
              ))}
            </div>
          )}

          {diff.modified.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-black">
                OBSERVAÇÕES ALTERADAS (*):
              </p>
              {diff.modified.map((m, idx) => (
                <div key={idx} className="pl-2 border-l-2 border-black text-xs space-y-0.5">
                  <p className="font-bold">[*] {m.quantity}x {m.productName.toUpperCase()}</p>
                  <p className="line-through pl-1 text-[11px]">DE: {(m.oldNotes || 'Sem obs').toUpperCase()}</p>
                  <p className="font-black pl-1 text-[11px]">PARA: {(m.newNotes || 'Sem obs').toUpperCase()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-[10px] font-black tracking-wide pt-1">
          *** NÃO REPETIR ITENS JÁ PREPARADOS ***
        </div>
      </div>
    );
  }

  // --- VIA REGULAR DA COZINHA ---
  return (
    <div className="space-y-3 font-sans text-black select-none">
      {/* Cabeçalho Compacto */}
      <div className="text-center border-b-2 border-dashed border-black pb-2.5">
        {header.isReprint && (
          <div className="border border-black px-2 py-0.5 mb-1.5 font-black text-xs uppercase">
            *** REIMPRESSÃO — MESMO PEDIDO ***
          </div>
        )}
        <h2 className="text-base font-black uppercase tracking-wider">
          CLIENTE: {header.customerName}
        </h2>
        <p className="text-xs font-bold mt-1 text-slate-800">
          Pedido {header.orderIdShort} | {header.time}
          {header.orderType && (
            <span>
              {' '} | {header.orderType === 'mesa' && header.tableNumber ? `Mesa ${header.tableNumber}` : header.orderType.toUpperCase()}
            </span>
          )}
        </p>
      </div>

      {/* Itens da Comanda */}
      <div className="py-1 border-b-2 border-dashed border-black space-y-2.5">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-0.5 break-inside-avoid">
            {/* Linha principal: Quantidade e Nome */}
            <p className="text-sm font-black tracking-wide text-black">
              {item.quantity}x {item.productName.toUpperCase()}
            </p>

            {/* Sub-detalhes indentados */}
            <div className="pl-3 text-xs space-y-0.5 font-bold text-slate-900">
              {item.pattiesComposition && (
                <p className="font-semibold text-slate-800">{item.pattiesComposition}</p>
              )}

              {item.comboInfo && (
                <p className="font-extrabold text-black">{item.comboInfo.label}</p>
              )}

              {item.meatPoint && (
                <p className="font-semibold text-slate-800">Ponto: {item.meatPoint}</p>
              )}

              {item.additionals.map((add, aIdx) => (
                <p key={aIdx} className="font-extrabold text-black">{add.label}</p>
              ))}

              {item.removals.map((rem, rIdx) => (
                <p key={rIdx} className="font-black text-black">
                  RETIRAR: {rem.toUpperCase()}
                </p>
              ))}

              {item.notes && (
                <p className="font-black text-black">
                  OBS: {item.notes.toUpperCase()}
                </p>
              )}

              {showMontagem && item.recipeIngredients && item.recipeIngredients.length > 0 && (
                <p className="text-[10px] font-semibold text-slate-600 pt-0.5">
                  Montagem: {item.recipeIngredients.join(' • ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé de Produção */}
      <div className="pt-1 space-y-1.5 text-xs break-inside-avoid">
        <p className="font-black uppercase tracking-wider text-xs border-b border-black pb-0.5">
          RESUMO DE PRODUÇÃO
        </p>

        {/* Chapa */}
        <div className="space-y-0.5">
          {productionSummary.chapa.status === 'a_conferir' ? (
            <p className="font-black uppercase">CHAPA: QUANTIDADE A CONFERIR</p>
          ) : productionSummary.chapa.status === 'sem_carnes' ? (
            null
          ) : (
            <>
              <p className="font-black uppercase">
                CHAPA — {productionSummary.chapa.pattiesLabel}
              </p>
              {productionSummary.chapa.pattiesBreakdown.map((p, pIdx) => (
                <p key={pIdx} className="pl-1 font-bold text-slate-900">
                  {p.label}
                </p>
              ))}
            </>
          )}

          {productionSummary.chapa.otherItems.length > 0 && (
            <div className="pt-1">
              <p className="font-black uppercase">OUTROS NA CHAPA</p>
              {productionSummary.chapa.otherItems.map((o, oIdx) => (
                <p key={oIdx} className="pl-1 font-bold text-slate-900">
                  {o.label}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Fritadeira */}
        <div className="space-y-0.5 pt-1">
          {productionSummary.fritadeira.status === 'a_conferir' ? (
            <p className="font-black uppercase">FRITADEIRA: QUANTIDADE A CONFERIR</p>
          ) : productionSummary.fritadeira.status === 'sem_itens' ? (
            null
          ) : (
            <>
              <p className="font-black uppercase">
                FRITADEIRA
              </p>
              {productionSummary.fritadeira.items.map((f, fIdx) => (
                <p key={fIdx} className="pl-1 font-bold text-slate-900">
                  {f.label}
                </p>
              ))}
            </>
          )}
        </div>
        {Object.entries(productionSummary.otherStations || {}).map(([station, entries]) => <div key={station} className="pt-2"><p className="font-black uppercase">{({ oven: 'Forno', cold: 'Preparo frio', assembly: 'Montagem', other: 'Outros' } as Record<string, string>)[station] || station}</p>{entries.map((entry, idx) => <p key={idx} className="pl-1 font-bold">{entry.label}</p>)}</div>)}
      </div>
    </div>
  );
}
