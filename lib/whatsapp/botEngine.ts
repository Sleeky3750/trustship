// lib/whatsapp/botEngine.ts
//
// WhatsApp-first conversational escrow bot — the complete state machine.
// Payments and payouts run exclusively on Flutterwave.
//
// Buyer flow:
//   trigger (hi / start / escrow / /start / /escrow)
//     -> AWAITING_TITLE      (item or service title)
//     -> AWAITING_AMOUNT     (amount in NGN)
//     -> AWAITING_SELLER_PHONE
//     -> draft saved as PENDING_SELLER_ACCEPTANCE, seller invited on WhatsApp
//
// Seller flow:
//   ACCEPT <ref>   -> PENDING_PAYMENT + Flutterwave checkout link sent to
//                     the buyer (the approved `seller_escrow_invitation`
//                     template is attempted first, then interactive buttons,
//                     then text)
//   DECLINE <ref>  -> CANCELLED + both parties notified
//
// Settlement (app/api/flutterwave/webhook):
//   charge.completed -> ESCROW_LOCKED + PIN privately to the buyer + dual
//   notifications.
//
// Disputes:
//   DISPUTE <ref> (either party) -> DISPUTE_OPEN, funds frozen, both parties
//   prompted for photo/video proof over WhatsApp (AWAITING_DISPUTE_EVIDENCE).
//
// Completion:
//   4-digit PIN release -> seller paid via Flutterwave Transfers, status
//   COMPLETED, buyer receives their custom referral link prompt.
//
// Sessions persist in Prisma (`WhatsAppSession`, one row per phone number)
// and expire after 30 minutes of inactivity. Reference lookup and one-shot
// "Title, Amount, SellerPhone" shortcuts are preserved here.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveReplyButtons,
  sendWhatsAppTemplateMessage,
} from "@/lib/whatsapp";
import {
  createEscrowDraft,
  EscrowCreationError,
} from "@/lib/escrow-service";
import { computePayoutAmount } from "@/lib/payout";
import {
  initiateFlutterwaveTransfer,
  initializeFlutterwavePayment,
} from "@/lib/flutterwave";

// ---------------------------------------------------------------------------
// Session persistence (Prisma-backed)
// ---------------------------------------------------------------------------

/** Abandoned sessions expire after 30 minutes of inactivity. */
const SESSION_TTL_MS = 30 * 60 * 1000;

type BotState =
  | "IDLE"
  | "AWAITING_TITLE"
  | "AWAITING_AMOUNT"
  | "AWAITING_SELLER_PHONE"
  | "AWAITING_DISPUTE_EVIDENCE";

// A `type` (not `interface`) so Prisma's InputJsonObject accepts it directly.
type SessionData = {
  itemTitle?: string;
  itemAmount?: number;
  /** Set while AWAITING_DISPUTE_EVIDENCE — the disputed escrow's reference. */
  transactionRef?: string;
};

interface ActiveSession {
  state: Exclude<BotState, "IDLE">;
  data: SessionData;
}

/**
 * Load the active (non-expired, non-IDLE) session for a phone number.
 * Stale rows are lazily reset to IDLE so the next message starts clean.
 */
async function getSession(phoneNumber: string): Promise<ActiveSession | null> {
  const row = await prisma.whatsAppSession.findUnique({
    where: { phoneNumber },
  });
  if (!row || row.state === "IDLE") return null;

  if (Date.now() - row.updatedAt.getTime() > SESSION_TTL_MS) {
    await prisma.whatsAppSession
      .update({
        where: { id: row.id },
        data: { state: "IDLE", tempData: Prisma.DbNull },
      })
      .catch(() => undefined);
    return null;
  }

  return {
    state: row.state as Exclude<BotState, "IDLE">,
    data: (row.tempData ?? {}) as SessionData,
  };
}

/** Advance (or start) the buyer's session to `state`, replacing tempData. */
async function setSession(
  phoneNumber: string,
  state: BotState,
  data: SessionData | null
): Promise<void> {
  const tempData = data ?? Prisma.DbNull;
  await prisma.whatsAppSession.upsert({
    where: { phoneNumber },
    update: { state, tempData, updatedAt: new Date() },
    create: { phoneNumber, state, tempData: data ?? undefined },
  });
}

/** Clear any in-progress flow for a phone number. */
async function resetSession(phoneNumber: string): Promise<void> {
  await prisma.whatsAppSession.upsert({
    where: { phoneNumber },
    update: { state: "IDLE", tempData: Prisma.DbNull, updatedAt: new Date() },
    create: { phoneNumber, state: "IDLE" },
  });
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const WELCOME_MESSAGE =
  `Welcome to TrustShip Escrow! 🔒\n\n` +
  `Let's set up a secure deal. First, send the *item or service title* ` +
  `(e.g. \`iPhone 13\`).\n\n` +
  `Tip: you can also send everything at once — ` +
  "`Title, Amount, Seller Phone`";

const FALLBACK_MESSAGE =
  `${WELCOME_MESSAGE}\n\n` +
  `You can also send your *reference* (e.g. TS-ESCROW-XXXX) to check status, ` +
  `or your 4-digit *PIN* to release funds to the seller.`;

const START_COMMANDS = new Set(["hi", "start", "escrow", "/start", "/escrow"]);

/** "ACCEPT TS-..." (text) or "ACCEPT:TS-..." (button payload) → action+ref. */
function parseSellerDecision(
  raw: string
): { action: "ACCEPT" | "DECLINE"; ref: string } | null {
  const match = /^(ACCEPT|DECLINE)[\s:]+(\S+)$/i.exec(raw);
  if (!match) return null;
  return {
    action: match[1].toUpperCase() as "ACCEPT" | "DECLINE",
    ref: match[2],
  };
}

const DISPUTE_COMMAND = "DISPUTE";

/** "DISPUTE TS-..." / "dispute:TS-..." → the reference to freeze. */
function parseDisputeCommand(raw: string): string | null {
  const match = new RegExp(`^${DISPUTE_COMMAND}[\\s:]+(\\S+)$`, "i").exec(raw);
  return match ? match[1] : null;
}

/** Parse "250000", "₦250,000" or "NGN 250000" into a positive number. */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₦,\s]/g, "").replace(/^ngn/i, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** Normalise a phone number to digits, accepting 10–15 digit numbers. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

type EscrowDeal =
  | { ok: true; itemTitle: string; amount: number; sellerPhone: string }
  | { ok: false; error: string }
  | null;

/**
 * Parse a single-message deal of the form `Title, Amount, SellerPhone`.
 * Returns `null` when there are too few comma-separated fields to be a deal
 * attempt, or an error describing the first invalid field.
 */
function parseEscrowDeal(raw: string): EscrowDeal {
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < 3) return null;

  const sellerPhoneRaw = parts[parts.length - 1];
  const amountRaw = parts[parts.length - 2];
  const itemTitle = parts.slice(0, parts.length - 2).join(", ").trim();

  if (!itemTitle) {
    return {
      ok: false,
      error: "Please include the item title first, e.g. `iPhone 13, 250000, 2348012345678`.",
    };
  }

  const amount = parseAmount(amountRaw);
  if (amount === null) {
    return {
      ok: false,
      error: `"${amountRaw}" isn't a valid amount. Send a positive number, e.g. 250000.`,
    };
  }

  const sellerPhone = normalizePhone(sellerPhoneRaw);
  if (!sellerPhone) {
    return {
      ok: false,
      error: `"${sellerPhoneRaw}" isn't a valid phone number. Use digits only, e.g. 2348012345678.`,
    };
  }

  return { ok: true, itemTitle, amount, sellerPhone };
}

// ---------------------------------------------------------------------------
// Draft creation + seller invitation
// ---------------------------------------------------------------------------

/**
 * Save the draft (PENDING_SELLER_ACCEPTANCE), confirm to the buyer and
 * dispatch the WhatsApp acceptance invitation to the seller.
 */
async function createDraftAndInviteSeller(
  buyerPhone: string,
  itemTitle: string,
  itemAmount: number,
  sellerPhone: string
): Promise<void> {
  try {
    const draft = await createEscrowDraft({
      itemTitle,
      itemAmount,
      buyerPhone,
      sellerPhone,
      waybillAmount: 0,
      waybillPayer: "SELLER",
    });

    // Only clear the session once the draft exists.
    await resetSession(buyerPhone);

    // 1) Buyer confirmation with the transparent zero-loss checkout breakdown.
    await sendWhatsAppMessage(
      buyerPhone,
      `✅ *Escrow draft created!*\n\n` +
        `📦 Item: ${draft.itemTitle} — ₦${draft.itemAmount.toLocaleString()}\n` +
        `🛡️ TrustShip fee: ₦${draft.platformFee.toLocaleString()}\n` +
        `⚙️ Processing fee (Flutterwave pass-through): ₦${draft.gatewayFee.toLocaleString()}\n` +
        `💰 *Total to fund: ₦${draft.totalEscrow.toLocaleString()}*\n` +
        `🔑 Reference: ${draft.transactionRef}\n\n` +
        `An invitation has been sent to the seller (${draft.sellerPhone}). ` +
        `Once they accept, you'll receive a payment link to fund the escrow.`
    );

    // 2) Seller invitation (template → interactive → text fallback).
    await inviteSeller(draft);
  } catch (error: unknown) {
    const detail =
      error instanceof EscrowCreationError
        ? error.message
        : "Something went wrong while creating your escrow draft.";
    console.error("WhatsApp escrow draft creation failed:", error);

    // Keep the session so the buyer can simply resend the details and retry.
    await sendWhatsAppMessage(
      buyerPhone,
      `⚠️ We couldn't create your escrow: ${detail}\n\nPlease resend the details and we'll try again.`
    );
  }
}

/**
 * Trust & verification badge line built from completed database history, e.g.
 * `⭐ Verified Seller • 14 Successful Trades` / `🏦 Verified Payout Account`.
 * Empty string when the seller has no completed trades and no verified bank.
 */
async function buildSellerBadge(sellerPhone: string): Promise<string> {
  const [successfulTrades, seller] = await Promise.all([
    prisma.escrowTransaction.count({
      where: { sellerPhone, status: "COMPLETED" },
    }),
    prisma.user.findUnique({ where: { phone: sellerPhone } }),
  ]);

  const parts: string[] = [];
  if (successfulTrades > 0) {
    parts.push(
      `⭐ Verified Seller • ${successfulTrades} Successful Trade${successfulTrades === 1 ? "" : "s"}`
    );
  }
  if (seller?.bankVerifiedAt && seller?.bankAccountName) {
    parts.push(`🏦 Verified Payout Account (${seller.bankAccountName})`);
  }
  return parts.length ? `\n${parts.join("\n")}` : "";
}

/**
 * Send the seller the escrow invitation. Tries the approved Meta template
 * (`seller_escrow_invitation`, created in Business Hub with body params:
 * item, amount, buyer, reference) first; falls back to interactive
 * quick-reply buttons, then plain text, so the flow works regardless of
 * template approval state. The parameter order MUST match the approved
 * template exactly.
 */
async function inviteSeller(draft: {
  transactionRef: string;
  itemTitle: string;
  totalEscrow: number;
  sellerPhone: string;
  buyerPhone: string;
}): Promise<void> {
  const { transactionRef, itemTitle, totalEscrow, sellerPhone, buyerPhone } = draft;

  const template = await sendWhatsAppTemplateMessage(
    sellerPhone,
    "seller_escrow_invitation",
    [
      itemTitle,
      `₦${totalEscrow.toLocaleString()}`,
      buyerPhone,
      transactionRef,
    ]
  );
  if (template.success) return;

  const body =
    `🛡️ *TrustShip Escrow Invitation*\n\n` +
    `${buyerPhone} wants to trade with you:\n\n` +
    `• Item: ${itemTitle}\n` +
    `• Amount: ₦${totalEscrow.toLocaleString()}\n` +
    `• Buyer: ${buyerPhone}\n` +
    `• Reference: ${transactionRef}\n` +
    (await buildSellerBadge(sellerPhone)) +
    `\n\nReply *ACCEPT ${transactionRef}* to accept or ` +
    `*DECLINE ${transactionRef}* to decline.`;

  const interactive = await sendWhatsAppInteractiveReplyButtons(sellerPhone, body, [
    { id: `ACCEPT:${transactionRef}`, title: "Accept" },
    { id: `DECLINE:${transactionRef}`, title: "Decline" },
  ]);

  if (!interactive.success) {
    await sendWhatsAppMessage(sellerPhone, body);
  }
}

// ---------------------------------------------------------------------------
// Seller acceptance flow
// ---------------------------------------------------------------------------

/** Notify both parties that the escrow was declined. */
async function cancelDraft(transaction: {
  transactionRef: string;
  buyerPhone: string;
  sellerPhone: string;
  itemTitle: string | null;
}): Promise<void> {
  const detail =
    `Trade ${transaction.transactionRef}` +
    (transaction.itemTitle ? ` (${transaction.itemTitle})` : "");

  await sendWhatsAppMessage(
    transaction.sellerPhone,
    `❌ You declined ${detail}. The escrow has been cancelled.`
  );
  await sendWhatsAppMessage(
    transaction.buyerPhone,
    `❌ The seller declined ${detail}. The escrow has been cancelled — ` +
      `message us with \`escrow\` to start a new one.`
  );
}

/**
 * Handle "ACCEPT <ref>" / "DECLINE <ref>" from the invited seller.
 * ACCEPT flips the draft to PENDING_PAYMENT, initializes the Flutterwave
 * checkout link and sends it to the buyer (reverting to
 * PENDING_SELLER_ACCEPTANCE if initialization fails, so the seller can
 * retry). DECLINE cancels the draft.
 */
async function handleSellerDecision(
  from: string,
  action: "ACCEPT" | "DECLINE",
  rawRef: string
): Promise<void> {
  const transactionRef = rawRef
    .toUpperCase()
    .replace(/[.,;!?]+$/, "");

  // A single response covers "not found" and "not the invited seller" so the
  // endpoint can't be used as a transactionRef existence oracle.
  const transaction = await prisma.escrowTransaction.findUnique({
    where: { transactionRef },
  });
  if (!transaction || transaction.sellerPhone !== from) {
    await sendWhatsAppMessage(
      from,
      `❌ No escrow invitation requiring your response was found for reference *${transactionRef}*.`
    );
    return;
  }

  if (action === "DECLINE") {
    if (transaction.status !== "PENDING_SELLER_ACCEPTANCE") {
      await sendWhatsAppMessage(
        from,
        `⚠️ Escrow *${transactionRef}* can no longer be declined (current status: ${transaction.status}).`
      );
      return;
    }
    await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { status: "CANCELLED" },
    });
    await cancelDraft(transaction);
    return;
  }

  // ---- ACCEPT ----
  if (transaction.status === "PENDING_PAYMENT") {
    await sendWhatsAppMessage(
      from,
      `✅ You already accepted escrow *${transactionRef}* — waiting for the buyer to complete payment.`
    );
    return;
  }
  if (transaction.status !== "PENDING_SELLER_ACCEPTANCE") {
    await sendWhatsAppMessage(
      from,
      `⚠️ Escrow *${transactionRef}* is no longer open for acceptance (current status: ${transaction.status}).`
    );
    return;
  }

  // 1) Flip to PENDING_PAYMENT (per flow contract) …
  await prisma.escrowTransaction.update({
    where: { id: transaction.id },
    data: { status: "PENDING_PAYMENT" },
  });

  // 2) … then initialize Flutterwave checkout and send the buyer the link.
  try {
    const init = await initializeFlutterwavePayment({
      txRef: transaction.transactionRef,
      amount: transaction.totalEscrow,
      email: `${transaction.buyerPhone.replace(/\D/g, "")}@trustship.app`,
      name: "TrustShip Buyer",
      title: `TrustShip Escrow: ${transaction.itemTitle ?? transaction.transactionRef}`,
      description: `Secure escrow payment for ${transaction.itemTitle ?? "your item"} (Ref: ${transaction.transactionRef})`,
    });

    const paymentUrl =
      init?.data?.data?.link ?? init?.data?.link ?? null;
    if (!paymentUrl) {
      const detail = JSON.stringify(init?.data ?? {}).slice(0, 300);
      throw new Error(`Flutterwave returned no payment link: ${detail}`);
    }

    await sendWhatsAppMessage(
      transaction.buyerPhone,
      `💳 *Seller Accepted!*\n\n` +
        `The seller accepted escrow *${transaction.transactionRef}* ` +
        `(${transaction.itemTitle ?? "item"} — ₦${transaction.totalEscrow.toLocaleString()}).\n\n` +
        `Fund the escrow securely here:\n${paymentUrl}`
    );
    await sendWhatsAppMessage(
      transaction.sellerPhone,
      `✅ Accepted. The buyer has been sent the payment link for escrow ` +
        `*${transaction.transactionRef}* — we'll notify you once the funds are secured.`
    );
  } catch (error: unknown) {
    console.error(
      `Flutterwave initialization failed for escrow ${transaction.transactionRef}:`,
      error
    );

    // Revert so the seller can simply reply ACCEPT again to retry.
    await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { status: "PENDING_SELLER_ACCEPTANCE" },
    });
    await sendWhatsAppMessage(
      transaction.sellerPhone,
      `⚠️ We couldn't create the buyer's payment link for *${transaction.transactionRef}*. ` +
        `Please reply *ACCEPT ${transaction.transactionRef}* again to retry.`
    );
  }
}

// ---------------------------------------------------------------------------
// Preserved lifecycle handlers: PIN release + reference lookup
// ---------------------------------------------------------------------------

/** Release escrow funds when the buyer sends the correct 4-digit PIN. */
async function handlePinRelease(from: string, pin: string): Promise<void> {
  const transaction = await prisma.escrowTransaction.findFirst({
    where: {
      buyerPhone: from,
      releasePin: pin,
      status: { in: ["ESCROW_LOCKED", "DELIVERED"] },
    },
    include: { seller: true },
  });

  if (!transaction) {
    await sendWhatsAppMessage(
      from,
      `❌ Invalid PIN or no active escrow awaiting release was found for your account.`
    );
    return;
  }

  const payoutAmount = computePayoutAmount(transaction);

  await prisma.escrowTransaction.update({
    where: { id: transaction.id },
    data: { status: "COMPLETED" },
  });

  // Initiate Payout Transfer via Flutterwave
  try {
    if (transaction.seller.bankCode && transaction.seller.accountNumber) {
      await initiateFlutterwaveTransfer({
        accountBank: transaction.seller.bankCode,
        accountNumber: transaction.seller.accountNumber,
        amount: payoutAmount,
        narration: `TrustShip Payout for Escrow ${transaction.transactionRef}`,
        reference: `TS-WA-REL-${transaction.id}-${Date.now()}`,
        beneficiaryName: transaction.seller.name || "TrustShip Seller",
      });
    }
  } catch (transferErr: unknown) {
    console.error("WhatsApp triggered transfer payout error:", transferErr);
  }

  // Referral growth hook: every buyer gets a durable custom referral code
  // once their first trade completes.
  const referralLine = await buildReferralPrompt(transaction.buyerId);

  await sendWhatsAppMessage(
    from,
    `✅ PIN Verified! Payment of ₦${payoutAmount.toLocaleString()} has been released to the seller for escrow *${transaction.transactionRef}*. Thank you for using TrustShip!` +
      referralLine
  );

  if (transaction.sellerPhone) {
    await sendWhatsAppMessage(
      transaction.sellerPhone,
      `🎉 Trade Complete! The buyer verified delivery for trade *${transaction.transactionRef}*. ₦${payoutAmount.toLocaleString()} has been sent to your bank.`
    );
  }
}

/**
 * Referral hook: make sure the buyer has a unique short referral code and
 * return a closing prompt with their shareable TrustShip link (empty string
 * when no prompt should be shown).
 */
async function buildReferralPrompt(buyerId: string): Promise<string> {
  try {
    let user = await prisma.user.findUnique({ where: { id: buyerId } });
    if (!user) return "";

    if (!user.referralCode) {
      // Regenerate on the (astronomically unlikely) collision.
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = Math.random().toString(36).slice(2, 10);
        try {
          user = await prisma.user.update({
            where: { id: buyerId },
            data: { referralCode: code },
          });
          break;
        } catch {
          continue;
        }
      }
    }

    if (!user.referralCode) return "";

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://trustship.ng";
    return (
      `\n\n🎉 *Trade complete!* Want your next deal to be this smooth? ` +
      `Share your personal TrustShip link with a buyer or seller:\n${appUrl}/r/${user.referralCode}`
    );
  } catch (error: unknown) {
    console.error("Referral code prompt failed:", error);
    return "";
  }
}

/** Reply with the current status of an escrow the sender is party to. */
async function handleReferenceLookup(from: string, rawRef: string): Promise<void> {
  const ref = rawRef.toUpperCase();

  const transaction = await prisma.escrowTransaction.findFirst({
    where: {
      transactionRef: ref,
      OR: [{ buyerPhone: from }, { sellerPhone: from }],
    },
  });

  if (transaction) {
    await sendWhatsAppMessage(
      from,
      `🛡️ *TrustShip Escrow Status: ${ref}*\n\n` +
        `• Status: *${transaction.status}*\n` +
        `• Amount: ₦${transaction.totalEscrow.toLocaleString()}\n` +
        `• Waybill: ₦${transaction.waybillAmount.toLocaleString()} (${transaction.waybillPayer})\n` +
        `• Dispatch: ${transaction.dispatchStatus}\n\n` +
        `_Reply with your 4-digit PIN once item is received to release funds to the seller._`
    );
  } else {
    await sendWhatsAppMessage(
      from,
      `❌ No matching transaction found for reference *${ref}*.`
    );
  }
}

// ---------------------------------------------------------------------------
// Disputes: DISPUTE <ref> command + photo/video evidence over WhatsApp
// ---------------------------------------------------------------------------

/** Statuses a trade can still be disputed from (funds at stake / in motion). */
const DISPUTABLE_STATUSES = new Set([
  "ESCROW_LOCKED",
  "DISPATCHED",
  "DELIVERED",
  "PENDING_DEPOSIT",
  "PENDING_PAYMENT",
  "PENDING_SELLER_ACCEPTANCE",
]);

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "DISPUTE_OPEN",
]);

/**
 * Move both parties' sessions into AWAITING_DISPUTE_EVIDENCE so the bot
 * accepts their photo/video proof for this reference. Exported so the web
 * dispute endpoint arms the same WhatsApp evidence flow.
 */
export async function armDisputeEvidenceSessions(
  buyerPhone: string,
  sellerPhone: string,
  transactionRef: string
): Promise<void> {
  await Promise.all([
    setSession(buyerPhone, "AWAITING_DISPUTE_EVIDENCE", { transactionRef }),
    setSession(sellerPhone, "AWAITING_DISPUTE_EVIDENCE", { transactionRef }),
  ]);
}

/**
 * Handle `DISPUTE <ref>` from either party: freeze funds
 * (status → DISPUTE_OPEN), put both parties into evidence-collection mode
 * and notify both sides. Re-sending DISPUTE while open re-arms/re-prompts.
 */
async function handleDisputeCommand(from: string, rawRef: string): Promise<void> {
  const transactionRef = rawRef.toUpperCase().replace(/[.,;!?]+$/, "");

  // Single generic response so the endpoint can't be used as a ref oracle.
  const transaction = await prisma.escrowTransaction.findUnique({
    where: { transactionRef },
  });
  const isParty =
    transaction && (transaction.buyerPhone === from || transaction.sellerPhone === from);
  if (!transaction || !isParty) {
    await sendWhatsAppMessage(
      from,
      `❌ No escrow requiring your response was found for reference *${transactionRef}*.`
    );
    return;
  }

  if (transaction.status === "DISPUTE_OPEN") {
    await armDisputeEvidenceSessions(
      transaction.buyerPhone,
      transaction.sellerPhone,
      transaction.transactionRef
    );
    await sendWhatsAppMessage(
      from,
      `⚠️ Escrow *${transactionRef}* is already in dispute — funds are frozen.\n\n` +
        `Send your *photo or video proof* now and our team will review it.`
    );
    return;
  }

  if (TERMINAL_STATUSES.has(transaction.status) || !DISPUTABLE_STATUSES.has(transaction.status)) {
    await sendWhatsAppMessage(
      from,
      `⚠️ Escrow *${transactionRef}* can no longer be disputed (current status: ${transaction.status}).`
    );
    return;
  }

  // 1) Freeze funds immediately.
  await prisma.escrowTransaction.update({
    where: { id: transaction.id },
    data: { status: "DISPUTE_OPEN" },
  });

  // 2) Both parties can now send photo/video proof over WhatsApp.
  await armDisputeEvidenceSessions(
    transaction.buyerPhone,
    transaction.sellerPhone,
    transaction.transactionRef
  );

  const proofPrompt =
    `\n\n📎 Please send your *photo or video proof* as a WhatsApp message ` +
    `(photos/videos of the item, delivery, packaging, etc.). Our admin team ` +
    `will review both sides and freeze funds until the case is resolved.`;

  await sendWhatsAppMessage(
    transaction.buyerPhone,
    `🚨 *Dispute opened for escrow ${transactionRef}* — funds are frozen.` +
      proofPrompt
  );
  if (transaction.sellerPhone && transaction.sellerPhone !== transaction.buyerPhone) {
    await sendWhatsAppMessage(
      transaction.sellerPhone,
      `🚨 *Dispute opened for escrow ${transactionRef}* by the other party — funds are frozen.` +
        proofPrompt
    );
  }
}

export interface IncomingWhatsAppMedia {
  kind: "IMAGE" | "VIDEO" | "DOCUMENT";
  /** Meta WhatsApp media id from the webhook payload. */
  mediaId: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  caption?: string | null;
}

/**
 * Media entry point: records photo/video proof from a party whose session is
 * in AWAITING_DISPUTE_EVIDENCE. Evidence rows land in the admin review
 * queue (metadata + WhatsApp media id — no other processing happens here).
 * Non-evidence media is acknowledged and ignored.
 */
export async function handleIncomingWhatsAppMedia(
  from: string,
  media: IncomingWhatsAppMedia
): Promise<void> {
  try {
    const session = await getSession(from);
    if (!session || session.state !== "AWAITING_DISPUTE_EVIDENCE" || !session.data.transactionRef) {
      // Media outside the dispute flow — nothing to attach it to.
      return;
    }

    const transactionRef = session.data.transactionRef;
    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (
      !transaction ||
      (transaction.buyerPhone !== from && transaction.sellerPhone !== from) ||
      transaction.status !== "DISPUTE_OPEN"
    ) {
      await resetSession(from);
      await sendWhatsAppMessage(
        from,
        `⚠️ We couldn't attach that media to escrow *${transactionRef}*. ` +
          `Send \`${DISPUTE_COMMAND} ${transactionRef}\` if you need to re-open the dispute.`
      );
      return;
    }

    await prisma.disputeEvidence.create({
      data: {
        transactionId: transaction.id,
        transactionRef: transaction.transactionRef,
        uploaderPhone: from,
        kind: media.kind,
        whatsappMediaId: media.mediaId,
        mimeType: media.mimeType ?? null,
        fileSizeBytes: media.fileSizeBytes ?? null,
        caption: media.caption ?? null,
      },
    });

    await sendWhatsAppMessage(
      from,
      `✅ *Proof received* for escrow *${transactionRef}* — it's been added to the ` +
        `admin review queue. You may send more photos/videos; funds stay frozen ` +
        `until our team resolves the dispute.`
    );
  } catch (error: unknown) {
    console.error("WhatsApp dispute evidence handling failed:", error);
    await sendWhatsAppMessage(
      from,
      `⚠️ We couldn't save that media. Please try sending it again.`
    );
  }
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/** Advance an in-progress buyer session by one field. */
async function advanceSession(
  from: string,
  session: ActiveSession,
  text: string
): Promise<void> {
  switch (session.state) {
    case "AWAITING_TITLE": {
      const title = text.trim();
      if (!title || title.length > 120) {
        await sendWhatsAppMessage(
          from,
          "Please send a valid item or service title, e.g. `iPhone 13`."
        );
        return;
      }
      await setSession(from, "AWAITING_AMOUNT", { itemTitle: title });
      await sendWhatsAppMessage(
        from,
        `Got it — *${title}* 📦\n\nNow send the *amount* in Naira (e.g. 250000).`
      );
      return;
    }

    case "AWAITING_AMOUNT": {
      const amount = parseAmount(text);
      if (amount === null) {
        await sendWhatsAppMessage(
          from,
          "That doesn't look like a valid amount. Please send a positive number (e.g. 250000)."
        );
        return;
      }
      await setSession(from, "AWAITING_SELLER_PHONE", {
        ...session.data,
        itemAmount: amount,
      });
      await sendWhatsAppMessage(
        from,
        `Amount set to ₦${amount.toLocaleString()} 💰\n\nFinally, send the *seller's phone number* (e.g. 2348012345678).`
      );
      return;
    }

    case "AWAITING_SELLER_PHONE": {
      const sellerPhone = normalizePhone(text);
      if (!sellerPhone) {
        await sendWhatsAppMessage(
          from,
          "That doesn't look like a valid phone number. Use digits only (e.g. 2348012345678)."
        );
        return;
      }

      const { itemTitle, itemAmount } = session.data;
      if (!itemTitle || !itemAmount) {
        // Session data is incomplete — restart cleanly.
        await setSession(from, "AWAITING_TITLE", null);
        await sendWhatsAppMessage(from, `${WELCOME_MESSAGE}`);
        return;
      }

      await createDraftAndInviteSeller(from, itemTitle, itemAmount, sellerPhone);
      return;
    }

    case "AWAITING_DISPUTE_EVIDENCE":
      // Unreachable: the main loop prompts for media before this is called.
      return;

    default:
      return; // getSession() never returns IDLE sessions
  }
}

/**
 * Main entry point for the WhatsApp webhook — routes one incoming message
 * (text body or interactive button payload) through the state machine.
 */
export async function handleIncomingWhatsAppMessage(
  from: string,
  messageBody: string
): Promise<void> {
  const text = (messageBody || "").trim();
  if (!text) return;

  // 1. Seller acceptance commands (text or button payload).
  const decision = parseSellerDecision(text);
  if (decision) {
    await handleSellerDecision(from, decision.action, decision.ref);
    return;
  }

  // 1.5. DISPUTE <ref> — either party freezes the trade and arms the
  //      evidence-collection flow for both sides.
  const dispute = parseDisputeCommand(text);
  if (dispute) {
    await handleDisputeCommand(from, dispute);
    return;
  }

  // 2. Commands — start (or restart) the buyer flow.
  if (START_COMMANDS.has(text.toLowerCase())) {
    await setSession(from, "AWAITING_TITLE", null);
    await sendWhatsAppMessage(from, WELCOME_MESSAGE);
    return;
  }

  // 3. In-progress escrow creation → progressive field collection.
  //    A reference lookup or a PIN typed mid-flow is allowed to fall through,
  //    except while we are specifically waiting for the numeric amount (where
  //    a 4-digit value is a legitimate amount, not a PIN).
  const session = await getSession(from);
  if (session) {
    // A full one-shot deal still works at any step.
    const parsed = parseEscrowDeal(text);
    if (parsed) {
      if (parsed.ok) {
        await createDraftAndInviteSeller(from, parsed.itemTitle, parsed.amount, parsed.sellerPhone);
      } else {
        await sendWhatsAppMessage(from, `⚠️ ${parsed.error}`);
      }
      return;
    }

    // While collecting dispute evidence, ordinary texts are re-prompted for
    // photo/video media — a PIN or reference still falls through so status
    // lookups keep working mid-dispute.
    if (session.state === "AWAITING_DISPUTE_EVIDENCE") {
      const looksLikePin = /^\d{4}$/.test(text);
      const looksLikeRef = text.toUpperCase().startsWith("TS-");
      if (!looksLikePin && !looksLikeRef) {
        await sendWhatsAppMessage(
          from,
          `📎 Please send your *photo or video proof* for escrow ` +
            `*${session.data.transactionRef ?? "the disputed trade"}* as a WhatsApp media message. ` +
            `_(You can also send \`${DISPUTE_COMMAND} ${session.data.transactionRef ?? "<ref>"}\` again to re-open.)_`
        );
        return;
      }
    }

    const stepOwnsNumericInput = session.state === "AWAITING_AMOUNT";
    const looksLikePin = /^\d{4}$/.test(text);
    const looksLikeRef = text.toUpperCase().startsWith("TS-");
    if (stepOwnsNumericInput || (!looksLikePin && !looksLikeRef)) {
      await advanceSession(from, session, text);
      return;
    }
  }

  // 4. PIN Release Handler
  if (/^\d{4}$/.test(text)) {
    await handlePinRelease(from, text);
    return;
  }

  // 5. Transaction Reference Lookup Handler
  if (text.toUpperCase().startsWith("TS-")) {
    await handleReferenceLookup(from, text);
    return;
  }

  // 6. One-shot deal with no active session
  const parsed = parseEscrowDeal(text);
  if (parsed) {
    if (parsed.ok) {
      await createDraftAndInviteSeller(from, parsed.itemTitle, parsed.amount, parsed.sellerPhone);
    } else {
      await sendWhatsAppMessage(from, `⚠️ ${parsed.error}\n\n${WELCOME_MESSAGE}`);
    }
    return;
  }

  // 7. Fallback Info Message
  await sendWhatsAppMessage(from, FALLBACK_MESSAGE);
}
