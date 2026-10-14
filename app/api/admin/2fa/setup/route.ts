import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { adminId } = await request.json();
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const secret = authenticator.generateSecret();
    const appName = 'TrustShip Admin';
    const otpauth = authenticator.keyuri(admin.email, appName, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { twoFactorSecret: secret },
    });

    return NextResponse.json({ success: true, secret, qrCodeUrl });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
