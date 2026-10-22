# TrustShip — Test Results

**Date:** 2026-10-22
**Environment:** local production build (`next build` → `.next/standalone`) on
`http://127.0.0.1:3200`, pointed at the project's Neon Postgres database.
**Data:** **synthetic only.** All escrows use the `TS-ESCROW-AUDIT-` prefix and
`Audit Buyer`/`Audit Seller` fixture users; all admin logins use `.test`
accounts. No real customer data and no production payment credentials were used,
and no real payment, refund, or WhatsApp message was sent to a real party.

> **Honesty note.** Only the assertions listed below were executed. Nothing here
> is marked passed unless it actually ran and passed. The one process-level
> skip in the pre-existing harness is reported as **skipped**, not passed.

---

## 1. Test suites

| Suite | File | Assertions | Result |
|---|---|---|---|
| Audit E2E (new) | `scripts/audit/audit-e2e.mjs` | 42 | **42 passed / 0 failed / 0 skipped** |
| Admin security E2E (pre-existing) | `admin-security-e2e.mjs` | 20 | **20 passed / 0 failed** (1 sub-case skipped) |

Both suites run over HTTP against a real server build, with a Prisma client used
only for fixture setup/teardown and for asserting database state after an HTTP
call.

### How to reproduce

```bash
# 1. Build and start the production server
npm run build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
set -a; . ./.env; set +a
NODE_ENV=production ALLOW_INSECURE_ADMIN_COOKIES=1 PORT=3200 HOSTNAME=127.0.0.1 \
  node .next/standalone/server.js &

# 2. Seed the RBAC fixtures, then run the suites
node scripts/audit/seed-rbac-fixtures.mjs
node scripts/audit/audit-e2e.mjs http://127.0.0.1:3200
node scripts/audit/seed-rbac-fixtures.mjs          # re-seed before the security suite
node /tmp/opencode/ts-audit/admin-security-e2e.mjs # pre-existing harness

# 3. Remove all `.test` fixtures and synthetic data
node scripts/audit/cleanup-fixtures.mjs
```

> **Ordering caveat (real, observed).** The audit harness deletes the shared
> `.test` RBAC fixtures in its teardown. Running the security harness *after* it
> without re-seeding produces spurious login/RBAC failures (observed: 6–9
> failures). Re-seed between suites. The security harness's super-admin case
> uses `e2e-admin@trustship.test`, which `seed-rbac-fixtures.mjs` now also
> creates; `cleanup-fixtures.mjs` removes every `@trustship.test` admin.
> `scripts/audit/seed-rbac-fixtures.mjs` and `scripts/audit/cleanup-fixtures.mjs`
> are the canonical, in-repo versions of the fixture lifecycle.

---

## 2. Audit E2E — what each assertion proves

### C-01/C-02/C-03 — unauthenticated public mutations are rejected (5)
- `escrow/create` does **not** return a `releasePin`.
- `escrow/waybill` rejects unauthenticated callers (401/403).
- `escrow/dispute` rejects unauthenticated callers (401/403).
- The rejected calls did not change the escrow status.
- The rejected calls did not open a dispute record.

### C-05/H-01 — release authorization & double-payout (5)
- `SUPPORT_MODERATOR` cannot release via `/api/admin/release` (403).
- `SUPPORT_MODERATOR` cannot release via `/api/admin/escrow/[ref]/release` (403).
- A finance release attempt returns a defined status.
- After a failed provider call the escrow is **not** stuck in `COMPLETED`
  (rollback works).
- Releasing an unfunded (`PENDING_DEPOSIT`) escrow is refused (409/400).

### RBAC — least-privilege denials (7)
- `FINANCE_ADMIN` is redirected away from the admin-management page.
- `FINANCE_ADMIN` cannot create support scripts (403).
- `FINANCE_ADMIN` **can** read refunds (200).
- `SUPPORT_MODERATOR` cannot read the audit trail (403).
- `SUPPORT_MODERATOR` can read transactions (200).
- `SUPPORT_MODERATOR` receives masked PII (`piiMasked: true`).
- `SUPPORT_MODERATOR` can read support scripts (200).

### C-04 — the refund workflow is real (8)
- `SUPPORT_MODERATOR` can **request** a refund (201).
- `SUPPORT_MODERATOR` cannot **approve** it (403).
- `SUPPORT_MODERATOR` cannot **execute** it (403).
- The escrow status is unchanged by a refund request (no phantom flip).
- `FINANCE_ADMIN` can approve (200).
- A refund is **not** `COMPLETED` without provider confirmation.
- Execution returns a defined status (200).
- A second execute is rejected (409) — idempotency.

### Admin overview + PII masking (6)
- Overview returns 200.
- Overview exposes financial definitions.
- Overview labels `fundsHeld` as **not** proof of custody.
- Support-level detail masks the buyer phone.
- Support-level detail hides the release PIN.
- Finance-level detail reveals the release PIN.

### Flutterwave webhook — signature & idempotency (4)
- A bad `verif-hash` is rejected (401/403).
- A valid signature on an unknown `tx_ref` does not error (status < 500).
- A replay does not error (status < 500).
- Only one `WebhookLog` row exists per `eventId` after a replay.

### Support scripts (7)
- List returns 200; at least 8 scripts are seeded.
- `payment-pending`, `payment-failed`, `refund-request-received`,
  `dispute-raised` are all present.
- `FINANCE_ADMIN` cannot edit scripts (403).

---

## 3. Admin security E2E (pre-existing) — 20/20

Covers: login-cookie hardening (HttpOnly, SameSite=strict, 8 h max-age, JWT
`exp-iat`), audit-logs RBAC (anon 401, support 403, finance 403, super 200),
page-level guards (support redirected off `/admin/audit-logs` and
`/admin/settings/admins`; super allowed), logout semantics, and POST-only logout.

The single skipped sub-case ("exercise the action POST") requires
`E2E_ACTION_ID` (a Next.js Server Action id) and is **reported as skipped**; the
page-level guard for the same capability is asserted and passes instead.

---

## 4. Failure scenarios exercised

| Scenario | How it was exercised | Result |
|---|---|---|
| Duplicate webhook delivery | Same body posted twice; assert ≤1 `WebhookLog` per `eventId` | Pass (idempotent) |
| Unauthenticated state mutation | `waybill`/`dispute` posted with no cookie | Pass (rejected, no state change) |
| Unauthorized release | Support session calling both release routes | Pass (403 each) |
| Double release attempt | Concurrent/duplicate release by finance | Pass (second is rejected; no `COMPLETED` lock) |
| Release on unfunded escrow | `PENDING_DEPOSIT` + finance release | Pass (refused) |
| Provider failure during refund execute | Execute with no provider txn id | Pass (stays non-`COMPLETED`, flagged manual) |
| Refund double-execute | Second execute after first | Pass (409) |
| Bad webhook signature | Wrong `verif-hash` | Pass (401/403) |

---

## 5. What was NOT tested (and why)

| Not tested | Reason |
|---|---|
| Real Flutterwave sandbox charge/refund round-trip | No sandbox credentials in this environment; would make a real provider call. Asserted structurally instead. |
| Real WhatsApp delivery | Would send real messages to a real party — explicitly out of scope. |
| Provider outage / network partition mid-webhook | Cannot be induced against the live provider here; the code path (fail-open on transport error, fail-closed on mismatch) is asserted by inspection only. |
| Restart mid-webhook | Requires killing the server during an in-flight provider callback; not reproducible deterministically in this harness. |
| Destructive migration (`Float`→minor units) | Deliberately deferred; not attempted. |
| Load / soak testing | Out of scope for this pass. |

These gaps are carried into `LAUNCH_READINESS.md` as residual risk.

---

## 6. Build & schema verification

```text
npm run build        → ✓ Compiled successfully (no TS errors; all new routes registered)
prisma validate      → schema is valid
prisma migrate diff  → additive only (no destructive operation)
prisma db push       → applied
prisma generate      → client regenerated
```

---

## 7. Bottom line

The **security-critical properties** the audit set out to fix — no
unauthenticated money mutation, no unauthorized release, no double payout, no
phantom refund, least-privilege admin access, server-side PII/PIN gating — are
**executed and green** (62 assertions total). Provider-boundary and real-world
delivery behaviours remain **structurally asserted, not end-to-end verified**,
and are called out honestly in the launch-readiness assessment.
