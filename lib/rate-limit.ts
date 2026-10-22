// lib/rate-limit.ts
//
// In-memory sliding-window failure tracker for the admin login endpoint.
//
// Policy (see /api/admin/login): an IP is blocked for 15 minutes after
// 5 failed attempts within that window. A successful login clears the
// bucket for that IP.
//
// Notes:
// - Per server instance (no Redis dependency). Multiple serverless
//   instances each keep their own bucket — still effective against
//   single-connection brute force, which is the threat model here.
// - Bucket keys come from getClientIp(); behind Vercel/nginx the
//   x-forwarded-for chain is edge-controlled and cannot be spoofed by
//   the attacker.
//
// This module ALSO exposes a generic fixed-window limiter
// (`checkWindowLimit` / `windowClientKey`) used by public mutation routes
// (e.g. /api/escrow/create) that need a simple abuse brake rather than the
// failure-counting login policy above.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15-minute window
const MAX_BUCKETS = 10_000; // hard cap so memory stays bounded

type Bucket = {
  count: number;
  windowStart: number;
  blockedUntil: number | null; // epoch ms; null while not blocked
};

const buckets = new Map<string, Bucket>();

/** Drop expired buckets when the map grows past its cap. */
function prune(): void {
  const now = Date.now();
  const expired: string[] = [];
  buckets.forEach((bucket, key) => {
    const windowExpired = now - bucket.windowStart >= WINDOW_MS;
    const blockActive = bucket.blockedUntil !== null && now < bucket.blockedUntil;
    if (windowExpired && !blockActive) expired.push(key);
  });
  expired.forEach((key) => buckets.delete(key));

  // Still oversized (pathological load): evict oldest-inserted entries.
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export type RateLimitStatus = {
  blocked: boolean;
  /** Seconds until the block/window expires (0 when not blocked). */
  retryAfterSeconds: number;
};

/**
 * Check whether `key` is currently blocked. Read-only — does not count
 * the current attempt.
 */
export function checkRateLimit(key: string): RateLimitStatus {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return { blocked: false, retryAfterSeconds: 0 };

  if (bucket.blockedUntil !== null && now < bucket.blockedUntil) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
    };
  }

  // Count-based block while the window is still open.
  if (bucket.count >= MAX_FAILURES && now - bucket.windowStart < WINDOW_MS) {
    const windowEnd = bucket.windowStart + WINDOW_MS;
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
    };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

/** Record one failed attempt; blocks the key once MAX_FAILURES is reached. */
export function recordFailure(key: string): void {
  const now = Date.now();
  prune();

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    // Fresh window.
    buckets.set(key, { count: 1, windowStart: now, blockedUntil: null });
    return;
  }

  bucket.count += 1;
  if (bucket.count >= MAX_FAILURES && bucket.blockedUntil === null) {
    bucket.blockedUntil = bucket.windowStart + WINDOW_MS;
  }
}

/** Clear failures for `key` (call on successful authentication). */
export function clearFailures(key: string): void {
  buckets.delete(key);
}

// ---------------------------------------------------------------------------
// Generic fixed-window limiter (separate bucket namespace from the login
// failure tracker above, so the two policies never interfere).
// ---------------------------------------------------------------------------

interface WindowBucket {
  count: number;
  resetAt: number;
}

const windowBuckets = new Map<string, WindowBucket>();

function pruneWindows(now: number): void {
  windowBuckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) windowBuckets.delete(key);
  });
}

export interface WindowLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (0 when allowed). */
  retryAfter: number;
}

/**
 * Fixed-window limiter. Best-effort (per server instance) — a simple abuse
 * brake for public mutation endpoints, not a distributed guarantee.
 *
 * @param key       Bucket identity, e.g. `escrow-create:<ip>`.
 * @param limit     Max requests per window.
 * @param windowMs  Window length in milliseconds.
 */
export function checkWindowLimit(
  key: string,
  limit: number,
  windowMs: number
): WindowLimitResult {
  const now = Date.now();
  pruneWindows(now);

  const existing = windowBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    windowBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfter: 0 };
}

/**
 * Best-effort client identity for the generic limiter. Prefers proxy headers
 * (Vercel sets `x-forwarded-for`), falling back to a constant so an
 * unidentified client still shares a bucket rather than bypassing the limit.
 */
export function windowClientKey(request: Request, scope: string): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip =
    (fwd ? fwd.split(",")[0].trim() : "") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}
