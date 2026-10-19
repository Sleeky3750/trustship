// lib/admin-auth.ts
// Shared admin authentication helpers for API route handlers.
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Single source of truth for the admin JWT secret.
// Imported by /api/admin/login (sign), /api/admin/me (verify) and requireAdmin().
export const JWT_SECRET =
  process.env.JWT_SECRET || "default-jwt-secret-change-in-production";

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
 * Verifies the `admin_token` httpOnly cookie (HS256 JWT signed with JWT_SECRET),
 * loads the admin from the database and optionally enforces a role allow-list.
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
  const token = request.cookies.get("admin_token")?.value;
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
