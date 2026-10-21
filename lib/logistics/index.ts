// lib/logistics/index.ts
//
// Provider registry + escrow-bound helpers.
//
// `getLogisticsProvider(value)` is the ONLY way callers should obtain an
// integration. Real carriers (GIGL / SPEEDAF / DHL) are not credentialed yet,
// so they intentionally resolve to the mock integration rather than throwing —
// that keeps the admin "Generate Waybill" flow usable today while GUARANTEEING
// at most one place (`registry` below) changes when live keys land.

import { prisma } from "@/lib/prisma";
import type { LogisticsProvider } from "@prisma/client";
import { MockLogisticsProvider } from "./mock";
import type { LogisticsIntegration, WaybillResult } from "./types";

export * from "./types";
export { MockLogisticsProvider } from "./mock";

const mock = new MockLogisticsProvider();

/**
 * Carrier → integration map.
 *
 * Every entry currently points at the mock implementation. Swapping a carrier
 * to its real client is a one-line change here; `LogisticsIntegration` is
 * already the contract those clients must satisfy.
 */
const registry: Record<LogisticsProvider, LogisticsIntegration> = {
  MOCK: mock,
  CUSTOM: mock,
  GIGL: mock,
  SPEEDAF: mock,
  DHL: mock,
};

/** Resolve an integration by provider. Unknown values fall back to MOCK. */
export function getLogisticsProvider(
  provider: LogisticsProvider | string | null | undefined
): LogisticsIntegration {
  if (!provider) return mock;
  return registry[provider as LogisticsProvider] ?? mock;
}

/** All providers the UI may offer, with their display metadata. */
export const LOGISTICS_PROVIDERS: {
  value: LogisticsProvider;
  label: string;
  /** True when the integration is live (has carrier credentials configured). */
  live: boolean;
}[] = [
  { value: "GIGL", label: "GIG Logistics", live: false },
  { value: "SPEEDAF", label: "Speedaf Express", live: false },
  { value: "DHL", label: "DHL Express", live: false },
  { value: "CUSTOM", label: "Custom Courier", live: false },
  { value: "MOCK", label: "TrustShip Mock Carrier", live: true },
];

/**
 * Book a waybill for an escrow and persist the carrier metadata on the
 * transaction.
 *
 * Persisting here (rather than in the route) means every entry point — admin
 * UI, seller dashboard, a future automated dispatch bot — writes the same
 * fields. Returns the transaction's new tracking state; throws only when the
 * transaction does not exist.
 */
export async function createWaybillForTransaction(params: {
  transactionRef: string;
  provider: LogisticsProvider | string;
  origin?: string;
  destination?: string;
  recipientName?: string;
  recipientPhone?: string;
  itemTitle?: string | null;
}): Promise<{ success: true; waybill: WaybillResult; transactionRef: string }> {
  const transaction = await prisma.escrowTransaction.findUnique({
    where: { transactionRef: params.transactionRef },
  });

  if (!transaction) {
    throw new Error(`Transaction not found: ${params.transactionRef}`);
  }

  const integration = getLogisticsProvider(params.provider);
  const waybill = await integration.createWaybill({
    transactionRef: transaction.transactionRef,
    origin: params.origin || "Lagos, Nigeria",
    destination: params.destination || "Nigeria",
    recipientName: params.recipientName || "Escrow recipient",
    recipientPhone: params.recipientPhone || transaction.buyerPhone,
    declaredValue: transaction.itemAmount,
    currency: transaction.currency,
    itemTitle: params.itemTitle ?? transaction.itemTitle,
  });

  await prisma.escrowTransaction.update({
    where: { id: transaction.id },
    data: {
      trackingNumber: waybill.trackingNumber,
      logisticsProvider: integration.provider,
      waybillUrl: waybill.waybillUrl,
      deliveryStatus: waybill.status,
      // Surface the carrier in the existing courier columns so the legacy
      // dashboard columns keep rendering something meaningful.
      courierName: params.provider === "MOCK" ? "TrustShip Mock Carrier" : String(params.provider),
    },
  });

  return { success: true, waybill, transactionRef: transaction.transactionRef };
}
