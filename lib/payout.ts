// lib/payout.ts — Shared escrow money math.
//
// Zero-Loss Dynamic Fee & Gateway Pass-Through Engine.
//
// TrustShip's fees are flat (volume-dominance model) and Flutterwave's
// processing fees are passed through exactly, so every party gets its full
// amount:
//
//   totalEscrow (buyer funds) = itemAmount
//                             + platformFee   (TrustShip net revenue)
//                             + gatewayFee    (Flutterwave pass-through)
//                             + waybill       (only when the buyer pays it)
//   payoutAmount (seller)     = totalEscrow - platformFee - gatewayFee
//                             = 100% of the item value (+ buyer-paid waybill)
//
// Platform fee tiers (flat, based on the item amount):
//   <  ₦20,000        -> ₦200
//   ₦20,000–₦200,000  -> ₦500
//   >  ₦200,000       -> ₦1,500 (capped max flat rate)
//
// Gateway (Flutterwave) pass-through:
//   Collection fee  = 1.4% of (itemAmount + platformFee), capped at ₦2,000
//   Transfer fee    = ₦10 (<₦5k payout) | ₦25 (₦5k–₦50k) | ₦50 (>₦50k)
//
// All release/payout handlers must use `computePayoutAmount` instead of
// picking a column (itemAmount / totalEscrow) ad hoc.

/** Flat platform-fee tiers. */
export const MICRO_FEE_LIMIT = 20_000; // items below this: ₦200
export const STANDARD_FEE_LIMIT = 200_000; // items at/below this: ₦500 (above: ₦1,500)

export const MICRO_PLATFORM_FEE = 200;
export const STANDARD_PLATFORM_FEE = 500;
export const HIGH_VALUE_PLATFORM_FEE = 1_500;

/** Flutterwave collection (checkout) fee: 1.4% capped at ₦2,000. */
export const COLLECTION_FEE_RATE = 0.014;
export const COLLECTION_FEE_CAP = 2_000;

/** Round to 2 decimals to avoid float drift in money amounts. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * TrustShip flat platform fee, computed from the item amount. Used by both
 * creation paths (web + WhatsApp drafts) so the stored fee always matches
 * the total shown to the buyer (never trust a caller-supplied fee).
 */
export function computePlatformFee(itemAmount: number): number {
  const item = Number(itemAmount);
  if (!Number.isFinite(item) || item <= 0) return 0;
  if (item < MICRO_FEE_LIMIT) return MICRO_PLATFORM_FEE;
  if (item <= STANDARD_FEE_LIMIT) return STANDARD_PLATFORM_FEE;
  return HIGH_VALUE_PLATFORM_FEE;
}

/** Flutterwave payout transfer fee for the amount sent to the seller. */
export function computePayoutTransferFee(payoutAmount: number): number {
  const amount = Number(payoutAmount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount < 5_000) return 10;
  if (amount <= 50_000) return 25;
  return 50;
}

export interface GatewayFeeBreakdown {
  /** 1.4% of (item + platform fee), capped at ₦2,000. */
  collectionFee: number;
  /** Flutterwave transfer fee for the seller payout. */
  transferFee: number;
  /** collectionFee + transferFee — what the buyer pays as gateway pass-through. */
  total: number;
}

/**
 * Exact Flutterwave processing fees for a transaction, charged to the buyer
 * on top of the item + platform fee (pass-through — TrustShip neither earns
 * nor absorbs them).
 *
 * @param itemAmount    the seller's item value
 * @param platformFee   the computed TrustShip fee
 * @param payoutAmount  what will be transferred to the seller (item value +
 *                      buyer-paid waybill), used for the transfer-fee tier
 */
export function computeGatewayFee(
  itemAmount: number,
  platformFee: number,
  payoutAmount?: number
): GatewayFeeBreakdown {
  const item = Number(itemAmount) || 0;
  const platform = Number(platformFee) || 0;
  const payout = Number.isFinite(Number(payoutAmount))
    ? Number(payoutAmount)!
    : item;

  const collectionFee = round2(Math.min((item + platform) * COLLECTION_FEE_RATE, COLLECTION_FEE_CAP));
  const transferFee = computePayoutTransferFee(payout);

  return {
    collectionFee,
    transferFee,
    total: round2(collectionFee + transferFee),
  };
}

/**
 * The canonical seller payout: everything held in escrow minus TrustShip's
 * platform fee and the gateway pass-through fees (legacy rows created before
 * the pass-through engine have gatewayFee = 0, so their payout is unchanged).
 * Never negative (a malformed row can't produce a negative transfer).
 */
export function computePayoutAmount(transaction: {
  totalEscrow: number;
  platformFee: number;
  gatewayFee?: number | null;
}): number {
  const totalEscrow = Number(transaction.totalEscrow) || 0;
  const platformFee = Number(transaction.platformFee) || 0;
  const gatewayFee = Number(transaction.gatewayFee) || 0;
  const payout = round2(totalEscrow - platformFee - gatewayFee);
  return payout > 0 ? payout : 0;
}
