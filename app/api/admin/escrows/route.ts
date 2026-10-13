import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const escrows = await prisma.escrowTransaction.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ escrows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
