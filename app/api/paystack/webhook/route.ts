// Paystack webhook listener (Module C of the WhatsApp-first escrow flow).
//
// Verifies `x-paystack-signature` = HMAC-SHA512(raw body, PAYSTACK_SECRET_KEY)
// in constant time, then processes `charge.success` events:
//   EscrowTransaction PENDING_PAYMENT -> ESCROW_LOCKED
// plus dual WhatsApp notifications (funds-secured to the buyer, deliver-the-
// item to the seller). Replays and out-of-state events are acknowledged with
// 200 but processed as no-ops so Paystack never retries-forever.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaystackSignature } from "@/lib/paystack";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    const signature = request.headers.get("x-paystack-signature");

    // Fail-closed verification: rejects forged payloads; a missing
    // PAYSTACK_SECRET_KEY throws (-> 500) in production.
    if (!verifyPaystackSignature(rawBody, signature)) {
      console.error(
        "Paystack webhook: missing or invalid x-paystack-signature — rejected."
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));

    // Persist the raw event for auditing / replay diagnostics.
    try {
      await prisma.webhookLog.create({
        data: {
          provider: "PAYSTACK",
          payload: payload,
        },
      });
    } catch (logErr) {
      console.warn("Could not save to WebhookLog table (skipping log):", logErr);
    }

    if (payload?.event !== "charge.success") {
      return NextResponse.json({ status: true, message: "Ignored event" }, { status: 200 });
    }

    const reference = payload.data?.reference;
    if (!reference || typeof reference !== "string") {
      console.warn("Paystack charge.success without a reference — ignored.");
      return NextResponse.json({ status: true, message: "No reference" }, { status: 200 });
    }

    const transaction = await prisma.escrowTransaction.findFirst({
      where: { OR: [{ transactionRef: reference }, { paystackRef: reference }] },
    });

    if (!transaction) {
      console.warn(`Paystack charge.success for unknown reference ${reference} — ignored.`);
      return NextResponse.json({ status: true, message: "Unknown reference" }, { status: 200 });
    }

    // Only PENDING_PAYMENT escrows (the seller-accepted WhatsApp flow) can be
    // locked by this event; replays (already ESCROW_LOCKED) are no-ops.
    if (transaction.status !== "PENDING_PAYMENT") {
      console.log(
        `Paystack charge.success for ${reference} in status ${transaction.status} — no-op.`
      );
      return NextResponse.json({ status: true, message: "Out-of-state event" }, { status: 200 });
    }

    // Integrity checks (defense in depth — the signature already authenticates
    // the sender): the settled amount and currency must match the escrow.
    const expectedAmountKobo = Math.round(transaction.totalEscrow * 100);
    if (
      payload.data.currency &&
      payload.data.currency !== transaction.currency
    ) {
      console.error(
        `Paystack currency mismatch for ${reference}: got ${payload.data.currency}, expected ${transaction.currency} — not locking funds.`
      );
      return NextResponse.json({ status: true, message: "Currency mismatch" }, { status: 200 });
    }
    if (
      payload.data.amount != null &&
      Number(payload.data.amount) !== expectedAmountKobo
    ) {
      console.error(
        `Paystack amount mismatch for ${reference}: got ${payload.data.amount} kobo, expected ${expectedAmountKobo} kobo — not locking funds.`
      );
      return NextResponse.json({ status: true, message: "Amount mismatch" }, { status: 200 });
    }

    // Lock the funds.
    await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { status: "ESCROW_LOCKED" },
    });

    // Buyer: funds are held safely; include the release PIN (the same PIN the
    // web/Flutterwave flow delivers at activation) so the buyer can release.
    await sendWhatsAppMessage(
      transaction.buyerPhone,
      `🔒 *Funds Secured!*\n\n` +
        `₦${transaction.totalEscrow.toLocaleString()} is now safely held in TrustShip escrow for ` +
        `*${transaction.transactionRef}* (${transaction.itemTitle ?? "item"}).\n\n` +
        `🔑 Your release PIN: *${transaction.releasePin}*\n\n` +
        `Once you receive the item, send this PIN here to release the funds to the seller.`
    );

    // Seller: payment is secured — deliver the item.
    await sendWhatsAppMessage(
      transaction.sellerPhone,
      `💰 *Payment secured for ${transaction.transactionRef}*!\n\n` +
        `The buyer's funds are safely held in TrustShip escrow. Please deliver ` +
        `${transaction.itemTitle ?? "the item"} — you'll be paid as soon as the buyer confirms delivery.`
    );

    return NextResponse.json({ status: true, message: "Escrow locked" }, { status: 200 });
  } catch (error: unknown) {
    console.error("Paystack webhook error:", error);
    return NextResponse.json(
      { error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
