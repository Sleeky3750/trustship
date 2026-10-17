import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initializeFlutterwavePayment } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      itemTitle,
      itemAmount,
      waybillAmount = 0,
      platformFee = 0,
      waybillPayer, // "BUYER" or "SELLER"
      buyerPhone,
      buyerEmail,
      buyerName,
      sellerPhone,
      sellerName,
      sellerBankCode,
      sellerAccountNumber,
      sellerBankName,
    } = body;

    // 1. Validation checks
    if (!itemTitle || !itemAmount || !buyerPhone || !sellerPhone) {
      return NextResponse.json(
        { error: "Missing required fields: itemTitle, itemAmount, buyerPhone, or sellerPhone" },
        { status: 400 }
      );
    }

    // 2. Calculate total escrow amount based on who pays the waybill
    const numItemAmount = Number(itemAmount);
    const numWaybillAmount = Number(waybillAmount);
    const numPlatformFee = Number(platformFee);

    // If buyer pays waybill, add it to total; otherwise total is item + platform fee
    const totalEscrow =
      waybillPayer === "BUYER"
        ? numItemAmount + numWaybillAmount + numPlatformFee
        : numItemAmount + numPlatformFee;

    const transactionRef = `TS-ESCROW-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const releasePin = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit release PIN for buyer

    // 3. Find or create Buyer User
    let buyer = await prisma.user.findUnique({
      where: { phone: buyerPhone },
    });

    if (!buyer) {
      buyer = await prisma.user.create({
        data: {
          phone: buyerPhone,
          name: buyerName || "TrustShip Buyer",
          role: "BUYER",
          bankCode: "",
          accountNumber: "",
          bankName: "",
        },
      });
    }

    // 4. Find or create Seller User
    let seller = await prisma.user.findUnique({
      where: { phone: sellerPhone },
    });

    if (!seller) {
      seller = await prisma.user.create({
        data: {
          phone: sellerPhone,
          name: sellerName || "TrustShip Seller",
          role: "SELLER",
          bankCode: sellerBankCode || "",
          accountNumber: sellerAccountNumber || "",
          bankName: sellerBankName || "",
        },
      });
    } else if (sellerBankCode && sellerAccountNumber) {
      // Update seller bank details if provided
      seller = await prisma.user.update({
        where: { id: seller.id },
        data: {
          bankCode: sellerBankCode,
          accountNumber: sellerAccountNumber,
          bankName: sellerBankName || seller.bankName,
        },
      });
    }

    // 5. Create Escrow Transaction in Prisma DB with PENDING_DEPOSIT status
    const transaction = await prisma.escrowTransaction.create({
      data: {
        transactionRef,
        itemAmount: numItemAmount,
        waybillAmount: numWaybillAmount,
        totalEscrow,
        platformFee: numPlatformFee,
        waybillPayer: waybillPayer === "SELLER" ? "SELLER" : "BUYER",
        dispatchStatus: "PENDING",
        status: "PENDING_DEPOSIT",
        releasePin,
        buyerPhone,
        sellerPhone,
        buyerId: buyer.id,
        sellerId: seller.id,
        paymentProvider: "FLUTTERWAVE",
      },
    });

    // 6. Initialize Flutterwave Payment Link
    const flwResponse = await initializeFlutterwavePayment({
      txRef: transactionRef,
      amount: totalEscrow,
      email: buyerEmail || `${buyerPhone.replace(/\D/g, "")}@trustship.user`,
      name: buyerName || "TrustShip Buyer",
      title: `TrustShip Escrow: ${itemTitle}`,
      description: `Secure escrow payment for ${itemTitle} (Ref: ${transactionRef})`,
    });

    const paymentUrl = flwResponse?.data?.link;

    if (!paymentUrl) {
      return NextResponse.json(
        { error: "Failed to generate Flutterwave checkout link." },
        { status: 500 }
      );
    }

    // 7. Send WhatsApp activation to buyer and seller with agreement terms and payment instructions
    const whatsappMessage = `🛡️ *TrustShip Escrow Activated (${transactionRef})*\n\n` +
      `• Item: ${itemTitle}\n` +
      `• Total Amount: ₦${totalEscrow.toLocaleString()}\n` +
      `• Payment Link: ${paymentUrl}\n` +
      `• Release PIN: ${releasePin}\n\n` +
      `Please review the terms and complete the payment via the link above. Both parties must agree before funds are locked.`;

    // Send to buyer
    await sendWhatsAppMessage(buyerPhone, whatsappMessage);
    // Send to seller
    await sendWhatsAppMessage(sellerPhone, whatsappMessage);

    return NextResponse.json({
      success: true,
      transactionRef,
      transactionId: transaction.id,
      paymentUrl,
      totalEscrow,
      releasePin, // Include PIN for immediate WhatsApp sharing
    });
  } catch (error: any) {
    console.error("Escrow creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during escrow creation" },
      { status: 500 }
    );
  }
}