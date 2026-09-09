'use client';
import { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, 
  Trash2, Users, Phone, MapPin, Sparkles, Check, RefreshCw
} from 'lucide-react';
import { 
  ImportedCustomer, parseCardapioWebXlsx, 
  getStoredImportedCustomers, saveImportedCustomers, clearImportedCustomers 
} from '@/lib/crm-clientes';

interface ImportarClientesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (imported: ImportedCustomer[]) => void;
}

export default function ImportarClientesModal({
  isOpen,
  onClose,
  onImportSuccess
}: ImportarClientesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{
    customers: ImportedCustomer[];
    totalRows: number;
    detectedColumns: Record<string, string | undefined>;
  } | null>(null);

  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [currentImportedCount, setCurrentImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredImportedCustomers();
      setCurrentImportedCount(stored.length);
      setFile(null);
      setParsedData(null);
      setParseError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProcessFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setParsing(true);
    setParseError(null);

    try {
      const res = await parseCardapioWebXlsx(selectedFile);
      if (res.customers.length === 0) {
        setParseError('Nenhum cliente válido foi encontrado na planilha. Verifique se o arquivo possui colunas com nomes de clientes.');
        setParsedData(null);
      } else {
        setParsedData(res);
      }
    } catch (err: any) {
      console.error('Erro ao ler XLSX:', err);
      setParseError(`Erro ao ler arquivo: ${err?.message || 'Arquivo corrompido ou formato incompatível.'}`);
      setParsedData(null);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleProcessFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleProcessFile(f);
  };

  const handleConfirmImport = () => {
    if (!parsedData || parsedData.customers.length === 0) return;

    let finalCustomers: ImportedCustomer[] = [];
    if (importMode === 'replace') {
      finalCustomers = parsedData.customers;
    } else {
      const existing = getStoredImportedCustomers();
      // Mapa para evitar duplicar pelo ID normalizado
      const map = new Map<string, ImportedCustomer>();
      existing.forEach(c => map.set(c.id, c));
      parsedData.customers.forEach(c => map.set(c.id, c));
      finalCustomers = Array.from(map.values());
    }

    saveImportedCustomers(finalCustomers);
    onImportSuccess(finalCustomers);
    onClose();
  };

  const handleClearDatabase = () => {
    if (confirm('Tem certeza que deseja apagar todos os clientes importados do Cardápio Web salvos no navegador?')) {
      clearImportedCustomers();
      setCurrentImportedCount(0);
      onImportSuccess([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl animate-fade-in space-y-5 max-h-[90vh] flex flex-col">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                Importar Clientes do Cardápio Web
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/30">
                  .XLSX / Excel
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Carregue a planilha para abastecer o autocomplete do caixa com nomes, telefones e endereços.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Informação da Base Atual */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Users size={14} className="text-amber-400" />
            <span>Base importada atual: <strong className="text-white">{currentImportedCount}</strong> cliente(s) ativo(s)</span>
          </div>
          {currentImportedCount > 0 && (
            <button
              type="button"
              onClick={handleClearDatabase}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <Trash2 size={12} /> Limpar base atual
            </button>
          )}
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          
          {/* Zona Drag & Drop */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              file 
                ? 'border-emerald-500/50 bg-emerald-950/10' 
                : 'border-slate-700 hover:border-amber-500/60 bg-slate-950/40 hover:bg-slate-950/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-800 rounded-full text-amber-400">
                <Upload size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {file ? file.name : 'Clique para selecionar ou arraste o arquivo .XLSX aqui'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Suporta arquivos .xlsx, .xls ou .csv exportados do Cardápio Web
                </p>
              </div>
              {parsing && (
                <div className="flex items-center gap-2 text-xs text-amber-400 font-bold mt-2">
                  <RefreshCw size={14} className="animate-spin" /> Processando planilha...
                </div>
              )}
            </div>
          </div>

          {/* Mensagem de Erro se houver */}
          {parseError && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 text-rose-400 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Prévia dos Dados Processados */}
          {parsedData && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Resumo do Mapeamento */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Clientes Válidos</span>
                  <p className="text-lg font-mono font-black text-emerald-400">{parsedData.customers.length}</p>
                  <span className="text-[10px] text-slate-500">De {parsedData.totalRows} linhas na planilha</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Com Telefone</span>
                  <p className="text-lg font-mono font-black text-amber-400">
                    {parsedData.customers.filter(c => c.phone).length}
                  </p>
                  <span className="text-[10px] text-slate-500">Prontos para contato</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Com Endereço</span>
                  <p className="text-lg font-mono font-black text-cyan-400">
                    {parsedData.customers.filter(c => c.fullAddress).length}
                  </p>
                  <span className="text-[10px] text-slate-500">Agiliza o Delivery</span>
                </div>
              </div>

              {/* Modo de Importação */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-300 block">Modo de Gravação:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                      importMode === 'merge'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs">➕ Mesclar com os atuais</div>
                    <div className="text-[10px] opacity-80">Adiciona à base existente</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs">🔄 Substituir tudo</div>
                    <div className="text-[10px] opacity-80">Substitui a base antiga</div>
                  </button>
                </div>
              </div>

              {/* Tabela de Amostra das Primeiras Linhas */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Amostra dos Clientes Identificados (5 primeiros):
                </span>
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs">
                  <div className="divide-y divide-slate-800/80">
                    {parsedData.customers.slice(0, 5).map(c => (
                      <div key={c.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white truncate">{c.name}</span>
                            {c.totalOrders > 1 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                {c.totalOrders} pedidos
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            {c.phone && <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>}
                            {c.fullAddress && <span className="flex items-center gap-1 truncate"><MapPin size={10} /> {c.fullAddress}</span>}
                          </div>
                        </div>
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="flex gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!parsedData || parsedData.customers.length === 0}
            onClick={handleConfirmImport}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check size={16} />
            <span>Confirmar Importação {parsedData ? `(${parsedData.customers.length})` : ''}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
