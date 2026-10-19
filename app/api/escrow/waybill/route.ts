import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { transactionRef, waybillPayer, dispatchStatus } = await request.json();

    if (!transactionRef) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Allow the admin dashboard's "Mark Delivered" action to move the
    // dispatch state forward alongside the waybill payer.
    const allowedDispatch = ["PENDING", "IN_TRANSIT", "DELIVERED"];
    const nextDispatch =
      typeof dispatchStatus === "string" && allowedDispatch.includes(dispatchStatus)
        ? dispatchStatus
        : undefined;

    // Update waybill metadata
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        waybillPayer: waybillPayer || transaction.waybillPayer,
        ...(nextDispatch ? { dispatchStatus: nextDispatch } : {}),
        ...(nextDispatch === "DELIVERED" && transaction.status !== "RELEASED"
          ? { status: "DELIVERED" }
          : {}),
      },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: any) {
    console.error("Waybill update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}