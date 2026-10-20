import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { verify } from "otplib";
import { recordAdminAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any));
    // Security page sends `{ token }`; other callers may send `{ code }`.
    const code = body?.code ?? body?.token;

    // The admin is identified by their session cookie, never by a body field.
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const adminId = auth.admin.id;

    if (!code) {
      return NextResponse.json(
        { success: false, error: "2FA code is required" },
        { status: 400 }
      );
    }

    // Look up the admin user (needs the TOTP secret)
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

    // Verify the TOTP code.
    // NOTE: otplib v13 verify() is async and returns { valid, ... } — calling it
    // without await produced a always-truthy Promise (any code was accepted).
    let isValid = false;
    try {
      const result = await verify({
        secret: admin.twoFactorSecret,
        token: String(code),
        epochTolerance: 30, // accept ±1 time step to tolerate clock drift
      });
      isValid = result.valid;
    } catch (err: any) {
      // Malformed code (e.g. not 6 digits) counts as invalid, not a 500
      console.error("Admin 2FA verify TOTP error:", err?.message || err);
      isValid = false;
    }

    if (!isValid) {
      await recordAdminAction(request, {
        adminId,
        action: "2FA_VERIFICATION_FAILED",
        message: "Rejected an invalid 2FA code during 2FA enablement",
      });
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

    await recordAdminAction(request, {
      adminId,
      action: "2FA_VERIFIED",
      message: "2FA enabled and verified for this admin account",
      changes: { isTwoFactorEnabled: { from: false, to: true } },
    });

    return NextResponse.json({
      success: true,
      message: "2FA verification successful",
      isTwoFactorEnabled: true,
    });
  } catch (error: any) {
    console.error("Admin 2FA verify error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
