import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    // Audit trails are restricted to SUPER_ADMIN (mirrors the sidebar gating).
    const auth = await requireAdmin(request, { roles: ["SUPER_ADMIN"] });
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");
    const action = searchParams.get("action");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );

    // Build where clause for filtering
    const where: any = {};
    if (adminId) {
      where.adminId = adminId;
    }
    if (action) {
      where.action = action;
    }

    // Count total records for pagination
    const totalCount = await prisma.adminAuditLog.count({ where });

    // Fetch audit logs with pagination
    const auditLogs = await prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      // `logs` is the canonical key; `auditLogs` is kept as an alias for
      // consumers (e.g. the dashboard Recent Activity widget) that read it.
      logs: auditLogs,
      auditLogs,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("Admin audit logs error:", error);
    return NextResponse.json(
      {
        success: false,
        logs: [],
        auditLogs: [],
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}