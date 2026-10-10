import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import axios from "axios"

// Helper: Verify Paystack HMAC SHA512 signature
function verifyPaystackSignature(req: NextRequest, secretKey: string): boolean {
  const signature = req.headers.get("x-paystack-signature")
  if (!signature) return false

  const body = req.body
  // Paystack signs the raw body; we re-compute the HMAC on the stringified body
  const crypto = require("crypto")
  const hmac = crypto.createHmac("sha512", secretKey)
  hmac.update(JSON.stringify(body))
  const computed = hmac.digest("base64")

  return computed === signature
}

// POST - Paystack webhook handler with signature verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // --- Signature Verification ---
    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY not configured")
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const isValid = verifyPaystackSignature(request, secretKey)
    if (!isValid) {
      console.warn("Invalid Paystack webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const { event, data } = body

    // Log the webhook event (after signature validation)
    await prisma.webhookLog.create({
      data: {
        provider: "PAYSTACK",
        payload: body,
      },
    })

    // Handle different event types
    switch (event) {
      case "charge.success": {
        const {
          reference,
          amount,
          status,
          metadata,
        } = data

        // Process successful payment
        if (status === "success" && metadata) {
          const { transactionRef, escrowId } = metadata

          // Find the corresponding EscrowTransaction
          const transaction = await prisma.escrowTransaction.findFirst({
            where: { transactionRef },
          })

          if (transaction) {
            // Transition status from PENDING_DEPOSIT -> ESCROW_LOCKED
            // Only transition if currently in PENDING_DEPOSIT
            if (transaction.status === "PENDING_DEPOSIT") {
              await prisma.escrowTransaction.update({
                where: { id: transaction.id },
                data: {
                  status: "ESCROW_LOCKED",
                  updatedAt: new Date(),
                },
              })
            }

            // Trigger WhatsApp notifications
            // To Seller: "₦[amount] Escrow Locked! You can now dispatch the item."
            // To Buyer: "Payment verified! Waybill is now active. Your 4-digit release PIN is: [releasePin]. Only share this PIN after inspecting your item."
            if (transaction.sellerPhone) {
              await axios.post(
                `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
                {
                  messaging_product: "whatsapp",
                  to: transaction.sellerPhone,
                  type: "text",
                  text: `₦${amount} Escrow Locked! You can now dispatch the item.`,
                },
                {
                  headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                  },
                }
              )
            }

            if (transaction.buyerPhone) {
              await axios.post(
                `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
                {
                  messaging_product: "whatsapp",
                  to: transaction.buyerPhone,
                  type: "text",
                  text: `Payment verified! Waybill is now active. Your 4-digit release PIN is: ${transaction.releasePin}. Only share this PIN after inspecting your item.`,
                },
                {
                  headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                  },
                }
              )
            }
          }
        }
        break
      }

      case "transfer.success": {
        const {
          reference,
          amount,
          metadata,
        } = data

        // Log payout completion
        if (metadata?.transactionRef) {
          await prisma.escrowTransaction.update({
            where: { transactionRef: metadata.transactionRef },
            data: {
              status: "RELEASED",
              updatedAt: new Date(),
            },
          })
        }
        break
      }

      case "transfer.failed": {
        const {
          reference,
          amount,
          metadata,
        } = data

        // Flag failures for administrative retry
        if (metadata?.transactionRef) {
          await prisma.escrowTransaction.update({
            where: { transactionRef: metadata.transactionRef },
            data: {
              status: "DISPUTED",
              disputeFault: "BUYER_FAULT", // Could be adjusted based on business rules
              updatedAt: new Date(),
            },
          })
        }
        break
      }

      default:
        // Unhandled event type
        break
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error("Paystack webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}