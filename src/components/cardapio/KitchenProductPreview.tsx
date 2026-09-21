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
import type { KitchenComponent, RecipeIngredient, InventoryItem } from '@/lib/store/types';
import { calculateProductKitchenComponents, DEFAULT_KITCHEN_COMPONENTS } from '@/lib/kitchen-calculator';

interface KitchenProductPreviewProps {
  validationResult: ProductValidationResult;
  productName?: string;
  category?: string;
  recipe?: RecipeIngredient[];
  inventoryItems?: InventoryItem[];
  kitchenComponents?: KitchenComponent[];
}

export function KitchenProductPreview({
  validationResult,
  productName = '',
  category = 'lanche',
  recipe = [],
  inventoryItems = [],
  kitchenComponents = DEFAULT_KITCHEN_COMPONENTS,
}: KitchenProductPreviewProps) {
  const [simQty, setSimQty] = useState<number>(1);

  const structuredBreakdown = calculateProductKitchenComponents(
    { name: productName, category: category as any, recipe },
    inventoryItems,
    kitchenComponents
  );

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

      {/* SEÇÃO: COMO MOSTRAR NA COZINHA (Requisito de Configuração) */}
      <div className="p-3.5 bg-brand-primary/5 border-b border-border-default space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
            <ChefHat size={15} /> Como mostrar na cozinha
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            Configuração de Componentes de Preparo
          </span>
        </div>
        <p className="text-[11px] font-semibold text-text-secondary">
          Para {simQty} unidade(s) deste produto:
        </p>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {structuredBreakdown.items.map((item, idx) => (
            <div
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-surface-card border border-brand-primary/30 flex items-center gap-1.5 text-xs font-bold text-text-primary shadow-xs"
            >
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-brand-primary/20 text-brand-primary font-black">
                {item.station === 'grill' ? 'Chapa' : item.station === 'fryer' ? 'Fritadeira' : item.station}
              </span>
              <span>
                — {item.quantity * simQty} {item.productionUnit} de {item.name}
              </span>
            </div>
          ))}
          {structuredBreakdown.items.length === 0 && (
            <span className="text-xs text-text-muted italic">
              Nenhum componente de preparo configurado para este produto.
            </span>
          )}
        </div>
        {structuredBreakdown.pendingReview.length > 0 && (
          <div className="text-[11px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
            ⚠️ {structuredBreakdown.pendingReview.map(p => p.reason).join(' • ')}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
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
