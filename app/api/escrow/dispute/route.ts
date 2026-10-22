import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { armDisputeEvidenceSessions } from "@/lib/whatsapp/botEngine";
import { DisputeFault, TransactionStatus } from "@prisma/client";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { recordEvent, EVENTS } from "@/lib/events";

/** Statuses from which a dispute may legitimately be opened. */
const DISPUTABLE_STATUSES = ["ESCROW_LOCKED", "DISPATCHED", "DELIVERED"];

export async function POST(request: NextRequest) {
  try {
    // Opening a dispute freezes funds and fans out real customer messages.
    // That is a support/moderator action, never an anonymous one — previously
    // any caller who knew a reference could freeze any escrow and message both
    // parties. Requires the `disputes:manage` permission.
    const auth = await requirePermission(request, "disputes:manage");
    if (auth.error) return auth.error;
    const admin = auth.admin;

    // Accept either the escrow reference or its database id so both the
    // tracking page (transactionRef) and admin tooling (id) work.
    const { transactionRef, transactionId, disputeFault, reportedBy, reason } =
      await request.json();

    if (!transactionRef && !transactionId) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = transactionRef
      ? await prisma.escrowTransaction.findUnique({ where: { transactionRef } })
      : await prisma.escrowTransaction.findUnique({ where: { id: transactionId } });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Validate dispute fault parameter
    if (
      !disputeFault ||
      !(
        disputeFault === DisputeFault.SELLER_FAULT ||
        disputeFault === DisputeFault.BUYER_FAULT
      )
    ) {
      return NextResponse.json(
        { error: "Valid dispute fault (SELLER_FAULT or BUYER_FAULT) is required" },
        { status: 400 }
      );
    }

    // A dispute may only be raised on an escrow that actually holds funds and
    // is not already terminal or disputed.
    if (transaction.status === TransactionStatus.DISPUTE_OPEN) {
      return NextResponse.json(
        { error: "This escrow already has an open dispute." },
        { status: 409 }
      );
    }
    if (!DISPUTABLE_STATUSES.includes(transaction.status)) {
      return NextResponse.json(
        {
          error: `Transaction is ${transaction.status}; only a funded escrow can be disputed.`,
        },
        { status: 409 }
      );
    }

    // Update transaction with dispute status and fault — funds frozen.
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.DISPUTE_OPEN,
        disputeFault: disputeFault as DisputeFault,
        disputeStage: "AWAITING_EVIDENCE",
      },
    });

    // Create the dispute case record so the moderation pipeline has a row to
    // work from (assignee, status, notes, resolution).
    const dispute = await prisma.dispute.create({
      data: {
        transactionId: transaction.id,
        transactionRef: transaction.transactionRef,
        description: reason ?? null,
        status: "OPEN",
        openedByPhone: reportedBy ?? transaction.buyerPhone,
      },
    });

    // Put both parties into the WhatsApp evidence flow (photo/video proof
    // lands in the admin dispute review queue).
    if (transaction.buyerPhone && transaction.sellerPhone) {
      await armDisputeEvidenceSessions(
        transaction.buyerPhone,
        transaction.sellerPhone,
        transaction.transactionRef
      );
    }

    // Send WhatsApp notification to both parties about the dispute
    const disputeInfo =
      `⚠️ *Dispute Raised (${transaction.transactionRef})*\n\n` +
      `A dispute has been raised and the funds for this escrow are on hold.\n` +
      `• Reason: ${reason || "Not specified"}\n\n` +
      `📎 Please send your *photo or video proof* over WhatsApp — our team will ` +
      `review both sides before releasing or refunding the funds.`;

    if (transaction.buyerPhone) {
      await sendWhatsAppMessage(transaction.buyerPhone, disputeInfo);
    }
    if (transaction.sellerPhone) {
      await sendWhatsAppMessage(transaction.sellerPhone, disputeInfo);
    }

    // Timeline + audit.
    await recordEvent({
      transactionId: transaction.id,
      transactionRef: transaction.transactionRef,
      type: EVENTS.DISPUTE_OPENED,
      message: `Dispute opened (${disputeFault}). Case ${dispute.id}`,
      actorKind: "ADMIN",
      actorId: admin.id,
      metadata: {
        disputeId: dispute.id,
        disputeFault,
        reason: reason ?? null,
        reportedBy: reportedBy ?? null,
      },
    });
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "DISPUTE_OPENED",
      targetId: transaction.id,
      message: `Opened dispute ${dispute.id} on ${transaction.transactionRef} (fault: ${disputeFault})`,
      changes: {
        status: { from: transaction.status, to: TransactionStatus.DISPUTE_OPEN },
        disputeId: dispute.id,
        disputeFault,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Dispute recorded and both parties notified via WhatsApp",
      disputeId: dispute.id,
      transaction: updated,
    });
  } catch (error: any) {
    console.error("Dispute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
