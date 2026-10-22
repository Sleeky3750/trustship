// app/api/admin/logistics/track/route.ts
//
// Live tracking lookup for a single shipment.
//
//   GET ?trackingNumber=...  -> carrier milestone timeline
//
// Kept separate from the fleet list so the dashboard can refresh one shipment's
// timeline (e.g. inside the tracking card) without refetching the whole table.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { getLogisticsProvider } from "@/lib/logistics";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "logistics:read");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const trackingNumber = (searchParams.get("trackingNumber") || "").trim();
    const ref = (searchParams.get("ref") || "").trim();

    let resolvedTracking = trackingNumber;
    let providerHint: string | null = null;

    // Allow lookup by escrow reference too, resolving the shipment first.
    if (!resolvedTracking && ref) {
      const transaction = await prisma.escrowTransaction.findUnique({
        where: { transactionRef: ref },
        select: { trackingNumber: true, logisticsProvider: true },
      });
      resolvedTracking = transaction?.trackingNumber || "";
      providerHint = transaction?.logisticsProvider || null;
    }

    if (!resolvedTracking) {
      return NextResponse.json(
        { success: false, error: "No tracking number for that shipment" },
        { status: 404 }
      );
    }

    const integration = getLogisticsProvider(providerHint);
    const tracking = await integration.getTrackingStatus(resolvedTracking);

    return NextResponse.json({ success: true, tracking });
  } catch (error) {
    console.error("Admin tracking lookup error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
