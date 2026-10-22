// lib/mask.ts
//
// Presentation-layer masking for personally identifiable information.
//
// The admin surface must not expose unnecessary customer PII by default. These
// helpers are pure (no server-only imports) so they can run on the server when
// building responses AND in client components as a display fallback.
//
// Masking here is a *display* concern only — it is never an authorization
// control. Calls that need full PII check the `transactions:read_pii`
// permission server-side before returning unmasked values.

/**
 * Mask a phone number, keeping only the last 3 digits:
 *   +2348012345678 → •••••••5678
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length <= 3) return "•••";
  return `••••••${digits.slice(-4)}`;
}

/**
 * Mask a bank account number, keeping only the last 4 digits:
 *   0123456789 → ••••••6789
 */
export function maskAccount(account?: string | null): string {
  if (!account) return "—";
  const digits = account.replace(/[^\d]/g, "");
  if (digits.length <= 4) return "••••";
  return `••••••${digits.slice(-4)}`;
}

/**
 * Mask an email address, keeping the first character of the local part and the
 * full domain: jane.doe@example.com → j•••@example.com
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return "—";
  const [local, domain] = email.split("@");
  if (!local) return `•••@${domain}`;
  return `${local[0]}•••@${domain}`;
}
