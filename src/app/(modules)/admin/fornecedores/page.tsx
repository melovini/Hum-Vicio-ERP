'use client';
import { useDeferredValue, useState } from 'react';
import { useInventory } from '@/lib/store';
import { 
  ArrowLeft, Truck, Plus, MessageSquare, Trash2, History
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { filterSuppliers } from '@/lib/supplier-filters';

export default function FornecedoresPage() {
  const { suppliers, addSupplier, removeSupplier, purchaseRecords, isLoaded } = useInventory();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [categoryFilter, setCategoryFilter] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const clearFilters = () => { setSearchTerm(''); setCategoryFilter(''); };

  // Form
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Carnes');
  const [notes, setNotes] = useState('');

  if (!isLoaded) {
    return (
      <div role="status" aria-label="Carregando fornecedores" className="mx-auto max-w-6xl space-y-6 p-6">
        <span className="sr-only">Carregando fornecedores…</span>
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((id) => <Skeleton key={id} className="h-48" />)}</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await addSupplier({
      name: name.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      category,
      notes: notes.trim()
    });

    setName('');
    setContactName('');
    setPhone('');
    setNotes('');
    setShowAddModal(false);
  };

  const filteredSuppliers = filterSuppliers(suppliers, deferredSearch, categoryFilter);
  const categories = [...new Set(suppliers.map((supplier) => supplier.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filtersActive = Boolean(searchTerm || categoryFilter);

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/10 blur-[150px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <Link href="/" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft size={18} aria-hidden="true" /> Voltar à central
        </Link>
        <PageHeader title="Fornecedores" eyebrow="Gestão"
          description="Encontre parceiros e consulte o histórico de compras."
          className="mb-6"
          actions={<Button onClick={() => setShowAddModal(true)} leadingIcon={<Plus size={18} aria-hidden="true" />}>Cadastrar fornecedor</Button>} />

        {/* Modal de Cadastro */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <Truck size={24} className="text-blue-400" /> Novo Fornecedor
              </h2>
              <p className="text-slate-400 text-sm mb-6">Cadastre o parceiro para vincular às compras e cotações.</p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-bold mb-1">Nome da Empresa / Fornecedor</label>
                  <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white outline-none focus:border-blue-500"
                    placeholder="Ex: Açougue Premium Carnes"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 text-xs font-bold mb-1">Contato / Vendedor</label>
                    <input 
                      type="text" 
                      value={contactName} 
                      onChange={e => setContactName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white outline-none focus:border-blue-500"
                      placeholder="Ex: Rodrigo"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-xs font-bold mb-1">WhatsApp / Telefone</label>
                    <input 
                      type="text" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white outline-none focus:border-blue-500"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-bold mb-1">Categoria de Insumos</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="Carnes">Carnes & Frios</option>
                    <option value="Padaria">Pães & Massas</option>
                    <option value="Laticínios">Queijos & Laticínios</option>
                    <option value="Hortifruti">Hortifruti & Verduras</option>
                    <option value="Embalagens">Embalagens & Descartáveis</option>
                    <option value="Bebidas">Bebidas & Refrigerantes</option>
                    <option value="Geral">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-bold mb-1">Observações / Condições</label>
                  <textarea 
                    rows={2}
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 text-sm"
                    placeholder="Ex: Pedido mínimo R$ 200, entrega terças e sextas"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="mb-6">
          <FilterBar search={searchTerm} onSearchChange={setSearchTerm} searchLabel="Buscar fornecedores"
            placeholder="Nome, categoria ou vendedor" resultCount={filteredSuppliers.length}
            totalCount={suppliers.length} active={filtersActive} onClear={clearFilters}>
            <div className="space-y-1.5 sm:w-56">
              <label htmlFor="supplier-category-filter" className="block text-sm font-medium text-text-secondary">Categoria</label>
              <Select id="supplier-category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="">Todas as categorias</option>
                {categories.map((value) => <option key={value} value={value}>{value || 'Sem categoria'}</option>)}
              </Select>
            </div>
          </FilterBar>
        </div>
        {filteredSuppliers.length === 0 && <div className="mb-8">
          <EmptyState title={suppliers.length ? 'Nenhum fornecedor encontrado' : 'Seu primeiro fornecedor'}
            description={suppliers.length ? 'Altere a busca ou limpe os filtros para consultar outros parceiros.' : 'Cadastre um parceiro para organizar contatos e vincular suas compras.'}
            icon={<Truck aria-hidden="true" />}
            action={suppliers.length
              ? <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>
              : <Button onClick={() => setShowAddModal(true)}>Cadastrar fornecedor</Button>} />
        </div>}

        {/* Grid de Fornecedores */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredSuppliers.map(sup => {
            const rawPhone = sup.phone.replace(/\D/g, '');
            const whatsappUrl = rawPhone 
              ? `https://wa.me/55${rawPhone}?text=Olá%20${encodeURIComponent(sup.contactName || sup.name)},%20gostaria%20de%20fazer%20um%20pedido%20para%20o%20Hum%20Vício%20Hamburgueria.`
              : null;

            return (
              <div key={sup.id} className="rounded-card bg-surface-card p-6 border border-border-default hover:border-border-strong transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-lg uppercase">
                      {sup.category}
                    </span>
                    <button 
                      onClick={() => {
                        if (confirm(`Excluir fornecedor ${sup.name}?`)) {
                          removeSupplier(sup.id);
                        }
                      }}
                      className="text-slate-600 hover:text-red-400 p-1 cursor-pointer"
                      aria-label={`Excluir fornecedor ${sup.name}`} title="Excluir fornecedor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-1">{sup.name}</h3>
                  {sup.contactName && (
                    <p className="text-xs text-slate-400 mb-3">Vendedor: <strong className="text-slate-200">{sup.contactName}</strong></p>
                  )}
                  {sup.notes && (
                    <p className="text-xs text-slate-500 mb-4 italic bg-slate-950/40 p-2 rounded-xl">"{sup.notes}"</p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80">
                  {whatsappUrl ? (
                    <a 
                      href={whatsappUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <MessageSquare size={16} /> Pedir no WhatsApp
                    </a>
                  ) : (
                    <p className="text-xs text-slate-600 text-center">Sem telefone cadastrado</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Histórico de Compras e Evolução de Preços */}
        <div className="glass-card rounded-3xl p-8 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <History size={24} className="text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Histórico de Compras de Insumos</h2>
              <p className="text-slate-400 text-sm">Acompanhe preços pagos, fornecedores e variação de custos.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {purchaseRecords.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhuma compra registrada com histórico detalhado ainda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                    <th scope="col" className="pb-3 font-semibold">Data</th>
                    <th scope="col" className="pb-3 font-semibold">Insumo</th>
                    <th scope="col" className="pb-3 font-semibold">Fornecedor</th>
                    <th scope="col" className="pb-3 font-semibold text-right">Qtd</th>
                    <th scope="col" className="pb-3 font-semibold text-right">Custo Unitário</th>
                    <th scope="col" className="pb-3 font-semibold text-right">Total Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {purchaseRecords.map(p => (
                    <tr key={p.id} className="hover:bg-slate-900/40">
                      <td className="py-3 text-slate-400 text-xs">
                        {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 font-bold text-slate-200">
                        {p.ingredientName}
                      </td>
                      <td className="py-3 text-slate-400 text-xs">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {p.supplierName}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-right text-slate-300">
                        {p.quantity} {p.unit}
                      </td>
                      <td className="py-3 font-mono text-right text-amber-400 font-semibold">
                        R$ {p.costPerUnit.toFixed(2)}
                      </td>
                      <td className="py-3 font-mono text-right text-emerald-400 font-bold">
                        R$ {p.totalCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
