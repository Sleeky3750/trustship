import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Extract dynamic route params from URL pathname
    const url = new URL(request.url);
    const pathnameParts = url.pathname.split("/").filter(Boolean);
    const ref = pathnameParts[pathnameParts.indexOf("admin") + 1];
    const action = pathnameParts[pathnameParts.indexOf("admin") + 2];

    if (!ref || !action) {
      return NextResponse.json({ error: "Transaction reference and action are required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef: ref },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Handle different actions
    let updated;

    switch (action) {
      case "release":
        // This would typically require admin authentication
        // For now, check if release PIN was provided via query param
        const body = await request.json();
        const { releasePin } = body;

        if (!releasePin || transaction.releasePin !== releasePin) {
          return NextResponse.json({ error: "Invalid release PIN" }, { status: 400 });
        }

        // Prevent double release
        if (transaction.status === "RELEASED") {
          return NextResponse.json({ message: "Funds already released" }, { status: 200 });
        }

        // Update status to RELEASED
        updated = await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: { status: "RELEASED" },
        });

        return NextResponse.json({ success: true, transaction: updated });

      case "deliver":
        // Mark as delivered
        updated = await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: { status: "DELIVERED", dispatchStatus: "DELIVERED" },
        });

        return NextResponse.json({ success: true, transaction: updated });

      case "dispute":
        // Raise dispute
        const { disputeFault } = body;

        if (!disputeFault) {
          return NextResponse.json({ error: "Dispute fault is required" }, { status: 400 });
        }

        updated = await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: { status: "DISPUTED", disputeFault },
        });

        return NextResponse.json({ success: true, transaction: updated });

      default:
        return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Admin escrow action error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extract dynamic route params from URL pathname
    const url = new URL(request.url);
    const pathnameParts = url.pathname.split("/").filter(Boolean);
    const ref = pathnameParts[pathnameParts.indexOf("admin") + 1];

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
        status: transaction.status,
        dispatchStatus: transaction.dispatchStatus,
        totalEscrow: transaction.totalEscrow,
        releasePin: transaction.releasePin,
      },
    });
  } catch (error: any) {
    console.error("Admin escrow get error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}