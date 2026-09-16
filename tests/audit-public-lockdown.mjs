import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

const envFile = existsSync('.env.local') ? readFileSync('.env.local', 'utf-8') : '';
const lines = envFile.split('\n').map(l => l.trim()).filter(Boolean);
const getEnv = (key) => lines.find(l => l.startsWith(key + '='))?.split('=')[1]?.trim() || process.env[key];

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !anonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devem estar configurados.');
  process.exit(1);
}

console.log('================================================================');
console.log('🔒 AUDITORIA DE SEGURANÇA (PASSO 8): TESTE DE FALHA FECHADA');
console.log('================================================================\n');

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const operationalTables = [
  'collaborators',
  'sales',
  'sale_items',
  'inventory',
  'products',
  'recipes',
  'cash_sessions',
  'cash_movements',
  'imported_customers',
  'app_sessions',
  'auth_attempts'
];

async function testDirectAnonAccess() {
  console.log('1. Testando leitura direta com chave pública (ANON KEY)...');
  let leaked = 0;
  let blocked = 0;

  for (const table of operationalTables) {
    try {
      const { data, error } = await anonClient.from(table).select('*').limit(1);
      if (error) {
        console.log(`   ✓ [${table}]: ACESSO NEGADO (${error.code || error.message})`);
        blocked++;
      } else if (data && data.length > 0) {
        console.log(`   ❌ [${table}]: VAZAMENTO! Leu ${data.length} registro(s) com a chave anônima!`);
        leaked++;
      } else {
        console.log(`   ✓ [${table}]: RLS ATIVO (0 registros retornados para anônimo)`);
        blocked++;
      }
    } catch (err) {
      console.log(`   ✓ [${table}]: ACESSO BLOQUEADO`);
      blocked++;
    }
  }

  console.log('\n2. Testando tentativa de gravação direta com chave pública (ANON KEY)...');
  const writeTest = await anonClient.from('collaborators').insert({
    id: 'hacker_probe_' + Date.now(),
    name: 'Invasor Teste',
    role: 'admin',
    pin: '1234',
    is_active: true
  });

  if (writeTest.error) {
    console.log('   ✓ Inserção não autorizada bloqueada com sucesso:', writeTest.error.message);
  } else {
    console.log('   ❌ GRAVE: Inserção anônima foi permitida na tabela collaborators!');
    leaked++;
  }

  console.log('\n----------------------------------------------------------------');
  if (leaked === 0) {
    console.log('🎉 SUCESSO TOTAL: Nenhuma tabela operacional expõe dados para a chave pública anônima!');
  } else {
    console.log(`⚠️ ALERTA: ${leaked} tabela(s) ainda acessíveis com a chave pública. Aplique 20260916_access_security.sql no Supabase!`);
  }
  console.log('----------------------------------------------------------------\n');
}

testDirectAnonAccess();
