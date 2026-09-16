import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(derive);
const defaults = new Set(['admin', '0000', '1234', '5678']);

export function credentialAllowed(value, role) {
  return typeof value === 'string' && value === value.trim() &&
    value.length >= (role === 'admin' || role === 'gerente' ? 12 : 6) &&
    value.length <= 128 && !defaults.has(value.toLowerCase());
}

export async function hashCredential(value) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(value, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyCredential(value, encoded) {
  if (typeof value !== 'string' || value.length > 128 || typeof encoded !== 'string') return false;
  if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded)) return false;
  const [, salt, digest] = encoded.split('$');
  const key = await scrypt(value, salt, 64);
  return timingSafeEqual(key, Buffer.from(digest, 'hex'));
}
