import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { verify } from 'otplib';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, password, token } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });

    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Handle 2FA Verification
    if (admin.isTwoFactorEnabled) {
      if (!token) {
        return NextResponse.json({ requires2FA: true }, { status: 200 });
      }

      if (!admin.twoFactorSecret) {
        return NextResponse.json({ error: '2FA configuration missing' }, { status: 400 });
      }

      // Verify TOTP token with 1-step window tolerance (±30 seconds drift allowance)
      const isValid = verify({
        token: token.trim(),
        secret: admin.twoFactorSecret,
      });

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid 2FA security code. Please check your authenticator time settings.' }, { status: 400 });
      }
    }

    // Set Admin Session Cookie
    const cookieStore = await cookies();
    cookieStore.set('trustship_admin_session', admin.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({
      success: true,
      admin: { id: admin.id, email: admin.email, role: admin.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
