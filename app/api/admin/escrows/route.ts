import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

// Returns escrow transactions (this endpoint used to return User records,
// which is why the admin dashboard read `data.escrows` and rendered nothing).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const ref = searchParams.get("ref");

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (ref) {
      where.transactionRef = ref;
    }

    const totalCount = await prisma.escrowTransaction.count({ where });

    const escrows = await prisma.escrowTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json({
      success: true,
      escrows,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("Admin escrows error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
