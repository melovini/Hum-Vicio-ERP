// Script de Backup Automatizado do Hum Vício ERP
// Exporta snapshot estruturado com hashes criptográficos SHA-256 de integridade.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TABLES_IN_ORDER = [
  'collaborators',
  'products',
  'inventory',
  'recipes',
  'sub_recipes',
  'customers',
  'suppliers',
  'purchase_records',
  'waste_records',
  'daily_checklists',
  'cash_sessions',
  'cash_movements',
  'sales',
  'sale_items',
  'payment_events',
  'inventory_movements',
  'audit_logs'
];

export async function createDatabaseBackup(customDb = null, options = {}) {
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let db = customDb;
  if (!db) {
    if (!url || !key) {
      throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL para gerar o backup.');
    }
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  const timestamp = new Date().toISOString();
  const snapshot = {
    version: '1.0',
    createdAt: timestamp,
    system: 'Hum Vício ERP',
    tables: {},
    tableCounts: {},
    checksums: {}
  };

  console.log(`[Backup] Iniciando snapshot do banco em ${timestamp}...`);

  for (const table of TABLES_IN_ORDER) {
    try {
      const { data, error } = await db.from(table).select('*');
      if (error) {
        console.warn(`[Backup] Aviso: falha ao ler tabela "${table}": ${error.message}`);
        snapshot.tables[table] = [];
        snapshot.tableCounts[table] = 0;
      } else {
        const rows = Array.isArray(data) ? data : [];
        snapshot.tables[table] = rows;
        snapshot.tableCounts[table] = rows.length;

        // Checksum SHA-256 individual por tabela
        const tableJson = JSON.stringify(rows);
        snapshot.checksums[table] = createHash('sha256').update(tableJson).digest('hex');
        console.log(`[Backup] Tabela "${table}": ${rows.length} registros (SHA-256: ${snapshot.checksums[table].slice(0, 8)}...)`);
      }
    } catch (err) {
      console.warn(`[Backup] Erro inesperado na tabela "${table}":`, err.message);
      snapshot.tables[table] = [];
      snapshot.tableCounts[table] = 0;
    }
  }

  // Checksum global do snapshot completo
  const snapshotJson = JSON.stringify(snapshot, null, 2);
  const globalHash = createHash('sha256').update(snapshotJson).digest('hex');
  snapshot.globalChecksum = globalHash;

  if (!isDryRun) {
    const backupDir = resolve(__dirname, '../backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const safeDate = timestamp.replace(/[:.]/g, '-');
    const filename = `backup-${safeDate}.json`;
    const targetPath = resolve(backupDir, filename);

    writeFileSync(targetPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`\n[Backup Concluído] Snapshot gravado em: ${targetPath}`);
    console.log(`[Checksum Global]: ${globalHash}\n`);
  } else {
    console.log('\n[Dry-Run] Backup simulado com sucesso sem escrita em disco.\n');
  }

  return snapshot;
}

// Execução direta via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createDatabaseBackup().catch(err => {
    console.error('[Backup Falhou]:', err.message);
    process.exit(1);
  });
}
