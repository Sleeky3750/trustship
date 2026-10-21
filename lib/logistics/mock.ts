// lib/logistics/mock.ts
//
// Mock logistics provider.
//
// This is the default integration: it needs no carrier credentials, returns
// deterministic-but-realistic data, and lets the whole waybill → tracking →
// delivery → release lifecycle run end-to-end (including in CI) while GIGL and
// Speedaf API keys are still pending. Real integrations slot in behind the
// same `LogisticsIntegration` interface.
//
// Determinism: every derived value is a pure function of the tracking number,
// so the same shipment always reports the same timeline. That makes the
// admin UI and the webhook stub testable without seeding state.

import type { LogisticsProvider } from "@prisma/client";
import {
  TRACKING_MILESTONES,
  type CancelResult,
  type DeliveryStatus,
  type LogisticsIntegration,
  type TrackingEvent,
  type TrackingMilestone,
  type TrackingResult,
  type WaybillRequest,
  type WaybillResult,
} from "./types";

/** Stable, order-independent hash so a tracking number maps to fixed data. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * MOCK booking reference. Format mirrors a real carrier enough that the UI can
 * be built against it: `MOCK-<year>-<6 digits>`.
 */
function buildTrackingNumber(seed: number): string {
  const year = new Date().getFullYear();
  const digits = String(seed % 1_000_000).padStart(6, "0");
  return `MOCK-${year}-${digits}`;
}

/**
 * MOCK milestone schedule. The shipment advances one milestone per hour since
 * `createdAt`, capped at DELIVERED — so a freshly created waybill shows PICKED
 * UP and a day-old one shows DELIVERED, without a background job.
 */
function computeStatus(trackingNumber: string): {
  status: DeliveryStatus;
  events: TrackingEvent[];
} {
  const seed = hash(trackingNumber);
  const createdAt = Date.now() - (seed % 6) * 60 * 60 * 1000; // 0–5h ago
  const hoursElapsed = (Date.now() - createdAt) / (60 * 60 * 1000);
  const reached = Math.min(TRACKING_MILESTONES.length, Math.floor(hoursElapsed) + 1);

  const events: TrackingEvent[] = [];
  for (let i = reached - 1; i >= 0; i--) {
    const milestone = TRACKING_MILESTONES[i] as TrackingMilestone;
    events.push({
      status: milestone,
      description: MILESTONE_COPY[milestone],
      location: i % 2 === 0 ? "Lagos Sorting Hub" : "Ikeja Distribution Centre",
      occurredAt: new Date(createdAt + i * 60 * 60 * 1000).toISOString(),
    });
  }

  const latest = events[0]?.status ?? "PENDING";
  return { status: latest, events };
}

const MILESTONE_COPY: Record<TrackingMilestone, string> = {
  PICKED_UP: "Shipment picked up from the sender.",
  IN_TRANSIT: "Shipment is in transit between hubs.",
  OUT_FOR_DELIVERY: "Courier is out for delivery today.",
  DELIVERED: "Shipment delivered and signed for.",
};

export class MockLogisticsProvider implements LogisticsIntegration {
  readonly provider: LogisticsProvider = "MOCK";

  async createWaybill(request: WaybillRequest): Promise<WaybillResult> {
    const trackingNumber = buildTrackingNumber(hash(request.transactionRef));

    // Flat mock rate scaled by declared value so the checkout preview shows a
    // plausible number instead of a hardcoded constant.
    const declared = request.declaredValue ?? 0;
    const shippingFee =
      request.shippingFee ??
      Math.round((1200 + declared * 0.01) * 100) / 100;

    return {
      provider: this.provider,
      trackingNumber,
      waybillUrl: `https://mock.logistics.trustship.app/waybills/${trackingNumber}.pdf`,
      status: "PICKED_UP",
      shippingFee,
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      raw: { mock: true, destination: request.destination },
    };
  }

  async getTrackingStatus(trackingNumber: string): Promise<TrackingResult> {
    const { status, events } = computeStatus(trackingNumber);
    return {
      provider: this.provider,
      trackingNumber,
      status,
      events,
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const { status } = computeStatus(trackingNumber);
    const cancellable = status !== "DELIVERED";
    return {
      provider: this.provider,
      trackingNumber,
      cancelled: cancellable,
      message: cancellable
        ? "Shipment cancelled. The waybill is void and no fee is charged."
        : "Shipment already delivered — it can no longer be cancelled.",
    };
  }
}
