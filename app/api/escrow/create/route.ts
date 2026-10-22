import { NextResponse } from "next/server";
import { createEscrow, EscrowCreationError } from "@/lib/escrow-service";
import { checkWindowLimit, windowClientKey } from "@/lib/rate-limit";

/**
 * POST /api/escrow/create
 *
 * Public escrow creation for the web checkout form (and reused by the
 * WhatsApp draft flow). Hardening applied over the original implementation:
 *
 *   1. Rate limited per client IP (creation mints a Flutterwave checkout link
 *      and two User rows, so unthrottled access is an abuse vector).
 *   2. The release PIN is NOT returned in the response body. It is delivered to
 *      the buyer over WhatsApp by the escrow service. Returning it here would
 *      let anyone who can call this endpoint read the PIN that authorises a
 *      fund release.
 */
export async function POST(request: Request) {
  try {
    const limit = checkWindowLimit(windowClientKey(request, "escrow-create"), 10, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many escrow creation attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const body = await request.json();
    const result = await createEscrow(body);

    // Strip the release PIN from the HTTP response — it travels over WhatsApp.
    const { releasePin: _releasePin, ...safeResult } = result;
    return NextResponse.json(safeResult);
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
