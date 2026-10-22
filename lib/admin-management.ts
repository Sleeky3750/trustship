// lib/admin-management.ts
//
// Data Access Layer for creating administrative accounts.
//
// Everything privileged lives here rather than in the Server Action itself:
// the action stays a thin, validated wrapper, while authentication,
// authorization and password hashing all happen behind this `server-only`
// boundary. Importing this module from a Client Component is a build error.
import "server-only";

import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readAdminSession, isSuperAdmin } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

/** bcrypt cost. 12 rounds ≈ 250ms on commodity hardware — deliberately slow. */
const BCRYPT_ROUNDS = 12;

const VALID_ADMIN_ROLES: readonly AdminRole[] = [
  "SUPER_ADMIN",
  "SUPPORT_MODERATOR",
  "FINANCE_ADMIN",
];

export type CreateAdminInput = {
  email: string;
  name?: string;
  password: string;
  role: string;
};

export type CreateAdminResult =
  | { success: true; admin: { id: string; email: string; name: string | null; role: AdminRole } }
  | { success: false; error: string };

/** Pragmatic RFC-5322-ish check — one @, a dot-bearing domain, no whitespace. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Create a new administrative account.
 *
 * Authorization is enforced **inside** this function, from the server-side
 * session cookie — never from caller-supplied input. The caller cannot assert
 * its own identity or role: a direct POST to the Server Action behaves exactly
 * like the UI path.
 */
export async function createAdminAccount(
  input: CreateAdminInput
): Promise<CreateAdminResult> {
  // --- 1. Authenticate + authorize from the request's session cookie --------
  const cookieStore = await cookies();
  const session = await readAdminSession(
    cookieStore.get("admin_token")?.value
  );

  if (!session) {
    return { success: false, error: "Unauthorized: please sign in again." };
  }
  if (!isSuperAdmin(session.role)) {
    return {
      success: false,
      error: "Forbidden: only a Super Admin can create admin accounts.",
    };
  }

  // --- 2. Validate input (untrusted) ---------------------------------------
  const email = (input.email || "").trim().toLowerCase();
  const name = (input.name || "").trim();
  const password = input.password || "";
  const role = (input.role || "").trim().toUpperCase() as AdminRole;

  if (!email || !isValidEmail(email)) {
    return { success: false, error: "A valid email address is required." };
  }
  // 12 chars minimum: these accounts can move money and read audit trails.
  if (password.length < 12) {
    return {
      success: false,
      error: "Password must be at least 12 characters long.",
    };
  }
  if (!VALID_ADMIN_ROLES.includes(role)) {
    return {
      success: false,
      error: "Invalid role. Choose SUPER_ADMIN, SUPPORT_MODERATOR or FINANCE_ADMIN.",
    };
  }

  // --- 3. Hash before persisting — plaintext never reaches the database ----
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "An admin with that email already exists." };
    }

    const created = await prisma.adminUser.create({
      data: {
        email,
        name: name || null,
        password: hashedPassword,
        role,
        // New accounts start with 2FA off but must enrol before doing real work.
        isTwoFactorEnabled: false,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return { success: true, admin: created };
  } catch (error) {
    console.error("[admin-management] failed to create admin:", error);
    return {
      success: false,
      error: "Could not create the admin account. Please try again.",
    };
  }
}

/** List admins for the management UI. Super-admin-only. */
export async function listAdminAccounts(): Promise<
  | { success: true; admins: { id: string; email: string; name: string | null; role: AdminRole; isTwoFactorEnabled: boolean; isActive: boolean }[] }
  | { success: false; error: string }
> {
  const cookieStore = await cookies();
  const session = await readAdminSession(
    cookieStore.get("admin_token")?.value
  );

  if (!session) return { success: false, error: "Unauthorized" };
  if (!isSuperAdmin(session.role)) return { success: false, error: "Forbidden" };

  try {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isTwoFactorEnabled: true,
        isActive: true,
      },
    });
    return { success: true, admins };
  } catch (error) {
    console.error("[admin-management] failed to list admins:", error);
    return { success: false, error: "Could not load admin accounts." };
  }
}

/**
 * Resolve the acting session from the request cookie and assert SUPER_ADMIN.
 * Shared by the mutating admin-management operations so the rule lives in one
 * place. Returns the verified session on success.
 */
async function requireSuperAdminSession(): Promise<
  | { ok: true; session: { id: string; email: string } }
  | { ok: false; error: string }
> {
  const cookieStore = await cookies();
  const session = await readAdminSession(cookieStore.get("admin_token")?.value);
  if (!session) return { ok: false, error: "Unauthorized: please sign in again." };
  if (!isSuperAdmin(session.role)) {
    return {
      ok: false,
      error: "Forbidden: only a Super Admin can manage admin accounts.",
    };
  }
  return { ok: true, session: { id: session.id, email: session.email } };
}

/**
 * Count how many ACTIVE super-admins exist. Used to refuse changes that would
 * leave the platform with no usable super-admin at all (a self-inflicted
 * lockout). Deactivated accounts do not count — they cannot sign in.
 */
async function countSuperAdmins(exceptId?: string): Promise<number> {
  return prisma.adminUser.count({
    where: {
      role: "SUPER_ADMIN",
      isActive: true,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

export type UpdateAdminRoleResult =
  | { success: true; admin: { id: string; email: string; role: AdminRole }; previousRole: AdminRole }
  | { success: false; error: string };

/**
 * Change an existing admin's role.
 *
 * Safeguards (enforced HERE, from the session cookie — never from input):
 *   * caller must be a SUPER_ADMIN;
 *   * an admin may not change their OWN role (prevents accidental
 *     self-demotion that would strip the session's privileges mid-flight);
 *   * the change must not remove the last remaining SUPER_ADMIN.
 */
export async function updateAdminRole(input: {
  adminId: string;
  role: string;
}): Promise<UpdateAdminRoleResult> {
  const auth = await requireSuperAdminSession();
  if (!auth.ok) return { success: false, error: auth.error };

  const adminId = (input.adminId || "").trim();
  const role = (input.role || "").trim().toUpperCase() as AdminRole;

  if (!VALID_ADMIN_ROLES.includes(role)) {
    return {
      success: false,
      error: "Invalid role. Choose SUPER_ADMIN, SUPPORT_MODERATOR or FINANCE_ADMIN.",
    };
  }

  try {
    const target = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, role: true },
    });
    if (!target) return { success: false, error: "Admin account not found." };

    if (target.id === auth.session.id) {
      return {
        success: false,
        error: "You cannot change your own role while signed in.",
      };
    }
    if (target.role === role) {
      return { success: false, error: "That account already has this role." };
    }

    // Demoting the last super-admin would lock everyone out of administration.
    if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      const others = await countSuperAdmins(target.id);
      if (others === 0) {
        return {
          success: false,
          error: "Cannot demote the last Super Admin — the platform would be left without one.",
        };
      }
    }

    const updated = await prisma.adminUser.update({
      where: { id: target.id },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    return { success: true, admin: updated, previousRole: target.role };
  } catch (error) {
    console.error("[admin-management] failed to update admin role:", error);
    return { success: false, error: "Could not update the admin's role." };
  }
}

export type DeactivateAdminResult =
  | { success: true; admin: { id: string; email: string } }
  | { success: false; error: string };

/**
 * Deactivate an administrative account (soft delete).
 *
 * WHY DEACTIVATE, NOT DELETE
 * --------------------------
 * `AdminAuditLog.adminId` is a foreign key with `onDelete: Cascade`, so a hard
 * `DELETE` of an AdminUser would **erase that admin's entire audit history** —
 * exactly the record an incident review depends on. Deactivation keeps the row
 * (and its audit trail) while making the account unusable: it cannot sign in,
 * and it no longer counts toward the active super-admin total.
 *
 * Safeguards (enforced HERE, from the session cookie):
 *   * caller must be a SUPER_ADMIN;
 *   * an admin may not deactivate their OWN account (would terminate the
 *     active session out from under them);
 *   * deactivation must not remove the last remaining ACTIVE SUPER_ADMIN.
 */
export async function deactivateAdminAccount(input: {
  adminId: string;
}): Promise<DeactivateAdminResult> {
  const auth = await requireSuperAdminSession();
  if (!auth.ok) return { success: false, error: auth.error };

  const adminId = (input.adminId || "").trim();

  try {
    const target = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!target) return { success: false, error: "Admin account not found." };

    if (target.id === auth.session.id) {
      return {
        success: false,
        error: "You cannot remove your own account while signed in.",
      };
    }
    if (!target.isActive) {
      return { success: false, error: "That account is already deactivated." };
    }

    if (target.role === "SUPER_ADMIN") {
      const others = await countSuperAdmins(target.id);
      if (others === 0) {
        return {
          success: false,
          error: "Cannot remove the last active Super Admin — the platform would be left without one.",
        };
      }
    }

    await prisma.adminUser.update({
      where: { id: target.id },
      data: { isActive: false },
    });

    return { success: true, admin: { id: target.id, email: target.email } };
  } catch (error) {
    console.error("[admin-management] failed to deactivate admin:", error);
    return { success: false, error: "Could not remove the admin account." };
  }
}

export type ReactivateAdminResult =
  | { success: true; admin: { id: string; email: string } }
  | { success: false; error: string };

/** Reverse a deactivation. Super-admin-only. */
export async function reactivateAdminAccount(input: {
  adminId: string;
}): Promise<ReactivateAdminResult> {
  const auth = await requireSuperAdminSession();
  if (!auth.ok) return { success: false, error: auth.error };

  const adminId = (input.adminId || "").trim();

  try {
    const target = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, isActive: true },
    });
    if (!target) return { success: false, error: "Admin account not found." };
    if (target.isActive) {
      return { success: false, error: "That account is already active." };
    }

    await prisma.adminUser.update({
      where: { id: target.id },
      data: { isActive: true },
    });

    return { success: true, admin: { id: target.id, email: target.email } };
  } catch (error) {
    console.error("[admin-management] failed to reactivate admin:", error);
    return { success: false, error: "Could not restore the admin account." };
  }
}
