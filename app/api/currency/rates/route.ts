// app/api/currency/rates/route.ts
//
// Public exchange-rate endpoint for the checkout/escrow-creation currency
// widget. Deliberately unauthenticated (the landing page and create flow need
// it before a session exists) and read-only.
//
//   GET            -> every rate on record
//   GET ?from=&to= -> a single converted preview, with `amount` optional
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_CURRENCY,
  convert,
  formatCurrency,
  getExchangeRate,
  listExchangeRates,
} from "@/lib/currency";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Single-pair preview (used by the conversion banner).
    if (from && to) {
      const rate = await getExchangeRate(from, to);
      if (!rate) {
        return NextResponse.json(
          { success: false, error: `No rate for ${from.toUpperCase()} → ${to.toUpperCase()}` },
          { status: 404 }
        );
      }

      const rawAmount = searchParams.get("amount");
      const amount = rawAmount === null ? null : Number(rawAmount);
      const converted =
        amount !== null && Number.isFinite(amount) ? await convert(amount, from, to) : null;

      return NextResponse.json({
        success: true,
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        rate: rate.rate,
        amount,
        converted,
        formatted: converted !== null ? formatCurrency(converted, rate.toCurrency) : null,
        updatedAt: rate.updatedAt,
      });
    }

    // Full table.
    const rates = await listExchangeRates();
    return NextResponse.json({
      success: true,
      baseCurrency: DEFAULT_CURRENCY,
      rates,
    });
  } catch (error) {
    console.error("Currency rate lookup error:", error);
    return NextResponse.json(
      { success: false, error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
