import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSecret, generateURI } from "otplib";

export async function GET(request: NextRequest) {
  try {
    const adminSession = request.cookies.get("trustship_admin_session")?.value;

    if (!adminSession) {
      return NextResponse.json(
        { success: false, error: "Admin session not found" },
        { status: 401 }
      );
    }

    // Look up the admin user
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminSession },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Generate TOTP secret if not already set
    let secret = admin.twoFactorSecret;

    if (!secret) {
      secret = generateSecret();
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { twoFactorSecret: secret },
      });
    }

    // Generate the QR code data URI for the authenticator app
    const otpauthUrl = generateURI({
      issuer: "TrustShip",
      label: admin.email,
      secret,
    });

    return NextResponse.json({
      success: true,
      qrCodeUrl: otpauthUrl,
      secret,
      message: "Scan the QR code with your authenticator app to enable 2FA",
    });
  } catch (error: any) {
    console.error("Admin 2FA setup error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}