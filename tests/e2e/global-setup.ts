import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { signSessionToken, SESSION_COOKIE_NAME } from '../../src/lib/session';
import { authSecret } from '../../playwright.config';

export default async function globalSetup() {
  process.env.AUTH_SECRET = authSecret;
  const token = await signSessionToken('admin', 'Gestor de teste', 'e2e-admin', 'e2e-session');
  const output = resolve('test-results/.auth/admin.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({
    cookies: [{
      name: SESSION_COOKIE_NAME,
      value: token,
      domain: '127.0.0.1',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 8 * 3600,
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    }],
    origins: [],
  }, null, 2));
}
