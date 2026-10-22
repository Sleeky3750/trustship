import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import {
  transitionRefund,
  executeRefund,
  RefundError,
  toMajor,
} from "@/lib/refunds/workflow";

type ActionContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/refunds/[id]
 *
 * Drives a refund through its lifecycle. Each action maps to a distinct
 * permission so support moderators can review but never approve or execute:
 *
 *   review  → refunds:request  (REQUESTED → UNDER_REVIEW)
 *   approve → refunds:approve  (→ APPROVED)
 *   reject  → refunds:approve  (→ REJECTED)
 *   execute → refunds:execute  (APPROVED → PROCESSING → COMPLETED/FAILED)
 */
const ACTION_PERMISSION = {
  review: "refunds:request",
  approve: "refunds:approve",
  reject: "refunds:approve",
  execute: "refunds:execute",
} as const;

export async function POST(request: NextRequest, context: ActionContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Refund id is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({} as any));
    const action = String(body?.action || "");

    const permission =
      ACTION_PERMISSION[action as keyof typeof ACTION_PERMISSION];
    if (!permission) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const auth = await requirePermission(request, permission);
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const refund = await prisma.refund.findUnique({ where: { id } });
    if (!refund) {
      return NextResponse.json({ error: "Refund not found" }, { status: 404 });
    }

    switch (action) {
      case "review":
      case "approve":
      case "reject": {
        const to =
          action === "review"
            ? "UNDER_REVIEW"
            : action === "approve"
              ? "APPROVED"
              : "REJECTED";

        const updated = await transitionRefund({
          refundId: refund.id,
          to,
          reviewedById: admin.id,
          note: body?.note,
        });

        await recordAdminAction(request, {
          adminId: admin.id,
          action: `REFUND_${to}`,
          targetId: refund.transactionId,
          message: `Refund ${refund.id} for ${refund.transactionRef} → ${to}`,
          changes: { refundId: refund.id, from: refund.status, to },
        });

        return NextResponse.json({ success: true, refund: serialize(updated) });
      }

      case "execute": {
        const result = await executeRefund({ refundId: refund.id, actorId: admin.id });

        await recordAdminAction(request, {
          adminId: admin.id,
          action: "REFUND_EXECUTED",
          targetId: refund.transactionId,
          message: `Refund execution for ${refund.transactionRef}: ${result.status}${
            result.processorRef ? ` (${result.processorRef})` : ""
          }`,
          changes: {
            refundId: refund.id,
            amountMinor: refund.amountMinor,
            outcome: result.status,
            processorRef: result.processorRef ?? null,
          },
        });

        const fresh = await prisma.refund.findUnique({ where: { id: refund.id } });
        return NextResponse.json({
          success: result.ok,
          message: result.message ?? null,
          refund: fresh ? serialize(fresh) : null,
        });
      }
    }
  } catch (error: unknown) {
    if (error instanceof RefundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Refund action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function serialize(r: {
  id: string;
  transactionRef: string;
  amountMinor: number;
  currency: string;
  status: string;
  reason: string | null;
  processorRef: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: r.id,
    transactionRef: r.transactionRef,
    amountMinor: r.amountMinor,
    amount: toMajor(r.amountMinor),
    currency: r.currency,
    status: r.status,
    reason: r.reason,
    processorRef: r.processorRef,
    failureReason: r.failureReason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  };
}
