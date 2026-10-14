import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('trustship_admin_session');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Grab the active admin record
    const admin = await prisma.adminUser.findFirst();

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
