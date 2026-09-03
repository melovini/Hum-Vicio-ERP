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
    const formattedNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;

    const newItem: LayoutTemplateItem = {
      id: 'item_' + Date.now().toString(36),
      layoutTemplateId: activeTemplate.id,
      numeroIdentificador: `Mesa ${formattedNum}`,
      posX: 80,
      posY: 80,
      largura: 100,
      altura: 100,
      capacidade: 4,
      formato: 'quadrada'
    };

    const updated = {
      ...activeTemplate,
      items: [...activeTemplate.items, newItem]
    };
    setActiveTemplate(updated);
    setSelectedItemId(newItem.id);
  };

  // Remover Mesa do Template
  const handleRemoveTableFromTemplate = (itemId: string) => {
    if (!activeTemplate) return;
    const updated = {
      ...activeTemplate,
      items: activeTemplate.items.filter(it => it.id !== itemId)
    };
    setActiveTemplate(updated);
    if (selectedItemId === itemId) setSelectedItemId(null);
  };

  // Manipulação de Arraste (Drag & Drop)
  const handleMouseDown = (e: React.MouseEvent, itemId: string) => {
    const item = activeTemplate?.items.find(i => i.id === itemId);
    if (!item || !canvasRef.current) return;

    setSelectedItemId(itemId);
    setDraggingItemId(itemId);

    const rect = canvasRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    setDragOffset({
      x: cursorX - item.posX,
      y: cursorY - item.posY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingItemId || !activeTemplate || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left - dragOffset.x;
    let newY = e.clientY - rect.top - dragOffset.y;

    if (snapToGrid) {
      newX = Math.round(newX / 20) * 20;
      newY = Math.round(newY / 20) * 20;
    }

    newX = Math.max(10, Math.min(newX, rect.width - 110));
    newY = Math.max(30, Math.min(newY, rect.height - 110));

    const updatedItems = activeTemplate.items.map(it => {
      if (it.id === draggingItemId) {
        return { ...it, posX: newX, posY: newY };
      }
      return it;
    });

    setActiveTemplate({
      ...activeTemplate,
      items: updatedItems
    });
  };

  const handleMouseUp = () => {
    setDraggingItemId(null);
  };

  // Atualizar Propriedades da Mesa Selecionada
  const handleUpdateSelectedItem = (fields: Partial<LayoutTemplateItem>) => {
    if (!activeTemplate || !selectedItemId) return;
    const updatedItems = activeTemplate.items.map(it => {
      if (it.id === selectedItemId) {
        return { ...it, ...fields };
      }
      return it;
    });
    setActiveTemplate({
      ...activeTemplate,
      items: updatedItems
    });
  };

  const selectedItem = activeTemplate?.items.find(i => i.id === selectedItemId);

  return (
    <div className="min-h-screen bg-surface-ground text-slate-100 p-4 md:p-6 space-y-6">
      
      {/* Topo / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2.5 bg-surface-card border border-surface-border text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="inline-flex items-center gap-1.5 text-brand-accent font-medium text-xs tracking-wider mb-0.5">
              <LayoutGrid size={14} /> Configuração do Administrador
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editor de Layouts Mestre de Salão</h1>
            <p className="text-xs text-slate-400">
              Defina a arquitetura e disposição base das mesas. A operação do turno clonará estes padrões.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveActiveTemplate}
            className="py-2 px-4 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            {saveSuccess ? <Check size={15} /> : <Save size={15} />}
            {saveSuccess ? 'Layout Salvo!' : 'Salvar Layout'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Coluna Lateral: Gerenciador de Templates & Propriedades da Mesa */}
        <div className="space-y-4">
          
          {/* Caixa de Seleção e Criação de Templates */}
          <div className="bg-surface-card p-4 rounded-xl border border-surface-border space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">Templates Salvos</span>
              <button
                type="button"
                onClick={handleCreateNewTemplate}
                className="py-1 px-2.5 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 border border-brand-primary/30 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={13} /> Novo
              </button>
            </div>

            <div className="space-y-1.5">
              {templates.filter(t => t.ativo).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTemplate(t.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer flex justify-between items-center ${
                    selectedTemplateId === t.id
                      ? 'bg-surface-elevated border-brand-primary text-white font-semibold'
                      : 'bg-surface-ground border-surface-border text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold truncate">{t.nome}</p>
                    <span className="text-[10px] text-slate-500 font-mono tabular-nums">{t.items.length} mesas</span>
                  </div>
                  {selectedTemplateId === t.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                  )}
                </button>
              ))}
            </div>

            {activeTemplate && (
              <div className="pt-3 border-t border-surface-border space-y-2">
                <label className="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  Nome do Template
                </label>
                <input
                  type="text"
                  value={activeTemplate.nome}
                  onChange={e => setActiveTemplate({ ...activeTemplate, nome: e.target.value })}
                  className="w-full input-util text-xs"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDuplicateTemplate}
                    className="flex-1 py-1.5 bg-surface-ground hover:bg-surface-elevated border border-surface-border text-slate-300 rounded-md text-xs font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Copy size={12} /> Duplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Painel de Propriedades da Mesa Selecionada */}
          {selectedItem ? (
            <div className="bg-surface-card p-4 rounded-xl border border-surface-border space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-surface-border">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Edit2 size={13} className="text-brand-accent" /> Propriedades
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveTableFromTemplate(selectedItem.id)}
                  className="text-status-danger hover:text-red-300 p-1 cursor-pointer transition-colors"
                  title="Excluir Mesa do Template"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-medium tracking-wider text-slate-400 uppercase mb-1">
                  Identificador
                </label>
                <input
                  type="text"
                  value={selectedItem.numeroIdentificador}
                  onChange={e => handleUpdateSelectedItem({ numeroIdentificador: e.target.value })}
                  className="w-full input-util text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium tracking-wider text-slate-400 uppercase mb-1">
                  Formato da Mesa
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'quadrada', label: 'Quadrada', icon: Square },
                    { id: 'redonda', label: 'Redonda', icon: Circle },
                    { id: 'retangular', label: 'Retangular', icon: RectangleHorizontal }
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => handleUpdateSelectedItem({ formato: fmt.id as any })}
                      className={`py-1.5 rounded-md border text-[11px] font-medium flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                        selectedItem.formato === fmt.id
                          ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-semibold'
                          : 'bg-surface-ground border-surface-border text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <fmt.icon size={13} />
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium tracking-wider text-slate-400 uppercase mb-1">
                  Capacidade (Lugares)
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[2, 4, 6, 8].map(cap => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => handleUpdateSelectedItem({ capacidade: cap })}
                      className={`py-1 rounded-md text-xs font-mono tabular-nums font-semibold border cursor-pointer transition-colors ${
                        selectedItem.capacidade === cap
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-surface-ground text-slate-400 border-surface-border hover:text-slate-200'
                      }`}
                    >
                      {cap}L
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums text-slate-400">
                <div className="bg-surface-ground p-2 rounded-lg border border-surface-border">
                  <span className="text-[10px] text-slate-500 block">Posição X</span>
                  <span className="font-semibold text-slate-200">{Math.round(selectedItem.posX)} px</span>
                </div>
                <div className="bg-surface-ground p-2 rounded-lg border border-surface-border">
                  <span className="text-[10px] text-slate-500 block">Posição Y</span>
                  <span className="font-semibold text-slate-200">{Math.round(selectedItem.posY)} px</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-card p-6 rounded-xl border border-surface-border text-center text-slate-500 space-y-1.5">
              <Move size={24} className="mx-auto opacity-30" />
              <p className="text-xs">Clique em qualquer mesa no mapa para editar suas propriedades.</p>
            </div>
          )}

        </div>

        {/* Coluna Central: Canvas Interativo do Salão */}
        <div className="lg:col-span-3 space-y-3">
          
          {/* Barra de Controle do Canvas */}
          <div className="bg-surface-card p-3 rounded-xl border border-surface-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddTableToTemplate}
                className="py-1.5 px-3 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={14} /> Adicionar Mesa
              </button>

              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-400 bg-surface-ground px-2.5 py-1.5 rounded-lg border border-surface-border">
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={e => setSnapToGrid(e.target.checked)}
                  className="rounded border-surface-border accent-brand-primary"
                />
                <span>Snap 20px</span>
              </label>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-status-free" />
              <span>Arraste as mesas livremente pelo salão para compor a planta mestre.</span>
            </div>
          </div>

          {/* Área de Canvas Bidimensional com Dot Grid */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative w-full h-[580px] bg-surface-ground dot-grid rounded-xl border border-surface-border overflow-hidden select-none"
          >
            {/* Linha indicadora de Entrada / Balcão */}
            <div className="absolute top-0 left-0 right-0 h-6 bg-surface-card/80 border-b border-surface-border flex items-center justify-center text-[10px] font-medium uppercase tracking-widest text-slate-500">
              FRENTE DE CAIXA / ENTRADA DO SALÃO
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
                    borderRadius: item.formato === 'redonda' ? '9999px' : '12px'
                  }}
                  className={`absolute cursor-grab active:cursor-grabbing transition-all flex flex-col justify-between p-2.5 border bg-surface-card ${
                    isSelected 
                      ? 'border-brand-primary ring-2 ring-brand-primary/40 z-30' 
                      : 'border-surface-border hover:border-surface-borderHover z-10'
                  } ${isDragging ? 'opacity-90 scale-105 z-40 shadow-xl' : 'shadow-xs'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white text-xs tracking-tight truncate">
                      {item.numeroIdentificador}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 flex items-center gap-0.5">
                      <Users size={10} /> {item.capacidade}
                    </span>
                  </div>

                  <div className="text-center my-auto">
                    <span className="text-[9px] uppercase font-medium tracking-wider text-slate-500 bg-surface-ground px-1.5 py-0.5 rounded border border-surface-border">
                      {item.formato}
                    </span>
                  </div>

                  <div className="text-[9px] font-mono tabular-nums text-slate-500 text-center">
                    ({Math.round(item.posX)}, {Math.round(item.posY)})
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
}
