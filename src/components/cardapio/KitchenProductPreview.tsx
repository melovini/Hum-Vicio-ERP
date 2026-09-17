'use client';

import React from 'react';
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
  Sparkles
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

  const totalBatatas = fryerBatatasCombo + fryerBatatasAvulsa;
  const totalOnions = fryerOnionsCombo + fryerOnionsAvulsa;

  // Insumos que vão para montagem (estação 'nenhuma' ou sem estação quente)
  const montagemIngredients = ingredientsSummary.filter(
    i => !['chapa', 'fritadeira_frango', 'fritadeira_queijo', 'fritadeira_batata', 'fritadeira_onion'].includes(i.station)
  );

  const hasHotStation = chapaPatties > 0 || eggsCount > 0 || fryerChicken > 0 || fryerCheese > 0 || totalBatatas > 0 || totalOnions > 0;

  return (
    <div className="rounded-2xl border border-border-default bg-surface-elevated/40 overflow-hidden text-xs">
      {/* Cabeçalho da Prévia */}
      <div className="p-3.5 bg-surface-card border-b border-border-default flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary">
            <ChefHat size={16} />
          </div>
          <div>
            <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-2">
              Como este produto aparece na Cozinha (KDS)
            </h4>
            <span className="text-[11px] text-text-muted">
              Prévia ao vivo da interpretação das estações da cozinha
            </span>
          </div>
        </div>

        {/* Badge de Status de Validação */}
        <div>
          {status === 'validado' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[11px] border border-emerald-500/30">
              <CheckCircle2 size={12} /> Ficha Validada
            </span>
          )}
          {status === 'alerta' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 font-bold text-[11px] border border-amber-500/30">
              <AlertTriangle size={12} /> Alerta de Coerência
            </span>
          )}
          {status === 'rascunho' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-500/15 text-zinc-300 font-bold text-[11px] border border-zinc-500/30">
              <Layers size={12} /> Rascunho / Incompleto
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Painel de Estações e Quantidades */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {/* Estação Chapa: Carnes Bovina */}
          <div className={cn(
            'p-3 rounded-xl border flex flex-col justify-between transition-all',
            chapaPatties > 0 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
              : 'bg-surface-card border-border-default text-text-muted opacity-60'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={14} className={chapaPatties > 0 ? 'text-amber-400' : ''} /> Chapa (Carnes)
              </span>
              {isDouble && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-tighter">
                  Duplo
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono">
                {chapaPatties}x
              </span>
              <span className="text-xs font-semibold">
                {chapaPatties === 1 ? 'Carne Bovina' : 'Carnes Bovinas'}
              </span>
            </div>
          </div>

          {/* Estação Chapa: Ovos Fritos (SEPARADOS DE CARNES) */}
          <div className={cn(
            'p-3 rounded-xl border flex flex-col justify-between transition-all',
            eggsCount > 0 
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200' 
              : 'bg-surface-card border-border-default text-text-muted opacity-60'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Egg size={14} className={eggsCount > 0 ? 'text-yellow-400' : ''} /> Chapa (Ovos)
              </span>
              {eggsCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                  Separado
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono">
                {eggsCount}x
              </span>
              <span className="text-xs font-semibold">
                {eggsCount === 1 ? 'Ovo na Chapa' : 'Ovos na Chapa'}
              </span>
            </div>
          </div>

          {/* Fritadeiras: Frango e Queijo Empanados */}
          <div className={cn(
            'p-3 rounded-xl border flex flex-col justify-between transition-all',
            (fryerChicken > 0 || fryerCheese > 0)
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-200' 
              : 'bg-surface-card border-border-default text-text-muted opacity-60'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed size={14} className={(fryerChicken > 0 || fryerCheese > 0) ? 'text-orange-400' : ''} /> Fritadeira (Proteínas)
              </span>
            </div>
            <div className="mt-2 space-y-0.5">
              {fryerChicken > 0 && (
                <div className="text-xs font-bold text-orange-300">
                  {fryerChicken}x Frango Empanado
                </div>
              )}
              {fryerCheese > 0 && (
                <div className="text-xs font-bold text-yellow-300">
                  {fryerCheese}x Queijo Minas Empanado
                </div>
              )}
              {fryerChicken === 0 && fryerCheese === 0 && (
                <span className="text-sm font-bold text-text-muted">0 itens</span>
              )}
            </div>
          </div>

          {/* Fritadeiras: Batatas e Acompanhamentos */}
          <div className={cn(
            'p-3 rounded-xl border flex flex-col justify-between transition-all sm:col-span-2 md:col-span-3',
            (totalBatatas > 0 || totalOnions > 0)
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' 
              : 'bg-surface-card border-border-default text-text-muted opacity-60'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                🍟 Acompanhamentos (Fritadeira)
              </span>
              {(totalBatatas > 0 || totalOnions > 0) && (
                <span className="text-[10px] text-amber-300">
                  Sem Duplicidade de Combo
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4 flex-wrap text-xs">
              {totalBatatas > 0 ? (
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <span className="font-mono text-base">{totalBatatas}x</span> Porção de Batata
                </div>
              ) : (
                <span className="text-text-muted">Nenhuma batata</span>
              )}

              {totalOnions > 0 && (
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <span className="font-mono text-base">{totalOnions}x</span> Porção de Onions
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Montagem: Insumos que não vão ao fogo (pães, queijos fatiados, molhos, saladas) */}
        {montagemIngredients.length > 0 && (
          <div className="p-3 rounded-xl border border-border-default bg-surface-card space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary uppercase">
              <span className="flex items-center gap-1.5">
                <Layers size={13} className="text-cyan-400" /> Montagem & Finalização ({montagemIngredients.length} insumos)
              </span>
              <span className="text-[10px] text-text-muted lowercase">sem estação quente</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {montagemIngredients.map((ing, idx) => (
                <span 
                  key={idx} 
                  className="px-2 py-1 rounded-md bg-surface-elevated border border-border-default text-[11px] text-text-secondary"
                >
                  <strong className="text-text-primary">{ing.name}</strong> ({ing.quantity} {ing.unit})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quadro de Avisos e Inconsistências Detectadas */}
        {warnings.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
              Diagnóstico do Validador de Produtos:
            </span>
            {warnings.map((w, idx) => {
              const isDanger = w.severity === 'danger';
              const isWarning = w.severity === 'warning';

              return (
                <div 
                  key={idx} 
                  className={cn(
                    'p-2.5 rounded-xl border flex items-start gap-2.5 text-xs',
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
