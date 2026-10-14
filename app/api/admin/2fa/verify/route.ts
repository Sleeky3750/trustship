import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as otplib from 'otplib';

const prisma = new PrismaClient();
const authenticator = otplib.authenticator;

export async function POST(request: Request) {
  try {
    const { adminId, token } = await request.json();
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });

    if (!admin || !admin.twoFactorSecret) {
      return NextResponse.json({ error: 'Setup not initiated' }, { status: 400 });
    }

    const isValid = authenticator.verify({ token, secret: admin.twoFactorSecret });

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
