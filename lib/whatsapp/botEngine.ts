// lib/whatsapp/botEngine.ts
//
// WhatsApp-first conversational escrow bot — the complete state machine.
//
// Buyer flow:
//   trigger (hi / start / escrow / /start / /escrow)
//     -> AWAITING_TITLE      (item or service title)
//     -> AWAITING_AMOUNT     (amount in NGN)
//     -> AWAITING_SELLER_PHONE
//     -> draft saved as PENDING_SELLER_ACCEPTANCE, seller invited on WhatsApp
//
// Seller flow:
//   ACCEPT <ref>   -> PENDING_PAYMENT + Paystack /transaction/initialize
//                     + payment link sent to the buyer
//   DECLINE <ref>  -> CANCELLED + both parties notified
//   (Interactive quick-reply buttons carry the same commands as payloads.)
//
// Paystack settlement (app/api/paystack/webhook):
//   charge.success -> ESCROW_LOCKED + dual WhatsApp notifications.
//
// Sessions persist in Prisma (`WhatsAppSession`, one row per phone number)
// and expire after 30 minutes of inactivity. The PIN-release handler,
// reference lookup and one-shot "Title, Amount, SellerPhone" shortcut from
// the original flow are preserved here.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveReplyButtons,
} from "@/lib/whatsapp";
import {
  createEscrowDraft,
  EscrowCreationError,
} from "@/lib/escrow-service";
import { initializePaystackTransaction } from "@/lib/paystack";
import { computePayoutAmount } from "@/lib/payout";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";

// ---------------------------------------------------------------------------
// Session persistence (Prisma-backed)
// ---------------------------------------------------------------------------

/** Abandoned sessions expire after 30 minutes of inactivity. */
const SESSION_TTL_MS = 30 * 60 * 1000;

type BotState =
  | "IDLE"
  | "AWAITING_TITLE"
  | "AWAITING_AMOUNT"
  | "AWAITING_SELLER_PHONE";

// A `type` (not `interface`) so Prisma's InputJsonObject accepts it directly.
type SessionData = {
  itemTitle?: string;
  itemAmount?: number;
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

    // 1) Buyer confirmation — invite dispatched.
    await sendWhatsAppMessage(
      buyerPhone,
      `✅ *Escrow draft created!*\n\n` +
        `📦 Item: ${draft.itemTitle}\n` +
        `💰 Amount: ₦${draft.totalEscrow.toLocaleString()}\n` +
        `🔑 Reference: ${draft.transactionRef}\n\n` +
        `An invitation has been sent to the seller (${draft.sellerPhone}). ` +
        `Once they accept, you'll receive a payment link to fund the escrow.`
    );

    // 2) Seller invitation (interactive quick-replies, text fallback).
    await inviteSeller(draft.transactionRef, draft.itemTitle, draft.totalEscrow, draft.sellerPhone, draft.buyerPhone);
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

/** Send the seller the ACCEPT/DECLINE invitation (buttons with text fallback). */
async function inviteSeller(
  transactionRef: string,
  itemTitle: string,
  totalEscrow: number,
  sellerPhone: string,
  buyerPhone: string
): Promise<void> {
  const body =
    `🛡️ *TrustShip Escrow Invitation*\n\n` +
    `${buyerPhone} wants to trade with you:\n\n` +
    `• Item: ${itemTitle}\n` +
    `• Amount: ₦${totalEscrow.toLocaleString()}\n` +
    `• Reference: ${transactionRef}\n\n` +
    `Reply *ACCEPT ${transactionRef}* to accept or ` +
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
 * ACCEPT flips the draft to PENDING_PAYMENT and initializes the Paystack
 * checkout (reverting to PENDING_SELLER_ACCEPTANCE if initialization fails,
 * so the seller can retry). DECLINE cancels the draft.
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
    data: { status: "PENDING_PAYMENT", paystackRef: transaction.transactionRef },
  });

  // 2) … then initialize Paystack and send the buyer the payment link.
  try {
    const init = await initializePaystackTransaction({
      reference: transaction.transactionRef,
      amount: transaction.totalEscrow,
      email: `${transaction.buyerPhone.replace(/\D/g, "")}@trustship.app`,
      firstName: "TrustShip Buyer",
      phone: transaction.buyerPhone,
      callbackUrl: process.env.APP_URL
        ? `${process.env.APP_URL}/escrow/${transaction.transactionRef}`
        : undefined,
    });

    await sendWhatsAppMessage(
      transaction.buyerPhone,
      `💳 *Seller Accepted!*\n\n` +
        `The seller accepted escrow *${transaction.transactionRef}* ` +
        `(${transaction.itemTitle ?? "item"} — ₦${transaction.totalEscrow.toLocaleString()}).\n\n` +
        `Fund the escrow securely here:\n${init.authorizationUrl}`
    );
    await sendWhatsAppMessage(
      transaction.sellerPhone,
      `✅ Accepted. The buyer has been sent the payment link for escrow ` +
        `*${transaction.transactionRef}* — we'll notify you once the funds are secured.`
    );
  } catch (error: unknown) {
    console.error(
      `Paystack initialization failed for escrow ${transaction.transactionRef}:`,
      error
    );

    // Revert so the seller can simply reply ACCEPT again to retry.
    await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { status: "PENDING_SELLER_ACCEPTANCE", paystackRef: null },
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
    data: { status: "RELEASED" },
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

  await sendWhatsAppMessage(
    from,
    `✅ PIN Verified! Payment of ₦${payoutAmount.toLocaleString()} has been released to the seller for escrow *${transaction.transactionRef}*. Thank you for using TrustShip!`
  );

  if (transaction.sellerPhone) {
    await sendWhatsAppMessage(
      transaction.sellerPhone,
      `🎉 Escrow Released! The buyer verified delivery for trade *${transaction.transactionRef}*. ₦${payoutAmount.toLocaleString()} has been sent to your bank.`
    );
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
