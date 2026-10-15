import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { verify } from 'otplib';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // If 2FA is enabled
    if (admin.isTwoFactorEnabled) {
      if (!token) {
        return NextResponse.json({ requires2FA: true }, { status: 200 });
      }

      if (!admin.twoFactorSecret) {
        return NextResponse.json({ error: '2FA configuration missing' }, { status: 400 });
      }

      // Properly AWAIT verify and check result.valid property
      const result = await verify({
        token: token.trim(),
        secret: admin.twoFactorSecret,
      });

      if (!result.valid) {
        return NextResponse.json({ error: 'Invalid 2FA security code.' }, { status: 400 });
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
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
