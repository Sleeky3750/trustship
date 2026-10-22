import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { requestRefund, RefundError, toMajor } from "@/lib/refunds/workflow";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/escrow/ref
 *
 * Creates a refund REQUEST. This is intentionally NOT the endpoint that moves
 * money: it records a request that must be reviewed, approved and executed via
 * the refund workflow (`/api/admin/refunds/*`). Anyone with the refunds:request
 * permission may open a request; execution requires refunds:execute (finance).
 *
 * Previous behaviour — flipping the escrow to REFUNDED and messaging both
 * parties that the money had been returned, without calling Flutterwave — has
 * been removed. The escrow status is left untouched here.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "refunds:request");
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { transactionRef, refundReason, amountMinor } = await request
      .json()
      .catch(() => ({} as any));

    if (!transactionRef) {
      return NextResponse.json(
        { error: "Transaction reference is required" },
        { status: 400 }
      );
    }

    const refund = await requestRefund({
      transactionRef,
      amountMinor:
        amountMinor == null ? undefined : Number(amountMinor),
      reason: refundReason ?? undefined,
      requestedById: admin.id,
    });

    // Best-effort: if the same request already existed we return it unchanged.
    const transaction = await prisma.escrowTransaction.findUnique({
      where: { id: refund.transactionId },
      select: { id: true, transactionRef: true },
    });

    await recordAdminAction(request, {
      adminId: admin.id,
      action: "REFUND_REQUESTED",
      targetId: transaction?.id ?? refund.transactionId,
      message: `Refund requested for ${refund.transactionRef} (${toMajor(
        refund.amountMinor
      )} ${refund.currency}). Reason: ${refundReason || "Not specified"}`,
      changes: {
        refundId: refund.id,
        amountMinor: refund.amountMinor,
        status: refund.status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Refund request recorded. It must be approved and executed by a finance administrator before any funds move.",
        refund: {
          id: refund.id,
          status: refund.status,
          amountMinor: refund.amountMinor,
          currency: refund.currency,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof RefundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Refund request error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
