import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {
  JWT_SECRET,
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
} from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";

/**
 * Expires the admin session cookie.
 *
 * The deliberate `set(..., { maxAge: 0 })` rather than a bare `delete(name)`
 * is what makes the clear reliable: a deletion must echo the *same* attributes
 * the cookie was issued with (path, secure, sameSite). Re-issuing an empty
 * value with `adminSessionCookieOptions()` produces a byte-compatible
 * Set-Cookie that every browser treats as "remove", including in production
 * where the session cookie is `Secure; SameSite=Strict`.
 */
function expireSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  // Belt-and-braces: drop any identically-named cookie left by an older build
  // that used different attributes (e.g. the old SameSite=Lax, 1-day cookie).
  response.cookies.delete(ADMIN_SESSION_COOKIE);
}

export async function POST(request: NextRequest) {
  try {
    // Clear the admin session cookie
    const response = NextResponse.json({
      success: true,
      message: "Admin logged out successfully",
    });

    // Best-effort forensics: log the logout (with client IP + User-Agent) when
    // a still-valid session token is present. Logout itself must always
    // succeed — an expired/invalid token simply has nothing to record.
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
          adminId?: string;
        };
        if (decoded && typeof decoded.adminId === "string" && decoded.adminId) {
          await recordAdminAction(request, {
            adminId: decoded.adminId,
            action: "ADMIN_LOGOUT",
            message: "Admin logged out",
          });
        }
      } catch {
        // Expired or invalid token — nothing durable to record.
      }
    }

    // Remove every copy of the admin session cookie set by /api/admin/login.
    expireSessionCookie(response);

    return response;
  } catch (error: any) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}

// Logout is a state-changing, cookie-clearing action: only POST (never a
// GET, which a third-party page could trigger via an <img> tag).
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    { status: 405 }
  );
}
