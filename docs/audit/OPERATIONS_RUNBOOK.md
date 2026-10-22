# TrustShip — Operations Runbook

Operational procedures for running TrustShip in production. Written for an
on-call engineer who may not have built the system. Where a step is destructive
or requires production access, it is marked **[OPERATOR]** and must be performed
by an authorized human, not an automated agent.

> **Secret hygiene.** Never paste secret values into tickets, chat, or logs. All
> secret references below name the *variable*, never the value.

---

## 1. Deploy

1. Ensure `npm run build` passes locally (it currently does).
2. Apply schema changes: this work is **additive**; `prisma db push` (or
   `prisma migrate deploy` once a migrations directory exists) is safe.
3. Deploy the build. The app is a Next.js 16 standalone server.
4. Health check: `GET /api/currency/rates` should return `200`.

### Running the standalone build locally

```bash
npm run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
set -a; . ./.env; set +a
NODE_ENV=production ALLOW_INSECURE_ADMIN_COOKIES=1 PORT=3200 HOSTNAME=127.0.0.1 \
  node .next/standalone/server.js
```

`ALLOW_INSECURE_ADMIN_COOKIES` is for **plain-HTTP local testing only**. Never
set it in a real production deployment.

---

## 2. Scheduled jobs (Vercel crons)

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/auto-release` | `0 0 * * *` (daily) | Auto-release eligible escrows after the hold window |
| `/api/cron/cleanup-sessions` | `15 * * * *` (hourly) | Prune expired admin sessions |
| `/api/cron/process-payouts` | `*/10 * * * *` (every 10 min) | Drain the payout queue |

All cron endpoints require `Authorization: Bearer $CRON_SECRET`. If a cron fails
repeatedly, check the logs for `401` (wrong/missing `CRON_SECRET`) first.

---

## 3. Admin access

Three roles exist (see `docs/audit/ADMIN_RBAC_MATRIX.md`):

| Role | Can do |
|---|---|
| `SUPER_ADMIN` | Everything, including admin management, audit trail, script editing |
| `FINANCE_ADMIN` | Money: release, payouts, refunds (approve/execute), read PII/PIN. **Not** admin management or script editing |
| `SUPPORT_MODERATOR` | Read masked transactions/disputes/logistics/risk/scripts; may **request** a refund. No money movement |

**Two-factor authentication** should be enabled for every admin. The `/admin/me`
endpoint no longer exposes `twoFactorSecret`.

---

## 4. Common operations

### Release escrowed funds to a seller
1. Confirm the escrow is in a **releasable** state (`DISPATCHED`, `DELIVERED`,
   or `ESCROW_LOCKED`) — the UI/API enforces this.
2. Use the release action on the transaction detail page (requires
   `escrow:release`).
3. The system takes an atomic claim and rolls back automatically if the provider
   rejects. A concurrent second attempt is rejected — this is expected.

### Issue a refund
1. **Request** it (support or finance) — this does *not* move money.
2. **Approve** it (finance) — `refunds:approve`.
3. **Execute** it (finance) — `refunds:execute`.
4. If the provider confirms, the refund becomes `COMPLETED`. If the provider is
   unavailable or no provider transaction id exists, the refund stays
   `PROCESSING` flagged **manual settlement required** — settle it out-of-band
   and record the reference. It will **never** be marked `COMPLETED` without
   confirmation.

### Resolve a dispute
1. Move the case through `AWAITING_EVIDENCE → IN_MEDIATION →
   ARBITRATION_PENDING → RESOLVED` on the dispute board.
2. Record the fault. A **seller-fault** resolution opens a real refund request
   (finance must still approve/execute). A **buyer-fault** resolution leaves
   funds in escrow for the normal release path.

---

## 5. Monitoring & alerting (what to watch)

| Signal | Where | Action |
|---|---|---|
| Webhook failures | `WebhookLog` (`status`, `errorCategory`, `attemptCount`) | Investigate repeated `attemptCount > 1` for the same `eventId` |
| Payout queue backlog | `/api/admin/payouts` stats | If `PENDING` grows, check the Flutterwave balance/transfer status |
| Refunds stuck in `PROCESSING` | `/api/admin/refunds` | These require manual settlement — reconcile daily |
| `P1001` / "Can't reach database" errors | server logs | Neon pooled-connection transients; retry. If sustained, failover |
| Cron `401`s | server logs | `CRON_SECRET` mismatch |

---

## 6. Incident response

### Duplicate payout suspected
1. The atomic claim makes a double release from the app **impossible**; if one
   occurred it was outside the app. Check `PayoutQueue` for duplicate
   `transactionRef` + distinct provider references.
2. Freeze further releases on the affected escrow by moving it out of a
   releasable state **only through the app** (do not hand-edit the DB).
3. Reconcile against the Flutterwave dashboard.

### Webhook stopped arriving
1. Re-send the event from the Flutterwave dashboard (idempotency will dedupe).
2. Verify `FLUTTERWAVE_WEBHOOK_SECRET_HASH` matches the dashboard `verif-hash`.
3. Confirm the endpoint is publicly reachable (no WAF blocking).

### Suspected unauthorized access
1. Rotate `JWT_SECRET` (invalidates all admin sessions), then `CRON_SECRET`.
2. Review `AdminAuditLog` (now includes `actorRole`, `correlationId`, `outcome`).
3. Disable/delete the suspect admin account.

---

## 7. Pre-production checklist [OPERATOR]

- [ ] Delete `e2e-admin@trustship.test` and any `e2e-*@trustship.test` accounts.
- [ ] Confirm `FLUTTERWAVE_WEBHOOK_SECRET_HASH` == dashboard `verif-hash`.
- [ ] Confirm Meta `seller_escrow_invitation` template is **approved**.
- [ ] Confirm all production admins have 2FA enabled.
- [ ] Confirm `ALLOW_INSECURE_ADMIN_COOKIES` is **unset**.
- [ ] Confirm `NODE_ENV=production`.
- [ ] Confirm a database backup exists before any future destructive migration.
- [ ] Agree a `WebhookLog` retention policy (currently unbounded).

---

## 8. Rollback

The application is stateless apart from the database. To roll back a deploy,
redeploy the previous build. **Schema rollback is not automatic** — because all
changes in this work are additive, the previous build ignores the new tables and
columns and will continue to function. If a future migration is destructive,
rollback requires restoring from backup.

---

## 9. Running the test suites

```bash
# after the server is up (see section 1)
node scripts/audit/seed-rbac-fixtures.mjs
node scripts/audit/audit-e2e.mjs http://127.0.0.1:3200
node scripts/audit/seed-rbac-fixtures.mjs   # re-seed (audit teardown removes the shared fixtures)
node /tmp/opencode/ts-audit/admin-security-e2e.mjs   # pre-existing harness
node scripts/audit/cleanup-fixtures.mjs     # remove ALL .test fixtures + synthetic data
```

**Ordering matters** — the audit harness's teardown deletes the shared `.test`
fixtures, so re-seed before the security suite. The security suite's super-admin
case uses `e2e-admin@trustship.test`, which `seed-rbac-fixtures.mjs` also
creates. `cleanup-fixtures.mjs` removes every `@trustship.test` admin and all
synthetic data — **run it after testing and always before deploying**. See
`TEST_RESULTS.md` for expected results.
