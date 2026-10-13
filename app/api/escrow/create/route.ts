import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      itemAmount,
      waybillAmount = 0,
      waybillPayer = "BUYER", // "BUYER" or "SELLER"
      buyerPhone,
      sellerPhone,
      buyerEmail,
      sellerEmail,
      buyerName,
      sellerName,
    } = body;

    // 1. Validate required fields
    if (!itemAmount || !buyerPhone || !sellerPhone) {
      return NextResponse.json(
        { error: "Missing required fields: itemAmount, buyerPhone, and sellerPhone are mandatory." },
        { status: 400 }
      );
    }

    // 2. Calculate fees & totals
    const parsedItemAmount = Number(itemAmount);
    const parsedWaybillAmount = Number(waybillAmount);
    
    // 1.5% platform fee calculation
    const platformFee = Math.round(parsedItemAmount * 0.015); 
    const totalEscrow = parsedItemAmount + (waybillPayer === "BUYER" ? parsedWaybillAmount : 0);

    // 3. Generate a secure 4-digit release PIN for the buyer & transaction reference
    const releasePin = Math.floor(1000 + Math.random() * 9000).toString();
    const transactionRef = `TS-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // 4. Upsert Buyer and Seller in database (using phone as unique identifier)
    const buyer = await prisma.user.upsert({
      where: { phone: buyerPhone },
      update: { name: buyerName || "Buyer" },
      create: { 
        phone: buyerPhone, 
        name: buyerName || "Buyer", 
        role: "BUYER" 
      },
    });

    const seller = await prisma.user.upsert({
      where: { phone: sellerPhone },
      update: { name: sellerName || "Seller" },
      create: { 
        phone: sellerPhone, 
        name: sellerName || "Seller", 
        role: "SELLER" 
      },
    });

    // 5. Create the Escrow Transaction record (fixed status to PENDING_DEPOSIT)
    const transaction = await prisma.escrowTransaction.create({
      data: {
        transactionRef,
        itemAmount: parsedItemAmount,
        waybillAmount: parsedWaybillAmount,
        totalEscrow,
        platformFee,
        waybillPayer,
        dispatchStatus: "NOT_DISPATCHED",
        status: "PENDING_DEPOSIT", // Correct Enum matching your Prisma schema
        releasePin,
        termsAcceptedByBuyer: true,
        buyerPhone,
        sellerPhone,
        buyerId: buyer.id,
        sellerId: seller.id,
      },
    });

    console.log(`📦 Created new Escrow Transaction: ${transactionRef} with PIN ${releasePin}`);

    return NextResponse.json(
      {
        success: true,
        message: "Escrow transaction created successfully",
        data: {
          transactionRef: transaction.transactionRef,
          totalEscrow: transaction.totalEscrow,
          releasePin: transaction.releasePin, 
          status: transaction.status,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Failed to create escrow transaction:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during escrow creation" },
      { status: 500 }
    );
  }
}