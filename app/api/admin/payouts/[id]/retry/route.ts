// app/api/admin/payouts/[id]/retry/route.ts
//
// Manual "Retry Payout" action from the payout table.
//
// Restricted to FINANCE_ADMIN / SUPER_ADMIN, matching the queue itself. The
// retry mints a fresh provider reference (attempt N+1) so the failed attempt's
// reference can never be reused — see lib/payouts/processor.ts.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { retryPayout } from "@/lib/payouts/processor";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const auth = await requireAdmin(request, {
      roles: ["SUPER_ADMIN", "FINANCE_ADMIN"],
    });
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Payout id is required" },
        { status: 400 }
      );
    }

    const result = await retryPayout(id);

    await recordAdminAction(request, {
      adminId: admin.id,
      action: "PAYOUT_RETRIED",
      targetId: id,
      message: `Payout retry finished with status ${result.status}`,
      changes: {
        status: result.status,
        providerRef: result.providerRef,
        error: result.error ?? null,
      },
    });

    // A retry that fails again is a legitimate 200 with status FAILED — the
    // admin needs the error surfaced, not the request rejected.
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Admin payout retry error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
