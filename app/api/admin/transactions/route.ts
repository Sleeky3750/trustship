import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { roleHasPermission } from "@/lib/rbac";
import { maskPhone } from "@/lib/mask";

/**
 * GET /api/admin/transactions
 *
 * Server-side paginated, filterable transaction list for the admin dashboard.
 *
 * PII: phone numbers are masked unless the caller holds
 * `transactions:read_pii` (FINANCE_ADMIN / SUPER_ADMIN). Masking happens on the
 * SERVER — a lower-privileged admin never receives the raw value at all, so
 * client-side filtering can never substitute for authorization.
 *
 * Filters: status, free-text query (ref / buyer phone / seller phone / item),
 * from/to (ISO dates), risk level, and legacy `ref` exact match.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "transactions:read");
    if (auth.error) return auth.error;
    const canReadPii = roleHasPermission(auth.admin.role, "transactions:read_pii");

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );
    const status = searchParams.get("status");
    const ref = searchParams.get("ref");
    const query = (searchParams.get("q") || "").trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const risk = searchParams.get("risk");

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (ref) where.transactionRef = ref;
    if (risk && risk !== "ALL") where.riskLevel = risk;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    if (query) {
      where.OR = [
        { transactionRef: { contains: query, mode: "insensitive" } },
        { itemTitle: { contains: query, mode: "insensitive" } },
        { buyerPhone: { contains: query } },
        { sellerPhone: { contains: query } },
      ];
    }

    const [totalCount, transactions] = await Promise.all([
      prisma.escrowTransaction.count({ where }),
      prisma.escrowTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          buyer: { select: { id: true, name: true, phone: true } },
          seller: { select: { id: true, name: true, phone: true } },
          // Lightweight related-record summaries for the table badges.
          _count: { select: { refunds: true, disputes: true, payouts: true } },
        },
      }),
    ]);

    const data = transactions.map((t) => ({
      id: t.id,
      transactionRef: t.transactionRef,
      itemTitle: t.itemTitle,
      currency: t.currency,
      itemAmount: t.itemAmount,
      totalEscrow: t.totalEscrow,
      platformFee: t.platformFee,
      gatewayFee: t.gatewayFee,
      status: t.status,
      dispatchStatus: t.dispatchStatus,
      deliveryStatus: t.deliveryStatus,
      trackingNumber: t.trackingNumber,
      logisticsProvider: t.logisticsProvider,
      disputeStage: t.disputeStage,
      riskLevel: t.riskLevel,
      riskScore: t.riskScore,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      buyer: {
        id: t.buyer.id,
        name: canReadPii ? t.buyer.name : t.buyer.name,
        phone: canReadPii ? t.buyer.phone : maskPhone(t.buyer.phone),
      },
      seller: {
        id: t.seller.id,
        name: canReadPii ? t.seller.name : t.seller.name,
        phone: canReadPii ? t.seller.phone : maskPhone(t.seller.phone),
      },
      counts: {
        refunds: t._count.refunds,
        disputes: t._count.disputes,
        payouts: t._count.payouts,
      },
    }));

    return NextResponse.json({
      success: true,
      transactions: data,
      piiMasked: !canReadPii,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("Admin transactions error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
