import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Caminho do arquivo de dados local no servidor
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'imported_customers.json');

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function readLocalCustomers(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('Erro ao ler data/imported_customers.json:', err);
  }
  return [];
}

function writeLocalCustomers(customers: any[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(customers), 'utf-8');
  } catch (err) {
    console.error('Erro ao escrever data/imported_customers.json:', err);
  }
}

// GET: Recupera os clientes importados sincronizados
export async function GET() {
  try {
    // 1. Tenta recuperar do Supabase se a tabela existir
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('imported_customers')
          .select('*')
          .order('name', { ascending: true })
          .limit(5000);

        if (!error && data && data.length > 0) {
          const mapped = data.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || undefined,
            address: c.address || undefined,
            number: c.number || undefined,
            neighborhood: c.neighborhood || undefined,
            city: c.city || undefined,
            complement: c.complement || undefined,
            fullAddress: c.full_address || undefined,
            totalOrders: c.total_orders || 1,
            lastOrderDate: c.last_order_date || undefined,
            source: c.source || 'cardapio_web',
            importedAt: c.imported_at || new Date().toISOString()
          }));

          // Atualiza cache local do servidor
          writeLocalCustomers(mapped);

          return NextResponse.json({ success: true, source: 'supabase', customers: mapped });
        }
      } catch (err) {
        // Fallback silencioso para arquivo local
      }
    }

    // 2. Fallback: Lê do arquivo local do servidor
    const local = readLocalCustomers();
    return NextResponse.json({ success: true, source: 'local_server', customers: local });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, customers: [] }, { status: 500 });
  }
}

// POST: Salva ou mescla novos clientes importados
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const incomingCustomers = Array.isArray(body.customers) ? body.customers : [];
    const mode = body.mode === 'replace' ? 'replace' : 'merge';

    if (incomingCustomers.length === 0) {
      return NextResponse.json({ success: false, message: 'Nenhum cliente fornecido' }, { status: 400 });
    }

    let finalCustomers = incomingCustomers;
    if (mode === 'merge') {
      const current = readLocalCustomers();
      const map = new Map<string, any>();
      current.forEach((c: any) => map.set(c.id, c));
      incomingCustomers.forEach((c: any) => map.set(c.id, c));
      finalCustomers = Array.from(map.values());
    }

    // 1. Grava no disco local do servidor
    writeLocalCustomers(finalCustomers);

    // 2. Grava no Supabase se disponível (em lotes de 100)
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const rows = finalCustomers.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone || null,
          address: c.address || null,
          number: c.number || null,
          neighborhood: c.neighborhood || null,
          city: c.city || null,
          complement: c.complement || null,
          full_address: c.fullAddress || null,
          total_orders: c.totalOrders || 1,
          last_order_date: c.lastOrderDate || null,
          source: c.source || 'cardapio_web',
          imported_at: c.importedAt || new Date().toISOString()
        }));

        // Batch upsert
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          await supabase.from('imported_customers').upsert(batch, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Aviso: Supabase imported_customers não pôde ser atualizado (tabela pendente de migração):', err);
      }
    }

    return NextResponse.json({
      success: true,
      totalSaved: finalCustomers.length,
      mode
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Limpa base importada
export async function DELETE() {
  try {
    writeLocalCustomers([]);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('imported_customers').delete().neq('id', 'keep_empty');
      } catch {}
    }
    return NextResponse.json({ success: true, message: 'Base de clientes importados limpa com sucesso' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
