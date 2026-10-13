import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const db = prisma as any;
    // Automatically find whichever model name exists in your schema
    const model = db.escrow || db.Escrow || db.transaction || db.Transaction;

    if (!model) {
      return NextResponse.json({ error: "Prisma escrow model not found in schema" }, { status: 500 });
    }

    const escrows = await model.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ escrows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}