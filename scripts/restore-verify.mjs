// Script de Simulação e Verificação de Integridade de Backup do Hum Vício ERP
// Valida integridade referencial, conciliação contábil, integridade de hashes e checksums.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function verifySnapshotIntegrity(snapshot) {
  const issues = [];
  const report = {
    valid: false,
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    tablesChecked: 0,
    rowsChecked: 0,
    referentialChecks: 0,
    financialChecks: 0,
    credentialChecks: 0,
    issues
  };

  if (!snapshot.tables || typeof snapshot.tables !== 'object') {
    issues.push('Snapshot corrompido: campo "tables" não encontrado.');
    return report;
  }

  // 1. Verificação de Checksums SHA-256 por tabela
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    report.tablesChecked++;
    report.rowsChecked += rows.length;

    if (snapshot.checksums && snapshot.checksums[table]) {
      const computedHash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
      if (computedHash !== snapshot.checksums[table]) {
        issues.push(`Tabela "${table}": Checksum SHA-256 divergente! Esperado ${snapshot.checksums[table]}, calculado ${computedHash}. Dados podem ter sido alterados.`);
      }
    }
  }

  const {
    collaborators = [],
    products = [],
    inventory = [],
    recipes = [],
    sales = [],
    sale_items = [],
    cash_sessions = [],
    cash_movements = [],
    payment_events = []
  } = snapshot.tables;

  const productIds = new Set(products.map(p => p.id));
  const inventoryIds = new Set(inventory.map(i => i.id));
  const saleIds = new Set(sales.map(s => s.id));
  const cashSessionIds = new Set(cash_sessions.map(cs => cs.id));

  // 2. Integridade Referencial: Receitas -> Produtos e Insumos
  for (const r of recipes) {
    report.referentialChecks++;
    if (r.product_id && !productIds.has(r.product_id)) {
      issues.push(`Receita referencia produto inexistente (product_id: ${r.product_id}).`);
    }
    if (r.ingredient_id && !inventoryIds.has(r.ingredient_id)) {
      issues.push(`Receita referencia insumo inexistente (ingredient_id: ${r.ingredient_id}).`);
    }
  }

  // 3. Integridade Referencial: Itens de Venda -> Vendas
  for (const si of sale_items) {
    report.referentialChecks++;
    if (si.sale_id && !saleIds.has(si.sale_id)) {
      issues.push(`Item de venda #${si.id} referencia venda inexistente (sale_id: ${si.sale_id}).`);
    }
  }

  // 4. Integridade Referencial: Movimentos de Caixa -> Sessões de Caixa
  for (const mov of cash_movements) {
    report.referentialChecks++;
    if (mov.session_id && !cashSessionIds.has(mov.session_id)) {
      issues.push(`Movimento de caixa #${mov.id} referencia sessão inexistente (session_id: ${mov.session_id}).`);
    }
  }

  // 5. Integridade Referencial: Eventos de Pagamento -> Vendas
  for (const pe of payment_events) {
    report.referentialChecks++;
    if (pe.sale_id && !saleIds.has(pe.sale_id)) {
      issues.push(`Evento de pagamento #${pe.id} referencia comanda inexistente (sale_id: ${pe.sale_id}).`);
    }
  }

  // 6. Proteção de Credenciais: Hashes scrypt
  for (const c of collaborators) {
    report.credentialChecks++;
    if (c.pin) {
      if (!c.pin.startsWith('scrypt$')) {
        issues.push(`Colaborador "${c.name}" (ID: ${c.id}) possui credencial fora do padrão seguro scrypt! Possível vazamento em texto puro.`);
      }
    }
  }

  // 7. Conciliação Matemática e Financeira
  for (const s of sales) {
    report.financialChecks++;
    const total = Number(s.total);

    if (s.subtotal !== null && s.subtotal !== undefined && Number(s.subtotal) > 0) {
      const subtotal = Number(s.subtotal);
      const discount = Number(s.discount || 0);
      const deliveryFee = Number(s.delivery_fee || 0);
      const calculatedTotal = subtotal - discount + deliveryFee;

      if (Math.abs(calculatedTotal - total) > 0.05) {
        issues.push(`Venda #${s.id.slice(0, 6)} possui divergência matemática: Subtotal(${subtotal.toFixed(2)}) - Desconto(${discount.toFixed(2)}) + Entrega(${deliveryFee.toFixed(2)}) = ${calculatedTotal.toFixed(2)}, mas Total gravado é ${total.toFixed(2)}.`);
      }
    } else {
      // Em vendas legadas onde o subtotal não foi discriminado separadamente, valida se total é válido
      if (total <= 0 && s.status !== 'cancelled') {
        issues.push(`Venda #${s.id.slice(0, 6)} possui valor total inválido: R$ ${total.toFixed(2)}.`);
      }
    }
  }

  report.valid = issues.length === 0;
  return report;
}

// Execução direta via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const backupDir = resolve(__dirname, '../backups');
  let targetFile = process.argv[2];

  if (!targetFile && existsSync(backupDir)) {
    const files = readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
    if (files.length > 0) {
      targetFile = resolve(backupDir, files[0]);
      console.log(`[Verify] Nenhum arquivo informado. Utilizando snapshot mais recente: ${files[0]}`);
    }
  }

  if (!targetFile || !existsSync(targetFile)) {
    console.error('[Verify Erro]: Nenhum arquivo de backup encontrado para verificação.');
    process.exit(1);
  }

  console.log(`[Verify] Lendo e validando snapshot: ${targetFile}...`);
  const rawData = readFileSync(targetFile, 'utf-8');
  const snapshot = JSON.parse(rawData);

  const report = verifySnapshotIntegrity(snapshot);

  console.log('\n======================================================');
  console.log('       RELATÓRIO DE INTEGRIDADE DO BACKUP');
  console.log('======================================================');
  console.log(`Data do Snapshot:       ${report.createdAt}`);
  console.log(`Tabelas Verificadas:    ${report.tablesChecked}`);
  console.log(`Linhas Auditadas:       ${report.rowsChecked}`);
  console.log(`Checagens Relacionais:  ${report.referentialChecks}`);
  console.log(`Checagens Financeiras:  ${report.financialChecks}`);
  console.log(`Checagens Credenciais:  ${report.credentialChecks}`);
  console.log('------------------------------------------------------');

  if (report.valid) {
    console.log('STATUS: APROVADO! O snapshot é íntegro e seguro para restauração.\n');
  } else {
    console.error(`STATUS: REPROVADO! Foram encontrados ${report.issues.length} problema(s):`);
    report.issues.forEach((iss, idx) => console.error(` [${idx + 1}] ${iss}`));
    console.log('');
    process.exit(1);
  }
}
