'use client';
import { useState, useMemo } from 'react';
import { useInventory, Product } from '@/lib/store';
import { 
  ArrowLeft, TrendingUp, Sparkles, AlertCircle, DollarSign, Award, 
  Flame, Filter, Sliders, Check, BarChart2, HelpCircle, Info, ChevronRight,
  TrendingDown, Store, Smartphone, ShieldAlert, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { calculateIfoodViability } from '@/lib/pricing';

export type QuadrantType = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface ItemAnalysis {
  product: Product;
  price: number;
  cmv: number;
  cmvPct: number;
  marginR$: number;
  marginPct: number;
  volume: number;
  revenue: number;
  totalGrossProfit: number;
  quadrant: QuadrantType;
}

export default function EngenhariaCardapioPage() {
  const { products, sales, getProductCmv, isLoaded } = useInventory();

  // Filtros
  const [channelFilter, setChannelFilter] = useState<'geral' | 'balcao' | 'ifood'>('geral');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'lanche' | 'duplo' | 'porcao' | 'bebida'>('lanche');
  const [viewMode, setViewMode] = useState<'quadrantes' | 'tabela' | 'matriz' | 'viabilidade_ifood'>('quadrantes');

  // Parâmetros de Viabilidade do iFood (Promoções, Cupom Hits e Ads)
  const [ifoodCommissionPct, setIfoodCommissionPct] = useState<number>(23); // 23%
  const [ifoodPaymentFeePct, setIfoodPaymentFeePct] = useState<number>(3.2); // 3.2%
  const [packagingCostInput, setPackagingCostInput] = useState<number>(2.50); // R$ 2.50
  const [adsCostInput, setAdsCostInput] = useState<number>(2.00); // R$ 2.00
  const [hitsDiscountInput, setHitsDiscountInput] = useState<number>(10.00); // R$ 10.00 (custo do cupom bancado pela loja)

  // Simulador de Reprecificação
  const [selectedSimProduct, setSelectedSimProduct] = useState<string>('');
  const [simPriceIncrease, setSimPriceIncrease] = useState<number>(2.00);

  // Vendas válidas
  const validSales = useMemo(() => {
    return sales.filter(s => s.status === 'completed');
  }, [sales]);

  // Contagem de vendas por produto (filtrando canal se necessário)
  const productSalesMap = useMemo(() => {
    const map: Record<string, { volume: number; revenue: number }> = {};
    
    validSales.forEach(s => {
      if (channelFilter !== 'geral' && s.channel !== channelFilter) return;

      s.items?.forEach(item => {
        if (!map[item.productId]) {
          map[item.productId] = { volume: 0, revenue: 0 };
        }
        map[item.productId].volume += item.quantity;
        map[item.productId].revenue += item.unitPrice * item.quantity;
      });
    });

    return map;
  }, [validSales, channelFilter]);

  // Produtos filtrados por categoria
  const eligibleProducts = useMemo(() => {
    return products.filter(p => {
      if (p.name.startsWith('Adicional:') || p.name.startsWith('Pote Maionese')) return false;

      if (categoryFilter === 'todos') return true;
      if (categoryFilter === 'duplo') return p.category === 'lanche' && p.name.toLowerCase().includes('duplo');
      if (categoryFilter === 'lanche') return p.category === 'lanche' && !p.name.toLowerCase().includes('duplo');
      return p.category === categoryFilter;
    });
  }, [products, categoryFilter]);

  // Análise Matemática de Engenharia de Cardápio
  const analysisData = useMemo(() => {
    if (eligibleProducts.length === 0) return { items: [], avgMargin: 0, avgVolume: 0 };

    // 1. Calcular métricas básicas de cada item
    const rawItems = eligibleProducts.map(p => {
      let price = p.priceBalcao;
      if (channelFilter === 'ifood') {
        price = p.priceIfood;
      } else if (channelFilter === 'geral') {
        price = (p.priceBalcao + p.priceIfood) / 2;
      }

      // CMV Real das receitas e sub-receitas
      const cmv = getProductCmv(p.recipe || []);
      const marginR$ = Math.max(0, price - cmv);
      const marginPct = price > 0 ? (marginR$ / price) * 100 : 0;
      const cmvPct = price > 0 ? (cmv / price) * 100 : 0;

      const salesInfo = productSalesMap[p.id] || { volume: 0, revenue: 0 };
      const volume = salesInfo.volume;
      const revenue = volume > 0 ? salesInfo.revenue : price * volume;
      const totalGrossProfit = marginR$ * volume;

      return {
        product: p,
        price,
        cmv,
        cmvPct,
        marginR$,
        marginPct,
        volume,
        revenue,
        totalGrossProfit
      };
    });

    // 2. Linhas de corte (Médias da Categoria)
    const totalVolume = rawItems.reduce((acc, i) => acc + i.volume, 0);
    const totalProfit = rawItems.reduce((acc, i) => acc + i.totalGrossProfit, 0);

    // Margem média ponderada (ou simples se volume for zero)
    const avgMargin = totalVolume > 0 
      ? totalProfit / totalVolume 
      : rawItems.reduce((acc, i) => acc + i.marginR$, 0) / (rawItems.length || 1);

    // Volume médio de vendas por item
    const avgVolume = totalVolume / (rawItems.length || 1);

    // 3. Classificar nos 4 Quadrantes
    const items: ItemAnalysis[] = rawItems.map(item => {
      const isHighMargin = item.marginR$ >= avgMargin;
      const isHighVolume = item.volume >= avgVolume;

      let quadrant: QuadrantType = 'dog';
      if (isHighMargin && isHighVolume) quadrant = 'star';
      else if (!isHighMargin && isHighVolume) quadrant = 'plowhorse';
      else if (isHighMargin && !isHighVolume) quadrant = 'puzzle';
      else quadrant = 'dog';

      return {
        ...item,
        quadrant
      };
    });

    return {
      items,
      avgMargin,
      avgVolume,
      totalVolume,
      totalProfit
    };
  }, [eligibleProducts, channelFilter, getProductCmv, productSalesMap]);

  // Agrupamento por Quadrante
  const stars = useMemo(() => analysisData.items.filter(i => i.quadrant === 'star'), [analysisData]);
  const plowhorses = useMemo(() => analysisData.items.filter(i => i.quadrant === 'plowhorse'), [analysisData]);
  const puzzles = useMemo(() => analysisData.items.filter(i => i.quadrant === 'puzzle'), [analysisData]);
  const dogs = useMemo(() => analysisData.items.filter(i => i.quadrant === 'dog'), [analysisData]);

  // Item selecionado para simulação de reprecificação
  const simItem = useMemo(() => {
    if (!selectedSimProduct) {
      // Pré-seleciona o primeiro "Cavalo de Batalha" ou o primeiro item
      return plowhorses[0] || analysisData.items[0] || null;
    }
    return analysisData.items.find(i => i.product.id === selectedSimProduct) || null;
  }, [selectedSimProduct, plowhorses, analysisData]);

  // Cálculo da Simulação
  const simulationResults = useMemo(() => {
    if (!simItem) return null;
    const currentPrice = simItem.price;
    const currentMargin = simItem.marginR$;
    const newPrice = currentPrice + simPriceIncrease;
    const newMargin = currentMargin + simPriceIncrease;
    
    // Projeção baseada nas vendas (estimando 30 dias se volume for recente)
    const baseVolume = simItem.volume || 10;
    const currentProfit = currentMargin * baseVolume;
    const projectedProfit = newMargin * baseVolume;
    const additionalProfit = projectedProfit - currentProfit;
    const annualAdditional = additionalProfit * 12;

    return {
      currentPrice,
      newPrice,
      currentMargin,
      newMargin,
      baseVolume,
      additionalProfit,
      annualAdditional
    };
  }, [simItem, simPriceIncrease]);

  // Cálculos de Viabilidade do iFood (Hits, Ads & Embalagem)
  const ifoodViabilityItems = useMemo(() => {
    return eligibleProducts.map(p => {
      const cmv = getProductCmv(p.recipe || []);
      const viability = calculateIfoodViability({
        priceIfood: p.priceIfood,
        cmv,
        commissionPct: ifoodCommissionPct / 100,
        paymentFeePct: ifoodPaymentFeePct / 100,
        packagingCost: packagingCostInput,
        adsCostPerOrder: adsCostInput,
        hitsDiscount: hitsDiscountInput
      });

      return {
        product: p,
        cmv,
        ...viability
      };
    });
  }, [eligibleProducts, getProductCmv, ifoodCommissionPct, ifoodPaymentFeePct, packagingCostInput, adsCostInput, hitsDiscountInput]);

  const ifoodViabilitySummary = useMemo(() => {
    const total = ifoodViabilityItems.length;
    const viaveis = ifoodViabilityItems.filter(i => i.hitsStatus === 'viavel');
    const alertas = ifoodViabilityItems.filter(i => i.hitsStatus === 'alerta');
    const prejuizos = ifoodViabilityItems.filter(i => i.hitsStatus === 'prejuizo');

    const avgNormalProfit = total > 0 ? ifoodViabilityItems.reduce((acc, i) => acc + i.normalNetProfit, 0) / total : 0;
    const avgHitsProfit = total > 0 ? ifoodViabilityItems.reduce((acc, i) => acc + i.hitsNetProfit, 0) / total : 0;

    return {
      total,
      viaveisCount: viaveis.length,
      alertasCount: alertas.length,
      prejuizosCount: prejuizos.length,
      avgNormalProfit,
      avgHitsProfit,
      viaveisList: viaveis,
      prejuizosList: prejuizos
    };
  }, [ifoodViabilityItems]);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[50%] h-[50%] bg-amber-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-amber-400 font-bold mb-1 text-xs uppercase tracking-wider">
                <Award size={16} /> Matriz BCG & Lucratividade Real
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Engenharia de Cardápio
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Metodologia Kasavana & Smith: cruze a popularidade com a margem de cada lanche para maximizar seu lucro.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/cardapio"
              className="px-4 py-2.5 glass-card hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              Ficha Técnica & Receitas <ChevronRight size={14} />
            </Link>
          </div>
        </header>

        {/* Barra de Filtros */}
        <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-slate-800">
          
          {/* Categoria */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'lanche', label: '🍔 Hambúrgueres' },
              { id: 'duplo', label: '🥩 Linha Duplos' },
              { id: 'porcao', label: '🍟 Porções' },
              { id: 'bebida', label: '🥤 Bebidas' },
              { id: 'todos', label: 'Todos os Itens' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  categoryFilter === cat.id
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Canal e Visualização */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setChannelFilter('geral')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  channelFilter === 'geral' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Geral
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('balcao')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  channelFilter === 'balcao' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Store size={13} /> Balcão
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('ifood')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  channelFilter === 'ifood' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone size={13} /> iFood
              </button>
            </div>

            {/* Alternador de Vista */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('quadrantes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'quadrantes' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                4 Quadrantes
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matriz')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'matriz' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Matriz 2x2
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tabela')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'tabela' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setViewMode('viabilidade_ifood')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'viabilidade_ifood' 
                    ? 'bg-red-600 text-white shadow-md font-black' 
                    : 'text-amber-400 hover:text-white'
                }`}
              >
                <Flame size={13} /> Viabilidade iFood (Hits & Ads)
              </button>
            </div>
          </div>

        </div>

        {/* KPIs Executivos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5 border-t-4 border-amber-500">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Margem Média da Categoria
            </span>
            <p className="text-3xl font-mono font-extrabold text-amber-400">
              R$ {analysisData.avgMargin.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Linha de corte de lucratividade</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border-t-4 border-blue-500">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Volume Médio de Vendas
            </span>
            <p className="text-3xl font-mono font-extrabold text-blue-400">
              {analysisData.avgVolume.toFixed(1)} <span className="text-base text-slate-400 font-sans font-medium">un/item</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Linha de corte de popularidade</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border-t-4 border-emerald-500">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              🌟 Lanches Estrela
            </span>
            <p className="text-3xl font-mono font-extrabold text-emerald-400">
              {stars.length} <span className="text-base text-slate-400 font-sans font-medium">itens</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Alta saída + Alta margem de lucro</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border-t-4 border-purple-500">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              🐴 Cavalos de Batalha
            </span>
            <p className="text-3xl font-mono font-extrabold text-purple-400">
              {plowhorses.length} <span className="text-base text-slate-400 font-sans font-medium">itens</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Alta saída, mas margem a melhorar</p>
          </div>
        </div>

        {/* VISÃO 1: OS 4 QUADRANTES ESTRATÉGICOS */}
        {viewMode === 'quadrantes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. ESTRELAS */}
            <div className="glass-card rounded-3xl p-6 border-2 border-emerald-500/40 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-emerald-500/20">
                  <div>
                    <h3 className="text-xl font-black text-emerald-400 flex items-center gap-2">
                      🌟 1. Lanches Estrela (Stars)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">Alta Popularidade + Alta Margem de Lucro</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-bold text-xs">
                    {stars.length} produtos
                  </span>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3.5 mb-4 text-xs text-emerald-200 leading-relaxed">
                  <strong>💡 Ação Estratégica:</strong> Seus carros-chefe de lucratividade! Mantenha a qualidade e gramatura rigorosas, coloque em destaque nas fotos de cardápio e redes sociais. Não mude a receita.
                </div>

                <div className="space-y-3">
                  {stars.length === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">Nenhum produto classificado como Estrela nesta categoria.</p>
                  ) : (
                    stars.map(item => (
                      <div key={item.product.id} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-white text-sm">{item.product.name}</span>
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            Lucro Unit: R$ {item.marginR$.toFixed(2)} ({item.marginPct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-900 font-mono">
                          <span>Preço: R$ {item.price.toFixed(2)} • CMV: R$ {item.cmv.toFixed(2)}</span>
                          <span className="text-white font-bold">{item.volume} un vendidas</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 2. CAVALOS DE BATALHA */}
            <div className="glass-card rounded-3xl p-6 border-2 border-purple-500/40 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-purple-500/20">
                  <div>
                    <h3 className="text-xl font-black text-purple-400 flex items-center gap-2">
                      🐴 2. Cavalos de Batalha (Plowhorses)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">Alta Popularidade + Baixa Margem de Lucro</p>
                  </div>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full font-bold text-xs">
                    {plowhorses.length} produtos
                  </span>
                </div>

                <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-3.5 mb-4 text-xs text-purple-200 leading-relaxed">
                  <strong>💡 Ação Estratégica:</strong> Vendem muito, mas deixam pouco lucro no bolso. Aplique um reajuste suave de <strong>+R$ 1,50 a +R$ 2,50</strong> ou renegocie o custo dos queijos/carnes na ficha técnica para transformá-los em Estrelas!
                </div>

                <div className="space-y-3">
                  {plowhorses.length === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">Nenhum produto classificado como Cavalo de Batalha.</p>
                  ) : (
                    plowhorses.map(item => (
                      <div key={item.product.id} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-white text-sm">{item.product.name}</span>
                          <span className="font-mono text-xs font-bold text-amber-400">
                            Lucro Unit: R$ {item.marginR$.toFixed(2)} ({item.marginPct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-900 font-mono">
                          <span>Preço: R$ {item.price.toFixed(2)} • CMV: R$ {item.cmv.toFixed(2)}</span>
                          <span className="text-purple-300 font-bold">{item.volume} un vendidas</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 3. QUEBRA-CABEÇAS */}
            <div className="glass-card rounded-3xl p-6 border-2 border-blue-500/40 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-blue-500/20">
                  <div>
                    <h3 className="text-xl font-black text-blue-400 flex items-center gap-2">
                      🧩 3. Quebra-Cabeças (Puzzles)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">Baixa Popularidade + Alta Margem de Lucro</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full font-bold text-xs">
                    {puzzles.length} produtos
                  </span>
                </div>

                <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-3.5 mb-4 text-xs text-blue-200 leading-relaxed">
                  <strong>💡 Ação Estratégica:</strong> Dão um lucro excelente por unidade, mas poucos clientes compram. Aumente a visibilidade: crie combos atrativos com batata e bebida, ou treine o operador de caixa para sugerir no balcão.
                </div>

                <div className="space-y-3">
                  {puzzles.length === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">Nenhum produto classificado como Quebra-Cabeça.</p>
                  ) : (
                    puzzles.map(item => (
                      <div key={item.product.id} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-white text-sm">{item.product.name}</span>
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            Lucro Unit: R$ {item.marginR$.toFixed(2)} ({item.marginPct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-900 font-mono">
                          <span>Preço: R$ {item.price.toFixed(2)} • CMV: R$ {item.cmv.toFixed(2)}</span>
                          <span className="text-slate-400 font-bold">{item.volume} un vendidas</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 4. ABACAXIS */}
            <div className="glass-card rounded-3xl p-6 border-2 border-red-500/40 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-red-500/20">
                  <div>
                    <h3 className="text-xl font-black text-red-400 flex items-center gap-2">
                      🐶 4. Cães / Abacaxis (Dogs)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">Baixa Popularidade + Baixa Margem de Lucro</p>
                  </div>
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full font-bold text-xs">
                    {dogs.length} produtos
                  </span>
                </div>

                <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-3.5 mb-4 text-xs text-red-200 leading-relaxed">
                  <strong>💡 Ação Estratégica:</strong> Vendem pouco e deixam pouca margem. Muitas vezes geram perdas de insumos que vencem sem uso. Considere reformular a receita, mudar o nome comercial ou retirar do cardápio para enxugar a operação.
                </div>

                <div className="space-y-3">
                  {dogs.length === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">Nenhum produto classificado como Cão/Abacaxi.</p>
                  ) : (
                    dogs.map(item => (
                      <div key={item.product.id} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-white text-sm">{item.product.name}</span>
                          <span className="font-mono text-xs font-bold text-red-400">
                            Lucro Unit: R$ {item.marginR$.toFixed(2)} ({item.marginPct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-900 font-mono">
                          <span>Preço: R$ {item.price.toFixed(2)} • CMV: R$ {item.cmv.toFixed(2)}</span>
                          <span className="text-red-400 font-bold">{item.volume} un vendidas</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* VISÃO 2: MATRIZ VISUAL 2X2 (GRÁFICO DISPERSÃO CARTESIANO) */}
        {viewMode === 'matriz' && (
          <div className="glass-card rounded-3xl p-8 border border-slate-800 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart2 className="text-amber-400" /> Matriz Visual 2x2 (Kasavana & Smith)
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Eixo Vertical: Margem de Contribuição em R$ • Eixo Horizontal: Volume Vendido
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 min-h-[500px] border-2 border-dashed border-slate-700 p-4 rounded-3xl bg-slate-950/60 relative">
              
              {/* Quadrante Superior Esquerdo: QUEBRA-CABEÇAS */}
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">
                    🧩 Quebra-Cabeças (Alta Margem, Baixo Volume)
                  </span>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {puzzles.map(i => (
                      <span key={i.product.id} className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5">
                        {i.product.name} (R$ {i.marginR$.toFixed(0)})
                      </span>
                    ))}
                    {puzzles.length === 0 && <span className="text-xs text-slate-600">Nenhum</span>}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic">Estimular vendas com promoções</p>
              </div>

              {/* Quadrante Superior Direito: ESTRELAS */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                    🌟 Estrelas (Alta Margem, Alto Volume)
                  </span>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {stars.map(i => (
                      <span key={i.product.id} className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 shadow-md">
                        {i.product.name} (R$ {i.marginR$.toFixed(0)})
                      </span>
                    ))}
                    {stars.length === 0 && <span className="text-xs text-slate-600">Nenhum</span>}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic">Proteger qualidade e manter destaque</p>
              </div>

              {/* Quadrante Inferior Esquerdo: CÃES / ABACAXIS */}
              <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider block mb-1">
                    🐶 Abacaxis (Baixa Margem, Baixo Volume)
                  </span>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {dogs.map(i => (
                      <span key={i.product.id} className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1.5">
                        {i.product.name} (R$ {i.marginR$.toFixed(0)})
                      </span>
                    ))}
                    {dogs.length === 0 && <span className="text-xs text-slate-600">Nenhum</span>}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic">Avaliar retirada do cardápio</p>
              </div>

              {/* Quadrante Inferior Direito: CAVALOS DE BATALHA */}
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block mb-1">
                    🐴 Cavalos de Batalha (Baixa Margem, Alto Volume)
                  </span>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {plowhorses.map(i => (
                      <span key={i.product.id} className="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5">
                        {i.product.name} (R$ {i.marginR$.toFixed(0)})
                      </span>
                    ))}
                    {plowhorses.length === 0 && <span className="text-xs text-slate-600">Nenhum</span>}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic">Reajustar preço ou enxugar ficha técnica</p>
              </div>

              {/* Ponto Central de Corte */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-amber-500 px-3 py-1 rounded-full text-[10px] font-bold text-amber-300 z-10 shadow-lg">
                Corte: R$ {analysisData.avgMargin.toFixed(2)} • {analysisData.avgVolume.toFixed(1)} un
              </div>
            </div>
          </div>
        )}

        {/* VISÃO 3: TABELA DE PERFORMANCE COMPLETA */}
        {viewMode === 'tabela' && (
          <div className="glass-card rounded-3xl p-6 border border-slate-800 overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-4">Relatório Detalhado de Engenharia</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Item do Cardápio</th>
                    <th className="py-3 px-4">Classificação</th>
                    <th className="py-3 px-4 font-mono">Preço</th>
                    <th className="py-3 px-4 font-mono">CMV Real</th>
                    <th className="py-3 px-4 font-mono">Margem (R$)</th>
                    <th className="py-3 px-4 font-mono">Margem (%)</th>
                    <th className="py-3 px-4 font-mono">Vendas</th>
                    <th className="py-3 px-4 font-mono">Lucro Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analysisData.items.map(item => (
                    <tr key={item.product.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{item.product.name}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${
                          item.quadrant === 'star'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : item.quadrant === 'plowhorse'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : item.quadrant === 'puzzle'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {item.quadrant === 'star' ? '🌟 Estrela' : item.quadrant === 'plowhorse' ? '🐴 Cavalo' : item.quadrant === 'puzzle' ? '🧩 Quebra-Cabeça' : '🐶 Abacaxi'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">R$ {item.price.toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-mono text-amber-400">R$ {item.cmv.toFixed(2)} ({item.cmvPct.toFixed(0)}%)</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">R$ {item.marginR$.toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{item.marginPct.toFixed(1)}%</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">{item.volume} un</td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-400">
                        R$ {item.totalGrossProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISÃO 4: VIABILIDADE DO IFOOD (HITS, ADS, EMBALAGEM & COMISSÕES) */}
        {viewMode === 'viabilidade_ifood' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Topo da Aba de Viabilidade */}
            <div className="glass-card rounded-3xl p-6 md:p-8 border-2 border-red-500/30 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="inline-flex items-center gap-2 text-red-400 font-extrabold text-xs uppercase tracking-wider mb-1">
                    <Flame size={16} /> Inteligência de Delivery & Campanhas
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    Viabilidade Financeira do iFood (Orgânico vs. Cupom Hits)
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                    No iFood, campanhas como o <strong>Cupom Hits</strong> e <strong>iFood Ads</strong> atraem muitos clientes, mas o desconto do lanche (normalmente <strong>R$ 10,00</strong>) é custeado integralmente pela sua loja. Itens de baixo custo (como o <strong>EUA</strong>) são viáveis, mas lanches de alto CMV (como o <strong>México</strong>) geram prejuízo quando participam.
                  </p>
                </div>
              </div>

              {/* Parâmetros Operacionais Editáveis */}
              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-400 tracking-wider">
                  <Sliders size={15} /> Ajustar Parâmetros Reais da Sua Operação no iFood:
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Comissão iFood (%)</label>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={ifoodCommissionPct}
                        onChange={e => setIfoodCommissionPct(parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-white font-mono font-bold outline-none"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">23% Entrega iFood / 12% Própria</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Taxa Pagamento (%)</label>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={ifoodPaymentFeePct}
                        onChange={e => setIfoodPaymentFeePct(parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-white font-mono font-bold outline-none"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Transação no app (3.2%)</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Embalagem Delivery (R$)</label>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                      <span className="text-slate-500 font-mono mr-1">R$</span>
                      <input
                        type="number"
                        step="0.1"
                        value={packagingCostInput}
                        onChange={e => setPackagingCostInput(parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-white font-mono font-bold outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Sacola, papel e lacre</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">iFood Ads por Pedido (R$)</label>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                      <span className="text-slate-500 font-mono mr-1">R$</span>
                      <input
                        type="number"
                        step="0.5"
                        value={adsCostInput}
                        onChange={e => setAdsCostInput(parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-white font-mono font-bold outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Tráfego pago rateado</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Custo Cupom Hits (R$)</label>
                    <div className="flex items-center bg-slate-900 border border-red-500/40 rounded-xl px-3 py-2">
                      <span className="text-red-400 font-mono mr-1">-R$</span>
                      <input
                        type="number"
                        step="1"
                        value={hitsDiscountInput}
                        onChange={e => setHitsDiscountInput(parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-red-300 font-mono font-black outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-red-400 mt-0.5 block font-bold">Desconto pago pela loja</span>
                  </div>
                </div>
              </div>

              {/* Cards de Métricas da Viabilidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Itens Viáveis no Hits</span>
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-mono font-black text-emerald-400">
                    {ifoodViabilitySummary.viaveisCount} / {ifoodViabilitySummary.total} itens
                  </h3>
                  <p className="text-[10px] text-slate-400">Suportam a promoção com lucro saudável (&gt;18%)</p>
                </div>

                <div className="p-5 rounded-2xl bg-red-950/30 border border-red-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Prejuízo no Hits (Proibidos)</span>
                    <XCircle size={18} className="text-red-400" />
                  </div>
                  <h3 className="text-2xl font-mono font-black text-red-400">
                    {ifoodViabilitySummary.prejuizosCount} itens
                  </h3>
                  <p className="text-[10px] text-red-300">Margem &lt; 5% ou prejuízo direto ao vender</p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase">Lucro Médio Orgânico</span>
                  <h3 className="text-2xl font-mono font-black text-white">
                    R$ {ifoodViabilitySummary.avgNormalProfit.toFixed(2)}
                  </h3>
                  <p className="text-[10px] text-slate-500">Preço cheio sem cupom</p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase">Lucro Médio com Cupom Hits</span>
                  <h3 className={`text-2xl font-mono font-black ${ifoodViabilitySummary.avgHitsProfit >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    R$ {ifoodViabilitySummary.avgHitsProfit.toFixed(2)}
                  </h3>
                  <p className="text-[10px] text-slate-500">Após desconto de R$ {hitsDiscountInput.toFixed(2)} + Ads</p>
                </div>
              </div>

              {/* Destaque Comparativo EUA vs. México */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-black uppercase text-sm">
                    <span>🇺🇸 Caso de Sucesso: Hambúrgueres de CMV Baixo (Ex: EUA)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Por terem receitas enxutas e custos de insumos controlados, suportam pagar o Cupom Hits de R$ 10,00 e o iFood Ads, mantendo margem positiva. São perfeitos para colocar na vitrine promocional e alavancar o ranqueamento da hamburgueria no algoritmo do iFood.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/30 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-red-400 font-black uppercase text-sm">
                    <span>🇲🇽 Ponto de Atenção Crítico: Hambúrgueres Complexos (Ex: México)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Lanches duplos, artesanais ou com queijos nobres e bacon têm CMV alto. Se você colocar um lanche com CMV de R$ 18+ em promoção de cupom de R$ 10, a loja <strong>PAGA PARA TRABALHAR</strong>. Remova-os da campanha ou aumente o preço no iFood para compensar!
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela Comparativa Detalhada Produto a Produto */}
            <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    Diagnóstico de Viabilidade por Produto ({ifoodViabilityItems.length} itens)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Compare lado a lado o lucro da venda orgânica vs. o lucro quando o cliente usa o Cupom Hits.
                  </p>
                </div>
                <Link
                  href="/admin/precificacao"
                  className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <DollarSign size={14} /> Ajustar Preços no iFood
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="p-4">Produto & CMV</th>
                      <th className="p-4">Preço iFood Atual</th>
                      <th className="p-4">Venda Normal (Orgânica)</th>
                      <th className="p-4">Com Cupom Hits (-R$ {hitsDiscountInput.toFixed(0)})</th>
                      <th className="p-4 text-center">Diagnóstico da Promoção</th>
                      <th className="p-4 text-right">Preço Mínimo para Hits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {ifoodViabilityItems.map(item => {
                      const isPrejuizo = item.hitsStatus === 'prejuizo';
                      const isAlerta = item.hitsStatus === 'alerta';

                      return (
                        <tr
                          key={item.product.id}
                          className={`hover:bg-slate-900/40 transition-colors ${
                            isPrejuizo 
                              ? 'bg-red-950/15' 
                              : isAlerta 
                                ? 'bg-amber-950/10' 
                                : ''
                          }`}
                        >
                          {/* Produto e CMV */}
                          <td className="p-4">
                            <div className="font-extrabold text-white text-sm">{item.product.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              CMV: <strong className="text-amber-400">R$ {item.cmv.toFixed(2)}</strong> • Balcão: R$ {item.product.priceBalcao.toFixed(2)}
                            </div>
                          </td>

                          {/* Preço iFood */}
                          <td className="p-4 font-mono font-black text-white text-sm">
                            R$ {item.normalPrice.toFixed(2)}
                          </td>

                          {/* Venda Orgânica */}
                          <td className="p-4 font-mono">
                            <div className="font-bold text-white">
                              Lucro: <strong className="text-emerald-400 font-black">R$ {item.normalNetProfit.toFixed(2)}</strong>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Margem: {item.normalMarginPct.toFixed(1)}%
                            </span>
                          </td>

                          {/* Venda com Cupom Hits */}
                          <td className="p-4 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400">Cliente paga:</span>
                              <strong className="text-slate-200">R$ {item.hitsEffectivePrice.toFixed(2)}</strong>
                            </div>
                            <div className="font-bold mt-0.5">
                              Lucro: <strong className={item.hitsNetProfit > 0 ? (item.hitsMarginPct >= 18 ? 'text-emerald-400 font-black' : 'text-amber-400') : 'text-red-400 font-black'}>
                                {item.hitsNetProfit >= 0 ? '+' : ''} R$ {item.hitsNetProfit.toFixed(2)}
                              </strong>
                              <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.2 rounded ${
                                item.hitsMarginPct >= 18
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : item.hitsMarginPct >= 5
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-red-500/20 text-red-400'
                              }`}>
                                {item.hitsMarginPct.toFixed(1)}%
                              </span>
                            </div>
                          </td>

                          {/* Diagnóstico da Promoção */}
                          <td className="p-4 text-center">
                            {item.hitsStatus === 'viavel' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-black text-[10px] uppercase">
                                <CheckCircle2 size={12} /> Viável no Hits
                              </span>
                            )}
                            {item.hitsStatus === 'alerta' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-black text-[10px] uppercase">
                                <AlertTriangle size={12} /> Margem Apertada
                              </span>
                            )}
                            {item.hitsStatus === 'prejuizo' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/40 rounded-full font-black text-[10px] uppercase animate-pulse">
                                <XCircle size={12} /> 🚨 Prejuízo / Proibido
                              </span>
                            )}
                          </td>

                          {/* Preço Mínimo Recomendado */}
                          <td className="p-4 text-right font-mono">
                            {isPrejuizo ? (
                              <div>
                                <span className="font-extrabold text-red-400 text-sm">
                                  R$ {item.suggestedMinPriceForHits.toFixed(2)}
                                </span>
                                <span className="block text-[10px] text-slate-400">para ter 18% de margem</span>
                              </div>
                            ) : (
                              <span className="text-emerald-400 text-xs font-bold">
                                ✅ Preço atual OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* SIMULADOR DE OTIMIZAÇÃO ESTRATÉGICA & REPRECIFICAÇÃO */}
        <div className="glass-card rounded-3xl p-8 border-2 border-purple-500/40 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-purple-400 font-bold mb-1 text-xs uppercase tracking-wider">
                <Sliders size={16} /> Simulador de Impacto Financeiro
              </div>
              <h2 className="text-2xl font-extrabold text-white">
                Simular Reajuste em &quot;Cavalos de Batalha&quot;
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Veja o lucro adicional injetado no seu caixa ao aumentar centavos ou reais nos lanches de alta saída.
              </p>
            </div>

            {/* Seletor de Produto para Simular */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-400">Selecionar Lanche:</label>
              <select
                value={selectedSimProduct || (simItem?.product.id || '')}
                onChange={e => setSelectedSimProduct(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none cursor-pointer"
              >
                {analysisData.items.map(i => (
                  <option key={i.product.id} value={i.product.id}>
                    {i.product.name} ({i.quadrant === 'plowhorse' ? '🐴 Cavalo' : i.quadrant === 'star' ? '🌟 Estrela' : i.quadrant})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {simulationResults && simItem && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/60 p-6 rounded-2xl border border-slate-800">
              
              {/* Controles de Simulação */}
              <div className="lg:col-span-5 space-y-4">
                <p className="text-sm font-bold text-white">
                  Lanche: <span className="text-purple-400 font-extrabold">{simItem.product.name}</span>
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">
                    Aumento de Preço Simulado:
                  </label>
                  <div className="flex gap-2 mb-3">
                    {[1.00, 1.50, 2.00, 2.50, 3.00].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSimPriceIncrease(val)}
                        className={`flex-1 py-2 rounded-xl font-mono font-bold text-xs cursor-pointer transition-all ${
                          simPriceIncrease === val
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        +R$ {val.toFixed(2)}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="0.50"
                    max="5.00"
                    step="0.50"
                    value={simPriceIncrease}
                    onChange={e => setSimPriceIncrease(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                    <span>+ R$ 0,50</span>
                    <span className="text-purple-400 font-bold">+ R$ {simPriceIncrease.toFixed(2)}</span>
                    <span>+ R$ 5,00</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Preço Atual:</span>
                    <strong className="text-slate-200 font-mono">R$ {simulationResults.currentPrice.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Novo Preço Simulado:</span>
                    <strong className="text-emerald-400 font-mono">R$ {simulationResults.newPrice.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Nova Margem Unitária:</span>
                    <strong className="text-purple-300 font-mono">R$ {simulationResults.newMargin.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Resultado do Impacto no Bolso */}
              <div className="lg:col-span-7 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Projeção de Lucro Líquido Adicional
                  </span>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                      <span className="text-xs text-slate-400 font-semibold block mb-0.5">Por Período / Mês</span>
                      <p className="text-2xl md:text-3xl font-mono font-extrabold text-emerald-400">
                        + R$ {simulationResults.additionalProfit.toFixed(2)}
                      </p>
                      <span className="text-[10px] text-emerald-300 block mt-1">
                        100% vira lucro líquido direto
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
                      <span className="text-xs text-slate-400 font-semibold block mb-0.5">Projeção em 12 Meses</span>
                      <p className="text-2xl md:text-3xl font-mono font-extrabold text-purple-300">
                        + R$ {simulationResults.annualAdditional.toFixed(2)}
                      </p>
                      <span className="text-[10px] text-purple-200 block mt-1">
                        Sem vender nenhuma unidade a mais!
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-4 leading-relaxed bg-slate-900 p-3 rounded-xl border border-slate-800/80">
                  ⚡ <strong>Insight de Restaurante:</strong> Como o <em>{simItem.product.name}</em> já possui alta demanda, um pequeno ajuste de <strong>R$ {simPriceIncrease.toFixed(2)}</strong> geralmente é imperceptível para o consumidor, mas injeta <strong>R$ {simulationResults.additionalProfit.toFixed(2)}</strong> de margem pura direto no caixa da loja todo mês.
                </p>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
