import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

async function handleSetup(request: NextRequest) {
  try {
    // Only an authenticated admin (admin_token JWT) may fetch their TOTP secret.
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const admin = await prisma.adminUser.findUnique({
      where: { id: auth.admin.id },
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

    // The security page renders this in an <img src>, and browsers cannot
    // display an otpauth:// URL — return an actual QR PNG data URI instead.
    const qrCodeDataUri = await QRCode.toDataURL(otpauthUrl, {
      margin: 1,
      width: 256,
    });

    return NextResponse.json({
      success: true,
      qrCodeUrl: qrCodeDataUri,
      otpauthUrl,
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

// The security settings page issues POST; GET kept for backward compatibility.
export async function GET(request: NextRequest) {
  return handleSetup(request);
}

export async function POST(request: NextRequest) {
  return handleSetup(request);
}
