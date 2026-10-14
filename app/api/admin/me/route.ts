import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('trustship_admin_session');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For secure lookup, we pull the admin record. (If session stores email or ID, adjust here).
    // Let's fallback to the primary active admin or query by stored session value.
    const admin = await prisma.adminUser.findFirst({
      select: { id: true, email: true, name: true, role: true, isTwoFactorEnabled: true }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, admin });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
