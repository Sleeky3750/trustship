// app/api/admin/disputes/[ref]/route.ts
//
// Dispute moderation API.
//
//   GET  -> the full dispute case (statements, evidence, current stage)
//   POST -> advance the stage through the validated transition pipeline
//
// Stage transitions are admin-only here; the validation rules themselves live
// in lib/disputes/transitions.ts so this route stays a thin transport layer.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { advanceDisputeStage, loadDisputeCase } from "@/lib/disputes";
import type { DisputeFault, DisputeStage } from "@prisma/client";

type Context = { params: Promise<{ ref: string }> };

const VALID_STAGES: DisputeStage[] = [
  "AWAITING_EVIDENCE",
  "IN_MEDIATION",
  "ARBITRATION_PENDING",
  "RESOLVED",
];

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { ref } = await context.params;
    const dispute = await loadDisputeCase({ ref });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, dispute });
  } catch (error) {
    console.error("Dispute case load error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { ref } = await context.params;
    const body = await request.json().catch(() => ({}));

    const toStage = String(body?.stage || "").toUpperCase() as DisputeStage;
    if (!VALID_STAGES.includes(toStage)) {
      return NextResponse.json(
        { success: false, error: "A valid dispute stage is required" },
        { status: 400 }
      );
    }

    const fault =
      body?.fault === "SELLER_FAULT" || body?.fault === "BUYER_FAULT"
        ? (body.fault as DisputeFault)
        : undefined;

    const outcome = await advanceDisputeStage({
      transactionRef: ref,
      toStage,
      actor: "ADMIN",
      reason: typeof body?.reason === "string" ? body.reason : undefined,
      fault,
    });

    if (!outcome.allowed) {
      return NextResponse.json(
        { success: false, error: outcome.error || "Transition not permitted" },
        { status: 409 }
      );
    }

    await recordAdminAction(request, {
      adminId: admin.id,
      action: "DISPUTE_STAGE_CHANGED",
      targetId: ref,
      message: `Dispute moved to ${outcome.nextStage}`,
      changes: { stage: outcome.nextStage, fault: fault ?? null },
    });

    return NextResponse.json({ success: true, dispute: outcome.case });
  } catch (error) {
    console.error("Dispute stage change error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
