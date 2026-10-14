import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import axios from "axios";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body as string for accurate HMAC signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY not configured");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // 2. Compute Paystack HMAC SHA-512 signature in HEX
    const computedSignature = crypto
      .createHmac("sha512", secretKey)
      .update(rawBody)
      .digest("hex");

    if (!signature || signature !== computedSignature) {
      console.warn("Invalid Paystack webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Parse JSON after signature validation passes
    const body = JSON.parse(rawBody);
    const { event, data } = body;

    // Log the webhook payload
    await prisma.webhookLog.create({
      data: {
        provider: "PAYSTACK",
        payload: body,
      },
    });

    // 4. Handle events
    switch (event) {
      case "charge.success": {
        const { status, metadata, amount } = data;

        if (status === "success" && metadata) {
          const { transactionRef } = metadata;

          const transaction = await prisma.escrowTransaction.findFirst({
            where: { transactionRef },
          });

          if (transaction && transaction.status === "PENDING_DEPOSIT") {
            // Update transaction status to ESCROW_LOCKED
            await prisma.escrowTransaction.update({
              where: { id: transaction.id },
              data: {
                status: "ESCROW_LOCKED",
                updatedAt: new Date(),
              },
            });

            // Format kobo to Naira for display (e.g. 1000000 kobo -> 10,000 NGN)
            const formattedAmount = (amount / 100).toLocaleString("en-NG", {
              style: "currency",
              currency: "NGN",
            });

            // Trigger WhatsApp notification to Seller
            if (transaction.sellerPhone && process.env.WHATSAPP_TOKEN) {
              await axios.post(
                `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
                {
                  messaging_product: "whatsapp",
                  to: transaction.sellerPhone,
                  type: "text",
                  text: {
                    body: `🔒 ${formattedAmount} Escrow Locked! You can now dispatch the item to the buyer.`,
                  },
                },
                {
                  headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json",
                  },
                }
              ).catch((err) => console.error("WhatsApp Seller notification failed:", err?.response?.data || err.message));
            }

            // Trigger WhatsApp notification to Buyer
            if (transaction.buyerPhone && process.env.WHATSAPP_TOKEN) {
              await axios.post(
                `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
                {
                  messaging_product: "whatsapp",
                  to: transaction.buyerPhone,
                  type: "text",
                  text: {
                    body: `✅ Payment verified! Waybill is now active.\n\n🔑 Your 4-digit release PIN is: *${transaction.releasePin}*\n\n⚠️ Only share this PIN with the seller AFTER inspecting and accepting your item.`,
                  },
                },
                {
                  headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json",
                  },
                }
              ).catch((err) => console.error("WhatsApp Buyer notification failed:", err?.response?.data || err.message));
            }
          }
        }
        break;
      }

      case "transfer.success": {
        if (data.metadata?.transactionRef) {
          await prisma.escrowTransaction.update({
            where: { transactionRef: data.metadata.transactionRef },
            data: {
              status: "RELEASED",
              updatedAt: new Date(),
            },
          });
        }
        break;
      }

      case "transfer.failed": {
        if (data.metadata?.transactionRef) {
          await prisma.escrowTransaction.update({
            where: { transactionRef: data.metadata.transactionRef },
            data: {
              status: "DISPUTED",
              disputeFault: "BUYER_FAULT",
              updatedAt: new Date(),
            },
          });
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("Paystack webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}