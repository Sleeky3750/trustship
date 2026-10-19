import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { computePayoutAmount } from "@/lib/payout";
import { createEscrow, EscrowCreationError } from "@/lib/escrow-service";
import {
  createSession,
  getSession,
  removeSession,
  updateSession,
  type EscrowCreationState,
} from "@/lib/whatsapp-escrow-storage";

// GET: Meta Verification Handshake
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// POST: Incoming WhatsApp Message Processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log payload
    await prisma.webhookLog.create({
      data: {
        provider: "WHATSAPP",
        payload: body,
      },
    });

    const entries = body.entry;
    if (entries && Array.isArray(entries)) {
      for (const entry of entries) {
        const changes = entry.changes;
        if (changes && Array.isArray(changes)) {
          for (const change of changes) {
            const value = change.value;
            if (value && value.messages && Array.isArray(value.messages)) {
              for (const message of value.messages) {
                const from = message.from; // Phone number of sender
                if (message.type === "text" && message.text?.body) {
                  await processIncomingMessage(from, message.text.body.trim());
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: unknown) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Conversational escrow helpers
// ---------------------------------------------------------------------------

const WELCOME_MESSAGE =
  `Welcome to TrustShip Escrow! 🔒\n` +
  `To start a payment, send your deal details in this format:\n` +
  "`Item Title, Amount, Seller Phone`\n\n" +
  "Example: `iPhone 13, 250000, 2348012345678`";

const FALLBACK_MESSAGE =
  `${WELCOME_MESSAGE}\n\n` +
  `You can also send your *reference* (e.g. TS-ESCROW-XXXX) to check status, ` +
  `or your 4-digit *PIN* to release funds to the seller.`;

const START_COMMANDS = new Set(["/start", "/escrow", "escrow"]);

type EscrowDeal =
  | { ok: true; itemTitle: string; amount: number; sellerPhone: string }
  | { ok: false; error: string }
  | null;

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

/** Create the escrow and reply with the checkout link, or report failure. */
async function finalizeEscrow(
  from: string,
  itemTitle: string,
  amount: number,
  sellerPhone: string
): Promise<void> {
  try {
    const escrow = await createEscrow(
      {
        itemTitle,
        itemAmount: amount,
        buyerPhone: from,
        sellerPhone,
        waybillAmount: 0,
        waybillPayer: "SELLER",
      },
      { notifyParticipants: false }
    );

    // Only clear the session once the escrow (and checkout link) exist.
    removeSession(from);

    await sendWhatsAppMessage(
      from,
      `✅ Escrow Created Successfully!\n\n` +
        `📦 Item: ${itemTitle}\n` +
        `💰 Amount: ₦${amount.toLocaleString()}\n` +
        `🔑 Reference: ${escrow.transactionRef}\n\n` +
        `💳 Pay securely into escrow here:\n${escrow.paymentUrl}`
    );
  } catch (error: unknown) {
    const detail =
      error instanceof EscrowCreationError
        ? error.message
        : "Something went wrong while creating your escrow.";
    console.error("WhatsApp escrow creation failed:", error);

    // Keep the session so the buyer can simply resend the details and retry.
    await sendWhatsAppMessage(
      from,
      `⚠️ We couldn't create your escrow: ${detail}\n\nPlease resend your details and we'll try again.`
    );
  }
}

/** Advance an in-progress session by one field. */
async function handleSessionStep(
  from: string,
  session: EscrowCreationState,
  text: string
): Promise<void> {
  // A full one-shot deal still works at any step.
  const parsed = parseEscrowDeal(text);
  if (parsed) {
    if (parsed.ok) {
      await finalizeEscrow(from, parsed.itemTitle, parsed.amount, parsed.sellerPhone);
    } else {
      await sendWhatsAppMessage(from, `⚠️ ${parsed.error}`);
    }
    return;
  }

  switch (session.step) {
    case "awaiting_item_title": {
      const title = text.trim();
      if (!title || title.length > 120) {
        await sendWhatsAppMessage(
          from,
          "Please send a valid item title, e.g. `iPhone 13`."
        );
        return;
      }
      updateSession(from, { step: "awaiting_item_amount", itemTitle: title });
      await sendWhatsAppMessage(
        from,
        `Got it — *${title}* 📦\n\nNow send the *amount* in Naira (e.g. 250000).`
      );
      return;
    }

    case "awaiting_item_amount": {
      const amount = parseAmount(text);
      if (amount === null) {
        await sendWhatsAppMessage(
          from,
          "That doesn't look like a valid amount. Please send a positive number (e.g. 250000)."
        );
        return;
      }
      updateSession(from, { step: "awaiting_seller_phone", itemAmount: amount });
      await sendWhatsAppMessage(
        from,
        `Amount set to ₦${amount.toLocaleString()} 💰\n\nFinally, send the *seller's phone number* (e.g. 2348012345678).`
      );
      return;
    }

    case "awaiting_seller_phone": {
      const sellerPhone = normalizePhone(text);
      if (!sellerPhone) {
        await sendWhatsAppMessage(
          from,
          "That doesn't look like a valid phone number. Use digits only (e.g. 2348012345678)."
        );
        return;
      }

      const { itemTitle, itemAmount } = session;
      if (!itemTitle || !itemAmount) {
        // Session data is incomplete — restart cleanly.
        createSession(from);
        await sendWhatsAppMessage(from, `${WELCOME_MESSAGE}`);
        return;
      }

      await finalizeEscrow(from, itemTitle, itemAmount, sellerPhone);
      return;
    }
  }
}

// Message State Handler
async function processIncomingMessage(from: string, text: string): Promise<void> {
  const cleanText = text.trim();

  // 1. Commands — start (or restart) the conversational escrow flow.
  if (START_COMMANDS.has(cleanText.toLowerCase())) {
    createSession(from);
    await sendWhatsAppMessage(from, WELCOME_MESSAGE);
    return;
  }

  // 2. In-progress escrow creation → progressive field collection.
  //    A reference lookup or a PIN typed mid-flow is allowed to fall through,
  //    except while we are specifically waiting for the numeric amount (where
  //    a 4-digit value is a legitimate amount, not a PIN).
  const session = getSession(from);
  if (session) {
    const looksLikePin = /^\d{4}$/.test(text);
    const looksLikeRef = text.toUpperCase().startsWith("TS-");
    const stepOwnsNumericInput = session.step === "awaiting_item_amount";
    if (stepOwnsNumericInput || (!looksLikePin && !looksLikeRef)) {
      await handleSessionStep(from, session, text);
      return;
    }
  }

  // 3. PIN Release Handler
  const isPin = /^\d{4}$/.test(text);
  if (isPin) {
    const pin = text;

    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        buyerPhone: from,
        releasePin: pin,
        status: { in: ["ESCROW_LOCKED", "DELIVERED"] },
      },
      include: { seller: true },
    });

    if (transaction) {
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
    } else {
      await sendWhatsAppMessage(
        from,
        `❌ Invalid PIN or no active escrow awaiting release was found for your account.`
      );
    }
    return;
  }

  // 4. Transaction Reference Lookup Handler
  if (text.toUpperCase().startsWith("TS-")) {
    const ref = text.toUpperCase();

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
    return;
  }

  // 5. One-shot deal with no active session
  const parsed = parseEscrowDeal(text);
  if (parsed) {
    if (parsed.ok) {
      await finalizeEscrow(from, parsed.itemTitle, parsed.amount, parsed.sellerPhone);
    } else {
      await sendWhatsAppMessage(from, `⚠️ ${parsed.error}\n\n${WELCOME_MESSAGE}`);
    }
    return;
  }

  // 6. Fallback Info Message
  await sendWhatsAppMessage(from, FALLBACK_MESSAGE);
}
