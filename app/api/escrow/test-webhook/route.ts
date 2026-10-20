import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";

// Admin-only helper that simulates a successful Flutterwave charge so the
// escrow flow can be exercised without real money. Accepts ?ref=<txRef> to
// target one transaction, otherwise locks the most recently created escrow
// that is still awaiting deposit.
//
// POST (not GET): this endpoint mutates escrow state — a state-changing GET
// could be triggered by a top-level navigation (SameSite=Lax sends cookies
// on top-level GETs), so the handler only accepts POST.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("ref");

    const transaction = ref
      ? await prisma.escrowTransaction.findUnique({ where: { transactionRef: ref } })
      : await prisma.escrowTransaction.findFirst({
          where: { status: "PENDING_DEPOSIT" },
          orderBy: { createdAt: "desc" },
        });

    if (!transaction) {
      return NextResponse.json({ message: "No pending escrow transactions found to test." }, { status: 404 });
    }

    if (transaction.status !== "PENDING_DEPOSIT") {
      return NextResponse.json(
        { error: `Transaction ${transaction.transactionRef} is ${transaction.status}, not PENDING_DEPOSIT` },
        { status: 409 }
      );
    }

    // Simulate the payment success update
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "ESCROW_LOCKED",
        paymentProvider: "FLUTTERWAVE",
        flwTransactionId: "TEST-FLW-ID-99999",
      },
    });

    // Audit the simulated payment (state override) with real IP + User-Agent.
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "PAYMENT_SIMULATED",
      targetId: transaction.id,
      message: `Simulated Flutterwave payment for ${transaction.transactionRef} (test webhook)`,
      changes: {
        status: { from: "PENDING_DEPOSIT", to: "ESCROW_LOCKED" },
        paymentProvider: "FLUTTERWAVE",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully simulated payment! Transaction ${updated.transactionRef} is now ESCROW_LOCKED.`,
      transaction: {
        id: updated.id,
        transactionRef: updated.transactionRef,
        status: updated.status,
        totalEscrow: updated.totalEscrow,
        platformFee: updated.platformFee,
      },
    });
  } catch (error: any) {
    console.error("Test trigger error:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
