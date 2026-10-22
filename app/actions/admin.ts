"use server";

// Server Action entry point for administrative account creation.
//
// This file is intentionally thin: it exists only to expose a callable bound
// to the page, then delegates authentication, authorization, validation and
// password hashing to the `server-only` Data Access Layer in
// lib/admin-management.ts. Treat this as a public endpoint — the action ID is
// reachable by direct POST — so it never trusts its caller.
import { revalidatePath } from "next/cache";
import {
  createAdminAccount,
  updateAdminRole,
  deactivateAdminAccount,
  reactivateAdminAccount,
} from "@/lib/admin-management";
import { recordAdminAction } from "@/lib/audit";

export type CreateAdminActionState = {
  success: boolean;
  error?: string;
  message?: string;
};

export async function createAdminAction(
  _prevState: CreateAdminActionState,
  formData: FormData
): Promise<CreateAdminActionState> {
  const result = await createAdminAccount({
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Audit the creation. The DAL already proved the actor is a SUPER_ADMIN; we
  // pass the request as null because Server Actions have no NextRequest, so IP
  // and User-Agent fall back to "unknown" rather than being spoofed from body.
  await recordAdminAction(null, {
    adminId: result.admin.id,
    action: "ADMIN_CREATED",
    targetId: result.admin.id,
    message: `Created ${result.admin.role} account ${result.admin.email}`,
    changes: { email: result.admin.email, role: result.admin.role },
  });

  revalidatePath("/admin/settings/admins");

  return {
    success: true,
    message: `Admin ${result.admin.email} created as ${result.admin.role}.`,
  };
}

/** Shared result shape for the two management actions. */
export type AdminMutationState = {
  success: boolean;
  error?: string;
  message?: string;
};

/**
 * Change an existing admin's role.
 *
 * Thin wrapper: the DAL re-authenticates from the session cookie and enforces
 * every safeguard (super-admin caller, no self-change, never remove the last
 * super-admin). The audit row records both the previous and the new role.
 */
export async function updateAdminRoleAction(
  adminId: string,
  role: string
): Promise<AdminMutationState> {
  const result = await updateAdminRole({ adminId, role });

  if (!result.success) {
    // Record the refused attempt too — a rejected privilege change is exactly
    // the kind of event an audit trail exists to capture.
    await recordAdminAction(null, {
      adminId,
      action: "ADMIN_ROLE_CHANGE_REJECTED",
      targetId: adminId,
      message: `Refused role change to ${role}: ${result.error}`,
      outcome: "FAILED",
      reason: result.error,
    });
    return { success: false, error: result.error };
  }

  await recordAdminAction(null, {
    adminId: result.admin.id,
    action: "ADMIN_ROLE_CHANGED",
    targetId: result.admin.id,
    message: `Changed role for ${result.admin.email}: ${result.previousRole} → ${result.admin.role}`,
    changes: { role: { from: result.previousRole, to: result.admin.role } },
  });

  revalidatePath("/admin/settings/admins");

  return {
    success: true,
    message: `${result.admin.email} is now ${result.admin.role}.`,
  };
}

/**
 * Deactivate ("remove") an admin account — a soft delete.
 *
 * Thin wrapper: the DAL re-authenticates from the session cookie and refuses
 * self-deactivation or removing the last active super-admin. A hard delete is
 * deliberately avoided so the account's audit history is not cascade-erased.
 */
export async function deactivateAdminAction(
  adminId: string
): Promise<AdminMutationState> {
  const result = await deactivateAdminAccount({ adminId });

  if (!result.success) {
    await recordAdminAction(null, {
      adminId,
      action: "ADMIN_DEACTIVATE_REJECTED",
      targetId: adminId,
      message: `Refused admin deactivation: ${result.error}`,
      outcome: "FAILED",
      reason: result.error,
    });
    return { success: false, error: result.error };
  }

  await recordAdminAction(null, {
    adminId: result.admin.id,
    action: "ADMIN_DEACTIVATED",
    targetId: result.admin.id,
    message: `Deactivated admin account ${result.admin.email}`,
    changes: { email: result.admin.email, isActive: false },
  });

  revalidatePath("/admin/settings/admins");

  return { success: true, message: `Removed ${result.admin.email}.` };
}

/** Restore a previously deactivated admin account. Super-admin-only. */
export async function reactivateAdminAction(
  adminId: string
): Promise<AdminMutationState> {
  const result = await reactivateAdminAccount({ adminId });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  await recordAdminAction(null, {
    adminId: result.admin.id,
    action: "ADMIN_REACTIVATED",
    targetId: result.admin.id,
    message: `Reactivated admin account ${result.admin.email}`,
    changes: { email: result.admin.email, isActive: true },
  });

  revalidatePath("/admin/settings/admins");

  return { success: true, message: `Restored ${result.admin.email}.` };
}
