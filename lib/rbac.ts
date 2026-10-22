// lib/rbac.ts
//
// Centralized, server-side role-based access control — the SINGLE source of
// truth for "which admin role may do what".
//
// Before this module, authorization was scattered: some routes called bare
// `requireAdmin(request)`, others passed an inline `{ roles: [...] }` array, and
// the admin sidebar decided what to show from a string comparison. That gave
// three parallel, drifting answers to the same question — and several
// money-moving routes (escrow/release, admin/release, escrow/ref) ended up with
// NO role gate at all, so a SUPPORT_MODERATOR could move funds.
//
// Design rules:
//   1. A *permission* is a stable, named capability (`refund:execute`). Roles map
//      to sets of permissions. Routes check permissions, never role strings.
//   2. This is a pure module (no Prisma, no server-only import) so it can be
//      imported by both route handlers AND client components for UI hints.
//      Client use is only ever for *hiding* affordances — the server always
//      re-checks. Never treat a client-side check as authorization.
//   3. Adding a role or permission is one edit here; no route churn.

import type { AdminRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Every privileged capability in the admin surface. Grouped by domain; the
 * string values are the contract used at call sites, so keep them stable.
 */
export const PERMISSIONS = {
  // --- Transaction visibility -------------------------------------------------
  /** Read the transaction list and detail pages (masked view). */
  "transactions:read": "transactions:read",
  /** Read unmasked customer PII (full phone numbers, bank details). */
  "transactions:read_pii": "transactions:read_pii",
  /** Read the release PIN / PIN-adjacent detail fields. */
  "transactions:read_pin": "transactions:read_pin",

  // --- Money movement ---------------------------------------------------------
  /** Authorize a release of escrowed funds to the seller. */
  "escrow:release": "escrow:release",
  /** Read the payout queue and its stats. */
  "payouts:read": "payouts:read",
  /** Enqueue / retry payouts (real transfers). */
  "payouts:manage": "payouts:manage",

  // --- Refunds ----------------------------------------------------------------
  /** See refund records. */
  "refunds:read": "refunds:read",
  /** Create a refund request (does NOT move money). */
  "refunds:request": "refunds:request",
  /** Approve/reject a refund request. */
  "refunds:approve": "refunds:approve",
  /** Execute an approved refund against the provider. */
  "refunds:execute": "refunds:execute",

  // --- Disputes ---------------------------------------------------------------
  /** Read dispute cases. */
  "disputes:read": "disputes:read",
  /** Assign, annotate and advance dispute stages. */
  "disputes:manage": "disputes:manage",
  /** Apply the financial outcome of a resolved dispute (release/refund). */
  "disputes:resolve_financial": "disputes:resolve_financial",

  // --- Logistics --------------------------------------------------------------
  "logistics:read": "logistics:read",
  "logistics:manage": "logistics:manage",

  // --- Risk -------------------------------------------------------------------
  "risk:read": "risk:read",

  // --- Audit & administration -------------------------------------------------
  /** Read the administrative audit trail. */
  "audit:read": "audit:read",
  /** Create / list admin accounts and assign roles. */
  "admins:manage": "admins:manage",
  /** Read and edit customer-support scripts. */
  "support_scripts:read": "support_scripts:read",
  "support_scripts:manage": "support_scripts:manage",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ---------------------------------------------------------------------------
// Role → permission matrix
// ---------------------------------------------------------------------------

/**
 * Least-privilege grants per role.
 *
 * SUPER_ADMIN          — everything, including admin management and audit.
 * FINANCE_ADMIN        — money: releases, payouts, refunds, reconciliation.
 *                        Explicitly NOT admin management, NOT support-script
 *                        editing, NOT unmasked PII beyond operational need.
 * SUPPORT_MODERATOR    — support: read transactions (masked), disputes,
 *                        logistics, support scripts, risk. May *request* a
 *                        refund but never approve or execute one; no financial
 *                        release of any kind.
 *
 * Note: being SUPER_ADMIN does not make a financial action automatically safe —
 * the release/refund *workflows* still enforce their own state and idempotency
 * guards. This matrix only answers "may this role attempt it at all".
 */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),

  FINANCE_ADMIN: [
    "transactions:read",
    "transactions:read_pii",
    "transactions:read_pin",
    "escrow:release",
    "payouts:read",
    "payouts:manage",
    "refunds:read",
    "refunds:request",
    "refunds:approve",
    "refunds:execute",
    "disputes:read",
    "disputes:resolve_financial",
    "logistics:read",
    "risk:read",
    "support_scripts:read",
  ],

  SUPPORT_MODERATOR: [
    "transactions:read",
    "disputes:read",
    "disputes:manage",
    "logistics:read",
    "logistics:manage",
    "risk:read",
    "refunds:read",
    "refunds:request",
    "support_scripts:read",
  ],
};

/** Legacy/aliased role spellings observed in stale JWTs and older rows. */
const ROLE_ALIASES: Record<string, AdminRole> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SUPERADMIN: "SUPER_ADMIN",
  SUPPORT_MODERATOR: "SUPPORT_MODERATOR",
  SUPPORT: "SUPPORT_MODERATOR",
  FINANCE_ADMIN: "FINANCE_ADMIN",
  FINANCE: "FINANCE_ADMIN",
};

/**
 * Coerce any stored/JWT role string to a canonical `AdminRole`.
 * Unknown values resolve to the *least* privileged role so an unrecognized
 * string can never be treated as super-admin.
 */
export function canonicalRole(role: string | null | undefined): AdminRole {
  const key = (role || "").trim().toUpperCase();
  return ROLE_ALIASES[key] ?? "SUPPORT_MODERATOR";
}

/** True when `role` holds `permission`. */
export function roleHasPermission(
  role: string | null | undefined,
  permission: Permission
): boolean {
  const canonical = canonicalRole(role);
  return ROLE_PERMISSIONS[canonical].includes(permission);
}

/** True when `role` holds ALL of `permissions`. */
export function roleHasAll(
  role: string | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => roleHasPermission(role, p));
}

/** True when `role` holds ANY of `permissions`. */
export function roleHasAny(
  role: string | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => roleHasPermission(role, p));
}

/** Roles that hold a given permission (used for API role allow-lists). */
export function rolesWithPermission(permission: Permission): AdminRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as AdminRole[]).filter((role) =>
    ROLE_PERMISSIONS[role].includes(permission)
  );
}

/** Permission set for a role, as a plain array (for UI/debugging). */
export function permissionsForRole(role: string | null | undefined): Permission[] {
  return [...ROLE_PERMISSIONS[canonicalRole(role)]];
}

/** Human-readable role label for the UI. */
export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  FINANCE_ADMIN: "Finance Admin",
  SUPPORT_MODERATOR: "Support Moderator",
};
