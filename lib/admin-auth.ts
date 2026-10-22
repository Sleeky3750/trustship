// lib/admin-auth.ts
// Shared admin authentication helpers for API route handlers.
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roleHasPermission, type Permission } from "@/lib/rbac";

// Single source of truth for the admin JWT secret.
// Imported by /api/admin/login (sign), /api/admin/me (verify) and requireAdmin().
const JWT_SECRET_FALLBACK = "default-jwt-secret-change-in-production";

/**
 * Resolves the JWT secret with fail-closed behaviour in production:
 * a missing `JWT_SECRET` (or one still set to the insecure development
 * default) throws immediately instead of silently signing tokens with a
 * publicly known key. Development keeps the legacy fallback so local
 * workspaces without a `.env` continue to run, with a loud warning.
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret !== JWT_SECRET_FALLBACK) return secret;

  if (process.env.NODE_ENV === "production") {
    console.error(
      "FATAL: JWT_SECRET is missing or set to the insecure default — refusing to start in production."
    );
    throw new Error(
      "JWT_SECRET must be configured to a non-default value in production."
    );
  }

  console.warn(
    "[admin-auth] JWT_SECRET is not configured — using the insecure development-only fallback."
  );
  return JWT_SECRET_FALLBACK;
}

export const JWT_SECRET = resolveJwtSecret();

// ---------------------------------------------------------------------------
// Admin session cookie policy (single source of truth).
//   - httpOnly: JS can never read the session token (XSS exfiltration).
//   - secure:   true whenever NODE_ENV=production, so the token only ever
//               travels over HTTPS. Local plain-HTTP harnesses (`next start` /
//               standalone) opt out explicitly via
//               ALLOW_INSECURE_ADMIN_COOKIES=1 — an opt-out, never a silent
//               production downgrade.
//   - sameSite: 'strict' — the cookie is withheld from every cross-site
//               request, which closes CSRF on the admin surface entirely.
//   - maxAge:   8 hours; the JWT carries the matching `exp` so the proxy
//               rejects the token the moment it lapses.
// ---------------------------------------------------------------------------
export const ADMIN_SESSION_COOKIE = "admin_token";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function allowInsecureAdminCookies(): boolean {
  const flag = (process.env.ALLOW_INSECURE_ADMIN_COOKIES || "").trim().toLowerCase();
  return flag === "1" || flag === "true";
}

/** True when the current process should issue `Secure` admin cookies. */
export function useSecureAdminCookies(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  return !allowInsecureAdminCookies();
}

/** Canonical Set-Cookie options for the admin session token. */
export function adminSessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: useSecureAdminCookies(),
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}

/** Roles permitted to read the administrative audit trail. */
export const SUPER_ADMIN_ONLY: AdminRole[] = ["SUPER_ADMIN"];

/**
 * Case/format-tolerant super-admin check. The role comes from the database
 * enum in normal operation, but legacy rows and stale JWTs have been observed
 * with non-canonical casing — normalization keeps the gate strict without
 * turning a casing quirk into a privilege-escalation bug.
 */
export function isSuperAdmin(role: string | null | undefined): boolean {
  return normalizeAdminRole(role) === "SUPER_ADMIN";
}

/** Normalizes any role casing ("support_moderator" → "SUPPORT_MODERATOR"). */
export function normalizeAdminRole(role: string | null | undefined): string {
  return (role || "").trim().toUpperCase();
}

export type AdminSession = {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
};

export type RequireAdminResult =
  | { admin: AdminSession; error: null }
  | { admin: null; error: NextResponse };

function deny(message: string, status: number): RequireAdminResult {
  return {
    admin: null,
    error: NextResponse.json({ success: false, error: message }, { status }),
  };
}

/**
 * Guards an admin API route.
 *
 * Verifies the ADMIN_SESSION_COOKIE httpOnly cookie (HS256 JWT signed with
 * JWT_SECRET), loads the admin from the database and optionally enforces a
 * role allow-list.
 *
 * Usage:
 *   const auth = await requireAdmin(request);
 *   if (auth.error) return auth.error;
 *   const admin = auth.admin; // { id, email, name, role }
 */
export async function requireAdmin(
  request: NextRequest,
  options: { roles?: AdminRole[] } = {}
): Promise<RequireAdminResult> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return deny("Unauthorized", 401);
  }

  let adminId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
      adminId?: string;
    };
    if (typeof decoded !== "object" || typeof decoded.adminId !== "string" || !decoded.adminId) {
      return deny("Invalid or expired token", 401);
    }
    adminId = decoded.adminId;
  } catch {
    return deny("Invalid or expired token", 401);
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!admin) {
    return deny("Admin not found", 401);
  }

  if (options.roles && !options.roles.includes(admin.role)) {
    return deny("Insufficient permissions", 403);
  }

  return { admin, error: null };
}

/**
 * Permission-based guard — the preferred entry point for new routes.
 *
 * Verifies the admin session exactly like `requireAdmin`, then checks the
 * centralized `lib/rbac.ts` policy for the named permission. Returns 403 with
 * no detail about *why* (never leaks role/config internals to a probing client).
 *
 *   const auth = await requirePermission(request, "refunds:execute");
 *   if (auth.error) return auth.error;
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<RequireAdminResult> {
  const auth = await requireAdmin(request);
  if (auth.error) return auth;

  if (!roleHasPermission(auth.admin.role, permission)) {
    return deny("Insufficient permissions", 403);
  }

  return auth;
}

/**
 * Reads the admin session from the request cookies **outside** a Route Handler
 * (Server Actions, Server Components). Mirrors requireAdmin's database lookup
 * but returns a plain result instead of a NextResponse, since callers in those
 * contexts cannot `return` an HTTP response.
 *
 * Returns `null` for any of: missing cookie, invalid/expired JWT, unknown
 * admin, or a database failure — callers must treat `null` as "deny".
 */
export async function readAdminSession(
  cookieValue: string | undefined
): Promise<AdminSession | null> {
  if (!cookieValue) return null;

  let adminId: string;
  try {
    const decoded = jwt.verify(cookieValue, JWT_SECRET) as jwt.JwtPayload & {
      adminId?: string;
    };
    if (typeof decoded !== "object" || typeof decoded.adminId !== "string" || !decoded.adminId) {
      return null;
    }
    adminId = decoded.adminId;
  } catch {
    return null;
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true, role: true },
    });
    return admin ?? null;
  } catch (error) {
    console.error("[admin-auth] session lookup failed:", error);
    return null;
  }
}
