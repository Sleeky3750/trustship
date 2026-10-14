import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendInteractiveButtons } from "@/lib/whatsapp"
import axios from "axios"

// GET - Meta verification for WhatsApp Business API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 })
}

// POST - WhatsApp message handling with state machine
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entry } = body

    if (entry) {
      for (const entryItem of entry) {
        if (entryItem.changes) {
          for (const change of entryItem.changes) {
            const value = change.value

            if (value && value.messages && Array.isArray(value.messages)) {
              for (const message of value.messages) {
                const { from, text, interactive } = message

                if (text) {
                  await handleTextMessage(from, text.body || text.text)
                }

                if (interactive) {
                  await handleInteractiveMessage(from, interactive)
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error("WhatsApp webhook error:", error)
    return NextResponse.json(
      { error: "WhatsApp webhook processing failed" },
      { status: 500 }
    )
  }
}

// --- State Machine Handlers ---

async function handleTextMessage(from: string, text: string) {
  const cleanText = text.trim()
  const pinMatch = cleanText.match(/^(\d{4})$/)
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@trustship.io"

  // 1. Handle 4-Digit Release PIN Verification
  if (pinMatch) {
    const pin = pinMatch[1]

    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        buyerPhone: from,
        releasePin: pin,
        status: { in: ["ESCROW_LOCKED", "DELIVERED"] },
      },
    })

    if (transaction) {
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "RELEASED",
          updatedAt: new Date(),
        },
      })

      try {
        await axios.post(
          "https://api.paystack.co/transfer",
          {
            amount: Math.round(transaction.totalEscrow * 100),
            source: "balance",
            reason: `Escrow release for ref: ${transaction.transactionRef}`,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
          }
        )
      } catch (paystackError: any) {
        console.error("Paystack transfer API error:", paystackError?.response?.data || paystackError.message)
      }

      await sendWhatsAppMessage(
        from,
        `✅ Payment released successfully! ₦${transaction.totalEscrow.toLocaleString()} has been cleared for transfer to the seller. Thank you for using TrustShip!`
      )

      if (transaction.sellerPhone) {
        await sendWhatsAppMessage(
          transaction.sellerPhone,
          `🎉 Success! The buyer has released funds (₦${transaction.totalEscrow.toLocaleString()}) for escrow *${transaction.transactionRef}*. Payout is processing.`
        )
      }
    } else {
      const anyTx = await prisma.escrowTransaction.findFirst({
        where: { buyerPhone: from },
      })

      if (anyTx) {
        await sendWhatsAppMessage(
          from,
          `❌ Invalid PIN or this escrow is not currently in a locked/active deposit state. Need help? Reach us at ${supportEmail}`
        )
      } else {
        await sendWhatsAppMessage(
          from,
          `❌ No active escrow transaction found associated with your phone number. Need help? Reach us at ${supportEmail}`
        )
      }
    }
    return
  }

  // 2. Handle checking transaction status via reference code (e.g. TS-XXXXXX)
  if (cleanText.toUpperCase().startsWith("TS-")) {
    const refCode = cleanText.toUpperCase()
    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        transactionRef: refCode,
        OR: [{ buyerPhone: from }, { sellerPhone: from }],
      },
    })

    if (transaction) {
      await sendWhatsAppMessage(
        from,
        `📋 *Escrow Status: ${transaction.transactionRef}*\n\n` +
        `• Status: *${transaction.status}*\n` +
        `• Item Amount: ₦${transaction.itemAmount.toLocaleString()}\n` +
        `• Waybill Status: ${transaction.dispatchStatus}\n\n` +
        `_Reply with your 4-digit PIN to release funds upon inspection._`
      )
    } else {
      await sendWhatsAppMessage(
        from,
        `❌ Transaction *${refCode}* not found or you are not a participant in this trade. Contact support: ${supportEmail}`
      )
    }
    return
  }

  // 3. Fallback Welcome Message with Support Info
  await sendWhatsAppMessage(
    from,
    `Welcome to *TrustShip Escrow* 🛡️\n\n` +
    `Manage your trades right here on WhatsApp:\n` +
    `• Send your reference code (e.g. *TS-XXXXXX*) to check status.\n` +
    `• Send your 4-digit *Release PIN* after inspecting your item to release funds to the seller.\n\n` +
    `📧 *Need Support?*\n` +
    `Email us at: ${supportEmail}`
  )
}

async function handleInteractiveMessage(from: string, interactive: any) {
  const { type, title, id } = interactive

  if (type === "button") {
    if (title === "Accept Terms") {
      const transaction = await prisma.escrowTransaction.findFirst({
        where: {
          buyerPhone: from,
          termsAcceptedByBuyer: false,
        },
      })

      if (transaction) {
        await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: {
            termsAcceptedByBuyer: true,
            status: "PENDING_DEPOSIT",
          },
        })

        await initializePaystackPayment(transaction)
      }
    }
  }
}

async function initializePaystackPayment(transaction: any) {
  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        amount: Math.round(transaction.totalEscrow * 100),
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
    )

    const { authorization_url } = response.data.data

    await sendWhatsAppMessage(
      transaction.buyerPhone!,
      `💳 Payment Link for ₦${transaction.totalEscrow.toLocaleString()}\n\nPlease complete the payment to lock your escrow contract.\n\n${authorization_url}`
    )
  } catch (error) {
    console.error("Paystack initialization error:", error)
    await sendWhatsAppMessage(
      transaction.buyerPhone!,
      `❌ Failed to generate payment link. Please contact support at ${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@trustship.io"} if the issue persists.`
    )
  }
}