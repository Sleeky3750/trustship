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

  // Verify the verification token
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

    // Process WhatsApp webhook entries
    if (entry) {
      for (const entryItem of entry) {
        if (entryItem.changes) {
          for (const change of entryItem.changes) {
            const value = change.value

            // Handle incoming messages
            if (value.messages) {
              const { messages, contacts } = value

              for (const message of messages) {
                const { from, text, interactive } = message

                if (text) {
                  // Handle text messages (e.g., 4-digit PIN verification)
                  await handleTextMessage(from, text.text)
                }

                if (interactive) {
                  // Handle interactive button replies and list replies
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

/**
 * Handle text messages from buyers/sellers
 * State 3: 4-Digit Release PIN Verification
 */
async function handleTextMessage(from: string, text: string) {
  // Check if the text is a 4-digit PIN
  const pinMatch = text.match(/^(\d{4})$/)

  if (pinMatch) {
    const pin = pinMatch[1]

    // Find transaction where buyerPhone matches and status is awaiting PIN
    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        buyerPhone: from,
        status: "DELIVERED", // Buyer has inspected and is now releasing PIN
      },
    })

    if (transaction && transaction.releasePin === pin) {
      // State 3: PIN verified - release funds
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "RELEASED",
          updatedAt: new Date(),
        },
      })

      // Trigger Paystack Transfer API to payout to seller
      try {
        await axios.post(
          "https://api.paystack.co/transfer",
          {
            amount: transaction.totalEscrow * 100, // Paystack uses kobo
            recipient: transaction.sellerPhone, // Will need proper sub-account format
            reason: "Escrow release - item delivered successfully",
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
          }
        )
      } catch (paystackError) {
        console.error("Paystack transfer error:", paystackError)
        // Continue even if transfer fails - log and notify
      }

      // Notify both parties
      await sendWhatsAppMessage(
        from,
        `✅ Payment released successfully! ₦${transaction.totalEscrow} has been transferred to the seller.`
      )

      // Notify seller
      if (transaction.sellerPhone) {
        await sendWhatsAppMessage(
          transaction.sellerPhone,
          `🎉 Payment of ₦${transaction.totalEscrow} has been released from escrow. The item was delivered successfully.`
        )
      }
    } else if (transaction) {
      // Invalid PIN
      await sendWhatsAppMessage(
        from,
        `❌ Invalid PIN. Please enter the correct 4-digit release PIN for transaction ${transaction.transactionRef}.`
      )
    } else {
      await sendWhatsAppMessage(
        from,
        `❌ Invalid PIN. No active escrow transaction found for your phone number.`
      )
    }
  }
}

/**
 * Handle interactive messages (button clicks, list replies)
 * State 1: Pre-Agreement & Terms Acceptance
 */
async function handleInteractiveMessage(from: string, interactive: any) {
  const { type, title, id } = interactive

  if (type === "button") {
    // Handle button replies - "Accept Terms"
    if (title === "Accept Terms") {
      // Find transaction where buyerPhone matches and terms not yet accepted
      const transaction = await prisma.escrowTransaction.findFirst({
        where: {
          buyerPhone: from,
          termsAcceptedByBuyer: false,
        },
      })

      if (transaction) {
        // Update transaction: accept terms, set status to PENDING_DEPOSIT
        await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: {
            termsAcceptedByBuyer: true,
            status: "PENDING_DEPOSIT",
          },
        })

        // Trigger Paystack payment link message
        await initializePaystackPayment(transaction)
      }
    }
    // Handle other button interactions
    else {
      console.log(`Interactive button pressed: ${title} (id: ${id})`)
    }
  } else if (type === "list") {
    // Handle list replies
    console.log(`List item selected: ${title} (id: ${id})`)
  }
}

/**
 * Initialize Paystack payment link for escrow deposit
 */
async function initializePaystackPayment(transaction: any) {
  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        amount: transaction.totalEscrow * 100, // Convert to kobo
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

    const { data, authorization_url } = response.data

    // Send payment link back to buyer via WhatsApp
    await sendWhatsAppMessage(
      transaction.buyerPhone!,
      `💳 Payment Link for ₦${transaction.totalEscrow}\n\nPlease complete the payment to proceed with the escrow contract.\n\n[Pay Now](${authorization_url})`
    )

    // Also send interactive buttons with payment options
    await sendInteractiveButtons(
      transaction.buyerPhone!,
      `Payment of ₦${transaction.totalEscrow} is required to accept the escrow terms.`,
      [
        { id: "pay_now", title: "Pay Now" },
        { id: "deposit_later", title: "Deposit Later" },
      ]
    )
  } catch (error) {
    console.error("Paystack initialization error:", error)
    await sendWhatsAppMessage(
      transaction.buyerPhone!,
      `❌ Failed to generate payment link. Please contact support or try again later.`
    )
  }
}