import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logAdminAction } from '@/lib/audit';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Capture client IP for security forensics
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';

    // Log the successful login in the immutable audit table
    await logAdminAction({
      adminId: admin.id,
      action: 'LOGIN_SUCCESS',
      details: `Admin logged in successfully`,
      ipAddress: clientIp,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('trustship_admin_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}