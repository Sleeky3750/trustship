import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      currency = "NGN",
      itemAmount,
      waybillAmount,
      waybillPayer,
      buyerPhone,
      sellerPhone,
    } = body;

    const itemNum = Number(itemAmount) || 0;
    const waybillNum = Number(waybillAmount) || 0;
    
    // 5% platform fee calculation
    const platformFee = Math.round(itemNum * 0.05 * 100) / 100;
    const totalEscrow = itemNum + (waybillPayer === "BUYER" ? waybillNum : 0) + platformFee;

    // Generate reference code & PIN
    const transactionRef = `TS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const releasePin = Math.floor(1000 + Math.random() * 9000).toString();

    const escrow = await prisma.escrowTransaction.create({
      data: {
        transactionRef,
        currency,
        itemAmount: itemNum,
        waybillAmount: waybillNum,
        waybillPayer,
        platformFee,
        totalEscrow,
        buyerPhone,
        sellerPhone,
        releasePin,
        status: "PENDING_DEPOSIT",
      },
    });

    return NextResponse.json({ success: true, transactionRef: escrow.transactionRef, escrow });
  } catch (error: any) {
    console.error("Escrow creation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create escrow" }, { status: 500 });
  }
}