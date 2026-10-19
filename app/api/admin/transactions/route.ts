import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const ref = searchParams.get("ref");

    // Build where clause for filtering
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (ref) {
      where.transactionRef = ref;
    }

    // Count total records for pagination
    const totalCount = await prisma.escrowTransaction.count({ where });

    // Fetch transactions with pagination
    const transactions = await prisma.escrowTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        buyer: {
          select: { id: true, name: true, phone: true },
        },
        seller: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      transactions,
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
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}