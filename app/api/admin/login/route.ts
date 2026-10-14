import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import otplib from 'otplib';
import { logAdminAction } from '@/lib/audit';

const prisma = new PrismaClient();
const { authenticator } = otplib;

export async function POST(request: Request) {
  try {
    const { email, password, token } = await request.json();
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (admin.isTwoFactorEnabled) {
      if (!token) {
        return NextResponse.json({ 
          requires2FA: true, 
          message: 'Please provide your 2FA authenticator code' 
        }, { status: 200 });
      }

      const isValidToken = authenticator.verify({ token, secret: admin.twoFactorSecret! });
      if (!isValidToken) {
        return NextResponse.json({ error: 'Invalid 2FA authenticator code' }, { status: 401 });
      }
    }

    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';

    await logAdminAction({
      adminId: admin.id,
      action: 'LOGIN_SUCCESS',
      details: `Admin logged in successfully ${admin.isTwoFactorEnabled ? 'with 2FA' : ''}`,
      ipAddress: clientIp,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('trustship_admin_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
