import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminSession = request.cookies.get('trustship_admin_session')?.value;

  // 1. If trying to access protected admin pages without a session cookie, send to login
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!adminSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // 2. If already logged in and trying to access /admin/login, send to dashboard
  if (pathname === '/admin/login' && adminSession) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
