// app/api/cron/process-payouts/route.ts
//
// Drains the payout queue.
//
// CRON_SECRET-gated exactly like the other cron endpoints (Authorization:
// Bearer <CRON_SECRET>). Processing is bounded per run so a single invocation
// cannot exceed the platform's function timeout, and the worker is idempotent
// (see lib/payouts/processor.ts) so overlapping runs are safe.
import { NextRequest, NextResponse } from "next/server";
import { processPendingPayouts } from "@/lib/payouts/processor";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: without a configured secret the endpoint is disabled rather
    // than world-callable.
    return false;
  }
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const results = await processPendingPayouts(25);
    const succeeded = results.filter((r) => r.status === "SUCCESS").length;
    const failed = results.filter((r) => r.status === "FAILED").length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    console.error("Payout cron error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
