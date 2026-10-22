// app/api/admin/payouts/route.ts
//
// Admin payout queue API.
//
//   GET  -> the queue with status/search filters + headline stats
//   POST -> enqueue a payout for a transaction ({ action: "enqueue", transactionRef })
//
// Retry lives at /api/admin/payouts/[id]/retry. Both are FINANCE_ADMIN /
// SUPER_ADMIN only: payouts move real money out of the platform.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { enqueuePayout } from "@/lib/payouts/processor";
import { computePayoutAmount } from "@/lib/payout";
import { roleHasPermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "payouts:read");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { transactionRef: { contains: search, mode: "insensitive" } },
        { accountNumber: { contains: search } },
      ];
    }

    const [total, payouts, grouped] = await Promise.all([
      prisma.payoutQueue.count({ where }),
      prisma.payoutQueue.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payoutQueue.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const counts = { PENDING: 0, PROCESSING: 0, SUCCESS: 0, FAILED: 0 } as Record<string, number>;
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }

    return NextResponse.json({
      success: true,
      payouts,
      stats: {
        ...counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      },
      canManage: roleHasPermission(auth.admin.role, "payouts:manage"),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Admin payouts list error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "payouts:manage");
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const body = await request.json().catch(() => ({}));
    const transactionRef = String(body?.transactionRef || "").trim();

    if (!transactionRef) {
      return NextResponse.json(
        { success: false, error: "transactionRef is required" },
        { status: 400 }
      );
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
      include: { seller: { select: { accountNumber: true, bankCode: true } } },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Payout destination comes from the seller record, never the request body.
    const accountNumber = transaction.seller?.accountNumber;
    const bankCode = transaction.seller?.bankCode;

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { success: false, error: "Seller has no payout account on file" },
        { status: 400 }
      );
    }

    const amount = computePayoutAmount({
      totalEscrow: transaction.totalEscrow,
      platformFee: transaction.platformFee,
      gatewayFee: transaction.gatewayFee,
    });

    const result = await enqueuePayout({ transactionRef, amount, accountNumber, bankCode });

    await recordAdminAction(request, {
      adminId: admin.id,
      action: "PAYOUT_ENQUEUED",
      targetId: transactionRef,
      message: `Queued payout of ${amount} for ${transactionRef}`,
      changes: { amount, payoutId: result.payout.id },
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      payout: result.payout,
    });
  } catch (error) {
    console.error("Admin payout enqueue error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
