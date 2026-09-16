import type { NextConfig } from "next";
import { getAuthSecret } from './src/lib/security/config';

if (process.env.NODE_ENV === 'production') {
  getAuthSecret();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY é obrigatória no servidor.');
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'hum-vicio-erp.vercel.app',
        '*.vercel.app',
        'localhost:3000',
      ],
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
    ] }];
  },
};

export default nextConfig;
