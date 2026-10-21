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
  | { success: true; admins: { id: string; email: string; name: string | null; role: AdminRole; isTwoFactorEnabled: boolean }[] }
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
      },
    });
    return { success: true, admins };
  } catch (error) {
    console.error("[admin-management] failed to list admins:", error);
    return { success: false, error: "Could not load admin accounts." };
  }
}
