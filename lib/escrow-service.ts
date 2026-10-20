// Shared escrow creation service.
//
// Both the HTTP route (`app/api/escrow/create`) and the WhatsApp conversational
// flow (`app/api/whatsapp/webhook`) build escrows through this one function so
// the money math (platform fee / total) and the Flutterwave checkout handshake
// can never drift between entry points.
import { prisma } from "@/lib/prisma";
import { initializeFlutterwavePayment } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { computePlatformFee, computeGatewayFee } from "@/lib/payout";
import { resolveBankAccount } from "@/lib/bank-verification";

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
  /** Flutterwave pass-through processing fees (collection + transfer). */
  gatewayFee: number;
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
 * Find a user by phone, creating a placeholder row when none exists. Shared
 * by the immediate-creation and draft (seller-acceptance) paths so buyer and
 * seller resolution can never drift between them.
 */
async function ensureUser(
  phone: string,
  role: "BUYER" | "SELLER",
  name: string
) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      phone,
      name,
      role,
      bankCode: "",
      accountNumber: "",
      bankName: "",
    },
  });
}

/** Shared validation for both creation paths. Returns normalized numbers. */
function validateCreationInput(input: CreateEscrowInput): {
  buyerPhone: string;
  sellerPhone: string;
  numItemAmount: number;
  numWaybillAmount: number;
  waybillPayer: WaybillPayer;
  cleanItemTitle: string | null;
} {
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

  return { buyerPhone, sellerPhone, numItemAmount, numWaybillAmount, waybillPayer, cleanItemTitle };
}

/**
 * Shared zero-loss fee math for both creation paths (web + WhatsApp drafts):
 * flat platform tier + exact Flutterwave pass-through, so the stored fees
 * always match the total shown to the buyer.
 */
function computeFeeSchedule(
  itemAmount: number,
  waybillAmount: number,
  waybillPayer: WaybillPayer
): { platformFee: number; gatewayFee: number; totalEscrow: number } {
  const platformFee = computePlatformFee(itemAmount);
  // What the seller will be paid: item value + waybill when the buyer pays it.
  const payoutAmount = itemAmount + (waybillPayer === "BUYER" ? waybillAmount : 0);
  const gateway = computeGatewayFee(itemAmount, platformFee, payoutAmount);
  const totalEscrow =
    Math.round(
      (itemAmount +
        platformFee +
        gateway.total +
        (waybillPayer === "BUYER" ? waybillAmount : 0)) *
        100
    ) / 100;
  return { platformFee, gatewayFee: gateway.total, totalEscrow };
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

  const { buyerPhone, sellerPhone, numItemAmount, numWaybillAmount, waybillPayer, cleanItemTitle } =
    validateCreationInput(input);
  const displayItemTitle = cleanItemTitle ?? "Item";

  // Fees are always server-computed; never trust a caller-supplied fee.
  const { platformFee, gatewayFee, totalEscrow } = computeFeeSchedule(
    numItemAmount,
    numWaybillAmount,
    waybillPayer
  );

  const transactionRef = `TS-ESCROW-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const releasePin = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit release PIN

  // ---- Buyer ----
  const buyer = await ensureUser(buyerPhone, "BUYER", input.buyerName || "TrustShip Buyer");

  // ---- Seller ----
  // Trust & verification: resolve provided payout details to an account name
  // via Flutterwave's Bank Lookup (best effort — never blocks creation).
  const verifiedAccount =
    input.sellerBankCode && input.sellerAccountNumber
      ? await resolveBankAccount(input.sellerBankCode, input.sellerAccountNumber)
      : null;

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
        ...(verifiedAccount
          ? { bankAccountName: verifiedAccount.accountName, bankVerifiedAt: new Date() }
          : {}),
      },
    });
  } else if (input.sellerBankCode && input.sellerAccountNumber) {
    seller = await prisma.user.update({
      where: { id: seller.id },
      data: {
        bankCode: input.sellerBankCode,
        accountNumber: input.sellerAccountNumber,
        bankName: input.sellerBankName || seller.bankName,
        ...(verifiedAccount
          ? { bankAccountName: verifiedAccount.accountName, bankVerifiedAt: new Date() }
          : {}),
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
      gatewayFee,
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
    gatewayFee,
    releasePin,
  };
}

// ---------------------------------------------------------------------------
// WhatsApp-first flow: escrow drafts awaiting seller acceptance.
// ---------------------------------------------------------------------------

export interface CreateEscrowDraftResult {
  success: true;
  transactionRef: string;
  transactionId: string;
  totalEscrow: number;
  itemAmount: number;
  platformFee: number;
  /** Flutterwave pass-through processing fees (collection + transfer). */
  gatewayFee: number;
  releasePin: string;
  buyerPhone: string;
  sellerPhone: string;
  itemTitle: string;
}

/**
 * Save a draft escrow in `PENDING_SELLER_ACCEPTANCE` for the WhatsApp flow.
 *
 * No payment link is created here — once the seller replies ACCEPT, the bot
 * engine flips the row to PENDING_PAYMENT and initializes the Flutterwave
 * checkout link. Uses the exact same validation, zero-loss fee math and user
 * resolution as {@link createEscrow} so the two entry points can never drift.
 */
export async function createEscrowDraft(
  input: CreateEscrowInput
): Promise<CreateEscrowDraftResult> {
  const { buyerPhone, sellerPhone, numItemAmount, numWaybillAmount, waybillPayer, cleanItemTitle } =
    validateCreationInput(input);

  const { platformFee, gatewayFee, totalEscrow } = computeFeeSchedule(
    numItemAmount,
    numWaybillAmount,
    waybillPayer
  );

  const transactionRef = `TS-ESCROW-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const releasePin = Math.floor(1000 + Math.random() * 9000).toString();

  const buyer = await ensureUser(buyerPhone, "BUYER", input.buyerName || "TrustShip Buyer");
  const seller = await ensureUser(sellerPhone, "SELLER", input.sellerName || "TrustShip Seller");

  const transaction = await prisma.escrowTransaction.create({
    data: {
      transactionRef,
      itemTitle: cleanItemTitle,
      itemAmount: numItemAmount,
      waybillAmount: numWaybillAmount,
      totalEscrow,
      platformFee,
      gatewayFee,
      waybillPayer,
      dispatchStatus: "PENDING",
      status: "PENDING_SELLER_ACCEPTANCE",
      releasePin,
      buyerPhone,
      sellerPhone,
      buyerId: buyer.id,
      sellerId: seller.id,
      paymentProvider: "FLUTTERWAVE",
    },
  });

  return {
    success: true,
    transactionRef,
    transactionId: transaction.id,
    totalEscrow,
    itemAmount: numItemAmount,
    platformFee,
    gatewayFee,
    releasePin,
    buyerPhone,
    sellerPhone,
    itemTitle: cleanItemTitle ?? "Item",
  };
}
