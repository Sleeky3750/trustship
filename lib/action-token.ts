// lib/action-token.ts
//
// Cryptographically signed, short-lived action tokens for the public escrow
// state-transition routes (/api/escrow/dispatch, /api/escrow/confirm-delivery).
//
// These routes have no user session (the escrow flow is driven over WhatsApp),
// so before this existed anyone who knew/guessed a `transactionRef` could flip
// escrow status or trigger the release-PIN message. A transition now requires
// a token that only a server-side caller (holding the HMAC secret) can mint:
//
//   token     = "v1.<exp>.<base64url-hmac>"
//   signature = HMAC-SHA256(secret, `${action}:${transactionRef}:${exp}`)
//
// The signature binds the action name AND the transaction reference, so a
// token minted for one transition can never be replayed for another tx or
// another action. Tokens expire after 15 minutes by default.
//
// Verification is constant-time and fails closed: a missing/insecure secret
// in production throws rather than minting verifiable-by-anyone tokens.
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET_FALLBACK = "default-jwt-secret-change-in-production";
const DEFAULT_TTL_SECONDS = 15 * 60;

function getActionSecret(): string {
  const secret = process.env.ESCROW_ACTION_SECRET || process.env.JWT_SECRET;
  if (secret && secret !== SECRET_FALLBACK) return secret;

  if (process.env.NODE_ENV === "production") {
    console.error(
      "FATAL: ESCROW_ACTION_SECRET/JWT_SECRET missing or insecure default — refusing to sign/verify action tokens in production."
    );
    throw new Error(
      "ESCROW_ACTION_SECRET or JWT_SECRET must be configured to a non-default value in production."
    );
  }
  return SECRET_FALLBACK;
}

function computeSignature(action: string, transactionRef: string, exp: number): string {
  return createHmac("sha256", getActionSecret())
    .update(`${action}:${transactionRef}:${exp}`)
    .digest("base64url");
}

/**
 * Mint a signed action token authorizing one transition on one transaction.
 * Intended for server-side callers only (the secret never reaches browsers).
 */
export function signActionToken(
  action: string,
  transactionRef: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `v1.${exp}.${computeSignature(action, transactionRef, exp)}`;
}

/**
 * Verify a token for the given action + transaction. Returns true only when
 * the format is valid, the signature matches (constant-time) and it has not
 * expired. Never throws for malformed input.
 */
export function verifyActionToken(
  token: string | null | undefined,
  action: string,
  transactionRef: string
): boolean {
  if (!token || typeof token !== "string") return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") return false;

    const exp = Number(parts[1]);
    if (!Number.isSafeInteger(exp) || exp < Math.floor(Date.now() / 1000)) {
      return false; // malformed or expired
    }

    const provided = Buffer.from(parts[2], "utf8");
    const expected = Buffer.from(computeSignature(action, transactionRef, exp), "utf8");
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(provided, expected);
  } catch {
    return false; // fail closed on any unexpected error (incl. secret resolution)
  }
}
