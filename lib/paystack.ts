// lib/paystack.ts
//
// Paystack integration for the WhatsApp-first escrow flow:
//   - Transaction initialization (POST /transaction/initialize) used by the
//     bot engine when a seller accepts an escrow invitation.
//   - Constant-time webhook signature verification (x-paystack-signature =
//     HMAC-SHA512 of the raw request body keyed with PAYSTACK_SECRET_KEY).
//
// PAYSTACK_BASE_URL may be overridden (e.g. to a local mock) for testing;
// it defaults to the production API host.
import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_DEFAULT_BASE_URL = "https://api.paystack.co";

function getBaseUrl(): string {
  return process.env.PAYSTACK_BASE_URL?.trim() || PAYSTACK_DEFAULT_BASE_URL;
}

/**
 * Resolves the Paystack secret key. Missing configuration is a hard error at
 * execution time — never silently proceeds with an empty key.
 */
function getPaystackSecret(): string {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) {
    console.error("Paystack: PAYSTACK_SECRET_KEY is not configured");
    throw new Error("Paystack secret key not configured");
  }
  return secret;
}

export interface InitializePaystackInput {
  /** Unique transaction reference (we pass the escrow's transactionRef). */
  reference: string;
  /** Amount in Naira — converted to kobo (the Paystack unit) internally. */
  amount: number;
  /** Payer email (Paystack requires an email field). */
  email: string;
  firstName?: string;
  phone?: string;
  /** Where Paystack redirects the payer after checkout. */
  callbackUrl?: string;
}

export interface InitializePaystackResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * Initialize a Paystack transaction and return the hosted checkout URL.
 * Throws on configuration problems and non-OK / unsuccessful responses
 * (message text is kept generic — details stay server-side).
 */
export async function initializePaystackTransaction(
  input: InitializePaystackInput
): Promise<InitializePaystackResult> {
  const secret = getPaystackSecret();
  const amountKobo = Math.round(Number(input.amount) * 100);

  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    throw new Error("Invalid Paystack amount");
  }

  const response = await fetch(`${getBaseUrl()}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference: input.reference,
      amount: amountKobo,
      currency: "NGN",
      email: input.email,
      first_name: input.firstName,
      phone: input.phone,
      callback_url: input.callbackUrl,
    }),
  });

  const data = await response.json().catch(() => null);

  if (
    !response.ok ||
    !data?.status ||
    !data?.data?.authorization_url ||
    !data?.data?.access_code
  ) {
    console.error(
      "Paystack initialize failed:",
      response.status,
      data?.message || "no message"
    );
    throw new Error("Failed to initialize Paystack transaction");
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference || input.reference,
  };
}

/**
 * Verify a Paystack webhook's `x-paystack-signature` header:
 * `HMAC-SHA512(rawBody, PAYSTACK_SECRET_KEY)` compared in constant time.
 *
 * Fails closed: a missing/invalid header returns false; a missing secret key
 * throws in production (the route converts that to a rejected request) and
 * rejects in development (development .env ships a key, so this only trips
 * when the webhook is genuinely unverifiable).
 */
export function verifyPaystackSignature(
  rawBody: Buffer,
  signature: string | null
): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "FATAL: PAYSTACK_SECRET_KEY is not configured — Paystack webhooks cannot be verified (fail closed)."
      );
      throw new Error(
        "PAYSTACK_SECRET_KEY must be configured in production."
      );
    }
    return false; // nothing to verify against — reject
  }

  if (!signature) return false;

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
