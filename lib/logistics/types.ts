// lib/logistics/types.ts
//
// Unified logistics interface.
//
// Every carrier integration (GIGL, Speedaf, DHL, CUSTOM, MOCK) implements this
// exact surface so the escrow flow, the admin dashboard and the webhook stub
// never branch on which courier is in play. Integrations are looked up by
// `LogisticsProvider` value through `getLogisticsProvider()`.

import type { LogisticsProvider } from "@prisma/client";

/** Milestones surfaced in the tracking timeline UI, in chronological order. */
export const TRACKING_MILESTONES = [
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type TrackingMilestone = (typeof TRACKING_MILESTONES)[number];

/** Anything else the carrier reports (e.g. EXCEPTION, RETURNED). */
export type DeliveryStatus = TrackingMilestone | "PENDING" | "EXCEPTION" | "CANCELLED" | "UNKNOWN";

export interface WaybillRequest {
  /** Escrow reference — becomes the carrier's merchant/order reference. */
  transactionRef: string;
  /** Origin city / pickup address. */
  origin: string;
  /** Destination city / delivery address. */
  destination: string;
  recipientName: string;
  recipientPhone: string;
  /** Declared value in the transaction currency (used for insurance). */
  declaredValue?: number;
  currency?: string;
  itemTitle?: string | null;
  /** Pre-agreed shipment fee, when the buyer/seller selected a courier price. */
  shippingFee?: number;
}

export interface WaybillResult {
  provider: LogisticsProvider;
  trackingNumber: string;
  /** Hosted label / waybill PDF the customer can print. */
  waybillUrl: string;
  status: DeliveryStatus;
  /** Total quoted shipment cost, when the carrier returns one. */
  shippingFee?: number;
  estimatedDelivery?: string;
  raw?: unknown;
}

export interface TrackingEvent {
  status: DeliveryStatus;
  /** Human readable carrier note. */
  description: string;
  location?: string;
  /** ISO timestamp of the event. */
  occurredAt: string;
}

export interface TrackingResult {
  provider: LogisticsProvider;
  trackingNumber: string;
  status: DeliveryStatus;
  /** Newest first. */
  events: TrackingEvent[];
  estimatedDelivery?: string;
  recipientName?: string;
}

export interface CancelResult {
  provider: LogisticsProvider;
  trackingNumber: string;
  cancelled: boolean;
  message: string;
}

/**
 * The contract every logistics integration must satisfy. Keeping this narrow
 * (three calls) is deliberate: it is the minimum the escrow lifecycle needs,
 * and it is small enough that a carrier added later cannot break callers.
 */
export interface LogisticsIntegration {
  readonly provider: LogisticsProvider;
  /** Book a shipment and return the carrier tracking number + label URL. */
  createWaybill(request: WaybillRequest): Promise<WaybillResult>;
  /** Poll the carrier for the latest milestone timeline. */
  getTrackingStatus(trackingNumber: string): Promise<TrackingResult>;
  /** Attempt to cancel a shipment that has not yet been delivered. */
  cancelShipment(trackingNumber: string): Promise<CancelResult>;
}
