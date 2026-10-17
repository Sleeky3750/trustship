import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionRef = searchParams.get("ref");

    if (!transactionRef) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        transactionRef: transaction.transactionRef,
        status: transaction.status,
        dispatchStatus: transaction.dispatchStatus,
        totalEscrow: transaction.totalEscrow,
        itemAmount: transaction.itemAmount,
        waybillAmount: transaction.waybillAmount,
        releasePin: transaction.releasePin,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Escrow status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}