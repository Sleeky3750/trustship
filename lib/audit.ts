// lib/audit.ts
// Central admin audit recorder.
//
// Reliability rules:
// - Uses the shared Prisma singleton (a dedicated PrismaClient per module
//   exhausts the connection pool in serverless and was the root cause of
//   "intermittent" audit rows).
// - Every write is `await`ed inside try/catch with one retry, so callers can
//   never observe an unhandled promise rejection and transient failures do
//   not silently drop rows.
// - The recorder itself never throws: a failed audit write must not abort the
//   admin operation that triggered it, but it is logged loudly.
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent } from "@/lib/request-ip";

export type AdminAuditEntry = {
  /** The acting admin's database id (required — FK to AdminUser). */
  adminId: string;
  /** Canonical action type, e.g. "ADMIN_LOGIN", "ESCROW_RELEASED". */
  action: string;
  /** ID of the transaction/resource affected. */
  targetId?: string | null;
  /** Human readable summary stored alongside the JSON payload. */
  message?: string;
  /** JSON diff of the fields that changed ("changesMade"). */
  changes?: Record<string, unknown> | null;
  /** Legacy: pre-serialized details JSON (used when `message`/`changes` absent). */
  details?: string | null;
  /** Override IP (only when no Request object is available). */
  ipAddress?: string | null;
  /** Override User-Agent (only when no Request object is available). */
  userAgent?: string | null;
};

function buildDetails(entry: AdminAuditEntry): string | null {
  if (!entry.message && !entry.changes) {
    return entry.details ?? null;
  }
  const payload: Record<string, unknown> = {};
  if (entry.message) payload.message = entry.message;
  if (entry.changes) payload.changesMade = entry.changes;
  return JSON.stringify(payload);
}

/**
 * Record an admin action with full forensic context
 * (adminId, action, targetEntityId, ipAddress, userAgent, changes, timestamp).
 *
 * Pass the incoming `request` so the client IP and User-Agent are captured
 * across proxy layers. Never throws.
 *
 *   await recordAdminAction(request, {
 *     adminId: admin.id,
 *     action: "ESCROW_RELEASED",
 *     targetId: transaction.id,
 *     message: `Released escrow ${transaction.transactionRef}`,
 *     changes: { status: { from: "IN_ESCROW", to: "RELEASED" } },
 *   });
 */
export async function recordAdminAction(
  request: Request | NextRequest | null | undefined,
  entry: AdminAuditEntry
): Promise<boolean> {
  const ipAddress = entry.ipAddress ?? (request ? getClientIp(request) : "unknown");
  const userAgent = entry.userAgent ?? (request ? getUserAgent(request) : "unknown");
  const details = buildDetails(entry);

  const data = {
    adminId: entry.adminId,
    action: entry.action,
    targetId: entry.targetId ?? null,
    details,
    ipAddress,
    userAgent,
  };

  // Single insert (atomic) + one retry for transient connection failures.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prisma.adminAuditLog.create({ data });
      return true;
    } catch (error) {
      console.error(
        `Audit write failed (attempt ${attempt + 1}) action=${entry.action} admin=${entry.adminId}:`,
        error
      );
    }
  }
  return false;
}

/**
 * Legacy entry point kept for compatibility with older call sites that did
 * not pass a Request. Prefer `recordAdminAction(request, entry)` so IP and
 * User-Agent are captured.
 */
export async function logAdminAction(entry: AdminAuditEntry): Promise<boolean> {
  return recordAdminAction(null, entry);
}
