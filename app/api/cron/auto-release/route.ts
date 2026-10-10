import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import axios from "axios"
import { sendWhatsAppMessage } from "@/lib/whatsapp"

// GET - Auto-release cron worker (compatible with Vercel Cron or manual trigger)
export async function GET(request: NextRequest) {
  try {
    const now = new Date()

    // Query all dispatched/delivered transactions eligible for auto-release:
    // status = "DISPATCHED" or "DELIVERED"
    // autoReleaseAt <= NOW()
    // status != "RELEASED" / "DISPUTED"
    const eligibleTransactions = await prisma.escrowTransaction.findMany({
      where: {
        OR: [
          { status: "DISPATCHED" },
          { status: "DELIVERED" },
        ],
        autoReleaseAt: {
          lte: now,
        },
        NOT: {
          OR: [
            { status: "RELEASED" },
            { status: "DISPUTED" },
          ],
        },
      },
    })

    console.log(`Found ${eligibleTransactions.length} transactions eligible for auto-release`)

    for (const transaction of eligibleTransactions) {
      try {
        // 1. Trigger Paystack Transfer API to release 100% payout to Seller
        if (transaction.sellerPhone) {
          await axios.post(
            "https://api.paystack.co/transfer",
            {
              amount: Math.round(transaction.totalEscrow * 100), // Paystack uses kobo
              recipient: transaction.sellerPhone, // Will need proper sub-account format
              reason: "Auto-release from TrustShip escrow - item delivery confirmation",
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
              },
            }
          )
        }

        // 2. Update transaction status to RELEASED
        await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: {
            status: "RELEASED",
            dispatchStatus: "DELIVERED",
            autoReleaseAt: null,
            updatedAt: new Date(),
          },
        })

        // 3. Send auto-release WhatsApp notification to both Buyer and Seller
        // Notify Buyer
        if (transaction.buyerPhone) {
          await sendWhatsAppMessage(
            transaction.buyerPhone,
            `🎉 Auto-release triggered! Your funds of ₦${transaction.totalEscrow} have been released to the seller as no dispute was filed within the 24-hour window.`
          )
        }

        // Notify Seller
        if (transaction.sellerPhone) {
          await sendWhatsAppMessage(
            transaction.sellerPhone,
            `💰 Auto-release confirmed! ₦${transaction.totalEscrow} has been released from escrow. The buyer did not file a dispute within 24 hours of delivery.`
          )
        }

        console.log(`Auto-released transaction: ${transaction.transactionRef}`)

      } catch (transferError) {
        console.error(`Paystack transfer error for transaction ${transaction.id}:`, transferError)
        // Continue to next transaction even if one transfer fails
      }
    }

    return NextResponse.json({
      success: true,
      processed: eligibleTransactions.length,
      message: `Auto-release complete for ${eligibleTransactions.length} transactions`,
    }, { status: 200 })

  } catch (error) {
    console.error("Auto-release cron error:", error)
    return NextResponse.json(
      { error: "Auto-release cron failed" },
      { status: 500 }
    )
  }
}