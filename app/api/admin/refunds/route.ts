import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { eligibleRefundMinor, toMajor } from "@/lib/refunds/workflow";

/**
 * GET /api/admin/refunds
 *
 * Server-side paginated refund list with optional status/search filters.
 * Read access requires `refunds:read` (all three roles hold it).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "refunds:read");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const query = (searchParams.get("q") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25)
    );
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (query) {
      where.OR = [
        { transactionRef: { contains: query, mode: "insensitive" } },
        { reason: { contains: query, mode: "insensitive" } },
      ];
    }

    const [total, refunds] = await Promise.all([
      prisma.refund.count({ where }),
      prisma.refund.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const data = refunds.map((r) => ({
      id: r.id,
      transactionRef: r.transactionRef,
      amount: toMajor(r.amountMinor),
      amountMinor: r.amountMinor,
      currency: r.currency,
      reason: r.reason,
      status: r.status,
      processorRef: r.processorRef,
      failureReason: r.failureReason,
      requestedById: r.requestedById,
      reviewedById: r.reviewedById,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Refunds list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/refunds
 *
 * Creates a refund request from inside the admin dashboard. Requires
 * `refunds:request`. Does not move money.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "refunds:request");
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({} as any));
    const { transactionRef, amountMinor, reason } = body ?? {};

    if (!transactionRef) {
      return NextResponse.json(
        { error: "Transaction reference is required" },
        { status: 400 }
      );
    }

    const tx = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
      select: { id: true },
    });
    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const eligible = await eligibleRefundMinor(tx.id);

    const { requestRefund, RefundError } = await import("@/lib/refunds/workflow");
    try {
      const refund = await requestRefund({
        transactionRef,
        amountMinor: amountMinor == null ? undefined : Number(amountMinor),
        reason,
        requestedById: auth.admin.id,
      });
      return NextResponse.json(
        {
          success: true,
          eligible,
          refund: {
            id: refund.id,
            status: refund.status,
            amountMinor: refund.amountMinor,
            currency: refund.currency,
          },
        },
        { status: 201 }
      );
    } catch (e) {
      if (e instanceof RefundError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  } catch (error) {
    console.error("Refund create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
