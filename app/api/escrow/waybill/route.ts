import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { transactionRef, waybillNumber, waybillPayer } = await request.json();

    if (!transactionRef) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Update waybill metadata
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        waybillPayer: waybillPayer || transaction.waybillPayer,
      },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: any) {
    console.error("Waybill update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}