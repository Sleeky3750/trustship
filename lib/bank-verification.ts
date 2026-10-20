// lib/bank-verification.ts — seller payout-account verification.
//
// Uses Flutterwave's Bank Lookup (account resolve) API to confirm that a
// seller's bank details map to a real account name, establishing baseline
// merchant authenticity. Verification is best-effort by design: any network,
// configuration or provider problem resolves to `null` and never blocks
// escrow creation or payouts.
import axios from "axios";

export interface BankAccountResolution {
  accountName: string;
  accountNumber: string;
  bankId?: number | string;
}

/**
 * Resolve a Nigerian bank account to its registered name.
 * GET /v3/banks/{bank_code}/resolve?account_number=...
 * Returns null when unverifiable (missing config, provider error, bad
 * details) — callers treat that as "unverified", never as a failure.
 */
export async function resolveBankAccount(
  bankCode: string,
  accountNumber: string
): Promise<BankAccountResolution | null> {
  const code = String(bankCode || "").trim();
  const number = String(accountNumber || "").trim();
  if (!code || !number) return null;

  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/banks/${encodeURIComponent(code)}/resolve`,
      {
        params: { account_number: number },
        headers: { Authorization: `Bearer ${secretKey}` },
        timeout: 10_000,
      }
    );

    const data = response.data;
    if (data?.status === "success" && data?.data?.account_name) {
      return {
        accountName: String(data.data.account_name),
        accountNumber: String(data.data.account_number || number),
        bankId: data.data.bank_id,
      };
    }
    return null;
  } catch (error: unknown) {
    // Expected for fake E2E details / provider downtime — stay non-blocking.
    console.warn(
      "Bank account resolution failed (leaving account unverified):",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
