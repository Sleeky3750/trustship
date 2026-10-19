import { NextResponse } from "next/server";
import { createEscrow, EscrowCreationError } from "@/lib/escrow-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createEscrow(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof EscrowCreationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Escrow creation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error during escrow creation",
      },
      { status: 500 }
    );
  }
}
