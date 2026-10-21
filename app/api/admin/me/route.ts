import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { JWT_SECRET, ADMIN_SESSION_COOKIE, adminSessionCookieOptions } from "@/lib/admin-auth";

/** Expire the session cookie with the attributes it was issued with. */
function expireSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Verify the JWT. On failure, clear the cookie so the middleware stops
  //    treating this browser as authenticated (prevents redirect loops).
  let adminId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId?: string };
    if (typeof decoded !== "object" || !decoded.adminId) {
      throw new Error("Malformed token payload");
    }
    adminId = decoded.adminId;
  } catch {
    const response = NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
    expireSessionCookie(response);
    return response;
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
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
      // Admin account was removed → invalidate the session cookie too.
      const response = NextResponse.json(
        { error: "Admin not found" },
        { status: 404 }
      );
      expireSessionCookie(response);
      return response;
    }

    // Enrolled = flag set AND a TOTP secret exists — the same predicate the
    // login route uses. Deriving this from secret presence alone reported
    // "Enabled" after a mere Setup click (before verification), which hid the
    // enrollment UI while login still did not require a code.
    const computedIsTwoFactorEnabled = !!(
      admin.isTwoFactorEnabled && admin.twoFactorSecret
    );

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
