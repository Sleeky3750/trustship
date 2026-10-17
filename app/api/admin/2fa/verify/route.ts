import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verify } from "otplib";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, adminId } = body;

    if (!code || !adminId) {
      return NextResponse.json(
        { success: false, error: "Code and admin ID are required" },
        { status: 400 }
      );
    }

    // Look up the admin user
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Admin user not found" },
        { status: 404 }
      );
    }

    if (!admin.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: "2FA not set up for this admin" },
        { status: 400 }
      );
    }

    // Verify the TOTP code
    const isValid = verify({ secret: admin.twoFactorSecret, token: code });

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid 2FA code" },
        { status: 401 }
      );
    }

    // Mark 2FA as enabled and return success
    await prisma.adminUser.update({
      where: { id: adminId },
      data: { isTwoFactorEnabled: true },
    });

    return NextResponse.json({
      success: true,
      message: "2FA verification successful",
      isTwoFactorEnabled: true,
    });
  } catch (error: any) {
    console.error("Admin 2FA verify error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}