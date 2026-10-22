// app/api/admin/logistics/route.ts
//
// Admin logistics board API.
//
//   GET  -> paginated escrow shipments (tracking state included)
//   POST -> book a waybill for a transaction with the chosen carrier
//
// Booking is a mutating administrative action, so it is audited. Every admin
// role may book (it is operational, not financial), but authentication is
// mandatory — the proxy and requireAdmin both enforce it.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { createWaybillForTransaction } from "@/lib/logistics";
import type { LogisticsProvider } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "logistics:read");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );
    const provider = searchParams.get("provider");
    const tracked = searchParams.get("tracked"); // "true" | "false" | null

    const where: Record<string, unknown> = {};
    if (provider) where.logisticsProvider = provider;
    if (tracked === "true") where.trackingNumber = { not: null };
    if (tracked === "false") where.trackingNumber = null;

    const [total, shipments] = await Promise.all([
      prisma.escrowTransaction.count({ where }),
      prisma.escrowTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          transactionRef: true,
          itemTitle: true,
          itemAmount: true,
          currency: true,
          status: true,
          trackingNumber: true,
          logisticsProvider: true,
          waybillUrl: true,
          deliveryStatus: true,
          courierName: true,
          buyerPhone: true,
          sellerPhone: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      shipments,
      shipmentStats: {
        total,
        tracked: shipments.filter((s) => s.trackingNumber).length,
        delivered: shipments.filter((s) => s.deliveryStatus === "DELIVERED").length,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Admin logistics list error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "logistics:manage");
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const body = await request.json();
    const transactionRef = String(body?.transactionRef || "").trim();
    const provider = String(body?.provider || "MOCK").trim().toUpperCase() as LogisticsProvider;

    if (!transactionRef) {
      return NextResponse.json(
        { success: false, error: "transactionRef is required" },
        { status: 400 }
      );
    }

    const result = await createWaybillForTransaction({
      transactionRef,
      provider,
      origin: body?.origin,
      destination: body?.destination,
      recipientName: body?.recipientName,
      recipientPhone: body?.recipientPhone,
    });

    await recordAdminAction(request, {
      adminId: admin.id,
      action: "WAYBILL_CREATED",
      targetId: transactionRef,
      message: `Booked ${result.waybill.provider} waybill ${result.waybill.trackingNumber} for ${transactionRef}`,
      changes: {
        provider: result.waybill.provider,
        trackingNumber: result.waybill.trackingNumber,
      },
    });

    return NextResponse.json({ success: true, waybill: result.waybill });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Transaction not found")) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }
    console.error("Admin waybill creation error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
