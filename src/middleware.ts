import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const role = request.cookies.get('hum_vicio_role')?.value;
  const path = request.nextUrl.pathname;

  // Se não estiver logado e não estiver na tela de login, manda pro login
  if (!role && path !== '/login' && path !== '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Regras de Acesso por Cargo
  if (role === 'cozinha') {
    if (path.startsWith('/admin') || path.startsWith('/caixa')) {
      return NextResponse.redirect(new URL('/cozinha', request.url));
    }
  }

  if (role === 'caixa') {
    if (path.startsWith('/admin') || path.startsWith('/cozinha')) {
      return NextResponse.redirect(new URL('/caixa', request.url));
    }
  }

  // Admin tem acesso a tudo, não precisa de bloqueio

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/cozinha/:path*', '/caixa/:path*'],
}
