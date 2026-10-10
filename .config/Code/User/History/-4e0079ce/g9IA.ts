import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "pulseSession";

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters long."
    );
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

export function createSessionValue(businessId: string) {
  const payload = `${businessId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined) {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [businessId, issuedAt, signature] = parts;

  if (!businessId || !issuedAt || !signature) {
    return null;
  }

  const timestamp = Number(issuedAt);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const maxAge = 7 * 24 * 60 * 60 * 1000;

  if (
    Date.now() - timestamp > maxAge ||
    timestamp > Date.now() + 60_000
  ) {
    return null;
  }

  const expected = sign(`${businessId}.${issuedAt}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (
    a.length !== b.length ||
    !timingSafeEqual(a, b)
  ) {
    return null;
  }

  return businessId;
}

export { COOKIE_NAME };