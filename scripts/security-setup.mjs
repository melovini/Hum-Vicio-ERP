// Executado apenas pelo administrador no servidor; nunca expõe credenciais.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { credentialAllowed, hashCredential } from '../src/lib/security/credentials.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL no servidor.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const password = process.env.SECURITY_ADMIN_PASSWORD;
const reset = process.argv.includes('--reset-admin');
const { data: people, error } = await db.from('collaborators').select('id,pin,role,is_active');
if (error) throw new Error('Aplique a migração de segurança antes de executar esta preparação.');
const strongAdmin = people.some(p => p.role === 'admin' && p.is_active &&
  (p.pin.startsWith('scrypt$') || credentialAllowed(p.pin, 'admin')));
if (reset || !strongAdmin) {
  if (!credentialAllowed(password, 'admin')) throw new Error('Defina SECURITY_ADMIN_PASSWORD com pelo menos 12 caracteres para criar ou recuperar o administrador.');
  const { error: saveError } = await db.from('collaborators').upsert({
    id: 'security_admin', name: 'Administrador', role: 'admin', pin: await hashCredential(password),
    is_active: true, updated_at: new Date().toISOString(),
  });
  if (saveError) throw new Error('Não foi possível preparar o administrador.');
}
let migrated = 0;
let disabled = 0;
for (const person of people) {
  if ((person.id === 'security_admin' && (reset || !strongAdmin)) || person.pin.startsWith('scrypt$')) continue;
  const allowed = credentialAllowed(person.pin, person.role);
  const { error: updateError } = await db.from('collaborators').update({
    pin: await hashCredential(allowed ? person.pin : randomBytes(32).toString('hex')),
    is_active: allowed && person.is_active, updated_at: new Date().toISOString(),
  }).eq('id', person.id);
  if (updateError) throw new Error('Migração interrompida. Corrija a configuração e execute novamente.');
  migrated++;
  if (!allowed) disabled++;
}
const { error: revokeError } = await db.from('app_sessions').delete().not('id', 'is', null);
if (revokeError) throw new Error('Não foi possível revogar as sessões antigas.');
// Remover somente o antigo arquivo de credenciais deste projeto.
if (existsSync(new URL('../data/collaborators.json', import.meta.url))) unlinkSync(new URL('../data/collaborators.json', import.meta.url));
console.log('Preparação concluída. Credenciais migradas: ' + migrated + '; acessos fracos desativados: ' + disabled + '.');
console.log('Remova SECURITY_ADMIN_PASSWORD da configuração após o uso.');
