"use server";

// Server Action entry point for administrative account creation.
//
// This file is intentionally thin: it exists only to expose a callable bound
// to the page, then delegates authentication, authorization, validation and
// password hashing to the `server-only` Data Access Layer in
// lib/admin-management.ts. Treat this as a public endpoint — the action ID is
// reachable by direct POST — so it never trusts its caller.
import { revalidatePath } from "next/cache";
import { createAdminAccount } from "@/lib/admin-management";
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
