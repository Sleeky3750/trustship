import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // 1. Verify Paystack webhook signature for security
    const secret = process.env.PAYSTACK_SECRET_KEY || "";
    const hash = crypto
      .createHmac("sha512", secret)
      .update(bodyText)
      .digest("hex");

    if (hash !== signature) {
      console.warn("⚠️ Invalid Paystack webhook signature detected.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(bodyText);

    // 2. Handle successful charge event
    if (event.event === "charge.success") {
      const paymentData = event.data;
      const transactionRef = paymentData.metadata?.transactionRef || paymentData.reference;

      console.log(`💳 Paystack payment successful for reference: ${transactionRef}`);

      // Update transaction status to funded/active (e.g., ready for dispatch)
      const updatedTx = await prisma.escrowTransaction.updateMany({
        where: { transactionRef: transactionRef },
        data: { 
          // You can map this to an active state like "FUNDED" or keep tracking dispatchStatus
          dispatchStatus: "PROCESSING" 
        },
      });

      console.log(`✅ Updated transaction state for ${transactionRef}. Records modified:`, updatedTx.count);
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("Paystack webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}