// app/api/admin/risk/route.ts
//
// Fraud risk overview API.
//
//   GET                     -> portfolio stats + flagged (HIGH/MEDIUM) rows
//   GET ?ref=TS-XXX         -> a single transaction's fresh assessment
//   POST { transactionRef } -> recompute and cache the risk band
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { evaluateAndCacheRisk, evaluateRisk } from "@/lib/risk/evaluator";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const ref = (searchParams.get("ref") || "").trim();

    // Single-transaction assessment (live, not cached).
    if (ref) {
      const assessment = await evaluateRisk({ transactionRef: ref });
      if (!assessment) {
        return NextResponse.json(
          { success: false, error: "Transaction not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, transactionRef: ref, assessment });
    }

    const [high, medium, low, total, openDisputes] = await Promise.all([
      prisma.escrowTransaction.count({ where: { riskLevel: "HIGH" } }),
      prisma.escrowTransaction.count({ where: { riskLevel: "MEDIUM" } }),
      prisma.escrowTransaction.count({ where: { riskLevel: "LOW" } }),
      prisma.escrowTransaction.count(),
      prisma.escrowTransaction.count({ where: { status: "DISPUTE_OPEN" } }),
    ]);

    const flagged = await prisma.escrowTransaction.findMany({
      where: { riskLevel: { in: ["HIGH", "MEDIUM"] } },
      orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        transactionRef: true,
        itemTitle: true,
        itemAmount: true,
        currency: true,
        status: true,
        riskLevel: true,
        riskScore: true,
        buyerPhone: true,
        sellerPhone: true,
        createdAt: true,
      },
    });

    const unscored = total - (high + medium + low);
    const disputeRatio = total > 0 ? openDisputes / total : 0;

    return NextResponse.json({
      success: true,
      stats: {
        total,
        high,
        medium,
        low,
        unscored,
        openDisputes,
        disputeRatio,
        // Rows the evaluator has actually scored — used to explain "unscored".
        scored: high + medium + low,
      },
      flagged,
    });
  } catch (error) {
    console.error("Admin risk overview error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
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

    const assessment = await evaluateAndCacheRisk(transactionRef);
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    await recordAdminAction(request, {
      adminId: admin.id,
      action: "RISK_RECOMPUTED",
      targetId: transactionRef,
      message: `Risk recomputed as ${assessment.level} (${assessment.score})`,
      changes: { level: assessment.level, score: assessment.score },
    });

    return NextResponse.json({ success: true, transactionRef, assessment });
  } catch (error) {
    console.error("Admin risk recompute error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
