// Shared escrow payout math.
//
// One invariant must hold for every money-moving escrow endpoint:
//
//   payoutAmount = totalEscrow - platformFee
//
// `totalEscrow` is what the buyer pays (item + waybill when the buyer pays it
// + platform fee), so the seller receives the funds held in escrow minus the
// platform's cut. All release/payout handlers must use `computePayoutAmount`
// instead of picking a column (itemAmount / totalEscrow) ad hoc.

export const PLATFORM_FEE_RATE = 0.05;

/** Round to 2 decimals to avoid float drift in money amounts. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Standard platform fee = 5% of the item amount.
 * Used by the creation handler so the stored fee always matches the total
 * shown to the buyer (never trust a client-supplied fee for money math).
 */
export function computePlatformFee(itemAmount: number): number {
  const item = Number(itemAmount);
  if (!Number.isFinite(item) || item <= 0) return 0;
  return round2(item * PLATFORM_FEE_RATE);
}

/**
 * The canonical seller payout: everything held in escrow minus the platform fee.
 * Never negative (a malformed row can't produce a negative transfer).
 */
export function computePayoutAmount(transaction: {
  totalEscrow: number;
  platformFee: number;
}): number {
  const totalEscrow = Number(transaction.totalEscrow) || 0;
  const platformFee = Number(transaction.platformFee) || 0;
  const payout = round2(totalEscrow - platformFee);
  return payout > 0 ? payout : 0;
}
