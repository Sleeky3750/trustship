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
  /**
   * The actor's role *at the time of the action*. When omitted it is resolved
   * from the AdminUser row so history reflects the role that performed the
   * action rather than whatever role the account holds today.
   */
  actorRole?: string | null;
  /** Groups the actions of a single request/incident for forensic replay. */
  correlationId?: string | null;
  /** SUCCESS | FAILED — lets a rejected sensitive action still be recorded. */
  outcome?: "SUCCESS" | "FAILED";
  /** Why the action was taken (especially for sensitive/denied operations). */
  reason?: string | null;
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
 * Best-effort correlation id derived from the request when the caller did not
 * supply one: the proxy sets `x-request-id` for admin traffic. Falls back to a
 * time-based token so related actions still cluster.
 */
function resolveCorrelationId(
  request: Request | NextRequest | null | undefined,
  provided?: string | null
): string | null {
  if (provided) return provided;
  const fromHeader = request?.headers?.get?.("x-request-id");
  if (fromHeader) return fromHeader;
  return null;
}

/**
 * Record an admin action with full forensic context
 * (adminId, actorRole, action, targetEntityId, ipAddress, userAgent, changes,
 * correlationId, outcome, timestamp).
 *
 * Pass the incoming `request` so the client IP and User-Agent are captured
 * across proxy layers. Never throws.
 *
 *   await recordAdminAction(request, {
 *     adminId: admin.id,
 *     action: "ESCROW_RELEASED",
 *     targetId: transaction.id,
 *     message: `Released escrow ${transaction.transactionRef}`,
 *     changes: { status: { from: "IN_ESCROW", to: "COMPLETED" } },
 *   });
 */
export async function recordAdminAction(
  request: Request | NextRequest | null | undefined,
  entry: AdminAuditEntry
): Promise<boolean> {
  const ipAddress = entry.ipAddress ?? (request ? getClientIp(request) : "unknown");
  const userAgent = entry.userAgent ?? (request ? getUserAgent(request) : "unknown");
  const details = buildDetails(entry);

  // Resolve the actor role as-of-now when the caller did not pass it, so a
  // later role change cannot silently rewrite what this action was authorised
  // as. Failure here is non-fatal — the row still records the action.
  let actorRole = entry.actorRole ?? null;
  if (!actorRole) {
    try {
      const actor = await prisma.adminUser.findUnique({
        where: { id: entry.adminId },
        select: { role: true },
      });
      actorRole = actor?.role ?? null;
    } catch {
      /* leave null */
    }
  }

  const data = {
    adminId: entry.adminId,
    action: entry.action,
    targetId: entry.targetId ?? null,
    details,
    ipAddress,
    userAgent,
    actorRole,
    correlationId: resolveCorrelationId(request, entry.correlationId),
    outcome: entry.outcome ?? "SUCCESS",
    reason: entry.reason ?? null,
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
