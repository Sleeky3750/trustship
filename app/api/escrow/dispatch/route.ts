import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import axios from "axios"

// POST - Dispatch status update endpoint
export async function POST(request: NextRequest) {
  try {
    // 1. Admin authorization check - support multiple header formats
    const adminSecret =
      request.headers.get("x-admin-secret") ||
      (request.headers.get("authorization")?.startsWith("Bearer ") && request.headers.get("authorization")!.substring(7)) ||
      request.cookies.get("admin_secret")?.value;

    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json()
    const { transactionId, courierName, courierPhone } = body

    // Validate required fields
    if (!transactionId) {
      return NextResponse.json(
        { error: "Missing required field: transactionId" },
        { status: 400 }
      )
    }

    // Update transaction: set dispatchStatus to IN_TRANSIT, status to DISPATCHED
    const transaction = await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: {
        dispatchStatus: "IN_TRANSIT",
        status: "DISPATCHED",
        courierName,
        courierPhone,
        updatedAt: new Date(),
      },
    })

    // Notify Buyer via WhatsApp with courier details
    if (transaction.buyerPhone) {
      let courierInfo = ""
      if (courierName && courierPhone) {
        courierInfo = `\nCourier: ${courierName}\nPhone: ${courierPhone}`
      }

      await sendWhatsAppMessage(
        transaction.buyerPhone,
        `🚚 Your item has been dispatched!\n\n` +
          `Transaction Reference: ${transaction.transactionRef}\n` +
`Total Paid: ₦${transaction.totalEscrow}\n` +
`${courierInfo}\nYou can track your waybill status. The courier will deliver your item shortly.`
      )
    }

    return NextResponse.json(
      { success: true, data: transaction },
      { status: 200 }
    )
  } catch (error) {
    console.error("Dispatch endpoint error:", error)
    return NextResponse.json(
      { error: "Failed to update dispatch status" },
      { status: 500 }
    )
  }
}