// lib/request-ip.ts
// Robust client request metadata extraction across proxy layers
// (Vercel / Cloudflare edge, nginx, dev server).

import type { NextRequest } from "next/server";

/**
 * Extract the real client IP from a request.
 *
 * Checks `x-forwarded-for` (first hop is the originating client when set by
 * the edge), then `x-real-ip` (nginx / Vercel), and finally falls back to a
 * loopback placeholder so audit rows are never `null`/`undefined`.
 */
export function getClientIp(req: Request | NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim()) return xRealIp.trim();

  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim()) return cfConnectingIp.trim();

  return "127.0.0.1";
}

/**
 * Extract the client User-Agent (or a stable placeholder so the audit
 * column is always populated).
 */
export function getUserAgent(req: Request | NextRequest): string {
  const userAgent = req.headers.get("user-agent");
  return userAgent && userAgent.trim() ? userAgent.trim() : "unknown";
}
