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

    const updated = await prisma.escrow.update({
      where: { transactionRef: ref },
      data: { status: newStatus },
    });

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}