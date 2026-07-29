'use client';
import { useState } from 'react';
import { calculateNetProfit, TaxConfig } from '@/lib/pricing';
import { Calculator, ArrowLeft, Store, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function PrecificacaoPage() {
  const [cmv, setCmv] = useState('12.50');
  const [balcaoPrice, setBalcaoPrice] = useState('35.00');
  const [ifoodPrice, setIfoodPrice] = useState('42.00');

  // Hardcoded config for prototype. Eventually comes from DB.
  const config: TaxConfig = {
    ifoodPercentage: 0.30,
    ifoodFixedFee: 0.99,
    creditCardFee: 0.03,
    debitPixFee: 0.01
  };

  const balcaoResult = calculateNetProfit({
    channel: 'balcao',
    paymentMethod: 'credito',
    salePrice: Number(balcaoPrice),
    cmv: Number(cmv)
  }, config);

  const ifoodResult = calculateNetProfit({
    channel: 'ifood',
    paymentMethod: 'ifood_online',
    salePrice: Number(ifoodPrice),
    cmv: Number(cmv)
  }, config);

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-4 glass-card rounded-2xl hover:bg-slate-800 transition-colors">
              <ArrowLeft size={24} className="text-slate-300" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-bold mb-1">
                <Calculator size={20} /> Módulo Gestão
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Motor de Precificação</h1>
            </div>
          </div>
        </header>

        <div className="glass-card rounded-3xl p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Parâmetros Base</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm text-slate-400 font-bold mb-2">Custo Base (CMV)</label>
              <input 
                type="number" 
                value={cmv}
                onChange={e => setCmv(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 font-bold mb-2">Preço de Venda (Balcão)</label>
              <input 
                type="number" 
                value={balcaoPrice}
                onChange={e => setBalcaoPrice(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 font-bold mb-2">Preço de Venda (iFood)</label>
              <input 
                type="number" 
                value={ifoodPrice}
                onChange={e => setIfoodPrice(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card Balcão */}
          <div className="glass-card rounded-3xl p-8 border-t-4 border-t-blue-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Store size={100} />
            </div>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl"><Store size={24} /></div>
              <h2 className="text-2xl font-bold text-white">Venda no Balcão</h2>
            </div>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Receita Bruta</span>
                <span className="font-mono text-slate-200">R$ {balcaoResult.grossRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Taxas (Crédito 3%)</span>
                <span className="font-mono text-red-400">- R$ {balcaoResult.totalFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Receita Líquida</span>
                <span className="font-mono text-slate-200">R$ {balcaoResult.netRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Custo (CMV)</span>
                <span className="font-mono text-amber-400">- R$ {balcaoResult.cmv.toFixed(2)}</span>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-700">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-lg font-bold text-slate-300">Lucro Real</span>
                  <span className="text-4xl font-mono font-extrabold text-blue-400">R$ {balcaoResult.netProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/50 rounded-xl p-3">
                  <span className="text-sm text-slate-500 font-bold">MARGEM LÍQUIDA</span>
                  <span className={`font-mono font-bold ${balcaoResult.profitMargin > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {balcaoResult.profitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card iFood */}
          <div className="glass-card rounded-3xl p-8 border-t-4 border-t-red-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Smartphone size={100} />
            </div>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-xl"><Smartphone size={24} /></div>
              <h2 className="text-2xl font-bold text-white">Venda no iFood</h2>
            </div>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Receita Bruta</span>
                <span className="font-mono text-slate-200">R$ {ifoodResult.grossRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Taxas (30% + R$0.99)</span>
                <span className="font-mono text-red-400">- R$ {ifoodResult.totalFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Receita Líquida</span>
                <span className="font-mono text-slate-200">R$ {ifoodResult.netRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Custo (CMV)</span>
                <span className="font-mono text-amber-400">- R$ {ifoodResult.cmv.toFixed(2)}</span>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-700">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-lg font-bold text-slate-300">Lucro Real</span>
                  <span className="text-4xl font-mono font-extrabold text-red-400">R$ {ifoodResult.netProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/50 rounded-xl p-3">
                  <span className="text-sm text-slate-500 font-bold">MARGEM LÍQUIDA</span>
                  <span className={`font-mono font-bold ${ifoodResult.profitMargin > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {ifoodResult.profitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
