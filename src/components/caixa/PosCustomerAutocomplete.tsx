'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { User, Phone, MapPin, Star, X, Sparkles, Loader2 } from 'lucide-react';
import { 
  CustomerProfile, 
  CustomerSearchResult, 
  getStoredImportedCustomers, 
  searchRecurringCustomers, 
  searchCustomersFast,
  cleanCustomerName
} from '@/lib/crm-clientes';
import { formatPhone } from '@/lib/customer-filters';

interface PosCustomerAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  customerProfiles?: CustomerProfile[];
  orderType?: 'retirada' | 'delivery' | 'mesa';
  placeholder?: string;
  disabled?: boolean;
  onSelectCustomer?: (customer: CustomerSearchResult) => void;
}

export default function PosCustomerAutocomplete({
  value,
  onChange,
  customerProfiles = [],
  orderType = 'retirada',
  placeholder,
  disabled = false,
  onSelectCustomer,
}: PosCustomerAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearchingCloud, setIsSearchingCloud] = useState(false);
  const [customerCacheVersion, setCustomerCacheVersion] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Escuta atualizações de clientes no IndexedDB ou sincronização em segundo plano
  useEffect(() => {
    const handleUpdate = () => setCustomerCacheVersion(v => v + 1);
    window.addEventListener('crm_customers_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('crm_customers_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca instantânea em memória local (0ms) + busca leve e debounced no Supabase
  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    // 1. Resposta IMEDIATA a partir do cache local (sub-milissegundo)
    const stored = getStoredImportedCustomers();
    const instantResults = searchRecurringCustomers(query, customerProfiles, stored, 8);
    setResults(instantResults);
    if (instantResults.length > 0) {
      setIsOpen(true);
    }

    // 2. Consulta leve em background na nuvem com debounce de 120ms
    const timer = setTimeout(async () => {
      try {
        setIsSearchingCloud(true);
        const cloudResults = await searchCustomersFast(query, customerProfiles, { limit: 8, fetchCloud: true });
        if (cloudResults && cloudResults.length > 0) {
          setResults(cloudResults);
          setIsOpen(true);
        }
      } catch {
        // Mantém os resultados locais sem interromper o usuário
      } finally {
        setIsSearchingCloud(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [value, customerProfiles, customerCacheVersion]);

  const handleSelect = (cust: CustomerSearchResult) => {
    const cleaned = cleanCustomerName(cust.name).cleanName || cust.name;
    let finalValue = cleaned;
    if (orderType === 'delivery' && cust.fullAddress) {
      // Se for entrega e tiver endereço completo na base, formata amigavelmente
      finalValue = `${cleaned} - ${cust.fullAddress}`;
    } else if (cust.rawFullName && orderType === 'delivery') {
      finalValue = cust.rawFullName;
    }

    onChange(finalValue);
    setIsOpen(false);
    setActiveIndex(-1);
    if (onSelectCustomer) {
      onSelectCustomer(cust);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < results.length) {
          e.preventDefault();
          handleSelect(results[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      case 'Tab':
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        } else {
          setIsOpen(false);
        }
        break;
    }
  };

  const defaultPlaceholder = orderType === 'mesa' 
    ? 'Nome do cliente na mesa (opcional)' 
    : orderType === 'delivery'
      ? 'Nome do Cliente / Telefone / Endereço'
      : 'Identificação / Nome do Cliente';

  return (
    <div ref={containerRef} className="relative flex-1 flex items-center">
      <User size={14} className="absolute left-3 text-slate-500 pointer-events-none z-10" />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          if (!isOpen && e.target.value.trim().length >= 2) {
            setIsOpen(true);
          }
        }}
        onFocus={() => {
          if (value.trim().length >= 2 && results.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || defaultPlaceholder}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label="Nome do cliente"
        className="w-full pl-8 pr-8 py-2 bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
        autoComplete="off"
        spellCheck="false"
      />

      {/* Botão de Limpar ou Indicador de Busca em Nuvem */}
      <div className="absolute right-2.5 flex items-center gap-1 z-10">
        {isSearchingCloud && (
          <Loader2 size={12} className="text-amber-400 animate-spin opacity-75" />
        )}
        {value.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
              setResults([]);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="p-1 text-slate-500 hover:text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Limpar campo"
            aria-label="Limpar nome do cliente"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Dropdown Flutuante de Sugestão de Clientes */}
      {isOpen && (results.length > 0 || isSearchingCloud) && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/98 backdrop-blur-md border border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-800 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Cabeçalho do Dropdown */}
          <div className="bg-slate-950/90 px-3 py-1.5 flex items-center justify-between text-[10px] font-bold text-amber-400 border-b border-slate-800">
            <span className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-amber-400" />
              <span>
                {results.length > 0 ? `Clientes Encontrados (${results.length})` : 'Consultando base de clientes...'}
              </span>
            </span>
            {results.length > 0 && (
              <span className="text-slate-500 font-normal">
                Navegue com ↑ ↓ e pressione Enter
              </span>
            )}
          </div>

          {/* Estado de Busca em Nuvem quando ainda não há locais */}
          {results.length === 0 && isSearchingCloud && (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={13} className="text-amber-400 animate-spin" />
              <span>Consultando base de clientes...</span>
            </div>
          )}

          {/* Lista de Sugestões */}
          {results.length > 0 && (
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
              {results.map((cust, idx) => {
                const isSelected = idx === activeIndex;
                const isLoyal = cust.totalOrders >= 2;
                const formattedPhone = cust.phone ? formatPhone(cust.phone) : '';
                const addressSnippet = cust.fullAddress || cust.importedCustomer?.neighborhood || cust.importedCustomer?.address;

                return (
                  <div
                    key={cust.id || idx}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(cust);
                    }}
                    onClick={() => handleSelect(cust)}
                    className={`p-2.5 transition-colors cursor-pointer flex items-center justify-between gap-3 text-left ${
                      isSelected ? 'bg-amber-500/20 text-white' : 'hover:bg-slate-800/70 text-slate-200'
                    }`}
                  >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-xs font-bold text-white truncate">
                        {cust.name}
                      </strong>

                      {isLoyal && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                          <Star size={9} className="fill-amber-400" />
                          {cust.totalOrders} {cust.totalOrders === 1 ? 'pedido' : 'pedidos'}
                        </span>
                      )}

                      {cust.source === 'erp' ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                          Histórico
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Base
                        </span>
                      )}
                    </div>

                    {/* Detalhes Complementares: Telefone & Endereço */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      {formattedPhone && (
                        <span className="flex items-center gap-1">
                          <Phone size={10} className="text-slate-500" />
                          <span className="font-mono">{formattedPhone}</span>
                        </span>
                      )}

                      {addressSnippet && (
                        <span className="flex items-center gap-1 truncate max-w-[220px]" title={addressSnippet}>
                          <MapPin size={10} className="text-slate-500 shrink-0" />
                          <span className="truncate">{addressSnippet}</span>
                        </span>
                      )}
                    </div>

                    {/* Nota ou preferência frequente */}
                    {cust.frequentNotes && cust.frequentNotes.length > 0 && (
                      <div className="text-[10px] text-amber-300 font-mono italic truncate">
                        💡 Preferência: {cust.frequentNotes.join(' • ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}
  </div>
);
}
