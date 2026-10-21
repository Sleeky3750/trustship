// app/api/webhooks/logistics/route.ts
//
// Carrier → TrustShip delivery webhook (stub).
//
// Real carriers POST milestone updates here ("shipment 12345 delivered").
// Today the payload shape is intentionally permissive and the handler is
// defensive: an unknown carrier or tracking number is acknowledged (2xx) so a
// provider never retries forever over a shipment we do not track.
//
// Security note: because the carrier integrations are not live yet there is no
// signature scheme to verify. The handler therefore trusts ONLY the tracking
// number to locate a shipment and never trusts amounts, recipients, or
// transaction state transition targets from the body. When GIGL/SPEEDAF
// credentials land, add their signature check here before touching the DB.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DeliveryStatus } from "@/lib/logistics";

/** Carrier status strings → TrustShip milestone vocabulary. */
const STATUS_ALIASES: Record<string, DeliveryStatus> = {
  PICKED_UP: "PICKED_UP",
  PICKEDUP: "PICKED_UP",
  PICKUP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  INTRANSIT: "IN_TRANSIT",
  TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  OUT_FORDELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY_SUCCESSFUL: "DELIVERED",
  EXCEPTION: "EXCEPTION",
  FAILED: "EXCEPTION",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
};

function normalizeStatus(raw: unknown): DeliveryStatus {
  if (typeof raw !== "string") return "UNKNOWN";
  return STATUS_ALIASES[raw.trim().toUpperCase().replace(/[\s-]+/g, "_")] ?? "UNKNOWN";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Carriers name these differently; accept the common spellings.
    const trackingNumber =
      (body.trackingNumber || body.tracking_number || body.waybill || body.awb) as
        | string
        | undefined;

    if (!trackingNumber) {
      return NextResponse.json(
        { success: false, error: "trackingNumber is required" },
        { status: 400 }
      );
    }

    const status = normalizeStatus(body.status || body.event || body.milestone);

    const transaction = await prisma.escrowTransaction.findFirst({
      where: { trackingNumber },
      select: { id: true, transactionRef: true, status: true, deliveryStatus: true },
    });

    // Unknown shipment → ack and move on. 404 here would make a carrier retry
    // a webhook we can never satisfy.
    if (!transaction) {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: "No escrow transaction matches that tracking number",
      });
    }

    // `deliveryStatus` is carrier telemetry: record it verbatim. The escrow's
    // own `status` transition stays driven by buyer confirmation / admin
    // action, so a carrier webhook can never release funds.
    await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { deliveryStatus: status },
    });

    return NextResponse.json({
      success: true,
      transactionRef: transaction.transactionRef,
      deliveryStatus: status,
    });
  } catch (error) {
    console.error("Logistics webhook error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}

// Webhooks are POST-only; a GET must not mutate anything.
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    { status: 405 }
  );
}
