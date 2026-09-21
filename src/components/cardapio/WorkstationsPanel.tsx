'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useInventory, type KitchenComponentType } from '@/lib/store';

const labels: Record<string, string> = { grill: 'Chapa', fryer: 'Fritadeira', oven: 'Forno', cold: 'Preparo frio', assembly: 'Montagem', other: 'Outros', none: 'Sem preparo individual' };
export const workstationLabel = (id: string) => labels[id] || id;

export function WorkstationsPanel() {
  const { items, linkInventoryKitchenComponent, kitchenComponents, addKitchenComponent, updateKitchenComponent } = useInventory('admin');
  const [stations, setStations] = useState<string[]>([]);
  const [station, setStation] = useState('grill');
  const [newStation, setNewStation] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<KitchenComponentType>('other');
  const [unit, setUnit] = useState('unidade');
  const [weight, setWeight] = useState('');
  const [portionUnit, setPortionUnit] = useState('g');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { let alive = true; void (async () => {
    const result = await createClient().from('workstations').select('id').order('id');
    if (!alive) return;
    if (result.error) setError('Não foi possível carregar as estações. Confira a conexão e a atualização do banco.');
    else { setStations((result.data || []).map(s => s.id)); setReady(true); }
  })(); return () => { alive = false; }; }, []);
  async function save(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { setBusy(false); }
  }
  const input = 'bg-surface-input border border-border-default rounded-lg p-2 text-sm text-text-primary';
  const button = 'rounded-lg bg-brand-primary text-white px-3 py-2 text-sm disabled:opacity-50';
  return <section className="space-y-5 rounded-xl border border-border-default bg-surface-card p-5">
    <h2 className="text-lg font-bold">Estações de trabalho</h2>
    <p className="text-sm text-text-muted">Cadastre o preparo uma vez e vincule os insumos. Todas as receitas que usam esses insumos herdam a configuração; exceções ficam na ficha técnica.</p>
    {error && <p role="alert" className="text-status-danger">{error}</p>}
    <fieldset disabled={busy || !ready} className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void save(async () => {
        const id = newStation.trim(); if (!id) throw new Error('Informe o nome da estação.');
        const result = await createClient().from('workstations').insert({ id });
        if (result.error) throw new Error('Não foi possível criar. Verifique se essa estação já existe.');
        setStations(prev => [...prev, id]); setStation(id); setNewStation('');
      }); }}>
        <input aria-label="Nome da nova estação" placeholder="Ex.: Forno de pizzas" maxLength={60} value={newStation} onChange={e => setNewStation(e.target.value)} className={input} required />
        <button className={button}>Criar estação</button>
      </form>
      <label className="block">Estação <select className={input} value={station} onChange={e => setStation(e.target.value)}>{stations.map(id => <option key={id} value={id}>{workstationLabel(id)}</option>)}</select></label>
      <form className="flex flex-wrap gap-2 items-end" onSubmit={e => { e.preventDefault(); void save(async () => {
        if (!name.trim()) throw new Error('Informe o nome do preparo.');
        if (weight && (!Number.isFinite(Number(weight)) || Number(weight) <= 0)) throw new Error('Informe um peso ou volume positivo.');
        await addKitchenComponent({ name: name.trim(), station, componentType: kind, productionUnit: unit, portionWeight: weight ? Number(weight) : undefined, portionUnit, showInSummary: station !== 'none', isActive: true });
        setName(''); setWeight('');
      }); }}>
        <label>Preparo<input required maxLength={100} placeholder="Bovino recheado de costela 180 g" className={input + ' block'} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Tipo<select className={input + ' block'} value={kind} onChange={e => setKind(e.target.value as KitchenComponentType)}><option value="burger">Hambúrguer</option><option value="side">Porção</option><option value="protein">Proteína</option><option value="egg">Ovo</option><option value="other">Outro</option></select></label>
        <label>Contar em<select className={input + ' block'} value={unit} onChange={e => setUnit(e.target.value)}><option>unidade</option><option>disco</option><option>porcao</option></select></label>
        <label>Peso/volume por preparo (opcional)<input type="number" min="0.001" step="any" className={input + ' block'} value={weight} onChange={e => setWeight(e.target.value)} /></label>
        <label>Medida<select className={input + ' block'} value={portionUnit} onChange={e => setPortionUnit(e.target.value)}><option>g</option><option>kg</option><option>ml</option><option>l</option><option>un</option></select></label>
        <button className={button}>Criar preparo</button>
      </form>
      <p className="text-xs text-text-muted">O peso converte o consumo da receita em porções. Para insumos contados em unidades, informe a quantidade na receita. Não é necessário cadastrar molhos e embalagens como tarefas individuais.</p>
      <div className="space-y-2">{kitchenComponents.filter(c => c.station === station).map(c => <div className="flex flex-wrap gap-3 items-center" key={c.id}><strong>{c.name}</strong><span>{c.productionUnit}</span><label>Mover para <select aria-label={'Estação de ' + c.name} className={input} value={c.station} onChange={e => { const value = e.target.value; void save(async () => { await updateKitchenComponent(c.id, { station: value }); }); }}>{stations.map(id => <option key={id} value={id}>{workstationLabel(id)}</option>)}</select></label></div>)}</div>
      <h3 className="font-bold">Vincular insumos e pré-preparos</h3>
      <input className={input} aria-label="Buscar insumo" placeholder="Buscar insumo ou pré-preparo" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="max-h-96 overflow-auto space-y-2">{items.filter(i => i.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(item => <label key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default py-2"><span>{item.name}</span><select className={input} aria-label={'Preparo padrão de ' + item.name} value={item.kitchenComponentId || ''} onChange={e => { const id = e.target.value; void save(async () => {
        await linkInventoryKitchenComponent(item.id, id);
      }); }}><option value="">Sem vínculo (preservar regra existente)</option>{kitchenComponents.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{workstationLabel(c.station)} — {c.name}</option>)}</select></label>)}</div>
    </fieldset>
  </section>;
}
