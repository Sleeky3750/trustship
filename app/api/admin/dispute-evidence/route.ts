import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { roleHasPermission } from "@/lib/rbac";
import { maskPhone } from "@/lib/mask";

// Dispute evidence review queue: photo/video proof sent over WhatsApp by
// either party after `DISPUTE <ref>` (or the web dispute form). Returns the
// evidence rows (metadata + WhatsApp media id) for one transaction.
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "disputes:read");
    if (auth.error) return auth.error;
    const canReadPii = roleHasPermission(auth.admin.role, "transactions:read_pii");

    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("ref");

    if (!ref) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef: ref },
      select: {
        id: true,
        transactionRef: true,
        status: true,
        disputeFault: true,
        itemTitle: true,
        itemAmount: true,
        buyerPhone: true,
        sellerPhone: true,
        createdAt: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const evidence = await prisma.disputeEvidence.findMany({
      where: { transactionId: transaction.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      piiMasked: !canReadPii,
      transaction: {
        ...transaction,
        buyerPhone: canReadPii ? transaction.buyerPhone : maskPhone(transaction.buyerPhone),
        sellerPhone: canReadPii ? transaction.sellerPhone : maskPhone(transaction.sellerPhone),
      },
      evidence,
    });
  } catch (error: unknown) {
    console.error("Dispute evidence lookup failed:", error);
    return NextResponse.json(
      { error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
