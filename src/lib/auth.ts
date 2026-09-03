export type UserRole = 'admin' | 'caixa' | 'cozinha';

export interface SessionPayload {
  role: UserRole;
  iat: number;
  exp: number;
}

const DEFAULT_SECRET = 'hum-vicio-erp-security-signature-key-prod-2026';
export const SESSION_COOKIE_NAME = 'hum_vicio_session';

function getSecretKey(): string {
  return process.env.AUTH_SECRET || DEFAULT_SECRET;
}

// Codificação compatível com Edge Runtime e Node.js (sem dependência de Buffer)
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// Criação de chave HMAC via Web Crypto API nativa
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyData = enc.encode(getSecretKey());
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Assina e cria um token de sessão inviolável (HMAC-SHA256)
 */
export async function signSessionToken(role: UserRole): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    role,
    iat: now,
    exp: now + 60 * 60 * 24, // 24 horas
  };

  const payloadStr = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadStr);

  const key = await getCryptoKey();
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload)
  );

  const signatureBase64 = bufferToBase64Url(signatureBuffer);
  return `${encodedPayload}.${signatureBase64}`;
}

/**
 * Verifica se o token foi emitido pelo servidor e não foi adulterado
 */
export async function verifySessionToken(token: string | undefined | null): Promise<{ valid: boolean; role?: UserRole }> {
  if (!token) return { valid: false };

  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };

  const [encodedPayload, signatureBase64] = parts;

  try {
    const key = await getCryptoKey();
    const signatureBytes = base64UrlToArrayBuffer(signatureBase64);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(encodedPayload)
    );

    if (!isValid) return { valid: false };

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: SessionPayload = JSON.parse(payloadJson);

    // Checar expiração
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return { valid: false };

    return { valid: true, role: payload.role };
  } catch {
    return { valid: false };
  }
}

/**
 * Validação segura de credenciais exclusivamente dentro do servidor
 */
export function validateServerCredentials(pinOrPassword: string): { valid: boolean; role?: UserRole } {
  if (!pinOrPassword) return { valid: false };

  const cozinhaPin = process.env.COZINHA_PIN || '1234';
  const caixaPin = process.env.CAIXA_PIN || '5678';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  const clean = pinOrPassword.trim();

  if (clean === adminPassword) {
    return { valid: true, role: 'admin' };
  }
  if (clean === caixaPin) {
    return { valid: true, role: 'caixa' };
  }
  if (clean === cozinhaPin) {
    return { valid: true, role: 'cozinha' };
  }

  return { valid: false };
}
