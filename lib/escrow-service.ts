// Shared escrow creation service.
//
// Both the HTTP route (`app/api/escrow/create`) and the WhatsApp conversational
// flow (`app/api/whatsapp/webhook`) build escrows through this one function so
// the money math (platform fee / total) and the Flutterwave checkout handshake
// can never drift between entry points.
import { prisma } from "@/lib/prisma";
import { initializeFlutterwavePayment } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { computePlatformFee } from "@/lib/payout";

export type WaybillPayer = "BUYER" | "SELLER";

export interface CreateEscrowInput {
  itemTitle?: string | null;
  itemAmount: number | string;
  waybillAmount?: number | string;
  waybillPayer?: string;
  buyerPhone: string;
  buyerEmail?: string;
  buyerName?: string;
  sellerPhone: string;
  sellerName?: string;
  sellerBankCode?: string;
  sellerAccountNumber?: string;
  sellerBankName?: string;
}

export interface CreateEscrowResult {
  success: true;
  transactionRef: string;
  transactionId: string;
  paymentUrl: string;
  totalEscrow: number;
  platformFee: number;
  releasePin: string;
}

export interface CreateEscrowOptions {
  /**
   * When true (default) the buyer and seller both receive the standard
   * "Escrow Activated" WhatsApp message. Conversational entry points that send
   * their own tailored reply set this to false to avoid duplicate messages.
   */
  notifyParticipants?: boolean;
}

/** Thrown for expected, user-correctable validation problems. */
export class EscrowCreationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EscrowCreationError";
    this.status = status;
  }
}

/**
 * Create an escrow transaction, initialise its Flutterwave checkout link and
 * (optionally) notify both parties. Throws {@link EscrowCreationError} for
 * invalid input and rethrows provider/network failures.
 */
export async function createEscrow(
  input: CreateEscrowInput,
  options: CreateEscrowOptions = {}
): Promise<CreateEscrowResult> {
  const notifyParticipants = options.notifyParticipants ?? true;

  const buyerPhone = typeof input.buyerPhone === "string" ? input.buyerPhone.trim() : "";
  const sellerPhone = typeof input.sellerPhone === "string" ? input.sellerPhone.trim() : "";
  const numItemAmount = Number(input.itemAmount);

  if (!buyerPhone || !sellerPhone) {
    throw new EscrowCreationError("Missing required fields: buyerPhone or sellerPhone");
  }
  if (!Number.isFinite(numItemAmount) || numItemAmount <= 0) {
    throw new EscrowCreationError("Item amount must be a positive number");
  }

  const numWaybillAmount = Number(input.waybillAmount) || 0;
  const waybillPayer: WaybillPayer = input.waybillPayer === "SELLER" ? "SELLER" : "BUYER";

  const rawTitle = typeof input.itemTitle === "string" ? input.itemTitle.trim() : "";
  const cleanItemTitle = rawTitle.length > 0 ? rawTitle : null;
  const displayItemTitle = cleanItemTitle ?? "Item";

  // Platform fee is always server-computed; never trust a caller-supplied fee.
  const platformFee = computePlatformFee(numItemAmount);
  // The buyer pays the waybill only when they are the designated payer.
  const totalEscrow =
    numItemAmount + platformFee + (waybillPayer === "BUYER" ? numWaybillAmount : 0);

  const transactionRef = `TS-ESCROW-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const releasePin = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit release PIN

  // ---- Buyer ----
  let buyer = await prisma.user.findUnique({ where: { phone: buyerPhone } });
  if (!buyer) {
    buyer = await prisma.user.create({
      data: {
        phone: buyerPhone,
        name: input.buyerName || "TrustShip Buyer",
        role: "BUYER",
        bankCode: "",
        accountNumber: "",
        bankName: "",
      },
    });
  }

  // ---- Seller ----
  let seller = await prisma.user.findUnique({ where: { phone: sellerPhone } });
  if (!seller) {
    seller = await prisma.user.create({
      data: {
        phone: sellerPhone,
        name: input.sellerName || "TrustShip Seller",
        role: "SELLER",
        bankCode: input.sellerBankCode || "",
        accountNumber: input.sellerAccountNumber || "",
        bankName: input.sellerBankName || "",
      },
    });
  } else if (input.sellerBankCode && input.sellerAccountNumber) {
    seller = await prisma.user.update({
      where: { id: seller.id },
      data: {
        bankCode: input.sellerBankCode,
        accountNumber: input.sellerAccountNumber,
        bankName: input.sellerBankName || seller.bankName,
      },
    });
  }

  // ---- Escrow row ----
  const transaction = await prisma.escrowTransaction.create({
    data: {
      transactionRef,
      itemTitle: cleanItemTitle,
      itemAmount: numItemAmount,
      waybillAmount: numWaybillAmount,
      totalEscrow,
      platformFee,
      waybillPayer,
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

  // ---- Flutterwave checkout link ----
  // Flutterwave rejects its own `.user`-style fallback ("invalid email"), so
  // derive a syntactically valid address from the buyer phone when needed.
  const resolvedBuyerEmail =
    typeof input.buyerEmail === "string" && input.buyerEmail.includes("@")
      ? input.buyerEmail
      : `${buyerPhone.replace(/\D/g, "")}@trustship.app`;

  const flwResponse = await initializeFlutterwavePayment({
    txRef: transactionRef,
    amount: totalEscrow,
    email: resolvedBuyerEmail,
    name: input.buyerName || "TrustShip Buyer",
    title: `TrustShip Escrow: ${displayItemTitle}`,
    description: `Secure escrow payment for ${displayItemTitle} (Ref: ${transactionRef})`,
  });

  // Flutterwave wraps the checkout URL as { status, message, data: { link } },
  // while axios exposes the body as response.data — hence `data.data.link`.
  const paymentUrl =
    flwResponse?.data?.data?.link || flwResponse?.data?.link || undefined;

  if (!paymentUrl) {
    throw new EscrowCreationError("Failed to generate Flutterwave checkout link.", 502);
  }

  if (notifyParticipants) {
    const whatsappMessage =
      `🛡️ *TrustShip Escrow Activated (${transactionRef})*\n\n` +
      `• Item: ${displayItemTitle}\n` +
      `• Total Amount: ₦${totalEscrow.toLocaleString()}\n` +
      `• Payment Link: ${paymentUrl}\n` +
      `• Release PIN: ${releasePin}\n\n` +
      `Please review the terms and complete the payment via the link above. Both parties must agree before funds are locked.`;

    await sendWhatsAppMessage(buyerPhone, whatsappMessage);
    await sendWhatsAppMessage(sellerPhone, whatsappMessage);
  }

  return {
    success: true,
    transactionRef,
    transactionId: transaction.id,
    paymentUrl,
    totalEscrow,
    platformFee,
    releasePin,
  };
}
