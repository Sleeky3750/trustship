import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Flutterwave signature header (Bypasses automatically if secret isn't set in env yet)
    const signature = request.headers.get("verif-hash");
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;

    if (secretHash && signature !== secretHash) {
      console.error("Flutterwave Webhook Security: Invalid verif-hash signature header");
      return NextResponse.json({ error: "Unauthorized signature" }, { status: 401 });
    }

    const payload = await request.json();

    // 2. Log webhook payload to WebhookLog table safely
    try {
      await prisma.webhookLog.create({
        data: {
          provider: "FLUTTERWAVE",
          payload: payload,
        },
      });
    } catch (logErr) {
      console.warn("Could not save to WebhookLog table (skipping log):", logErr);
    }

    // 3. Process successful payment event
    if (payload.event === "charge.completed" && payload.data.status === "successful") {
      const txRef = payload.data.tx_ref;
      const flwTransactionId = String(payload.data.id);

      const transaction = await prisma.escrowTransaction.findUnique({
        where: { transactionRef: txRef },
      });

      if (!transaction) {
        console.error(`Flutterwave Webhook: Transaction ref ${txRef} not found in database`);
        return NextResponse.json({ error: "Transaction ref not found" }, { status: 404 });
      }

      // Avoid double-processing
      if (transaction.status === "ESCROW_LOCKED") {
        return NextResponse.json({ received: true, message: "Transaction already processed" }, { status: 200 });
      }

      // Update status to ESCROW_LOCKED
      await prisma.escrowTransaction.update({
        where: { transactionRef: txRef },
        data: {
          status: "ESCROW_LOCKED",
          paymentProvider: "FLUTTERWAVE",
          flwTransactionId,
        },
      });

      console.log(`✅ Escrow payment confirmed and locked for txRef: ${txRef}`);
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("Flutterwave webhook processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}