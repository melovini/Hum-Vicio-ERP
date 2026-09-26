'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle2, RefreshCw, Trash2, 
  ArrowRight, ShieldAlert, DollarSign, Clock, Tag, X, AlertCircle
} from 'lucide-react';
import { Dialog, ConfirmDialog, Button, Badge, useToast } from '@/components/ui';
import type { Sale, SaleItem, Product } from '@/lib/store/types';

interface OfflineReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  products: Product[];
  currentUserRole?: string;
  onResolve: (revisedSale: Sale) => Promise<any>;
  onDiscard: (saleId: string, reason: string) => Promise<void>;
}

export function OfflineReconciliationModal({
  isOpen,
  onClose,
  sale,
  products,
  currentUserRole = 'caixa',
  onResolve,
  onDiscard,
}: OfflineReconciliationModalProps) {
  const { notify } = useToast();

  const [revisedItems, setRevisedItems] = useState<SaleItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [discardReason, setDiscardReason] = useState('');

  // Sincroniza estado local quando o modal abre com uma venda específica
  useEffect(() => {
    if (sale) {
      setRevisedItems(sale.items ? JSON.parse(JSON.stringify(sale.items)) : []);
      setDiscount(Number(sale.discount || 0));
      setDiscountReason(sale.discountReason || '');
      setDeliveryFee(Number(sale.deliveryFee || 0));
      setDiscardReason('');
    }
  }, [sale]);

  // Mapa rápido de produtos do catálogo
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Calcula o preço oficial vigente de cada item com base no catálogo atual
  const itemAnalyses = useMemo(() => {
    if (!sale) return [];

    return revisedItems.map((item, index) => {
      const product = productMap.get(item.productId);
      const isUnavailable = !product || product.isActive === false || ['rascunho', 'inativo'].includes(product.status || '');
      
      let officialUnit = 0;
      if (product) {
        officialUnit = sale.channel === 'ifood' 
          ? (product.priceIfood ?? product.priceBalcao ?? 0)
          : (product.priceBalcao ?? 0);
      }

      // Adiciona combo se houver
      if (item.comboId) {
        const combo = productMap.get(item.comboId);
        if (combo) {
          officialUnit += sale.channel === 'ifood' 
            ? (combo.priceIfood ?? combo.priceBalcao ?? 0)
            : (combo.priceBalcao ?? 0);
        }
      }

      // Adiciona adicionais
      if (Array.isArray(item.additionals)) {
        for (const add of item.additionals) {
          const addProduct = productMap.get(add.productId || add.id || '');
          const addPrice = addProduct
            ? (sale.channel === 'ifood' ? (addProduct.priceIfood ?? addProduct.priceBalcao ?? 0) : (addProduct.priceBalcao ?? 0))
            : (add.price || add.unitPrice || 0);
          officialUnit += addPrice * (add.quantity ?? 1);
        }
      }

      // Brindes custam 0
      if (item.isGift) {
        officialUnit = 0;
      }

      const registeredUnit = Number(item.unitPrice || 0);
      const diff = officialUnit - registeredUnit;
      const hasPriceDivergence = Math.abs(diff) > 0.01;

      return {
        index,
        item,
        product,
        isUnavailable,
        officialUnit,
        registeredUnit,
        diff,
        hasPriceDivergence,
      };
    });
  }, [sale, revisedItems, productMap]);

  // Totais matemáticos recalculados
  const calculatedSubtotal = useMemo(() => {
    return revisedItems.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * (it.quantity || 1)), 0);
  }, [revisedItems]);

  const calculatedTotal = useMemo(() => {
    return Math.max(0, calculatedSubtotal - discount + deliveryFee);
  }, [calculatedSubtotal, discount, deliveryFee]);

  const totalDivergences = useMemo(() => {
    return itemAnalyses.filter(a => a.hasPriceDivergence || a.isUnavailable).length;
  }, [itemAnalyses]);

  if (!sale) return null;

  // Ação 1: Atualizar todos os itens para os preços vigentes do cardápio
  const handleApplyOfficialPrices = () => {
    const updated = revisedItems.map(item => {
      const analysis = itemAnalyses.find(a => a.item === item);
      if (analysis && !analysis.isUnavailable && analysis.hasPriceDivergence) {
        return {
          ...item,
          unitPrice: analysis.officialUnit,
        };
      }
      return item;
    });

    setRevisedItems(updated);
    notify({
      title: 'Preços atualizados!',
      description: 'Itens atualizados com os valores oficiais vigentes do catálogo.',
      tone: 'success',
    });
  };

  // Ação 2: Manter o valor cobrado do cliente aplicando desconto de contingência
  const handleHonorOriginalTotalWithContingencyDiscount = () => {
    const updated = revisedItems.map(item => {
      const analysis = itemAnalyses.find(a => a.item === item);
      if (analysis && !analysis.isUnavailable) {
        return {
          ...item,
          unitPrice: analysis.officialUnit,
        };
      }
      return item;
    });

    const newSubtotal = updated.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * (it.quantity || 1)), 0);
    const targetTotal = Number(sale.total);
    const neededDiscount = Math.max(0, Number((newSubtotal + deliveryFee - targetTotal).toFixed(2)));

    setRevisedItems(updated);
    setDiscount(neededDiscount);
    setDiscountReason('Desconto de contingência offline: valor original anterior honrado no caixa.');

    notify({
      title: 'Valor original mantido!',
      description: `Aplicado desconto de contingência de R$ ${neededDiscount.toFixed(2)} para honrar o valor cobrado.`,
      tone: 'info',
    });
  };

  // Ação 3: Remover item conflitante/indisponível
  const handleRemoveItem = (indexToRemove: number) => {
    if (revisedItems.length <= 1) {
      notify({
        title: 'Pedido não pode ficar vazio',
        description: 'O pedido precisa conter pelo menos 1 item. Se desejar anular, use "Descartar Pedido".',
        tone: 'danger',
      });
      return;
    }
    setRevisedItems(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Salvar e retransmitir
  const handleResolveAndSync = async () => {
    if (revisedItems.length === 0) {
      notify({
        title: 'Pedido vazio',
        description: 'Inclua pelo menos 1 item válido antes de retransmitir.',
        tone: 'danger',
      });
      return;
    }

    if (discount > 0 && !discountReason.trim()) {
      notify({
        title: 'Justificativa obrigatória',
        description: 'Informe o motivo do desconto concedido para auditoria.',
        tone: 'danger',
      });
      return;
    }

    // Valida se ainda há itens indisponíveis
    const stillHasUnavailable = itemAnalyses.some(a => a.isUnavailable);
    if (stillHasUnavailable) {
      notify({
        title: 'Item indisponível presente',
        description: 'Remova os produtos indisponíveis ou inativos antes de reenviar.',
        tone: 'danger',
      });
      return;
    }

    const revisedSale: Sale = {
      ...sale,
      items: revisedItems,
      subtotal: calculatedSubtotal,
      discount,
      discountReason: discount > 0 ? discountReason.trim() : undefined,
      deliveryFee,
      total: calculatedTotal,
      syncStatus: 'pending',
      syncError: undefined,
    };

    try {
      setIsSubmitting(true);
      const res = await onResolve(revisedSale);
      if (res && res.errorsCount > 0) {
        notify({
          title: 'Pedido retransmitido com pendência',
          description: 'Ajuste gravado, mas o servidor ainda retornou pendência. Verifique os dados.',
          tone: 'warning',
        });
      } else {
        notify({
          title: 'Pedido reconciliado com sucesso!',
          description: `Venda #${sale.id.slice(0, 6).toUpperCase()} reenviada e confirmada pelo servidor.`,
          tone: 'success',
        });
        onClose();
      }
    } catch (err) {
      notify({
        title: 'Falha na reconciliação',
        description: err instanceof Error ? err.message : 'Não foi possível salvar o ajuste.',
        tone: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Descarte definitivo com justificativa
  const handleConfirmDiscard = async () => {
    if (!discardReason.trim()) {
      notify({
        title: 'Motivo obrigatório',
        description: 'Descreva a razão do descarte do pedido para o log de auditoria.',
        tone: 'danger',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await onDiscard(sale.id, discardReason.trim());
      notify({
        title: 'Pedido descartado',
        description: `Venda #${sale.id.slice(0, 6).toUpperCase()} removida da fila de contingência.`,
        tone: 'info',
      });
      setShowDiscardConfirm(false);
      onClose();
    } catch (err) {
      notify({
        title: 'Erro ao descartar',
        description: 'Não foi possível descartar o pedido.',
        tone: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={onClose}
        title="Reconciliação Assistida de Pedido Rejeitado"
        size="lg"
      >
        <div className="space-y-5 text-slate-100">
          {/* Cabeçalho do Pedido */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono font-extrabold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                #{sale.id.slice(0, 8).toUpperCase()}
              </span>
              <div>
                <div className="font-bold text-slate-200">
                  {sale.customerName || 'Cliente Balcão'}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Clock size={12} />
                  <span>{new Date(sale.date).toLocaleString('pt-BR')}</span>
                  <span>•</span>
                  <span className="uppercase font-semibold">{sale.channel || 'balcao'}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Valor Registrado</div>
              <div className="font-mono font-extrabold text-base text-slate-200">
                R$ {Number(sale.total).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Banner de Causa da Rejeição */}
          <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-start gap-3 text-xs">
            <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-300">
                Motivo da Recusa pelo Servidor:
              </div>
              <p className="text-slate-300 text-[12px] leading-relaxed">
                {sale.syncError || 'O pedido foi recusado pelo servidor por divergência nos itens ou catálogo.'}
              </p>
            </div>
          </div>

          {/* Tabela de Itens e Análise de Divergências */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Tag size={13} /> Comparação de Itens com o Catálogo Vigente
              </h4>
              {totalDivergences > 0 && (
                <Badge variant="warning">
                  {totalDivergences} divergência(s) detectada(s)
                </Badge>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-center">Qtd</th>
                      <th className="p-2.5 text-right">No Pedido</th>
                      <th className="p-2.5 text-right">Catálogo Atual</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center w-10">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {itemAnalyses.map((row) => (
                      <tr key={row.index} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-2.5">
                          <div className="font-bold text-slate-200">
                            {row.item.productName}
                          </div>
                          {row.item.notes && (
                            <div className="text-[10px] text-amber-400/80">
                              Obs: {row.item.notes}
                            </div>
                          )}
                          {Array.isArray(row.item.additionals) && row.item.additionals.length > 0 && (
                            <div className="text-[10px] text-slate-400">
                              + {row.item.additionals.map(a => `${a.quantity || 1}x ${a.name}`).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold">
                          {row.item.quantity}x
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          R$ {row.registeredUnit.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {row.isUnavailable ? (
                            <span className="text-rose-400 font-bold">Indisponível</span>
                          ) : (
                            <span className={row.hasPriceDivergence ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                              R$ {row.officialUnit.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {row.isUnavailable ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Inativo / Rascunho
                            </span>
                          ) : row.hasPriceDivergence ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {row.diff > 0 ? `+ R$ ${row.diff.toFixed(2)}` : `- R$ ${Math.abs(row.diff).toFixed(2)}`}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            title="Remover este item do pedido"
                            onClick={() => handleRemoveItem(row.index)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Atalhos de Resolução Rápida */}
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Opções de Ajuste em 1 Clique:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleApplyOfficialPrices}
                className="justify-start text-left text-xs"
              >
                <RefreshCw size={14} className="text-blue-400 shrink-0" />
                <span>Atualizar para Preços Oficiais do Cardápio</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleHonorOriginalTotalWithContingencyDiscount}
                className="justify-start text-left text-xs"
              >
                <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                <span>Honrar Valor Pago (Desconto de Contingência)</span>
              </Button>
            </div>
          </div>

          {/* Ajuste de Desconto e Justificativa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Desconto Aplicado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount || ''}
                onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Justificativa do Desconto {discount > 0 && <span className="text-rose-400">*</span>}
              </label>
              <input
                type="text"
                value={discountReason}
                onChange={e => setDiscountReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Ex: Ajuste de preço de contingência offline"
              />
            </div>
          </div>

          {/* Resumo Financeiro Comparativo */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-slate-400">Subtotal: R$ {calculatedSubtotal.toFixed(2)}</span>
              {discount > 0 && <span className="text-rose-400 block">- Desconto: R$ {discount.toFixed(2)}</span>}
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Novo Total do Pedido</span>
              <div className="font-mono font-extrabold text-lg text-emerald-400">
                R$ {calculatedTotal.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Rodapé de Ações do Modal */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setShowDiscardConfirm(true)}
            >
              <Trash2 size={14} />
              <span>Descartar Pedido</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                onClick={handleResolveAndSync}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Reenviando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Salvar Ajuste & Sincronizar</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Confirmação de Descarte de Pedido Rejeitado */}
      <ConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
        title="Descartar Pedido Rejeitado?"
        description={`Esta ação removerá definitivamente o pedido #${sale.id.slice(0, 8).toUpperCase()} da contingência offline deste terminal.`}
        confirmLabel="Confirmar Descarte"
        cancelLabel="Voltar"
        tone="danger"
        loading={isSubmitting}
        details={
          <div className="space-y-2 mt-2">
            <label className="block font-bold text-slate-200 text-xs">
              Motivo do Descarte (obrigatório para auditoria) <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              required
              value={discardReason}
              onChange={e => setDiscardReason(e.target.value)}
              placeholder="Ex: Pedido cancelado pelo cliente / refeito em outro caixa"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:ring-1 focus:ring-rose-500 outline-none"
            />
          </div>
        }
      />
    </>
  );
}
