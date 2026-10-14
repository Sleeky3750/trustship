import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { adminId } = await request.json();
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const secret = generateSecret();
    const otpauth = generateURI({
      issuer: 'TrustShip Admin',
      label: admin.email,
      secret,
    });
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
