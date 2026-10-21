// lib/admin-guards.ts
//
// Server-side page guards for the admin segment. These run during rendering
// (Server Components), reading the session cookie directly — the proxy already
// proved *authenticated*, but role authorization is per-page and must not rely
// on the client-side sidebar hiding a link.
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readAdminSession, isSuperAdmin, type AdminSession } from "@/lib/admin-auth";

/**
 * Require an authenticated admin session, or redirect to the login page.
 * Returns the verified session for the caller to render from.
 */
export async function requireAdminPage(): Promise<AdminSession> {
  const cookieStore = await cookies();
  const session = await readAdminSession(
    cookieStore.get("admin_token")?.value
  );
  if (!session) redirect("/admin/login");
  return session;
}

/**
 * Require a SUPER_ADMIN session. Non-super-admins are redirected to the admin
 * dashboard rather than shown a 403 — they have no legitimate reason to reach
 * the audit trail, and a redirect leaks nothing about its contents.
 */
export async function requireSuperAdminPage(): Promise<AdminSession> {
  const session = await requireAdminPage();
  if (!isSuperAdmin(session.role)) {
    redirect("/admin/transactions");
  }
  return session;
}
