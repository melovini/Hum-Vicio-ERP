'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { 
  validateServerCredentialsAsync, 
  signSessionToken, 
  SESSION_COOKIE_NAME 
} from '@/lib/auth';

export async function loginAction(pinOrPassword: string): Promise<{ success: boolean; error?: string; redirectUrl?: string }> {
  try {
    const { valid, role, userName, collaboratorId } = await validateServerCredentialsAsync(pinOrPassword);

    if (!valid || !role) {
      return { 
        success: false, 
        error: 'Credencial inválida. Digite seu PIN de colaborador ou senha de acesso.' 
      };
    }

    const token = await signSessionToken(role, userName, collaboratorId);
    const cookieStore = await cookies();

    // Cookie seguro HttpOnly
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 horas
    });

    // Limpar cookie inseguro antigo se existir
    cookieStore.delete('hum_vicio_role');

    // Admin e Gerente acessam a Home Executiva
    const redirectUrl = (role === 'admin' || role === 'gerente') ? '/' : `/${role}`;
    return { success: true, redirectUrl };
  } catch (err: any) {
    console.error('Erro na autenticação do servidor:', err);
    return { success: false, error: 'Erro interno no servidor ao autenticar.' };
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete('hum_vicio_role');
  redirect('/login');
}
