import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { handleIncomingWhatsAppMessage } from "@/lib/whatsapp/botEngine";

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

/**
 * Verify Meta's `x-hub-signature-256` header — `sha256=<hex>` where the digest
 * is HMAC-SHA256 of the RAW request body keyed with WHATSAPP_APP_SECRET.
 * Comparison is constant-time: byte length first, then `timingSafeEqual`.
 */
function isValidWhatsAppSignature(
  rawBody: Buffer,
  headerValue: string | null,
  appSecret: string
): boolean {
  if (!headerValue || !headerValue.startsWith("sha256=")) return false;

  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(headerValue, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// POST: Incoming WhatsApp Message Processing
//
// This route is the transport layer only: after signature verification and
// payload logging, every inbound message (text or interactive button tap) is
// handed to the conversational state machine in lib/whatsapp/botEngine.ts.
export async function POST(request: NextRequest) {
  try {
    // Read the raw body exactly once — the HMAC must be computed over the
    // bytes Meta actually sent, before any JSON parsing/normalisation.
    const rawBody = Buffer.from(await request.arrayBuffer());

    // Reject forged events BEFORE any processing (state changes, PIN release,
    // session handling) to prevent forged message injection.
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      if (process.env.NODE_ENV === "production") {
        console.error(
          "WhatsApp webhook: WHATSAPP_APP_SECRET not configured — rejecting payload (fail closed)."
        );
        return NextResponse.json(
          { error: "Webhook signature verification unavailable" },
          { status: 401 }
        );
      }
      console.warn(
        "WhatsApp webhook: WHATSAPP_APP_SECRET not configured — skipping signature verification (development only)."
      );
    } else if (!isValidWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
      console.error(
        "WhatsApp webhook: missing or invalid x-hub-signature-256 — rejected."
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody.toString("utf8"));

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
                if (!from) continue;

                if (message.type === "text" && message.text?.body) {
                  await handleIncomingWhatsAppMessage(from, message.text.body);
                } else if (message.type === "interactive") {
                  // Interactive quick-reply taps (seller ACCEPT/DECLINE
                  // invitation buttons) — the button id carries the command.
                  const buttonId =
                    message.interactive?.button_reply?.id ||
                    message.interactive?.list_reply?.id;
                  if (buttonId) {
                    await handleIncomingWhatsAppMessage(from, buttonId);
                  }
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
