import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import axios from "axios";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

interface ResolutionPayload {
  transactionRef: string;
  resolution: "RELEASE_TO_SELLER" | "REFUND_BUYER";
  adminNote?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ResolutionPayload = await request.json();
    const { transactionRef, resolution, adminNote } = body;

    // 1. Validate inputs
    if (!transactionRef || !resolution) {
      return NextResponse.json(
        { error: "Missing required fields: transactionRef, resolution" },
        { status: 400 }
      );
    }

    if (!["RELEASE_TO_SELLER", "REFUND_BUYER"].includes(resolution)) {
      return NextResponse.json(
        { error: "Invalid resolution option. Choose RELEASE_TO_SELLER or REFUND_BUYER" },
        { status: 400 }
      );
    }

    // 2. Find the transaction
    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
      include: { seller: true, buyer: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.status !== "DISPUTED") {
      return NextResponse.json(
        { error: `Transaction is not under dispute. Current status: ${transaction.status}` },
        { status: 400 }
      );
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.json({ error: "Paystack secret key missing in environment" }, { status: 500 });
    }

    let updatedStatus: string;

    // --- RESOLUTION A: RELEASE FUNDS TO SELLER ---
    if (resolution === "RELEASE_TO_SELLER") {
      updatedStatus = "RELEASED";

      // 1. Create Paystack Transfer Recipient for Seller
      const recipientRes = await axios.post(
        "https://api.paystack.co/transferrecipient",
        {
          type: "nuban",
          name: transaction.seller.name,
          account_number: transaction.seller.accountNumber,
          bank_code: transaction.seller.bankCode,
          currency: "NGN",
        },
        {
          headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
        }
      );

      const recipientCode = recipientRes.data.data.recipient_code;
      const transferAmountInKobo = Math.round(transaction.itemAmount * 100);

      // 2. Initiate Payout Transfer
      await axios.post(
        "https://api.paystack.co/transfer",
        {
          source: "balance",
          amount: transferAmountInKobo,
          recipient: recipientCode,
          reason: `TrustShip Dispute Resolution Payout - Ref: ${transactionRef}`,
        },
        {
          headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
        }
      );

      // 3. Update DB Status
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: { status: "RELEASED", updatedAt: new Date() },
      });

      // 4. Notify Parties via WhatsApp
      if (transaction.buyerPhone) {
        await sendWhatsAppMessage(
          transaction.buyerPhone,
          `⚖️ Dispute Resolved: Admin reviewed transaction *${transactionRef}* and ruled in favor of the seller. Funds have been released. Note: ${adminNote || "No additional note."}`
        );
      }

      if (transaction.sellerPhone) {
        await sendWhatsAppMessage(
          transaction.sellerPhone,
          `🎉 Dispute Resolved: Admin ruled in your favor for *${transactionRef}*. Your payout of ₦${transaction.itemAmount} has been sent to your bank account!`
        );
      }
    }

    // --- RESOLUTION B: REFUND BUYER ---
    else {
      updatedStatus = "REFUNDED";

      // 1. Call Paystack Refund API
      // Note: transactionRef should map to the Paystack transaction reference or charge id
      await axios.post(
        "https://api.paystack.co/refund",
        {
          transaction: transaction.transactionRef,
          amount: Math.round(transaction.totalEscrow * 100), // Full refund in kobo
          reason: adminNote || "Admin dispute resolution refund",
        },
        {
          headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
        }
      );

      // 2. Update DB Status
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: { status: "REFUNDED", updatedAt: new Date() },
      });

      // 3. Notify Parties via WhatsApp
      if (transaction.buyerPhone) {
        await sendWhatsAppMessage(
          transaction.buyerPhone,
          `⚖️ Dispute Resolved: Admin reviewed transaction *${transactionRef}* and approved a full refund of ₦${transaction.totalEscrow}. It will reflect in your account shortly.`
        );
      }

      if (transaction.sellerPhone) {
        await sendWhatsAppMessage(
          transaction.sellerPhone,
          `⚖️ Dispute Resolved: Admin reviewed transaction *${transactionRef}* and issued a refund to the buyer.`
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Dispute successfully resolved as ${updatedStatus}`,
        data: { transactionRef, status: updatedStatus },
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("Admin Dispute Resolution Error:", error.response?.data || error.message);
    return NextResponse.json(
      { error: error.response?.data?.message || "Admin dispute resolution failed" },
      { status: 500 }
    );
  }
}