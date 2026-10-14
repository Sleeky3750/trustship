import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verify } from 'otplib';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('trustship_admin_session');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    const admin = await prisma.adminUser.findFirst();

    if (!admin || !admin.twoFactorSecret) {
      return NextResponse.json({ error: 'Setup not initiated' }, { status: 400 });
    }

    const result = await verify({ token, secret: admin.twoFactorSecret });
    const isValid = typeof result === 'boolean' ? result : result.valid;

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid authenticator code' }, { status: 400 });
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { isTwoFactorEnabled: true },
    });

    return NextResponse.json({ success: true, message: '2FA successfully enabled' });
  } catch (error) {
    console.error('2FA verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
