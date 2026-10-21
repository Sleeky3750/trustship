import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const JWT_SECRET_FALLBACK = 'default-jwt-secret-change-in-production';

// Must match ADMIN_SESSION_COOKIE in lib/admin-auth.ts. Kept as a local literal
// because the proxy bundle must stay free of the Prisma/bcrypt imports that
// lib/admin-auth.ts pulls in.
const ADMIN_SESSION_COOKIE = 'admin_token';

/**
 * Fail-closed secret resolution for the proxy: in production a missing
 * `JWT_SECRET` (or one still set to the insecure default) throws on first
 * use instead of validating tokens against a publicly known key. The check
 * runs lazily so the worker bundle itself stays build-safe.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret !== JWT_SECRET_FALLBACK) return secret;

  if (process.env.NODE_ENV === 'production') {
    console.error(
      'FATAL: JWT_SECRET is missing or set to the insecure default — admin session validation disabled (fail closed).'
    );
    throw new Error(
      'JWT_SECRET must be configured to a non-default value in production.'
    );
  }
  return JWT_SECRET_FALLBACK;
}

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
      encoder.encode(getJwtSecret()),
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

// --- CORS / origin lockdown for admin APIs ---------------------------------

const ALLOWED_ORIGIN_ENV_KEYS = [
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
] as const;

/**
 * A browser `Origin` is trusted only when it targets this exact host (or an
 * explicitly allow-listed deployment URL). Anything else — including the
 * opaque `"null"` origin — is rejected before the request reaches a handler.
 * Requests without an `Origin` header (curl, server-to-server webhooks,
 * Node test harnesses) are not subject to browser CORS and pass through.
 */
function isTrustedOrigin(origin: string, request: NextRequest): boolean {
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // malformed or "null"
  }

  const host = request.headers.get('host');
  if (originHost === host) return true;

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedHost && originHost === forwardedHost) return true;

  for (const key of ALLOWED_ORIGIN_ENV_KEYS) {
    const value = process.env[key];
    if (!value) continue;
    try {
      if (new URL(value).host === originHost) return true;
    } catch {
      // ignore malformed env values
    }
  }
  return false;
}

// --- CSP with per-request nonce (see Next.js CSP guide) --------------------

function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const directives = [
    "default-src 'self'",
    // Inline scripts are only allowed with the per-request nonce;
    // 'strict-dynamic' lets nonce'd loaders pull in Next's chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Inline <style> elements (including Next's own) must carry the nonce;
    // style *attributes* stay allowed for React-computed layout values.
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    // dev needs the HMR websocket; production stays same-origin only.
    isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---------------------------------------------------------------------------
  // 1. Admin APIs: CORS preflight rejection + cross-origin guard + JWT gate.
  //    (Role/RBAC is additionally enforced inside every handler via
  //    requireAdmin(), which checks the database — zero trust: the proxy is
  //    the first line of defence, not the only one.)
  // ---------------------------------------------------------------------------
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    // Browsers only send OPTIONS here as a CORS preflight. Admin APIs are
    // same-origin — every preflight is untrusted and gets a bare 403 with no
    // CORS headers, so the browser blocks the follow-up request too.
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 403 });
    }

    const origin = request.headers.get('origin');
    if (origin && !isTrustedOrigin(origin, request)) {
      return NextResponse.json(
        { success: false, error: 'Cross-origin request rejected' },
        { status: 403 }
      );
    }

    // Auth-flow endpoints validate themselves (they must be reachable to
    // establish or tear down a session). Everything else needs a valid,
    // unexpired admin JWT before it reaches application code.
    const isAuthFlowEndpoint =
      pathname === '/api/admin/login' ||
      pathname === '/api/admin/logout' ||
      pathname === '/api/admin/me';

    if (!isAuthFlowEndpoint) {
      const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
      if (!token || !(await isAdminTokenValid(token))) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    return NextResponse.next();
  }

  // ---------------------------------------------------------------------------
  // 2. Admin pages: session redirects + per-request nonce CSP.
  // ---------------------------------------------------------------------------
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const isAuthenticated = !!adminToken && (await isAdminTokenValid(adminToken));
    const isLoginPath = pathname === '/admin/login';

    // Protected admin pages require a valid `admin_token` JWT
    if (!isLoginPath && !isAuthenticated) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Already logged in → skip the login screen and go to the dashboard
    if (isLoginPath && isAuthenticated) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // Fresh nonce per request. The admin segment renders dynamically
    // (export const dynamic = "force-dynamic" in app/admin/layout.tsx), so
    // Next.js stamps its inline scripts/styles with this nonce during SSR.
    const nonce = btoa(crypto.randomUUID());
    const csp = buildContentSecurityPolicy(nonce);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
