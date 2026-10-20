import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { computePayoutAmount } from "@/lib/payout";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { recordAdminAction } from "@/lib/audit";

type ActionContext = { params: Promise<{ ref: string; action: string }> };

export async function POST(request: NextRequest, context: ActionContext) {
  try {
    // Admin actions on escrows require a valid admin_token session.
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { ref, action } = await context.params;

    if (!ref || !action) {
      return NextResponse.json({ error: "Transaction reference and action are required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef: ref },
      include: { seller: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Parsed once, before the switch, so every action can read it safely.
    const body = await request.json().catch(() => ({} as any));
    const { releasePin, disputeFault } = body ?? {};

    let updated;

    switch (action) {
      case "fund": {
        // Manual "payment received" lock, mirroring the Flutterwave webhook.
        if (transaction.status !== "PENDING_DEPOSIT") {
          return NextResponse.json(
            { error: `Transaction is ${transaction.status}, not PENDING_DEPOSIT` },
            { status: 409 }
          );
        }

        updated = await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: { status: "ESCROW_LOCKED" },
        });

        await recordAdminAction(request, {
          adminId: admin.id,
          action: "ESCROW_FUNDED",
          targetId: transaction.id,
          message: `Manually confirmed payment and locked escrow ${transaction.transactionRef}`,
          changes: { status: { from: "PENDING_DEPOSIT", to: "ESCROW_LOCKED" } },
        });

        return NextResponse.json({ success: true, transaction: updated });
      }

      case "release": {
        if (transaction.status === "COMPLETED") {
          return NextResponse.json({ message: "Funds already released" }, { status: 200 });
        }

        // The release PIN is only required when the operator supplies one;
        // an authenticated admin release can proceed without it.
        if (releasePin && transaction.releasePin !== releasePin) {
          return NextResponse.json({ error: "Invalid release PIN" }, { status: 400 });
        }

        if (!transaction.seller.bankCode || !transaction.seller.accountNumber) {
          return NextResponse.json({ error: "Seller has no bank account on file" }, { status: 400 });
        }

        const payoutAmount = computePayoutAmount(transaction);
        const payoutRef = `TS-ADMIN-REL-${transaction.id}-${Date.now()}`;

        await initiateFlutterwaveTransfer({
          accountBank: transaction.seller.bankCode,
          accountNumber: transaction.seller.accountNumber,
          amount: payoutAmount,
          narration: `Admin Release for Tx ${transaction.transactionRef}`,
          reference: payoutRef,
          beneficiaryName: transaction.seller.name || "TrustShip Seller",
        });

        const released = await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: { status: "COMPLETED" },
        });

        await recordAdminAction(request, {
          adminId: admin.id,
          action: "ESCROW_RELEASED",
          targetId: transaction.id,
          message: `Released ₦${payoutAmount} to seller for transaction ${transaction.transactionRef}`,
          changes: {
            status: { from: transaction.status, to: "COMPLETED" },
            payoutAmount,
            payoutReference: payoutRef,
          },
        });

        if (transaction.sellerPhone) {
          try {
            await sendWhatsAppMessage(
              transaction.sellerPhone,
              `🎉 *Funds Released (${transaction.transactionRef})*\n\n` +
                `₦${payoutAmount.toLocaleString()} has been transferred to your bank account (${transaction.seller.bankName}).`
            );
          } catch (wsErr) {
            console.warn("Failed to send WhatsApp notification:", wsErr);
          }
        }

        return NextResponse.json({ success: true, payoutAmount, payoutReference: payoutRef, transaction: released });
      }

      case "deliver":
        // Mark as delivered
        updated = await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: { status: "DELIVERED", dispatchStatus: "DELIVERED" },
        });

        await recordAdminAction(request, {
          adminId: admin.id,
          action: "ESCROW_DELIVERED",
          targetId: transaction.id,
          message: `Marked transaction ${transaction.transactionRef} as delivered`,
          changes: { status: { from: transaction.status, to: "DELIVERED" } },
        });

        return NextResponse.json({ success: true, transaction: updated });

      case "dispute":
        if (!disputeFault) {
          return NextResponse.json({ error: "Dispute fault is required" }, { status: 400 });
        }

        updated = await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: { status: "DISPUTE_OPEN", disputeFault },
        });

        await recordAdminAction(request, {
          adminId: admin.id,
          action: "DISPUTE_OPENED",
          targetId: transaction.id,
          message: `Opened dispute on transaction ${transaction.transactionRef} (fault: ${disputeFault})`,
          changes: {
            status: { from: transaction.status, to: "DISPUTE_OPEN" },
            disputeFault,
          },
        });

        return NextResponse.json({ success: true, transaction: updated });

      default:
        return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Admin escrow action error:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: ActionContext) {
  try {
    // Detail view exposes the release PIN — admin session required.
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { ref } = await context.params;

    if (!ref) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef: ref },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        transactionRef: transaction.transactionRef,
        itemTitle: transaction.itemTitle,
        status: transaction.status,
        dispatchStatus: transaction.dispatchStatus,
        totalEscrow: transaction.totalEscrow,
        platformFee: transaction.platformFee,
        // Only an authenticated admin ever sees the release PIN.
        releasePin: transaction.releasePin,
      },
    });
  } catch (error: any) {
    console.error("Admin escrow get error:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
