import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignorar arquivos estáticos e internos do Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  // Se estiver na tela de login
  if (pathname === '/login') {
    if (session.valid && session.role) {
      const dest = session.role === 'admin' ? '/' : `/${session.role}`;
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // Se não estiver autenticado com token válido
  if (!session.valid || !session.role) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete('hum_vicio_role');
    return response;
  }

  const role = session.role;

  // Regra Cozinha: Restrito estritamente a /cozinha
  if (role === 'cozinha') {
    if (!pathname.startsWith('/cozinha')) {
      return NextResponse.redirect(new URL('/cozinha', request.url));
    }
  }

  // Regra Caixa: Restrito estritamente a /caixa
  if (role === 'caixa') {
    if (!pathname.startsWith('/caixa')) {
      return NextResponse.redirect(new URL('/caixa', request.url));
    }
  }

  // Admin tem acesso a todos os módulos e à Home (/)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica em todas as rotas de páginas exceto estáticos
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
