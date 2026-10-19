import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

// --- HS256 verification via Web Crypto (works in both Edge and Node runtimes,
// --- unlike the `jsonwebtoken` package which needs node:crypto).

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function isAdminTokenValid(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(headerB64))
    ) as { alg?: string };
    if (header.alg !== 'HS256') return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signatureValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signatureB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!signatureValid) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadB64))
    ) as { adminId?: unknown; exp?: unknown };
    if (typeof payload.adminId !== 'string' || !payload.adminId) return false;
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return false; // expired
    }
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminToken = request.cookies.get('admin_token')?.value;
  const isAuthenticated = !!adminToken && (await isAdminTokenValid(adminToken));

  // 1. Protected admin pages require a valid `admin_token` JWT
  if (
    pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/login') &&
    !isAuthenticated
  ) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // 2. Already logged in → skip the login screen and go to the dashboard
  if (pathname === '/admin/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
