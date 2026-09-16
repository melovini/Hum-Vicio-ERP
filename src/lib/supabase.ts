import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// O navegador usa apenas a API do aplicativo. Nenhuma chave privada é enviada ao cliente.
export const createClient = () => createSupabaseClient('https://database.invalid', 'app-session', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const match = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
      if (!match || typeof window === 'undefined') return Response.json({ message: 'Operação indisponível.' }, { status: 403 });
      const headers = new Headers(init?.headers);
      headers.delete('apikey');
      headers.delete('authorization');
      const response = await fetch('/api/data/' + match[1] + url.search, { ...init, headers, credentials: 'same-origin' });
      if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
      return response;
    },
  },
});
