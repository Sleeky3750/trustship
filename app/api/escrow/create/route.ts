import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
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

    // Create escrow with complete fallback defaults for User relation requirements
    const escrow = await (prisma.escrowTransaction as any).create({
      data: {
        transactionRef,
        itemAmount: itemNum,
        waybillAmount: waybillNum,
        waybillPayer: waybillPayer || "BUYER",
        platformFee,
        totalEscrow,
        buyerPhone,
        sellerPhone,
        releasePin,
        status: "PENDING_DEPOSIT",
        dispatchStatus: "PENDING",
        buyer: {
          connectOrCreate: {
            where: { phone: buyerPhone },
            create: { 
              phone: buyerPhone, 
              name: "Buyer",
              bankCode: "000",
              bankName: "Default Bank",
              accountNumber: "0000000000",
              accountName: "Buyer Default"
            },
          },
        },
        seller: {
          connectOrCreate: {
            where: { phone: sellerPhone },
            create: { 
              phone: sellerPhone, 
              name: "Seller",
              bankCode: "000",
              bankName: "Default Bank",
              accountNumber: "0000000000",
              accountName: "Seller Default"
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, transactionRef: escrow.transactionRef, escrow });
  } catch (error: any) {
    console.error("Escrow creation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create escrow" }, { status: 500 });
  }
}