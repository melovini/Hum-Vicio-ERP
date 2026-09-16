export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret === 'hum-vicio-erp-security-signature-key-prod-2026') {
    throw new Error('AUTH_SECRET deve conter um segredo exclusivo de pelo menos 32 caracteres.');
  }
  return secret;
}
