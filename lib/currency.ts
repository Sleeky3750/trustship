// lib/currency.ts
//
// Multi-currency formatting + conversion helpers.
//
// Design notes:
// - The escrow ledger is single-currency per transaction (`EscrowTransaction.
//   currency`, default NGN). This module is for DISPLAY and checkout PREVIEW
//   only — it never rewrites amounts that are persisted, so a stale rate can
//   never change what a buyer is charged.
// - Rates come from the `CurrencyRate` table (`1 fromCurrency = rate
//   toCurrency`). `convert()` throws on a missing pair rather than silently
//   using 1:1, because a wrong 1:1 conversion on a checkout preview is far
//   worse than a visible error.

import { prisma } from "@/lib/prisma";

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
  /** Emoji flag — rendered as a country badge in the selector. */
  flag: string;
  /** Minor-unit digits (NGN/USD = 2, JPY = 0). */
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬", decimals: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", decimals: 2 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", flag: "🇬🇭", decimals: 2 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦", decimals: 2 },
];

export const DEFAULT_CURRENCY = "NGN";

const CURRENCY_INDEX = new Map(SUPPORTED_CURRENCIES.map((c) => [c.code, c]));

/** Metadata for a currency code, with a safe NGN-shaped fallback. */
export function getCurrencyMeta(code: string | null | undefined): CurrencyMeta {
  const normalized = (code || DEFAULT_CURRENCY).toUpperCase();
  return (
    CURRENCY_INDEX.get(normalized) ?? {
      code: normalized,
      name: normalized,
      symbol: normalized,
      flag: "🏳️",
      decimals: 2,
    }
  );
}

export function isSupportedCurrency(code: string | null | undefined): boolean {
  return CURRENCY_INDEX.has((code || "").toUpperCase());
}

/**
 * Format an amount for display, e.g. `formatCurrency(1500, "NGN")` → "₦1,500.00".
 * Uses Intl when the runtime knows the code so grouping matches the locale,
 * and falls back to a manual symbol prefix otherwise.
 */
export function formatCurrency(
  amount: number,
  currency = DEFAULT_CURRENCY,
  options: { compact?: boolean } = {}
): string {
  const meta = getCurrencyMeta(currency);
  const value = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: meta.code,
      minimumFractionDigits: options.compact ? 0 : meta.decimals,
      maximumFractionDigits: options.compact ? 0 : meta.decimals,
    }).format(value);
  } catch {
    const formatted = value.toLocaleString("en-NG", {
      minimumFractionDigits: options.compact ? 0 : meta.decimals,
      maximumFractionDigits: options.compact ? 0 : meta.decimals,
    });
    return `${meta.symbol}${formatted}`;
  }
}

/** Rounds to the currency's minor unit (avoids 1.0000000000002 in previews). */
export function roundCurrency(amount: number, currency = DEFAULT_CURRENCY): number {
  const factor = 10 ** getCurrencyMeta(currency).decimals;
  return Math.round(amount * factor) / factor;
}

/** A resolved exchange rate pair. */
export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  updatedAt: string | null;
}

/**
 * Look up the rate from `from` to `to`, transparently inverting the stored
 * direction when only the reverse pair exists. Returns null when neither
 * direction is on record.
 */
export async function getExchangeRate(
  from: string,
  to: string
): Promise<ExchangeRate | null> {
  const fromCurrency = from.toUpperCase();
  const toCurrency = to.toUpperCase();

  if (fromCurrency === toCurrency) {
    return { fromCurrency, toCurrency, rate: 1, updatedAt: null };
  }

  const direct = await prisma.currencyRate.findUnique({
    where: { fromCurrency_toCurrency: { fromCurrency, toCurrency } },
  });
  if (direct) {
    return {
      fromCurrency,
      toCurrency,
      rate: direct.rate,
      updatedAt: direct.updatedAt.toISOString(),
    };
  }

  const inverse = await prisma.currencyRate.findUnique({
    where: { fromCurrency_toCurrency: { fromCurrency: toCurrency, toCurrency: fromCurrency } },
  });
  if (inverse && inverse.rate > 0) {
    return {
      fromCurrency,
      toCurrency,
      rate: 1 / inverse.rate,
      updatedAt: inverse.updatedAt.toISOString(),
    };
  }

  return null;
}

/**
 * Convert an amount using the rate table.
 * Throws when no rate exists — callers rendering a preview must catch and show
 * "rate unavailable" rather than mislead the buyer.
 */
export async function convert(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const rate = await getExchangeRate(from, to);
  if (!rate) {
    throw new Error(`No exchange rate available for ${from.toUpperCase()} → ${to.toUpperCase()}`);
  }
  return roundCurrency(amount * rate.rate, to);
}

/** Every rate pair currently on record (for the admin rate table). */
export async function listExchangeRates(): Promise<ExchangeRate[]> {
  const rows = await prisma.currencyRate.findMany({ orderBy: { fromCurrency: "asc" } });
  return rows.map((r) => ({
    fromCurrency: r.fromCurrency,
    toCurrency: r.toCurrency,
    rate: r.rate,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Create or update a rate pair. Used by seeding and the admin rate editor. */
export async function upsertExchangeRate(
  from: string,
  to: string,
  rate: number
): Promise<ExchangeRate> {
  const fromCurrency = from.toUpperCase();
  const toCurrency = to.toUpperCase();

  if (!(rate > 0)) {
    throw new Error("Exchange rate must be greater than zero");
  }

  const row = await prisma.currencyRate.upsert({
    where: { fromCurrency_toCurrency: { fromCurrency, toCurrency } },
    update: { rate },
    create: { fromCurrency, toCurrency, rate },
  });

  return {
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
    updatedAt: row.updatedAt.toISOString(),
  };
}
