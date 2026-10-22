import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { recordEvent, EVENTS } from "@/lib/events";

export async function POST(request: NextRequest) {
  try {
    // Updating the waybill / dispatch state is an operational action that must
    // never be reachable by an unauthenticated caller guessing a reference:
    // marking an escrow DELIVERED is a precondition of release.
    const auth = await requirePermission(request, "logistics:manage");
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { transactionRef, waybillPayer, dispatchStatus } = await request.json();

    if (!transactionRef) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Dispatch may only move monotonically. DELIVERED additionally requires
    // that the escrow was actually dispatched — an escrow still awaiting
    // payment or a seller cannot be marked delivered.
    const allowedDispatch = ["PENDING", "IN_TRANSIT", "DELIVERED"];
    const nextDispatch =
      typeof dispatchStatus === "string" && allowedDispatch.includes(dispatchStatus)
        ? dispatchStatus
        : undefined;

    if (nextDispatch === "DELIVERED") {
      const deliverable = ["ESCROW_LOCKED", "DISPATCHED", "DELIVERED"];
      if (!deliverable.includes(transaction.status)) {
        return NextResponse.json(
          {
            error: `Transaction is ${transaction.status}; only a funded escrow can be marked delivered.`,
          },
          { status: 409 }
        );
      }
    }

    // Update waybill metadata
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        waybillPayer: waybillPayer || transaction.waybillPayer,
        ...(nextDispatch ? { dispatchStatus: nextDispatch } : {}),
        ...(nextDispatch === "DELIVERED" && transaction.status !== "COMPLETED"
          ? { status: "DELIVERED" }
          : {}),
      },
    });

    // Timeline + audit (waybill edits are operational actions worth recording).
    if (nextDispatch) {
      await recordEvent({
        transactionId: transaction.id,
        transactionRef,
        type:
          nextDispatch === "DELIVERED"
            ? EVENTS.DELIVERY_REPORTED
            : EVENTS.DELIVERY_INITIATED,
        message: `Dispatch status set to ${nextDispatch} by an administrator`,
        actorKind: "ADMIN",
        actorId: admin.id,
        metadata: { dispatchStatus: nextDispatch, waybillPayer: waybillPayer ?? null },
      });
    }
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "WAYBILL_UPDATED",
      targetId: transaction.id,
      message: `Waybill/dispatch updated for ${transactionRef}`,
      changes: {
        waybillPayer: waybillPayer || transaction.waybillPayer,
        dispatchStatus: nextDispatch ?? transaction.dispatchStatus,
      },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: any) {
    console.error("Waybill update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}