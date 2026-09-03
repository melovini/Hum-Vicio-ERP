'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, LayoutGrid, Plus, Copy, Trash2, Save, 
  RotateCcw, Sparkles, Check, AlertCircle, Move, Edit2, 
  Maximize2, Users, Square, Circle, RectangleHorizontal
} from 'lucide-react';
import { 
  LayoutTemplate, LayoutTemplateItem, 
  getStoredLayoutTemplates, saveStoredLayoutTemplate, deleteStoredLayoutTemplate 
} from '@/lib/mesas';

export default function EditorMesasAdminPage() {
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [activeTemplate, setActiveTemplate] = useState<LayoutTemplate | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Arraste de mesas no Canvas do Admin
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Carrega templates
  useEffect(() => {
    const list = getStoredLayoutTemplates();
    setTemplates(list);
    if (list.length > 0) {
      setSelectedTemplateId(list[0].id);
      setActiveTemplate(JSON.parse(JSON.stringify(list[0])));
    }
  }, []);

  // Troca de template
  const handleSelectTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      setSelectedTemplateId(tpl.id);
      setActiveTemplate(JSON.parse(JSON.stringify(tpl)));
      setSelectedItemId(null);
    }
  };

  // Criar Novo Template
  const handleCreateNewTemplate = () => {
    const newId = 'tpl_custom_' + Date.now().toString(36);
    const newTemplate: LayoutTemplate = {
      id: newId,
      nome: `Novo Layout Salão (${templates.length + 1})`,
      ativo: true,
      createdAt: new Date().toISOString(),
      items: [
        { id: 'item_1', layoutTemplateId: newId, numeroIdentificador: 'Mesa 01', posX: 60, posY: 60, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' },
        { id: 'item_2', layoutTemplateId: newId, numeroIdentificador: 'Mesa 02', posX: 200, posY: 60, largura: 100, altura: 100, capacidade: 4, formato: 'quadrada' }
      ]
    };

    const updated = saveStoredLayoutTemplate(newTemplate);
    setTemplates(updated);
    setSelectedTemplateId(newId);
    setActiveTemplate(newTemplate);
    setSelectedItemId(null);
  };

  // Duplicar Template
  const handleDuplicateTemplate = () => {
    if (!activeTemplate) return;
    const newId = 'tpl_custom_' + Date.now().toString(36);
    const duplicated: LayoutTemplate = {
      ...JSON.parse(JSON.stringify(activeTemplate)),
      id: newId,
      nome: `${activeTemplate.nome} (Cópia)`,
      createdAt: new Date().toISOString(),
      items: activeTemplate.items.map(it => ({
        ...it,
        id: 'item_' + Math.random().toString(36).substring(2, 8),
        layoutTemplateId: newId
      }))
    };

    const updated = saveStoredLayoutTemplate(duplicated);
    setTemplates(updated);
    setSelectedTemplateId(newId);
    setActiveTemplate(duplicated);
  };

  // Salvar Template Ativo
  const handleSaveActiveTemplate = () => {
    if (!activeTemplate) return;
    const updated = saveStoredLayoutTemplate(activeTemplate);
    setTemplates(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Adicionar Mesa ao Template
  const handleAddTableToTemplate = () => {
    if (!activeTemplate) return;
    const nextNum = activeTemplate.items.length + 1;
    const newItem: LayoutTemplateItem = {
      id: 'item_' + Math.random().toString(36).substring(2, 8),
      layoutTemplateId: activeTemplate.id,
      numeroIdentificador: `Mesa ${nextNum < 10 ? '0' + nextNum : nextNum}`,
      posX: 100,
      posY: 100,
      largura: 100,
      altura: 100,
      capacidade: 4,
      formato: 'quadrada'
    };

    setActiveTemplate({
      ...activeTemplate,
      items: [...activeTemplate.items, newItem]
    });
    setSelectedItemId(newItem.id);
  };

  // Remover Mesa do Template
  const handleRemoveTableFromTemplate = (itemId: string) => {
    if (!activeTemplate) return;
    setActiveTemplate({
      ...activeTemplate,
      items: activeTemplate.items.filter(i => i.id !== itemId)
    });
    if (selectedItemId === itemId) setSelectedItemId(null);
  };

  // Manipulação de Arraste (Drag & Drop)
  const handleMouseDown = (e: React.MouseEvent, itemId: string) => {
    const item = activeTemplate?.items.find(i => i.id === itemId);
    if (!item || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    setDraggingItemId(itemId);
    setSelectedItemId(itemId);
    setDragOffset({
      x: mouseX - item.posX,
      y: mouseY - item.posY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingItemId || !activeTemplate || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    let rawX = e.clientX - canvasRect.left - dragOffset.x;
    let rawY = e.clientY - canvasRect.top - dragOffset.y;

    // Snap to Grid de 20px
    if (snapToGrid) {
      rawX = Math.round(rawX / 20) * 20;
      rawY = Math.round(rawY / 20) * 20;
    }

    rawX = Math.max(10, Math.min(canvasRect.width - 110, rawX));
    rawY = Math.max(10, Math.min(canvasRect.height - 110, rawY));

    setActiveTemplate({
      ...activeTemplate,
      items: activeTemplate.items.map(it => it.id === draggingItemId ? { ...it, posX: rawX, posY: rawY } : it)
    });
  };

  const handleMouseUp = () => {
    setDraggingItemId(null);
  };

  const selectedItem = activeTemplate?.items.find(i => i.id === selectedItemId);

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
      
      {/* Topo / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all cursor-pointer shadow-sm hover:border-slate-700"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="inline-flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider mb-1">
              <LayoutGrid size={16} /> Configuração do Administrador
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Editor de Layouts Mestre de Salão</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina a arquitetura e disposição base das mesas. A operação do turno clonará estes padrões.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveActiveTemplate}
            className="py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
          >
            {saveSuccess ? <Check size={16} className="text-white" /> : <Save size={16} />}
            {saveSuccess ? 'Layout Salvo!' : 'Salvar Layout Mestre'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Coluna Lateral: Gerenciador de Templates & Propriedades da Mesa */}
        <div className="space-y-6">
          
          {/* Caixa de Seleção e Criação de Templates */}
          <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Templates Salvos</span>
              <button
                type="button"
                onClick={handleCreateNewTemplate}
                className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="Criar Novo Layout"
              >
                <Plus size={14} /> Novo
              </button>
            </div>

            <div className="space-y-2">
              {templates.filter(t => t.ativo).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTemplate(t.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                    selectedTemplateId === t.id
                      ? 'bg-emerald-600/20 border-emerald-500 text-white font-bold shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold truncate">{t.nome}</p>
                    <span className="text-[10px] text-slate-500 font-mono">{t.items.length} mesas</span>
                  </div>
                  {selectedTemplateId === t.id && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            {activeTemplate && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">
                  Nome do Template:
                </label>
                <input
                  type="text"
                  value={activeTemplate.nome}
                  onChange={e => setActiveTemplate({ ...activeTemplate, nome: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDuplicateTemplate}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={13} /> Duplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Painel de Propriedades da Mesa Selecionada */}
          {selectedItem ? (
            <div className="glass-card p-5 rounded-3xl border border-emerald-500/40 space-y-4 animate-fade-in bg-slate-950/60">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit2 size={13} /> Propriedades da Mesa
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveTableFromTemplate(selectedItem.id)}
                  className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                  title="Remover do Template"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Rótulo / Identificador:</label>
                <input
                  type="text"
                  value={selectedItem.numeroIdentificador}
                  onChange={e => {
                    const val = e.target.value;
                    setActiveTemplate({
                      ...activeTemplate!,
                      items: activeTemplate!.items.map(it => it.id === selectedItem.id ? { ...it, numeroIdentificador: val } : it)
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Formato Visual:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'quadrada', label: 'Quadrada', icon: Square },
                    { id: 'redonda', label: 'Redonda', icon: Circle },
                    { id: 'retangular', label: 'Retangular', icon: RectangleHorizontal }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        const largura = f.id === 'retangular' ? 140 : 100;
                        const altura = 100;
                        setActiveTemplate({
                          ...activeTemplate!,
                          items: activeTemplate!.items.map(it => it.id === selectedItem.id ? { ...it, formato: f.id as any, largura, altura } : it)
                        });
                      }}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        selectedItem.formato === f.id
                          ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <f.icon size={16} />
                      <span className="text-[10px]">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Capacidade de Assentos:</label>
                <div className="flex gap-2">
                  {[2, 4, 6, 8].map(cap => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => {
                        setActiveTemplate({
                          ...activeTemplate!,
                          items: activeTemplate!.items.map(it => it.id === selectedItem.id ? { ...it, capacidade: cap } : it)
                        });
                      }}
                      className={`flex-1 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                        selectedItem.capacidade === cap
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {cap}L
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Posição X:</span>
                  <span className="font-bold text-white">{Math.round(selectedItem.posX)} px</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Posição Y:</span>
                  <span className="font-bold text-white">{Math.round(selectedItem.posY)} px</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 rounded-3xl border border-slate-800 text-center text-slate-500 space-y-2">
              <Move size={28} className="mx-auto opacity-30" />
              <p className="text-xs">Clique em qualquer mesa no mapa para editar suas propriedades.</p>
            </div>
          )}

        </div>

        {/* Coluna Central: Canvas Interativo do Salão */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Barra de Controle do Canvas */}
          <div className="glass-card p-4 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddTableToTemplate}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
              >
                <Plus size={15} /> Adicionar Mesa
              </button>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={e => setSnapToGrid(e.target.checked)}
                  className="rounded border-slate-700 accent-emerald-500"
                />
                <span>Grade Magnética (Snap 20px)</span>
              </label>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Arraste as mesas livremente pelo salão para compor a planta mestre.</span>
            </div>
          </div>

          {/* Área de Canvas Bidimensional */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative w-full h-[580px] bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden select-none"
            style={{
              backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          >
            {/* Linha indicadora de Entrada / Balcão */}
            <div className="absolute top-0 left-0 right-0 h-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
              🚪 Frente de Caixa / Entrada do Salão
            </div>

            {/* Mesas do Template */}
            {activeTemplate?.items.map(item => {
              const isSelected = selectedItemId === item.id;
              const isDragging = draggingItemId === item.id;

              return (
                <div
                  key={item.id}
                  onMouseDown={e => handleMouseDown(e, item.id)}
                  style={{
                    left: `${item.posX}px`,
                    top: `${item.posY}px`,
                    width: `${item.largura || 100}px`,
                    height: `${item.altura || 100}px`,
                    borderRadius: item.formato === 'redonda' ? '9999px' : '20px'
                  }}
                  className={`absolute cursor-grab active:cursor-grabbing transition-shadow flex flex-col items-center justify-center p-2 border-2 ${
                    isSelected
                      ? 'bg-emerald-600/30 border-emerald-400 shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/20'
                      : 'bg-slate-900/90 border-slate-700 hover:border-slate-500 shadow-lg'
                  } ${isDragging ? 'opacity-90 scale-105 z-30' : 'z-10'}`}
                >
                  <span className="font-black text-white text-xs tracking-tight text-center leading-tight">
                    {item.numeroIdentificador}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-mono">
                    <Users size={11} /> {item.capacidade} lugares
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

    </main>
  );
}
