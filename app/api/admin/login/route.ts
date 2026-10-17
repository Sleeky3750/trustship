import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 1. Find admin user by email
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 2. Verify password (supports both hashed and plain text for legacy setup migration)
    let isPasswordValid = false;
    if (admin.password.startsWith("$2a$") || admin.password.startsWith("$2b$")) {
      isPasswordValid = await bcrypt.compare(password, admin.password);
    } else {
      isPasswordValid = admin.password === password;
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 3. Check if 2F is enabled (prepare for 2FA verification step if needed)
    if (admin.isTwoFactorEnabled) {
      return NextResponse.json(
        {
          success: true,
          requires2FA: true,
          adminId: admin.id,
          message: "2FA verification required",
        },
        { status: 200 }
      );
    }

    // 4. Mint JWT token for authenticated admin (when 2FA is not enabled)
    const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: "1d" });

    // 5. Set JWT token in httpOnly cookie and return success
    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful",
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
      { status: 200 }
    );

    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error);
    // CRITICAL: Always return JSON, never let Next.js return HTML error pages
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}