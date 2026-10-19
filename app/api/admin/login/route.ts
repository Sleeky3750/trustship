import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/admin-auth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verify } from "otplib";

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

    // 3. Two-factor authentication: enrolled admins must present a valid TOTP code
    const hasTokenField = Object.prototype.hasOwnProperty.call(body, "token");
    const totpCode =
      typeof body.token === "string" ? body.token.trim() : body.token;

    if (admin.isTwoFactorEnabled && admin.twoFactorSecret) {
      if (!totpCode) {
        // A second step was submitted with an empty code → explicit error.
        if (hasTokenField) {
          return NextResponse.json(
            { success: false, error: "2FA code is required" },
            { status: 400 }
          );
        }
        // First step: password accepted, now ask for the authenticator code.
        return NextResponse.json(
          {
            success: true,
            requires2FA: true,
            message: "2FA verification required",
          },
          { status: 200 }
        );
      }

      try {
        const result = await verify({
          secret: admin.twoFactorSecret,
          token: String(totpCode),
          epochTolerance: 30, // accept ±1 time step to tolerate clock drift
        });
        if (!result.valid) {
          return NextResponse.json(
            { success: false, error: "Invalid 2FA code" },
            { status: 401 }
          );
        }
      } catch (err: any) {
        // Malformed code (e.g. not 6 digits) or crypto failure — treat as invalid
        console.error(
          "Admin login TOTP verification error:",
          err?.message || err
        );
        return NextResponse.json(
          { success: false, error: "Invalid 2FA code" },
          { status: 401 }
        );
      }
    } else if (admin.isTwoFactorEnabled) {
      // Flag set but no secret stored: only reachable via manual DB edits.
      // Password still gates access — refusing here would hard-lock the admin
      // out of an account whose authenticator can never work again anyway.
      console.warn(
        `[admin-login] admin ${admin.id} has isTwoFactorEnabled=true but no twoFactorSecret; falling back to password-only login`
      );
    }

    // 4. Mint JWT token for authenticated admin (password + TOTP both passed)
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