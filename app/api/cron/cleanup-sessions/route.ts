import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import crypto from "crypto";

// Only the holder of CRON_SECRET may trigger this job. Returns null when
// authorized, otherwise the NextResponse to send back.
function verifyCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Cleanup cron: CRON_SECRET is not configured");
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  return ok ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Spec: /api/cron/cleanup-sessions
//   - auto-cancel seller drafts that have sat unaccepted for > 24h (both
//     parties notified) and clear stale WhatsApp conversation sessions.
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30min (bot session TTL)
// Cap outbound notifications per run so a huge backlog can't turn into a
// messaging storm — the rest are cancelled silently and picked up next run.
const NOTIFY_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

    const now = Date.now();
    const draftCutoff = new Date(now - DRAFT_MAX_AGE_MS);
    const sessionCutoff = new Date(now - SESSION_MAX_AGE_MS);

    // 1) Expire unaccepted drafts (>24h old) → CANCELLED, notify both parties.
    const expired = await prisma.escrowTransaction.findMany({
      where: {
        status: TransactionStatus.PENDING_SELLER_ACCEPTANCE,
        createdAt: { lt: draftCutoff },
      },
      select: { id: true, transactionRef: true, buyerPhone: true, sellerPhone: true },
      orderBy: { createdAt: "asc" },
      take: NOTIFY_LIMIT,
    });

    let cancelledDrafts = 0;
    for (const draft of expired) {
      try {
        await prisma.escrowTransaction.update({
          where: { id: draft.id },
          data: { status: TransactionStatus.CANCELLED },
        });
        cancelledDrafts += 1;

        const notice =
          `⏳ Escrow invitation *${draft.transactionRef}* expired without a seller ` +
          `response and has been auto-cancelled after 24 hours. Message us with ` +
          `\`escrow\` to start a new deal.`;
        await sendWhatsAppMessage(draft.buyerPhone, notice);
        if (draft.sellerPhone && draft.sellerPhone !== draft.buyerPhone) {
          await sendWhatsAppMessage(draft.sellerPhone, notice);
        }
      } catch (err) {
        console.error(`Cleanup cron: failed to cancel draft ${draft.transactionRef}:`, err);
      }
    }

    // Safety net: any expired drafts beyond the notification cap are still
    // cancelled this run, just without messages.
    const silentCancelled = await prisma.escrowTransaction.updateMany({
      where: {
        status: TransactionStatus.PENDING_SELLER_ACCEPTANCE,
        createdAt: { lt: draftCutoff },
      },
      data: { status: TransactionStatus.CANCELLED },
    });

    // 2) Clear stale WhatsApp session rows (TTL is 30 minutes of inactivity).
    const staleSessions = await prisma.whatsAppSession.deleteMany({
      where: { updatedAt: { lt: sessionCutoff } },
    });

    return NextResponse.json({
      success: true,
      cancelledDrafts: cancelledDrafts + silentCancelled.count,
      notifiedDrafts: cancelledDrafts,
      sessionsCleared: staleSessions.count,
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
