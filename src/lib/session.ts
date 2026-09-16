import { getAuthSecret } from './security/config';
export type UserRole = 'admin' | 'gerente' | 'caixa' | 'cozinha';

export interface SessionPayload {
  role: UserRole;
  userName?: string;
  collaboratorId?: string;
  sessionId: string;
  version: 2;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'hum_vicio_session';

function getSecretKey(): string {
  return getAuthSecret();
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
 * Assina e cria um token de sessão inviolável (HMAC-SHA256) - Edge Safe
 */
export async function signSessionToken(
  role: UserRole, 
  userName: string | undefined,
  collaboratorId: string,
  sessionId: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    role,
    userName,
    collaboratorId,
    sessionId,
    version: 2,
    iat: now,
    exp: now + 60 * 60 * 8,
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
 * Verifica se o token foi emitido pelo servidor e não foi adulterado - Edge Safe
 */
export async function verifySessionToken(token: string | undefined | null): Promise<{ 
  valid: boolean; 
  role?: UserRole;
  userName?: string;
  collaboratorId?: string;
  sessionId?: string;
}> {
  if (!token || token.length > 4096) return { valid: false };

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
    if (payload.version !== 2 || !Number.isFinite(payload.exp) || !Number.isFinite(payload.iat) ||
        payload.exp <= now || payload.iat > now || payload.exp - payload.iat > 8 * 3600 ||
        !['admin', 'gerente', 'caixa', 'cozinha'].includes(payload.role) ||
        typeof payload.collaboratorId !== 'string' || !payload.collaboratorId ||
        typeof payload.sessionId !== 'string' || !payload.sessionId) return { valid: false };

    return { 
      valid: true, 
      role: payload.role, 
      userName: payload.userName, 
      collaboratorId: payload.collaboratorId,
      sessionId: payload.sessionId
    };
  } catch {
    return { valid: false };
  }
}
