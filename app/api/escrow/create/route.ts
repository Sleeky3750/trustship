import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { buyerPhone, sellerPhone, itemAmount, itemDescription } = body;

    if (!buyerPhone || !sellerPhone || !itemAmount) {
      return NextResponse.json(
        { error: "Missing buyerPhone, sellerPhone, or itemAmount" },
        { status: 400 }
      );
    }

    const amount = Number(itemAmount);
    const totalEscrow = amount; // Adjust if you add service fees

    // 1. Generate random 4-digit Release PIN for the buyer
    const releasePin = Math.floor(1000 + Math.random() * 9000).toString();

    // 2. Generate unique transaction reference
    const transactionRef = `TS-${Math.floor(100000 + Math.random() * 900000)}`;

    // 3. Save to Database with PENDING_DEPOSIT status
    const transaction = await prisma.escrowTransaction.create({
      data: {
        transactionRef,
        buyerPhone,
        sellerPhone,
        itemAmount: amount,
        totalEscrow,
        releasePin,
        status: "PENDING_DEPOSIT",
        dispatchStatus: "PENDING",
      },
    });

    // 4. Instantly Initialize Paystack Payment Link
    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        amount: Math.round(totalEscrow * 100), // Paystack expects amount in kobo
        email: `buyer${transaction.id}@trustship.io`,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
        metadata: {
          transactionRef: transaction.transactionRef,
          buyerPhone: transaction.buyerPhone,
          sellerPhone: transaction.sellerPhone,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const authorizationUrl = paystackRes.data.data.authorization_url;

    // 5. Instantly Send WhatsApp Message to Buyer with Payment Link
    await sendWhatsAppMessage(
      buyerPhone,
      `🛡️ *New TrustShip Escrow Created!*\n\n` +
      `• Ref: *${transactionRef}*\n` +
      `• Item Amount: ₦${amount.toLocaleString()}\n\n` +
      `Please complete your payment to lock funds securely in escrow:\n${authorizationUrl}\n\n` +
      `_Once paid, your escrow will lock and your tracking will update._`
    );

    return NextResponse.json({
      success: true,
      transactionRef,
      authorizationUrl,
    });
  } catch (error: any) {
    console.error("Escrow creation error:", error?.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to create escrow and initialize payment" },
      { status: 500 }
    );
  }
}
