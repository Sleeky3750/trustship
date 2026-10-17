import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Find the latest pending transaction
    const transaction = await prisma.escrowTransaction.findFirst({
      where: { status: "PENDING_DEPOSIT" },
      orderBy: { createdAt: "desc" },
    });

    if (!transaction) {
      return NextResponse.json({ message: "No pending escrow transactions found to test." }, { status: 404 });
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

    return NextResponse.json({
      success: true,
      message: `Successfully simulated payment! Transaction ${updated.transactionRef} is now ESCROW_LOCKED.`,
      transaction: updated,
    });
  } catch (error: any) {
    console.error("Test trigger error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}