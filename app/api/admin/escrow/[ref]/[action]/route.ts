import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ref: string; action: string }> }
) {
  try {
    const { ref, action } = await params;
    let newStatus = "";

    if (action === "fund") newStatus = "FUNDED";
    else if (action === "release") newStatus = "COMPLETED";
    else return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    // Explicitly cast prisma to any as a separate variable to bypass TS property checks
    const db: any = prisma;
    const model = db.escrow || db.Escrow || db.transaction || db.Transaction;

    if (!model) {
      return NextResponse.json({ error: "Prisma escrow model not found in schema" }, { status: 500 });
    }

    const updated = await model.update({
      where: { transactionRef: ref },
      data: { status: newStatus },
    });

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}