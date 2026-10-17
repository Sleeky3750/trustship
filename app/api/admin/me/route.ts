import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string };

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorSecret: true,
        isTwoFactorEnabled: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Compute 2FA state reliably from twoFactorSecret presence
    // This avoids Prisma boolean select quirks that may always return true
    const computedIsTwoFactorEnabled = !!(admin.twoFactorSecret || admin.isTwoFactorEnabled);

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isTwoFactorEnabled: computedIsTwoFactorEnabled,
        twoFactorSecret: admin.twoFactorSecret,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}