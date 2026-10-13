import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import axios from "axios";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// Types for dispute payload
interface DisputePayload {
  transactionId: string;
  disputeFault: "SELLER_FAULT" | "BUYER_FAULT";
  reason?: string;
}

// POST - Dispute & liability arbitration route
export async function POST(request: NextRequest) {
  try {
    const body: DisputePayload = await request.json();
    const { transactionId, disputeFault, reason } = body;

    // Validate required fields
    if (!transactionId || !disputeFault) {
      return NextResponse.json(
        { error: "Missing required fields: transactionId, disputeFault" },
        { status: 400 }
      );
    }

    // Find the transaction
    const transaction = await prisma.escrowTransaction.findFirst({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Ensure transaction is in a state eligible for dispute resolution
    const eligibleStatuses = ["ESCROW_LOCKED", "DISPATCHED", "DELIVERED"];
    if (!eligibleStatuses.includes(transaction.status)) {
      return NextResponse.json(
        { error: "Transaction is not in a dispute-eligible state" },
        { status: 400 }
      );
    }

    // Ensure disputeFault is valid
    const validFaults = ["SELLER_FAULT", "BUYER_FAULT"];
    if (!validFaults.includes(disputeFault)) {
      return NextResponse.json(
        { error: "Invalid disputeFault value" },
        { status: 400 }
      );
    }

    // Initialize calculation variables explicitly to satisfy TypeScript strict mode
    let refundAmount = 0;
    let sellerPayout = 0;
    let refundDescription = reason || "Escrow dispute resolution";

    // --- Seller Fault: wrong or damaged item ---
    if (disputeFault === "SELLER_FAULT") {
      // Refund 100% of escrow (Item Amount + Waybill Fee) back to Buyer
      refundAmount = transaction.totalEscrow;
      sellerPayout = 0;
      refundDescription = reason || "Seller fault - wrong/damaged item refund";

      // Trigger Paystack Refund API
      try {
        await axios.post(
          "https://api.paystack.co/refund",
          {
            transaction: transaction.transactionRef,
            amount: Math.round(refundAmount * 100), // Paystack operates in Kobo
            merchant_note: refundDescription,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (refundError) {
        console.error("Paystack refund error:", refundError);
      }
    }

    // --- Buyer Fault: change of mind or unreachable ---
    else if (disputeFault === "BUYER_FAULT") {
      const returnFee = Math.max(transaction.totalEscrow * 0.1, 50); // Min 50 NGN return fee
      refundAmount = transaction.totalEscrow - returnFee;
      sellerPayout = returnFee; // Seller/logistics gets the return fee
      refundDescription = reason || "Buyer fault - change of mind refund";

      try {
        await axios.post(
          "https://api.paystack.co/refund",
          {
            transaction: transaction.transactionRef,
            amount: Math.round(refundAmount * 100),
            merchant_note: refundDescription,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (refundError) {
        console.error("Paystack refund error:", refundError);
      }
    }

    // Update transaction with dispute resolution
    await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: {
        status: "REFUNDED",
        disputeFault: disputeFault,
        updatedAt: new Date(),
      },
    });

    // --- Notify both parties via WhatsApp ---
    const transactionRef = transaction.transactionRef;
    const totalEscrow = transaction.totalEscrow;

    // Buyer notification
    let buyerMessage: string;
    if (disputeFault === "SELLER_FAULT") {
      buyerMessage = `🛡️ Dispute resolved: Seller fault confirmed. Full refund of ₦${totalEscrow.toLocaleString()} is being processed to your account. Reference: ${transactionRef}`;
    } else {
      const returnedAmount = Math.round(refundAmount);
      const returnFee = totalEscrow - returnedAmount;
      buyerMessage = `🛡️ Dispute resolved: Buyer fault. Refund of ₦${returnedAmount.toLocaleString()} processed (₦${returnFee.toLocaleString()} return fee applied). Reference: ${transactionRef}`;
    }

    if (transaction.buyerPhone) {
      await sendWhatsAppMessage(transaction.buyerPhone, buyerMessage);
    }

    // Seller notification
    let sellerMessage: string;
    if (disputeFault === "SELLER_FAULT") {
      sellerMessage = `🛡️ Dispute resolved: Seller fault confirmed. Full escrow of ₦${totalEscrow.toLocaleString()} refunded to buyer. Reference: ${transactionRef}`;
    } else {
      sellerMessage = `🛡️ Dispute resolved: Buyer fault. Return fee of ₦${sellerPayout.toLocaleString()} collected from escrow. Remaining ₦${Math.round(refundAmount).toLocaleString()} refunded to buyer. Reference: ${transactionRef}`;
    }

    if (transaction.sellerPhone) {
      await sendWhatsAppMessage(transaction.sellerPhone, sellerMessage);
    }

    return NextResponse.json(
      { 
        success: true, 
        data: { 
          transactionId, 
          disputeFault, 
          refundAmount, 
          sellerPayout,
          status: "REFUNDED" 
        } 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Dispute endpoint error:", error);
    return NextResponse.json(
      { error: error.message || "Dispute resolution failed" },
      { status: 500 }
    );
  }
}