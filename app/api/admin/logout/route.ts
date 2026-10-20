import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";

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
    const token = request.cookies.get("admin_token")?.value;
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

    // Remove the admin session cookie set by /api/admin/login
    response.cookies.delete('admin_token');

    return response;
  } catch (error: any) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
