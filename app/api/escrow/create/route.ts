import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import axios from "crypto"
import { sendWhatsAppMessage, sendInteractiveButtons } from "@/lib/whatsapp"

// POST - Escrow contract creation logic
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      itemAmount,
      waybillAmount,
      buyerPhone,
      sellerPhone,
      currency,
    } = body

    // Validate required fields
    if (!itemAmount || !waybillAmount || !buyerPhone || !sellerPhone) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: itemAmount, waybillAmount, buyerPhone, sellerPhone",
        },
        { status: 400 }
      )
    }

    // Calculate escrow amounts
    const currencyCode = currency || "NGN"
    const totalEscrow = parseFloat(itemAmount) + parseFloat(waybillAmount)
    const platformFee = (parseFloat(itemAmount) * 0.02).toFixed(2) // 2% platform transaction fee

    // Generate a 4-digit release PIN using crypto random
    const releasePin = Math.floor(1000 + Math.random() * 8999)
      .toString()
      .padStart(4, "0")

    // Create escrow transaction with status PENDING_AGREEMENT
    const transaction = await prisma.escrowTransaction.create({
      data: {
        transactionRef: `TRX-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 8)
          .toUpperCase()}`,
        currency: currencyCode,
        countryCode: "NG",
        paymentProvider: "PAYSTACK",
        itemAmount: parseFloat(itemAmount),
        waybillAmount: parseFloat(waybillAmount),
        totalEscrow,
        platformFee: parseFloat(platformFee),
        waybillPayer: "BUYER",
        dispatchStatus: "PENDING",
        status: "PENDING_AGREEMENT",
        releasePin: releasePin,
        buyerPhone,
        sellerPhone,
        termsAcceptedByBuyer: false,
      },
    })

    // Initialize Paystack transaction
    try {
      const paystackResponse = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          amount: Math.round(totalEscrow * 100), // Paystack uses kobo
          email: `buyer${transaction.id}@trustship.io`,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
          metadata: {
            transactionRef: transaction.transactionRef,
            buyerPhone,
            sellerPhone,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      )

      const { data, authorization_url } = paystackResponse.data

      // Send WhatsApp message to buyer with payment link and terms
      await sendWhatsAppMessage(
        buyerPhone,
        `📋 Escrow Contract Created\n\n` +
          `Transaction Reference: ${transaction.transactionRef}\n` +
          `Total Escrow: ₦${totalEscrow}\n` +
          `Platform Fee: ₦${platformFee} (2%)\n` +
          `Release PIN: ${releasePin}\n\n` +
          `Please accept the terms to proceed with the payment.`
      )

      // Send interactive buttons for terms acceptance
      await sendInteractiveButtons(
        buyerPhone,
        "Welcome to TrustShip Escrow!\n\n" +
          `Transaction: ${transaction.transactionRef}\n` +
          `Total: ₦${totalEscrow}\n\n` +
          "Please accept the terms to continue.",
        [
          { id: "accept_terms", title: "Accept Terms" },
        ]
      )
    } catch (paystackError) {
      console.error("Paystack initialization error:", paystackError)
      // Continue without Paystack init - transaction created locally
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          transaction,
          authorization_url:
            (paystackResponse as any)?.data?.authorization_url,
        },
        releasePin,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Escrow creation error:", error)
    return NextResponse.json(
      { error: "Failed to create escrow transaction" },
      { status: 500 }
    )
  }
}