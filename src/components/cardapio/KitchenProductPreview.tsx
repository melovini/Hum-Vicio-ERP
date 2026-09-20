'use client';

import React, { useState } from 'react';
import { 
  Flame, 
  Egg, 
  UtensilsCrossed, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ChefHat, 
  ShieldAlert,
  Layers,
  Sparkles,
  Timer,
  ShoppingBag
} from 'lucide-react';
import type { ProductValidationResult } from '@/lib/product-validator';
import { cn } from '@/lib/cn';

interface KitchenProductPreviewProps {
  validationResult: ProductValidationResult;
  productName?: string;
  category?: string;
}

export function KitchenProductPreview({
  validationResult,
  productName = '',
  category = 'lanche'
}: KitchenProductPreviewProps) {
  const [simQty, setSimQty] = useState<number>(1);

  const { productionPreview, warnings, status, ingredientsSummary } = validationResult;
  const { 
    chapaPatties, 
    isDouble, 
    eggsCount, 
    fryerChicken, 
    fryerCheese, 
    fryerBatatasAvulsa, 
    fryerBatatasCombo,
    fryerOnionsAvulsa,
    fryerOnionsCombo 
  } = productionPreview;

  const totalBatatas = (fryerBatatasCombo + fryerBatatasAvulsa) * simQty;
  const totalOnions = (fryerOnionsCombo + fryerOnionsAvulsa) * simQty;
  const totalPatties = chapaPatties * simQty;
  const totalEggs = eggsCount * simQty;
  const totalChicken = fryerChicken * simQty;
  const totalCheese = fryerCheese * simQty;

  // Insumos agrupados por praça
  const chapaItems = ingredientsSummary.filter(i => i.station === 'grill');
  const fryerItems = ingredientsSummary.filter(i => i.station === 'fryer');
  const ovenItems = ingredientsSummary.filter(i => i.station === 'oven');
  const coldItems = ingredientsSummary.filter(i => i.station === 'cold');
  const assemblyItems = ingredientsSummary.filter(i => i.station === 'assembly' || (!i.station || i.station === 'none') && i.kind !== 'none');
  const nonKitchenItems = ingredientsSummary.filter(i => i.station === 'none' && (!i.kind || i.kind === 'none'));

  return (
    <div className="rounded-2xl border border-border-default bg-surface-elevated/40 overflow-hidden text-xs">
      {/* Cabeçalho com Simulação Interativa */}
      <div className="p-3.5 bg-surface-card border-b border-border-default flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary">
            <ChefHat size={16} />
          </div>
          <div>
            <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-2">
              Para vender {simQty} {simQty === 1 ? 'unidade' : 'unidades'}, a cozinha preparará:
            </h4>
            <span className="text-[11px] text-text-muted">
              Prévia determinística por praça • KDS e comanda de produção
            </span>
          </div>
        </div>

        {/* Controles de Simulação & Badge de Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border-default bg-surface-input p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSimQty(1)}
              className={cn(
                'px-2 py-0.5 rounded-md transition-colors cursor-pointer',
                simQty === 1 ? 'bg-brand-primary text-white' : 'text-text-muted hover:text-text-primary'
              )}
            >
              1 unidade
            </button>
            <button
              type="button"
              onClick={() => setSimQty(2)}
              className={cn(
                'px-2 py-0.5 rounded-md transition-colors cursor-pointer',
                simQty === 2 ? 'bg-brand-primary text-white' : 'text-text-muted hover:text-text-primary'
              )}
            >
              2 unidades
            </button>
          </div>

          <div>
            {status === 'validado' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                <CheckCircle2 size={11} /> Validada
              </span>
            )}
            {status === 'alerta' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                <AlertTriangle size={11} /> Alerta
              </span>
            )}
            {status === 'rascunho' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-500/15 text-zinc-300 font-bold text-[10px] border border-zinc-500/30">
                <Layers size={11} /> Rascunho
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Painel por Praças Operacionais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {/* Estação Chapa */}
          <div className={cn(
            'p-3 rounded-xl border flex flex-col justify-between transition-all',
            (totalPatties > 0 || totalEggs > 0 || chapaItems.length > 0)
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
              : 'bg-surface-card border-border-default text-text-muted opacity-60'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={14} className={totalPatties > 0 ? 'text-amber-400' : ''} /> Chapa
              </span>
              {isDouble && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-tighter">
                  Duplo
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {totalPatties > 0 && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black font-mono">{totalPatties}x</span>
                  <span className="text-xs font-semibold">
                    {totalPatties === 1 ? 'Carne Bovina' : 'Carnes Bovinas'}
                  </span>
                </div>
              )}
              {totalEggs > 0 && (
                <div className="flex items-baseline gap-1.5 text-yellow-300 font-semibold">
                  <span className="text-lg font-black font-mono">{totalEggs}x</span>
                  <span className="text-xs">{totalEggs === 1 ? 'Ovo na Chapa' : 'Ovos na Chapa'}</span>
                </div>
              )}
              {totalPatties === 0 && totalEggs === 0 && chapaItems.length === 0 && (
                <span className="text-xs text-text-muted">Sem preparo na chapa</span>
              )}
              {/* Outros itens de chapa sem contador principal */}
              {chapaItems.filter(c => c.kind !== 'beef_patty' && c.kind !== 'egg').map((item, idx) => (
                <div key={idx} className="text-[11px] text-amber-300/80">
                  + {item.name}: {Number((item.quantity * simQty).toFixed(3))} {item.unit} ({item.portionLabel})
                </div>
              ))}
            </div>
          </div>

          {/* Fritadeira */}
          <div className={cn(
            'p-3 rounded-xl border flex flex-col justify-between transition-all',
            (totalBatatas > 0 || totalOnions > 0 || totalChicken > 0 || totalCheese > 0 || fryerItems.length > 0)
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-200' 
              : 'bg-surface-card border-border-default text-text-muted opacity-60'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed size={14} className="text-orange-400" /> Fritadeira
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {totalBatatas > 0 && (
                <div className="text-xs font-bold text-amber-300">
                  <span className="font-mono text-base">{totalBatatas}x</span> Porção de Batata
                </div>
              )}
              {totalOnions > 0 && (
                <div className="text-xs font-bold text-amber-300">
                  <span className="font-mono text-base">{totalOnions}x</span> Porção de Onions
                </div>
              )}
              {totalChicken > 0 && (
                <div className="text-xs font-bold text-orange-300">
                  <span className="font-mono text-base">{totalChicken}x</span> Frango Empanado
                </div>
              )}
              {totalCheese > 0 && (
                <div className="text-xs font-bold text-yellow-300">
                  <span className="font-mono text-base">{totalCheese}x</span> Queijo Empanado
                </div>
              )}
              {totalBatatas === 0 && totalOnions === 0 && totalChicken === 0 && totalCheese === 0 && fryerItems.length === 0 && (
                <span className="text-xs text-text-muted">Sem itens de fritadeira</span>
              )}
            </div>
          </div>

          {/* Montagem & Preparo Frio */}
          <div className={cn(
            'p-3 rounded-xl border flex flex-col justify-between transition-all',
            assemblyItems.length > 0 || coldItems.length > 0 || ovenItems.length > 0
              ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-200'
              : 'bg-surface-card border-border-default text-text-muted opacity-60'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-cyan-400" /> Montagem & Frio
              </span>
              <span className="text-[10px] font-mono text-cyan-300">
                {assemblyItems.length + coldItems.length + ovenItems.length} componentes
              </span>
            </div>
            <div className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
              {assemblyItems.concat(coldItems).concat(ovenItems).map((item, idx) => (
                <div key={idx} className="text-[11px] text-text-secondary truncate">
                  • <strong className="text-text-primary">{item.name}</strong>: {Number((item.quantity * simQty).toFixed(3))} {item.unit}
                </div>
              ))}
              {assemblyItems.length === 0 && coldItems.length === 0 && ovenItems.length === 0 && (
                <span className="text-xs text-text-muted">Nenhum insumo de montagem</span>
              )}
            </div>
          </div>
        </div>

        {/* Não vai à cozinha (Embalagens / Operacional) */}
        {nonKitchenItems.length > 0 && (
          <div className="p-2.5 rounded-xl border border-border-default bg-surface-card flex items-center justify-between flex-wrap gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 font-bold text-text-muted uppercase">
              <ShoppingBag size={13} /> Não vai à cozinha (Baixa de Estoque):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {nonKitchenItems.map((item, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-surface-elevated text-text-secondary border border-border-default">
                  {item.name}: {Number((item.quantity * simQty).toFixed(3))} {item.unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Avisos e Pendências de Cadastro */}
        {warnings.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
              Conferência da Ficha Técnica:
            </span>
            {warnings.map((w, idx) => {
              const isDanger = w.severity === 'danger';
              const isWarning = w.severity === 'warning';

              return (
                <div 
                  key={idx} 
                  className={cn(
                    'p-2.5 rounded-xl border flex items-start gap-2 text-xs',
                    isDanger && 'bg-rose-500/10 border-rose-500/30 text-rose-200',
                    isWarning && 'bg-amber-500/10 border-amber-500/30 text-amber-200',
                    !isDanger && !isWarning && 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200',
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {isDanger && <ShieldAlert size={14} className="text-rose-400" />}
                    {isWarning && <AlertTriangle size={14} className="text-amber-400" />}
                    {!isDanger && !isWarning && <Info size={14} className="text-cyan-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="leading-snug">{w.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
