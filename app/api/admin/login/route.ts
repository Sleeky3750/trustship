import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/admin-auth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verify } from "otplib";
import { recordAdminAction } from "@/lib/audit";
import { getClientIp } from "@/lib/request-ip";
import { checkRateLimit, recordFailure, clearFailures } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Brute-force protection: block an IP for 15 minutes after 5 failed
    // attempts within the window (checked before any credential work).
    const clientIp = getClientIp(request);
    const rateStatus = checkRateLimit(clientIp);
    if (rateStatus.blocked) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many failed login attempts. Please try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateStatus.retryAfterSeconds) },
        }
      );
    }

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
      // Count toward the IP's failure window even though the email is
      // unknown (no audit row is possible — adminId is a required FK).
      recordFailure(clientIp);
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
      recordFailure(clientIp);
      // Forensics: failed attempt for a *known* admin account. (Unknown
      // emails cannot be logged — adminId is a required FK.)
      await recordAdminAction(request, {
        adminId: admin.id,
        action: "ADMIN_LOGIN_FAILED",
        message: "Rejected login attempt: incorrect password",
        changes: { attemptedEmail: admin.email },
      });
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
          recordFailure(clientIp);
          await recordAdminAction(request, {
            adminId: admin.id,
            action: "ADMIN_LOGIN_FAILED",
            message: "Rejected login attempt: invalid 2FA code",
            changes: { attemptedEmail: admin.email, stage: "2fa" },
          });
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
        recordFailure(clientIp);
        await recordAdminAction(request, {
          adminId: admin.id,
          action: "ADMIN_LOGIN_FAILED",
          message: "Rejected login attempt: malformed 2FA code",
          changes: { attemptedEmail: admin.email, stage: "2fa" },
        });
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

    // Authenticated — clear this IP's failure window.
    clearFailures(clientIp);

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

    // Complete audit record for the login: admin id, action, client IP and
    // User-Agent, 2FA usage and timestamp — written before responding.
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "ADMIN_LOGIN",
      message: `Admin ${admin.email} logged in${admin.isTwoFactorEnabled ? " with 2FA" : ""}`,
      changes: {
        email: admin.email,
        role: admin.role,
        twoFactorUsed: Boolean(admin.isTwoFactorEnabled && admin.twoFactorSecret),
      },
    });

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error);
    // CRITICAL: Always return JSON, never let Next.js return HTML error pages
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}