'use client';
import { useState, useMemo } from 'react';
import { useInventory, Product } from '@/lib/store';
import { calculateNetProfit, calculateIfoodViability, TaxConfig } from '@/lib/pricing';
import { 
  Calculator, ArrowLeft, Store, Smartphone, Search, 
  Check, Save, Sparkles, TrendingUp, AlertTriangle, 
  Sliders, RefreshCw, DollarSign, Percent, Info, Flame
} from 'lucide-react';
import Link from 'next/link';

export default function PrecificacaoPage() {
  const { products, getProductCmv, updateProduct, isLoaded } = useInventory();

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'lanche' | 'duplo' | 'porcao' | 'bebida'>('todos');
  
  // Taxas do iFood (configuráveis)
  const [ifoodCommissionPct, setIfoodCommissionPct] = useState<number>(23); // 23%
  const [paymentFeePct, setPaymentFeePct] = useState<number>(3.2); // 3.2%
  
  // Estados de Edição Local (para permitir digitação fluida antes de salvar)
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [savedSuccessIds, setSavedSuccessIds] = useState<Record<string, boolean>>({});
  const [bulkPercentInput, setBulkPercentInput] = useState<string>('27');
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);

  // Produto Selecionado para Raio-X / Simulador Detalhado
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Produtos Ativos
  const activeProducts = useMemo(() => {
    return products.filter(p => p.isActive !== false && !p.name.startsWith('Adicional:') && !p.name.startsWith('Pote Maionese'));
  }, [products]);

  // Produtos Filtrados
  const filteredProducts = useMemo(() => {
    return activeProducts.filter(p => {
      if (categoryFilter === 'duplo') {
        if (!p.name.toLowerCase().includes('duplo')) return false;
      } else if (categoryFilter === 'lanche') {
        if (p.category !== 'lanche' || p.name.toLowerCase().includes('duplo')) return false;
      } else if (categoryFilter !== 'todos' && p.category !== categoryFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        return p.name.toLowerCase().includes(searchTerm.toLowerCase());
      }

      return true;
    });
  }, [activeProducts, categoryFilter, searchTerm]);

  // Obter Preço Ativo no iFood (seja o editado em tela ou o original)
  const getProductIfoodPrice = (p: Product): number => {
    return editedPrices[p.id] !== undefined ? editedPrices[p.id] : p.priceIfood;
  };

  // Alteração direta do valor em R$
  const handlePriceChange = (productId: string, value: string) => {
    const num = parseFloat(value);
    setEditedPrices(prev => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : num
    }));
  };

  // Alteração por porcentagem de acréscimo sobre o Balcão
  const handleApplyPercentToProduct = (p: Product, percent: number, round90: boolean = false) => {
    let newPrice = p.priceBalcao * (1 + percent / 100);
    if (round90) {
      newPrice = Math.floor(newPrice) + 0.90;
    } else {
      newPrice = Math.round(newPrice * 10) / 10;
    }
    setEditedPrices(prev => ({
      ...prev,
      [p.id]: newPrice
    }));
  };

  // Salvar Preço Individual
  const handleSaveProductPrice = async (p: Product) => {
    const newPrice = getProductIfoodPrice(p);
    await updateProduct(p.id, { priceIfood: newPrice });

    // Feedback visual
    setSavedSuccessIds(prev => ({ ...prev, [p.id]: true }));
    setTimeout(() => {
      setSavedSuccessIds(prev => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    }, 2500);
  };

  // Aplicar Acréscimo em Massa (Ex: +27% em todos os lanches)
  const handleApplyBulkMarkup = () => {
    const pct = parseFloat(bulkPercentInput);
    if (isNaN(pct)) return;

    const updates: Record<string, number> = {};
    filteredProducts.forEach(p => {
      const calculated = Math.floor(p.priceBalcao * (1 + pct / 100)) + 0.90;
      updates[p.id] = calculated;
    });

    setEditedPrices(prev => ({ ...prev, ...updates }));
    setShowBulkModal(false);
  };

  // Salvar Todos os Modificados
  const handleSaveAllModified = async () => {
    for (const [id, newPrice] of Object.entries(editedPrices)) {
      await updateProduct(id, { priceIfood: newPrice });
    }
    setEditedPrices({});
    alert('Todos os novos preços do iFood foram salvos e auditados!');
  };

  // Métricas do Topo
  const metrics = useMemo(() => {
    let totalBalcao = 0;
    let totalIfood = 0;
    let count = 0;
    let totalMarginPct = 0;
    let criticalItemsCount = 0;

    activeProducts.forEach(p => {
      const ifoodP = getProductIfoodPrice(p);
      const cmv = getProductCmv(p.recipe || []);
      const totalFee = (ifoodCommissionPct + paymentFeePct) / 100;
      const netProfit = (ifoodP * (1 - totalFee)) - cmv;
      const margin = ifoodP > 0 ? (netProfit / ifoodP) * 100 : 0;

      totalBalcao += p.priceBalcao;
      totalIfood += ifoodP;
      totalMarginPct += margin;
      count++;

      if (margin < 18) {
        criticalItemsCount++;
      }
    });

    const avgBalcao = count > 0 ? totalBalcao / count : 0;
    const avgIfood = count > 0 ? totalIfood / count : 0;
    const avgMargin = count > 0 ? totalMarginPct / count : 0;

    return {
      avgBalcao,
      avgIfood,
      avgMargin,
      criticalItemsCount,
      totalCount: count
    };
  }, [activeProducts, editedPrices, ifoodCommissionPct, paymentFeePct, getProductCmv]);

  // Produto ativo no simulador de raio-X
  const selectedProduct = useMemo(() => {
    return activeProducts.find(p => p.id === selectedProductId) || activeProducts[0];
  }, [activeProducts, selectedProductId]);

  const selectedProductCmv = useMemo(() => {
    return selectedProduct ? getProductCmv(selectedProduct.recipe || []) : 0;
  }, [selectedProduct, getProductCmv]);

  const selectedProductIfoodPrice = selectedProduct ? getProductIfoodPrice(selectedProduct) : 0;

  // Raio-X do produto selecionado
  const selectedProductSim = useMemo(() => {
    if (!selectedProduct) return null;
    const totalFeePct = (ifoodCommissionPct + paymentFeePct) / 100;

    // Balcão
    const balcaoFee = selectedProduct.priceBalcao * 0.03; // Cartão médio 3%
    const balcaoNetRev = selectedProduct.priceBalcao - balcaoFee;
    const balcaoProfit = balcaoNetRev - selectedProductCmv;
    const balcaoMargin = selectedProduct.priceBalcao > 0 ? (balcaoProfit / selectedProduct.priceBalcao) * 100 : 0;

    // iFood
    const ifoodFee = selectedProductIfoodPrice * totalFeePct;
    const ifoodNetRev = selectedProductIfoodPrice - ifoodFee;
    const ifoodProfit = ifoodNetRev - selectedProductCmv;
    const ifoodMargin = selectedProductIfoodPrice > 0 ? (ifoodProfit / selectedProductIfoodPrice) * 100 : 0;

    return {
      balcao: {
        gross: selectedProduct.priceBalcao,
        fees: balcaoFee,
        netRev: balcaoNetRev,
        profit: balcaoProfit,
        margin: balcaoMargin
      },
      ifood: {
        gross: selectedProductIfoodPrice,
        fees: ifoodFee,
        netRev: ifoodNetRev,
        profit: ifoodProfit,
        margin: ifoodMargin
      }
    };
  }, [selectedProduct, selectedProductCmv, selectedProductIfoodPrice, ifoodCommissionPct, paymentFeePct]);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        
        {/* Topo / Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all shadow-sm">
              <ArrowLeft size={22} />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider mb-1">
                <Calculator size={15} /> Gestão Estratégica de Preços
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">Precificação Inteligente do iFood</h1>
              <p className="text-xs text-slate-400 mt-1">
                Ajuste os preços por porcentagem ou valor direto em R$ de forma individualizada (ex: EUA vs. México).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/engenharia"
              className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Flame size={15} /> Ver Viabilidade do iFood (Hits & Ads)
            </Link>
            {Object.keys(editedPrices).length > 0 && (
              <button
                type="button"
                onClick={handleSaveAllModified}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer animate-pulse"
              >
                <Save size={16} /> Salvar Todos ({Object.keys(editedPrices).length})
              </button>
            )}
          </div>
        </header>

        {/* Cards de Métricas Gerais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
            <div className="p-3.5 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
              <Store size={24} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase">Preço Médio Balcão</span>
              <h3 className="text-2xl font-mono font-black text-white">R$ {metrics.avgBalcao.toFixed(2)}</h3>
              <span className="text-[10px] text-slate-500">Base da loja física</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
            <div className="p-3.5 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
              <Smartphone size={24} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase">Preço Médio iFood</span>
              <h3 className="text-2xl font-mono font-black text-white">R$ {metrics.avgIfood.toFixed(2)}</h3>
              <span className="text-[10px] text-emerald-400">
                +{metrics.avgBalcao > 0 ? (((metrics.avgIfood - metrics.avgBalcao) / metrics.avgBalcao) * 100).toFixed(1) : 0}% sobre Balcão
              </span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
            <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <TrendingUp size={24} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase">Margem Líquida iFood</span>
              <h3 className="text-2xl font-mono font-black text-emerald-400">{metrics.avgMargin.toFixed(1)}%</h3>
              <span className="text-[10px] text-slate-500">Após taxas de {ifoodCommissionPct + paymentFeePct}%</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
            <div className="p-3.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <AlertTriangle size={24} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase">Margem Apertada (&lt;18%)</span>
              <h3 className={`text-2xl font-mono font-black ${metrics.criticalItemsCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                {metrics.criticalItemsCount} itens
              </h3>
              <span className="text-[10px] text-slate-500">Exigem revisão de preço</span>
            </div>
          </div>
        </div>

        {/* Barra de Taxas & Parâmetros da Plataforma */}
        <div className="glass-card p-4 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <Sliders size={18} className="text-red-400" />
            <span className="text-xs font-bold text-slate-300">Taxas Cadastradas no iFood:</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Comissão iFood:</span>
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                <input
                  type="number"
                  step="0.5"
                  value={ifoodCommissionPct}
                  onChange={e => setIfoodCommissionPct(parseFloat(e.target.value) || 0)}
                  className="w-12 bg-transparent text-white font-mono font-bold text-center outline-none"
                />
                <span className="text-slate-500 font-bold">%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Pagamento Online:</span>
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                <input
                  type="number"
                  step="0.1"
                  value={paymentFeePct}
                  onChange={e => setPaymentFeePct(parseFloat(e.target.value) || 0)}
                  className="w-12 bg-transparent text-white font-mono font-bold text-center outline-none"
                />
                <span className="text-slate-500 font-bold">%</span>
              </div>
            </div>

            <div className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 font-mono">
              Total Plataforma: <strong className="text-red-400">{(ifoodCommissionPct + paymentFeePct).toFixed(1)}%</strong>
            </div>

            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="py-1.5 px-3.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Sparkles size={14} /> Ajuste em Lote
            </button>
          </div>
        </div>

        {/* Modal de Ajuste em Lote */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Sparkles className="text-blue-400" /> Ajuste de Preços em Lote
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Aplica uma porcentagem padronizada sobre o preço de balcão de todos os lanches filtrados.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Porcentagem de Acréscimo sobre o Balcão (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={bulkPercentInput}
                      onChange={e => setBulkPercentInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold outline-none focus:border-blue-500"
                    />
                    <span className="text-lg text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {[20, 25, 27, 30, 35].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBulkPercentInput(p.toString())}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono font-bold"
                    >
                      +{p}%
                    </button>
                  ))}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-xs text-blue-300">
                  💡 Os preços serão automaticamente arredondados com final <strong>.90</strong> para melhorar a conversão no app.
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkMarkup}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30"
                >
                  Aplicar na Tabela
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Filtros da Tabela */}
        <div className="glass-card p-4 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'lanche', label: '🍔 Burgers Simples' },
              { id: 'duplo', label: '🔥 Linha Duplos' },
              { id: 'porcao', label: '🍟 Porções' },
              { id: 'bebida', label: '🥤 Bebidas' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categoryFilter === tab.id 
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar item (ex: EUA, México, Batata)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Tabela Interativa de Precificação Flexível */}
        <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Cardápio no iFood ({filteredProducts.length} itens)
              </h3>
              <p className="text-xs text-slate-400">
                Digite o valor em R$ desejado ou clique nos atalhos de porcentagem.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">Taxa iFood considerada: {(ifoodCommissionPct + paymentFeePct).toFixed(1)}%</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="p-4">Produto & CMV</th>
                  <th className="p-4">Preço Balcão</th>
                  <th className="p-4 w-48">Preço iFood (R$)</th>
                  <th className="p-4">Acréscimo s/ Balcão</th>
                  <th className="p-4">Lucro Líquido iFood</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredProducts.map(p => {
                  const cmv = getProductCmv(p.recipe || []);
                  const currentIfood = getProductIfoodPrice(p);
                  const isModified = editedPrices[p.id] !== undefined && editedPrices[p.id] !== p.priceIfood;
                  const isSaved = savedSuccessIds[p.id];

                  // Cálculo do Markup e Lucro
                  const markupPct = p.priceBalcao > 0 ? ((currentIfood - p.priceBalcao) / p.priceBalcao) * 100 : 0;
                  const totalFeePct = (ifoodCommissionPct + paymentFeePct) / 100;
                  const netRevenue = currentIfood * (1 - totalFeePct);
                  const netProfit = netRevenue - cmv;
                  const marginPct = currentIfood > 0 ? (netProfit / currentIfood) * 100 : 0;

                  return (
                    <tr 
                      key={p.id}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        isModified ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Nome e CMV */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm">{p.name}</span>
                          {p.name.toLowerCase().includes('duplo') && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-[10px] font-black">
                              DUPLO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 mt-1 font-mono text-[11px]">
                          <span>CMV: <strong className="text-amber-400">R$ {cmv.toFixed(2)}</strong></span>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedProductId(p.id)}
                            className="text-blue-400 hover:underline cursor-pointer"
                          >
                            Ver Raio-X
                          </button>
                        </div>
                      </td>

                      {/* Preço Balcão */}
                      <td className="p-4 font-mono font-bold text-slate-300">
                        R$ {p.priceBalcao.toFixed(2)}
                      </td>

                      {/* Input do Preço iFood (Edição Flexível) */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-mono font-bold">R$</span>
                          <input
                            type="number"
                            step="0.10"
                            value={currentIfood}
                            onChange={e => handlePriceChange(p.id, e.target.value)}
                            className={`w-28 p-2 rounded-xl font-mono text-sm font-black outline-none border transition-all ${
                              isModified 
                                ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-sm' 
                                : 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Acréscimo Percentual & Botões de Atalho */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`font-mono font-black text-xs ${
                            markupPct < 20 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            +{markupPct.toFixed(1)}%
                          </span>
                        </div>
                        {/* Botões Rápidos de Porcentagem */}
                        <div className="flex items-center gap-1">
                          {[20, 25, 30, 35].map(pct => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => handleApplyPercentToProduct(p, pct, true)}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-[10px] font-mono cursor-pointer transition-colors"
                              title={`Aplicar +${pct}% com final .90`}
                            >
                              +{pct}%
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Lucro Líquido no iFood */}
                      <td className="p-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${netProfit > 0 ? 'text-white' : 'text-red-400'}`}>
                            R$ {netProfit.toFixed(2)}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            marginPct >= 25 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : marginPct >= 18
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : marginPct >= 10
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {marginPct.toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {marginPct < 18 ? '⚠️ Margem apertada' : 'Margem saudável'}
                        </span>
                      </td>

                      {/* Ação: Salvar */}
                      <td className="p-4 text-right">
                        {isSaved ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs">
                            <Check size={14} /> Salvo!
                          </span>
                        ) : isModified ? (
                          <button
                            type="button"
                            onClick={() => handleSaveProductPrice(p)}
                            className="py-1.5 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all ml-auto"
                          >
                            <Save size={14} /> Salvar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedProductId(p.id)}
                            className="py-1.5 px-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-medium cursor-pointer transition-all ml-auto"
                          >
                            Simular
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Raio-X Detalhado: Comparativo Balcão vs. iFood */}
        {selectedProduct && selectedProductSim && (
          <div className="glass-card rounded-3xl p-6 md:p-8 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Raio-X de Margem</span>
                <h3 className="text-2xl font-black text-white">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-400">
                  CMV da Ficha Técnica: <strong className="text-amber-400 font-mono">R$ {selectedProductCmv.toFixed(2)}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Trocar produto:</span>
                <select
                  value={selectedProduct.id}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl p-2 text-white text-xs font-bold outline-none cursor-pointer"
                >
                  {activeProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Coluna Balcão */}
              <div className="p-6 rounded-2xl bg-blue-950/20 border border-blue-500/20 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-blue-400 font-extrabold text-sm pb-2 border-b border-blue-500/20">
                  <Store size={18} /> Venda no Balcão (Loja Física)
                </div>

                <div className="flex justify-between text-slate-300">
                  <span>Preço de Venda:</span>
                  <span className="font-mono font-bold text-white">R$ {selectedProductSim.balcao.gross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Taxa Cartão (Médio 3%):</span>
                  <span className="font-mono text-red-400">- R$ {selectedProductSim.balcao.fees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>CMV do Lanche:</span>
                  <span className="font-mono text-amber-400">- R$ {selectedProductCmv.toFixed(2)}</span>
                </div>

                <div className="pt-3 border-t border-blue-500/30 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Lucro Líquido</span>
                    <strong className="text-2xl font-mono text-blue-400 font-black">
                      R$ {selectedProductSim.balcao.profit.toFixed(2)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Margem Líquida</span>
                    <strong className="text-xl font-mono text-emerald-400 font-black">
                      {selectedProductSim.balcao.margin.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Coluna iFood */}
              <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/20 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-red-400 font-extrabold text-sm pb-2 border-b border-red-500/20">
                  <Smartphone size={18} /> Venda no iFood (Preço Atual)
                </div>

                <div className="flex justify-between text-slate-300">
                  <span>Preço no iFood:</span>
                  <span className="font-mono font-bold text-white">R$ {selectedProductSim.ifood.gross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Comissão + Pagamento ({(ifoodCommissionPct + paymentFeePct).toFixed(1)}%):</span>
                  <span className="font-mono text-red-400">- R$ {selectedProductSim.ifood.fees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>CMV do Lanche:</span>
                  <span className="font-mono text-amber-400">- R$ {selectedProductCmv.toFixed(2)}</span>
                </div>

                <div className="pt-3 border-t border-red-500/30 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Lucro Líquido</span>
                    <strong className="text-2xl font-mono text-red-400 font-black">
                      R$ {selectedProductSim.ifood.profit.toFixed(2)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Margem Líquida</span>
                    <strong className={`text-xl font-mono font-black ${
                      selectedProductSim.ifood.margin >= 18 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {selectedProductSim.ifood.margin.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
