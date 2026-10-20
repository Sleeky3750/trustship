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
    // Never echo raw error messages on 500s — the detail stays server-side.
    return NextResponse.json(
      { error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
