'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

// === INSUMOS (Inventário) ===
export type StockStatus = 'ok' | 'acabando' | 'zerado';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  costPerUnit: number;
  currentStock: number;
  status: StockStatus;
}

// === PRODUTOS (Lanches/Combos) ===
export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

// === SUB-RECEITAS / PRÉ-PREPAROS (MAIONESES E MOLHOS) ===
export interface SubRecipeItem {
  id: string;
  parentIngredientId: string;
  childIngredientId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  category: 'lanche' | 'bebida' | 'porcao' | 'combo';
  priceBalcao: number;
  priceIfood: number;
  recipe: RecipeIngredient[];
}

// === VENDAS ===
export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  channel: 'balcao' | 'ifood';
  total: number;
  paymentMethod: string;
  items: SaleItem[];
  date: string;
  status: 'completed' | 'cancelled';
}

// === CAIXA EM NUVEM ===
export interface CashMovement {
  id: string;
  type: 'sangria' | 'suprimento';
  amount: number;
  description: string;
  date: string;
}

export interface CashSession {
  id: string;
  status: 'open' | 'closed';
  initialAmount: number;
  finalAmount?: number;
  openedBy: string;
  closedBy?: string;
  openedAt: string;
  closedAt?: string;
}

// === REGISTRO DE PERDAS (COZINHA) ===
export interface WasteRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costAtTime: number;
  totalLoss: number;
  reason: string;
  responsibleName: string;
  createdAt: string;
}

// === CHECKLIST DE COZINHA ===
export interface ChecklistTask {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: string;
}

export interface DailyChecklist {
  id: string;
  date: string;
  tasks: ChecklistTask[];
  signedBy?: string;
}

// === FORNECEDORES & COMPRAS (FASE 3) ===
export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  category: string;
  notes: string;
  createdAt?: string;
}

export interface PurchaseRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  supplierId?: string;
  supplierName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  createdAt: string;
}

// === AUDITORIA DE INVENTÁRIO FÍSICO (FASE 3) ===
export interface StockAuditItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  costPerUnit: number;
  systemStock: number;
  countedStock: number;
  diff: number;
  varianceCost: number;
}

export interface StockAudit {
  id: string;
  auditedBy: string;
  items: StockAuditItem[];
  totalVarianceCost: number;
  createdAt: string;
}

const defaultChecklistTasks: ChecklistTask[] = [
  { id: '1', label: 'Verificar o conteúdo do freezer e geladeiras e ver o que será necessário', checked: false },
  { id: '2', label: 'Verificar os pães e a integridade deles', checked: false },
  { id: '3', label: 'Verificar a quantidade de carne', checked: false },
  { id: '4', label: 'Verificar a lista de compras', checked: false },
  { id: '5', label: 'Verificar o freezer de verduras e queijos', checked: false },
];

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Caixa State (em Nuvem)
  const [isOpen, setIsOpen] = useState(false);
  const [activeCashSession, setActiveCashSession] = useState<CashSession | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);

  // Perdas State (em Nuvem)
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);

  // Checklist State
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [allChecklists, setAllChecklists] = useState<DailyChecklist[]>([]);

  // Fase 3 States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
  const [stockAudits, setStockAudits] = useState<StockAudit[]>([]);

  // Sub-receitas State
  const [subRecipes, setSubRecipes] = useState<SubRecipeItem[]>([]);

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      // 1. Fetch Inventory
      const { data: invData } = await supabase.from('inventory').select('*');
      if (invData) {
        setItems(invData.map(i => ({
          id: i.id, name: i.name, category: i.category, unit: i.unit, 
          costPerUnit: Number(i.cost_per_unit) || 0, 
          currentStock: Number(i.current_stock) || 0, 
          status: i.status
        })));
      }

      // 2. Fetch Products & Recipes
      const { data: prodData } = await supabase.from('products').select('*');
      const { data: recData } = await supabase.from('recipes').select('*');
      
      if (prodData) {
        setProducts(prodData.map(p => ({
          id: p.id, name: p.name, category: p.category, 
          priceBalcao: Number(p.price_balcao) || 0, 
          priceIfood: Number(p.price_ifood) || 0,
          recipe: (recData || []).filter(r => r.product_id === p.id).map(r => ({
            ingredientId: r.ingredient_id,
            quantity: Number(r.quantity) || 0
          }))
        })));
      }

      // 3. Fetch Sales
      const { data: salesData } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      const { data: saleItemsData } = await supabase.from('sale_items').select('*');
      
      if (salesData) {
        setSales(salesData.map(s => ({
          id: s.id, channel: s.channel, total: Number(s.total) || 0, paymentMethod: s.payment_method, 
          date: s.created_at, status: s.status,
          items: (saleItemsData || []).filter(i => i.sale_id === s.id).map(i => ({
            productId: i.product_id, productName: i.product_name, 
            quantity: Number(i.quantity) || 0, 
            unitPrice: Number(i.unit_price) || 0
          }))
        })));
      }

      // 4. Fetch Caixa Ativo (Sessão de Caixa em Nuvem)
      try {
        const { data: sessData } = await supabase
          .from('cash_sessions')
          .select('*')
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessData) {
          setActiveCashSession({
            id: sessData.id,
            status: sessData.status,
            initialAmount: Number(sessData.initial_amount) || 0,
            finalAmount: sessData.final_amount ? Number(sessData.final_amount) : undefined,
            openedBy: sessData.opened_by,
            closedBy: sessData.closed_by,
            openedAt: sessData.opened_at,
            closedAt: sessData.closed_at
          });
          setIsOpen(true);
        } else {
          setActiveCashSession(null);
          setIsOpen(false);
        }
      } catch (err) {
        console.warn('Tabela cash_sessions ainda não criada:', err);
      }

      // 5. Fetch Movimentações de Caixa
      try {
        const { data: movData } = await supabase
          .from('cash_movements')
          .select('*')
          .order('created_at', { ascending: false });

        if (movData) {
          setMovements(movData.map(m => ({
            id: m.id,
            type: m.type,
            amount: Number(m.amount) || 0,
            description: m.description,
            date: m.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela cash_movements ainda não criada:', err);
      }

      // 6. Fetch Perdas / Desperdícios
      try {
        const { data: wasteData } = await supabase
          .from('waste_records')
          .select('*')
          .order('created_at', { ascending: false });

        if (wasteData) {
          setWasteRecords(wasteData.map(w => ({
            id: w.id,
            ingredientId: w.ingredient_id,
            ingredientName: w.ingredient_name,
            quantity: Number(w.quantity) || 0,
            unit: w.unit,
            costAtTime: Number(w.cost_at_time) || 0,
            totalLoss: Number(w.total_loss) || 0,
            reason: w.reason,
            responsibleName: w.responsible_name,
            createdAt: w.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela waste_records ainda não criada:', err);
      }

      // 7. Fetch Daily Checklist & All Checklists
      const today = new Date().toLocaleDateString('en-CA');
      const { data: allChecks } = await supabase.from('kitchen_checklists').select('*').order('date', { ascending: false });
      
      if (allChecks) {
        const mappedChecks = allChecks.map(c => ({
          id: c.id,
          date: c.date,
          tasks: c.tasks,
          signedBy: c.signed_by
        }));
        setAllChecklists(mappedChecks);
        
        const todayCheck = mappedChecks.find(c => c.date === today);
        if (todayCheck) {
          setChecklist(todayCheck);
        } else {
          setChecklist({ id: '', date: today, tasks: defaultChecklistTasks });
        }
      } else {
        setChecklist({ id: '', date: today, tasks: defaultChecklistTasks });
      }

      // 8. Fetch Fornecedores (Fase 3)
      try {
        const { data: supData } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
        if (supData) {
          setSuppliers(supData.map(s => ({
            id: s.id,
            name: s.name,
            contactName: s.contact_name || '',
            phone: s.phone || '',
            category: s.category || 'Geral',
            notes: s.notes || '',
            createdAt: s.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela suppliers ainda não criada:', err);
      }

      // 9. Fetch Histórico de Compras (Fase 3)
      try {
        const { data: purchData } = await supabase.from('purchase_records').select('*').order('created_at', { ascending: false });
        if (purchData) {
          setPurchaseRecords(purchData.map(p => ({
            id: p.id,
            ingredientId: p.ingredient_id,
            ingredientName: p.ingredient_name,
            supplierId: p.supplier_id,
            supplierName: p.supplier_name || 'Diversos',
            quantity: Number(p.quantity) || 0,
            unit: p.unit,
            costPerUnit: Number(p.cost_per_unit) || 0,
            totalCost: Number(p.total_cost) || 0,
            createdAt: p.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela purchase_records ainda não criada:', err);
      }

      // 10. Fetch Auditorias de Inventário (Fase 3)
      try {
        const { data: auditData } = await supabase.from('stock_audits').select('*').order('created_at', { ascending: false });
        if (auditData) {
          setStockAudits(auditData.map(a => ({
            id: a.id,
            auditedBy: a.audited_by,
            items: a.items || [],
            totalVarianceCost: Number(a.total_variance_cost) || 0,
            createdAt: a.created_at
          })));
        }
      } catch (err) {
        console.warn('Tabela stock_audits ainda não criada:', err);
      }

      // 11. Fetch Sub-Receitas
      try {
        const { data: subData } = await supabase.from('sub_recipes').select('*');
        if (subData) {
          setSubRecipes(subData.map(s => ({
            id: s.id,
            parentIngredientId: s.parent_ingredient_id,
            childIngredientId: s.child_ingredient_id,
            quantity: Number(s.quantity) || 0
          })));
        }
      } catch (err) {
        console.warn('Tabela sub_recipes ainda não criada:', err);
      }

      setIsLoaded(true);
    };

    loadData();
  }, []);

  // --- INSUMOS ACTIONS ---
  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    try {
      const { data, error } = await supabase.from('inventory').insert({
        name: item.name, category: item.category, unit: item.unit, 
        cost_per_unit: item.costPerUnit, current_stock: item.currentStock, status: item.status
      }).select().single();
      
      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        alert(`Erro ao salvar no banco: ${error.message}`);
        return;
      }
      
      if (data) setItems([...items, { ...item, id: data.id }]);
    } catch (err: any) {
      alert(`Erro inesperado: ${err.message}`);
    }
  };
  
  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.costPerUnit !== undefined) dbUpdates.cost_per_unit = updates.costPerUnit;
    if (updates.currentStock !== undefined) dbUpdates.current_stock = updates.currentStock;
    if (updates.status !== undefined) dbUpdates.status = updates.status;

    await supabase.from('inventory').update(dbUpdates).eq('id', id);
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeInventoryItem = async (id: string) => {
    await supabase.from('inventory').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
  };

  const updateStatus = async (id: string, newStatus: StockStatus, remainingQuantity?: number) => {
    const updates: Partial<InventoryItem> = { status: newStatus };
    if (remainingQuantity !== undefined) updates.currentStock = remainingQuantity;
    await updateInventoryItem(id, updates);
  };

  const registerPurchase = async (id: string, quantity: number, newCost: number) => {
    const item = items.find(i => i.id === id);
    if (item) {
      await updateInventoryItem(id, { currentStock: item.currentStock + quantity, costPerUnit: newCost, status: 'ok' });
    }
  };

  // --- REGISTRO DE COMPRA COM FORNECEDOR (FASE 3) ---
  const recordPurchaseWithSupplier = async (
    ingredientId: string, 
    quantity: number, 
    newCost: number,
    supplierId?: string,
    supplierName?: string
  ) => {
    const item = items.find(i => i.id === ingredientId);
    if (!item) return { success: false, error: 'Insumo não encontrado' };

    const totalCost = quantity * newCost;
    const finalSupplierName = supplierName || 'Diversos / Não Informado';

    try {
      // 1. Inserir histórico de compras
      const { data: pData } = await supabase.from('purchase_records').insert({
        ingredient_id: ingredientId,
        ingredient_name: item.name,
        supplier_id: supplierId || null,
        supplier_name: finalSupplierName,
        quantity,
        unit: item.unit,
        cost_per_unit: newCost,
        total_cost: totalCost
      }).select().single();

      // 2. Atualizar estoque e custo unitário
      await updateInventoryItem(ingredientId, {
        currentStock: item.currentStock + quantity,
        costPerUnit: newCost,
        status: 'ok'
      });

      if (pData) {
        const newRecord: PurchaseRecord = {
          id: pData.id,
          ingredientId: pData.ingredient_id,
          ingredientName: pData.ingredient_name,
          supplierId: pData.supplier_id,
          supplierName: pData.supplier_name,
          quantity: Number(pData.quantity),
          unit: pData.unit,
          costPerUnit: Number(pData.cost_per_unit),
          totalCost: Number(pData.total_cost),
          createdAt: pData.created_at
        };
        setPurchaseRecords([newRecord, ...purchaseRecords]);
      }

      return { success: true };
    } catch (err: any) {
      // Fallback
      await registerPurchase(ingredientId, quantity, newCost);
      return { success: true };
    }
  };

  // --- FORNECEDORES ACTIONS (FASE 3) ---
  const addSupplier = async (sup: Omit<Supplier, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase.from('suppliers').insert({
        name: sup.name,
        contact_name: sup.contactName,
        phone: sup.phone,
        category: sup.category,
        notes: sup.notes
      }).select().single();

      if (error) {
        alert(`Erro ao salvar fornecedor: ${error.message}`);
        return;
      }

      if (data) {
        setSuppliers([...suppliers, {
          id: data.id,
          name: data.name,
          contactName: data.contact_name,
          phone: data.phone,
          category: data.category,
          notes: data.notes,
          createdAt: data.created_at
        }]);
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase.from('suppliers').update(dbUpdates).eq('id', id);
    setSuppliers(suppliers.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSupplier = async (id: string) => {
    await supabase.from('suppliers').delete().eq('id', id);
    setSuppliers(suppliers.filter(s => s.id !== id));
  };

  // --- AUDITORIA DE INVENTÁRIO FÍSICO (FASE 3) ---
  const saveStockAudit = async (auditedBy: string, auditItems: StockAuditItem[], totalVarianceCost: number) => {
    try {
      // 1. Salvar relatório da auditoria
      const { data: aData, error: aErr } = await supabase.from('stock_audits').insert({
        audited_by: auditedBy,
        items: auditItems,
        total_variance_cost: totalVarianceCost
      }).select().single();

      if (aErr) {
        console.error('Erro ao salvar auditoria:', aErr);
      }

      // 2. Ajustar saldos de estoque no banco para cada insumo contado
      for (const ai of auditItems) {
        if (ai.diff !== 0) {
          await updateInventoryItem(ai.id, { currentStock: ai.countedStock });
        }
      }

      if (aData) {
        const newAudit: StockAudit = {
          id: aData.id,
          auditedBy: aData.audited_by,
          items: aData.items,
          totalVarianceCost: Number(aData.total_variance_cost),
          createdAt: aData.created_at
        };
        setStockAudits([newAudit, ...stockAudits]);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // --- PERDAS / DESPERDÍCIO (COZINHA) ---
  const registerWaste = async (ingredientId: string, quantity: number, reason: string, responsibleName: string) => {
    const ing = items.find(i => i.id === ingredientId);
    if (!ing) return { success: false, error: 'Insumo não encontrado no cadastro.' };

    const costAtTime = ing.costPerUnit;
    const totalLoss = costAtTime * quantity;

    try {
      const { data: wData, error: wErr } = await supabase.from('waste_records').insert({
        ingredient_id: ingredientId,
        ingredient_name: ing.name,
        quantity,
        unit: ing.unit,
        cost_at_time: costAtTime,
        total_loss: totalLoss,
        reason,
        responsible_name: responsibleName
      }).select().single();

      if (wErr) {
        console.error('Erro ao registrar perda:', wErr);
      }

      const newStock = Math.max(0, ing.currentStock - quantity);
      await updateInventoryItem(ingredientId, { currentStock: newStock });

      const newRecord: WasteRecord = {
        id: wData ? wData.id : Math.random().toString(36).substring(2, 9),
        ingredientId,
        ingredientName: ing.name,
        quantity,
        unit: ing.unit,
        costAtTime,
        totalLoss,
        reason,
        responsibleName,
        createdAt: wData ? wData.created_at : new Date().toISOString()
      };

      setWasteRecords([newRecord, ...wasteRecords]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getTotalWasteCost = () => {
    return wasteRecords.reduce((acc, w) => acc + (w.totalLoss || 0), 0);
  };

  // --- PRODUTOS ACTIONS ---
  const addProduct = async (prod: Omit<Product, 'id'>) => {
    const { data: pData } = await supabase.from('products').insert({
      name: prod.name, category: prod.category, price_balcao: prod.priceBalcao, price_ifood: prod.priceIfood
    }).select().single();
    
    if (pData) {
      if (prod.recipe && prod.recipe.length > 0) {
        const recipeInserts = prod.recipe.map(r => ({
          product_id: pData.id, ingredient_id: r.ingredientId, quantity: r.quantity
        }));
        await supabase.from('recipes').insert(recipeInserts);
      }
      setProducts([...products, { ...prod, id: pData.id }]);
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    await supabase.from('products').update({
      name: updates.name, category: updates.category, 
      price_balcao: updates.priceBalcao, price_ifood: updates.priceIfood
    }).eq('id', id);

    if (updates.recipe) {
      await supabase.from('recipes').delete().eq('product_id', id);
      if (updates.recipe.length > 0) {
        const recipeInserts = updates.recipe.map(r => ({
          product_id: id, ingredient_id: r.ingredientId, quantity: r.quantity
        }));
        await supabase.from('recipes').insert(recipeInserts);
      }
    }

    setProducts(products.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProduct = async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    setProducts(products.filter(p => p.id !== id));
  };

  // Cálculo de custo real do insumo (com suporte a sub-receitas de maioneses e molhos)
  const getIngredientTrueCost = (ingId: string, visited = new Set<string>()): number => {
    const ing = items.find(i => i.id === ingId);
    if (!ing) return 0;
    if (visited.has(ingId)) return ing.costPerUnit;
    visited.add(ingId);

    const children = subRecipes.filter(s => s.parentIngredientId === ingId);
    if (children.length === 0) return ing.costPerUnit;

    const calculated = children.reduce((acc, child) => {
      const childCost = getIngredientTrueCost(child.childIngredientId, new Set(visited));
      return acc + (childCost * child.quantity);
    }, 0);

    return calculated > 0 ? calculated : ing.costPerUnit;
  };

  const getProductCmv = (recipe: RecipeIngredient[]) => {
    return recipe.reduce((total, recipeItem) => {
      const unitCost = getIngredientTrueCost(recipeItem.ingredientId);
      return total + (unitCost * recipeItem.quantity);
    }, 0);
  };

  const saveSubRecipe = async (parentIngredientId: string, components: { childIngredientId: string; quantity: number }[]) => {
    try {
      await supabase.from('sub_recipes').delete().eq('parent_ingredient_id', parentIngredientId);
      if (components.length > 0) {
        const inserts = components.map(c => ({
          parent_ingredient_id: parentIngredientId,
          child_ingredient_id: c.childIngredientId,
          quantity: c.quantity
        }));
        await supabase.from('sub_recipes').insert(inserts);
      }

      const remaining = subRecipes.filter(s => s.parentIngredientId !== parentIngredientId);
      const newItems: SubRecipeItem[] = components.map(c => ({
        id: Math.random().toString(36).substring(2, 9),
        parentIngredientId,
        childIngredientId: c.childIngredientId,
        quantity: c.quantity
      }));
      setSubRecipes([...remaining, ...newItems]);

      // Atualizar o custo do insumo pai no banco com o novo valor somado
      const calculatedCost = components.reduce((acc, c) => {
        const childIng = items.find(i => i.id === c.childIngredientId);
        return acc + ((childIng?.costPerUnit || 0) * c.quantity);
      }, 0);

      if (calculatedCost > 0) {
        await updateInventoryItem(parentIngredientId, { costPerUnit: calculatedCost });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getRealSalesCmv = () => {
    const completedSales = sales.filter(s => s.status === 'completed');
    let totalCmv = 0;
    
    completedSales.forEach(sale => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product && product.recipe && product.recipe.length > 0) {
            totalCmv += getProductCmv(product.recipe) * item.quantity;
          } else {
            totalCmv += (item.unitPrice * 0.30) * item.quantity;
          }
        });
      } else {
        totalCmv += sale.total * 0.30;
      }
    });

    return totalCmv;
  };

  // --- CAIXA ACTIONS (EM NUVEM) ---
  const openCaixa = async (initialAmount: number, operatorName: string) => {
    try {
      const { data } = await supabase.from('cash_sessions').insert({
        status: 'open',
        initial_amount: initialAmount,
        opened_by: operatorName,
        opened_at: new Date().toISOString()
      }).select().single();

      if (data) {
        setActiveCashSession({
          id: data.id,
          status: 'open',
          initialAmount: Number(data.initial_amount),
          openedBy: data.opened_by,
          openedAt: data.opened_at
        });
      }
      setIsOpen(true);
    } catch {
      setIsOpen(true);
    }
  };

  const closeCaixa = async (finalAmount: number, operatorName: string) => {
    if (activeCashSession) {
      try {
        await supabase.from('cash_sessions').update({
          status: 'closed',
          final_amount: finalAmount,
          closed_by: operatorName,
          closed_at: new Date().toISOString()
        }).eq('id', activeCashSession.id);
      } catch (err) {
        console.error('Erro ao fechar caixa no banco:', err);
      }
    }
    setActiveCashSession(null);
    setIsOpen(false);
  };

  const toggleCaixa = (status: boolean) => {
    if (status) {
      openCaixa(0, 'Operador');
    } else {
      closeCaixa(0, 'Operador');
    }
  };

  const addSale = async (sale: Omit<Sale, 'id' | 'date' | 'status'>) => {
    const { data: sData } = await supabase.from('sales').insert({
      channel: sale.channel, total: sale.total, payment_method: sale.paymentMethod
    }).select().single();

    if (sData) {
      if (sale.items && sale.items.length > 0) {
        const saleItems = sale.items.map(i => ({
          sale_id: sData.id, product_id: i.productId, product_name: i.productName,
          quantity: i.quantity, unit_price: i.unitPrice
        }));
        await supabase.from('sale_items').insert(saleItems);
        
        // Simular o trigger localmente para refletir na UI imediatamente
        const newItems = [...items];
        sale.items.forEach(si => {
          const prod = products.find(p => p.id === si.productId);
          if (prod) {
            prod.recipe.forEach(r => {
              const invIdx = newItems.findIndex(inv => inv.id === r.ingredientId);
              if (invIdx > -1) {
                newItems[invIdx] = { ...newItems[invIdx], currentStock: newItems[invIdx].currentStock - (r.quantity * si.quantity) };
              }
            });
          }
        });
        setItems(newItems);
      }
      
      const newSaleLocal: Sale = {
        ...sale,
        id: sData.id,
        date: sData.created_at,
        status: 'completed'
      };
      setSales([newSaleLocal, ...sales]);
    }
  };

  const cancelSale = async (id: string) => {
    await supabase.from('sales').update({ status: 'cancelled' }).eq('id', id);
    
    // Estornar estoque localmente
    const saleToCancel = sales.find(s => s.id === id);
    if (saleToCancel && saleToCancel.items) {
      const restoredItems = [...items];
      saleToCancel.items.forEach(si => {
        const prod = products.find(p => p.id === si.productId);
        if (prod) {
          prod.recipe.forEach(r => {
            const invIdx = restoredItems.findIndex(inv => inv.id === r.ingredientId);
            if (invIdx > -1) {
              restoredItems[invIdx] = { 
                ...restoredItems[invIdx], 
                currentStock: restoredItems[invIdx].currentStock + (r.quantity * si.quantity) 
              };
            }
          });
        }
      });
      setItems(restoredItems);
    }

    setSales(sales.map(s => s.id === id ? { ...s, status: 'cancelled' } : s));
  };

  const addMovement = async (mov: Omit<CashMovement, 'id' | 'date'>) => {
    try {
      const { data } = await supabase.from('cash_movements').insert({
        type: mov.type,
        amount: mov.amount,
        description: mov.description
      }).select().single();

      const newMov: CashMovement = {
        id: data ? data.id : Math.random().toString(36).substr(2, 9),
        type: mov.type,
        amount: mov.amount,
        description: mov.description,
        date: data ? data.created_at : new Date().toISOString()
      };

      setMovements([newMov, ...movements]);
    } catch {
      const fallbackMov: CashMovement = {
        id: Math.random().toString(36).substr(2, 9),
        type: mov.type,
        amount: mov.amount,
        description: mov.description,
        date: new Date().toISOString()
      };
      setMovements([fallbackMov, ...movements]);
    }
  };

  // --- CHECKLIST ACTIONS ---
  const toggleChecklistTask = async (taskId: string, personName: string) => {
    if (!checklist) return;
    
    const updatedTasks = checklist.tasks.map(t => 
      t.id === taskId 
        ? { ...t, checked: !t.checked, checkedBy: !t.checked ? personName : undefined } 
        : t
    );
    
    const newChecklist = { ...checklist, tasks: updatedTasks };
    setChecklist(newChecklist);

    if (checklist.id === '') {
      const { data, error } = await supabase.from('kitchen_checklists').insert({
        date: checklist.date,
        tasks: updatedTasks
      }).select().single();
      
      if (data) setChecklist({ ...newChecklist, id: data.id });
      if (error) console.error(error);
    } else {
      await supabase.from('kitchen_checklists').update({ tasks: updatedTasks }).eq('id', checklist.id);
    }
  };

  const signChecklist = async (personName: string) => {
    if (!checklist || checklist.id === '') return;
    const newChecklist = { ...checklist, signedBy: personName };
    setChecklist(newChecklist);
    await supabase.from('kitchen_checklists').update({ signed_by: personName }).eq('id', checklist.id);
  };

  return { 
    items, addInventoryItem, updateInventoryItem, removeInventoryItem, updateStatus, registerPurchase,
    products, addProduct, updateProduct, removeProduct, getProductCmv, getRealSalesCmv,
    isLoaded, isOpen, activeCashSession, openCaixa, closeCaixa, toggleCaixa,
    sales, addSale, cancelSale,
    movements, addMovement,
    wasteRecords, registerWaste, getTotalWasteCost,
    checklist, toggleChecklistTask, signChecklist, allChecklists,
    suppliers, addSupplier, updateSupplier, removeSupplier,
    purchaseRecords, recordPurchaseWithSupplier,
    stockAudits, saveStockAudit,
    subRecipes, saveSubRecipe, getIngredientTrueCost
  };
}
