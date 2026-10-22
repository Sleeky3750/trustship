# TrustShip — Implementation Report

**Date:** 2026-10-22
**Scope:** Remediation work performed on top of the audit in `INITIAL_AUDIT.md`
**Base commit:** `9acb4d3` (clean tree at audit start)
**Method:** Autonomous implementation. Every change is described with its
motivation, files touched, and how it was verified. Nothing in this report is
claimed as tested unless a test was actually executed (see `TEST_RESULTS.md`).

> **Honesty note.** This is an implementation report, not a marketing document.
> Where a fix is partial, defensive, or deferred, it is stated as such. Where a
> change required a manual/external step, it is listed in the "Required manual
> configuration" section rather than being described as complete.

---

## 1. What was changed, at a glance

| Area | Before | After |
|---|---|---|
| Authorization | Three drifting mechanisms (bare `requireAdmin`, inline role arrays, client role strings); money routes with **no** gate | One permission matrix in `lib/rbac.ts`; routes check **permissions** |
| Public escrow mutations | `create` / `waybill` / `dispute` / `ref` fully unauthenticated | `waybill`/`dispute` need permissions; `ref` needs `refunds:request`; `create` rate-limited + no PIN leak |
| Release paths | 4 routes, TOCTOU double-payout, no funded-state guard | All 4 use an atomic DB claim; `RELEASABLE_STATUSES` enforced; rollback on provider rejection |
| Refunds | Phantom `escrow/ref` that flipped nothing | Real `Refund` workflow `REQUESTED→…→COMPLETED` via Flutterwave, money moves only on provider confirmation |
| Dispute resolution | Set `status=REFUNDED` with no refund | Records the outcome and opens a **real** refund request on seller fault |
| Webhook | Signature + idempotency only | + independent verify cross-check, currency check, per-attempt metadata, duplicate timeline |
| Event trail | None | Append-only `TransactionEvent`; wired into every lifecycle transition |
| Audit trail | adminId/action/target | + `actorRole`, `correlationId`, `outcome`, `reason` |
| Admin dashboard | Table-only, no financial definitions | New overview with basis-labelled metrics, refunds queue, transaction detail, support scripts |
| Support tooling | None | 8 standard scripts + versioning + placeholder safety + internal-note guard |
| Tests | **None** | Dependency-free E2E harness (42 assertions) + preserved security harness (20) |

---

## 2. Database changes

All schema changes are **additive**. `prisma migrate diff` was used to confirm
no destructive operation is included. `prisma db push` applied them; `prisma
generate` regenerated the client.

### New enums

| Enum | Values |
|---|---|
| `RefundStatus` | `REQUESTED`, `UNDER_REVIEW`, `APPROVED`, `PROCESSING`, `COMPLETED`, `FAILED`, `REJECTED` |
| `DisputeStatus` | `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `CLOSED` |

### New models

| Model | Purpose | Key fields |
|---|---|---|
| `Refund` | Real refund records | `amountMinor` (integer kobo), `status`, `providerRef`, `requestedById`, `approvedById`, `manualSettlementRequired` |
| `TransactionEvent` | Append-only lifecycle timeline | `transactionId`, `type`, `message`, `actorKind`, `actorId`, `metadata` |
| `Dispute` | Structured dispute case | `status`, `stage`, `fault`, `assignedToId`, `resolution` |
| `SupportScript` / `SupportScriptVersion` | Customer-support copy + history | `slug`, `title`, `category`, `body`, `usageNotes`, `isInternal`, version chain |

### Extended models

| Model | Added fields |
|---|---|
| `EscrowTransaction` | relations: `refunds`, `events`, `disputes` |
| `WebhookLog` | `eventType`, `transactionRef`, `status`, `attemptCount`, `errorCategory`, `processedAt`, `updatedAt` |
| `AdminAuditLog` | `actorRole`, `correlationId`, `outcome`, `reason` |

### Money representation

Existing monetary columns remain `Float` (changing them to integer minor units
would be a **destructive migration** and was deliberately **not** performed —
see "Deferred items"). New financial models (`Refund.amountMinor`) use integer
**kobo**, and `lib/refunds/workflow.ts` converts via `toMinor`/`toMajor` at the
boundary. This is documented rather than silently mixed.

---

## 3. Security fixes (finding → fix)

### C-01 — Unauthenticated `escrow/create` returning `releasePin`
`app/api/escrow/create/route.ts` now:
- applies `checkWindowLimit` (10 requests / 60 s per client key) to blunt abuse;
- **removes `releasePin` from the JSON response entirely** — the PIN is delivered
  to the buyer over WhatsApp, never echoed to the HTTP caller.

The route remains publicly reachable on purpose (the public form and the
WhatsApp bot both post to it), but it no longer leaks a release credential or
accepts unbounded traffic.

### C-02 — Unauthenticated `escrow/waybill` state mutation
`app/api/escrow/waybill/route.ts` now requires `logistics:manage`, refuses
`DELIVERED` unless the escrow is funded, enforces monotonic dispatch state, and
writes an audit row + timeline event.

### C-03 — Unauthenticated `escrow/dispute` freeze + WhatsApp fan-out
`app/api/escrow/dispute/route.ts` now requires `disputes:manage`, validates the
transition with `DISPUTABLE_STATUSES`, creates a real `Dispute` row, and only
then notifies the parties.

### C-04 — Phantom refund in `escrow/ref`
`app/api/escrow/ref/route.ts` was rewritten to do one honest thing: create a
refund **request** (`refunds:request`). It no longer flips escrow status and no
longer promises the customer a completed refund it cannot deliver.

### C-05 / H-01 — Release TOCTOU + inconsistent authz across 4 routes
All four release paths (`/api/escrow/release`, `/api/admin/release`,
`/api/admin/transactions/release`, `/api/admin/escrow/[ref]/[action]`) now:
- require `escrow:release`;
- take an **atomic claim** (`claimRelease`) using a conditional `updateMany`
  that only matches rows in `RELEASABLE_STATUSES` (`DISPATCHED`, `DELIVERED`,
  `ESCROW_LOCKED`) and atomically flips the status to an in-progress marker;
- roll the claim back (`releaseClaim`) if the provider rejects;
- write `TransactionEvent`s for the release.

A concurrent second release attempt matches no rows and is rejected, closing the
double-payout window.

### H-02 — `/api/admin/me` leaked `twoFactorSecret`
The select no longer includes `twoFactorSecret`; the UI never consumed it.

### H-04 — No independent verification on the webhook
`app/api/flutterwave/webhook/route.ts` now cross-checks the charge against
Flutterwave's verify endpoint: fail-**open** only on a transport error, fail-
**closed** on an actual mismatch, plus a currency integrity check.

### Server-side PII / PIN gating
`/api/admin/transactions`, `/api/admin/transactions/[id]`, and
`/api/admin/dispute-evidence` mask phone numbers unless the caller holds
`transactions:read_pii`, and strip the release PIN unless they hold
`transactions:read_pin`. Masking occurs **before** the response leaves the
server, so client-side filtering can never substitute for authorization.

---

## 4. Admin dashboard upgrade

| Page | Route | What it adds |
|---|---|---|
| Overview | `/admin/overview` | Status counts, **basis-labelled** financial metrics, webhook health, attention queue |
| Transactions | `/admin/transactions` | Server pagination + filters; rows deep-link to detail |
| Transaction detail | `/admin/transactions/[id]` | Real timeline, sanitized webhooks, refunds, disputes, payouts; PII/PIN gated |
| Refunds | `/admin/refunds` | Request → review → approve/reject → execute, per-action permissions |
| Support scripts | `/admin/support-scripts` | Versioned scripts, placeholder linting, internal-note guard |

The overview **never** presents a database status as proof that funds are
physically held; each financial figure carries a `basis` string (e.g. "sum of
`totalEscrow` for transactions in a funded state — not a claim of custody").

Nav links were added in `app/admin/components/AdminShell.tsx`. All new pages are
`dynamic = "force-dynamic"`.

---

## 5. Support tooling

`lib/support-scripts.ts` ships **8 standard scripts** (payment pending, payment
failed, refund request received, dispute raised, delivery update, pin reminder,
onboarding help, escalation) with:
- `placeholdersIn` / `missingPlaceholders` linting,
- `renderTemplate` / `renderForCustomer` (the latter **refuses** to render a
  script marked `isInternal`, so internal notes can never be pasted to a
  customer),
- `PLACEHOLDER_DOCS`, and safety usage notes on each script.

---

## 6. Files changed

### New libraries
- `lib/rbac.ts` — permission matrix (single source of truth)
- `lib/escrow-lifecycle.ts` — `claimRelease` / `releaseClaim` / status sets
- `lib/refunds/workflow.ts` — refund state machine + atomic execute
- `lib/events.ts` — append-only event recorder + `EVENTS` constants
- `lib/support-scripts.ts` — scripts + rendering safety
- `lib/mask.ts` — `maskPhone` / `maskAccount` / `maskEmail`

### Modified libraries
`lib/admin-auth.ts` (added `requirePermission`), `lib/audit.ts`,
`lib/flutterwave.ts` (+`verifyFlutterwaveTransaction`, `+initiateFlutterwaveRefund`),
`lib/rate-limit.ts` (merged login tracker + generic window limiter),
`lib/escrow-service.ts`, `prisma/schema.prisma`.

### New API routes
`/api/admin/overview`, `/api/admin/refunds`, `/api/admin/refunds/[id]`,
`/api/admin/transactions/[id]`, `/api/admin/support-scripts`,
`/api/admin/support-scripts/[id]`.

### Migrated routes (permission-based)
`admin/audit-logs`, `admin/dispute-evidence`, `admin/disputes/[ref]`,
`admin/escrow/[ref]/[action]`, `admin/logistics`, `admin/logistics/track`,
`admin/payouts`, `admin/payouts/[id]/retry`, `admin/release`,
`admin/resolve-disputes`, `admin/risk`, `admin/transactions`,
`admin/transactions/release`, `escrow/confirm-delivery`, `escrow/create`,
`escrow/dispatch`, `escrow/dispute`, `escrow/ref`, `escrow/release`,
`escrow/waybill`, `flutterwave/webhook`.

### New admin UI
`app/admin/overview/**`, `app/admin/refunds/**`, `app/admin/support-scripts/**`,
`app/admin/transactions/[id]/**`; nav in `app/admin/components/AdminShell.tsx`.

### Tests / scripts
- `scripts/audit/audit-e2e.mjs` — 42-assertion harness
- `scripts/audit/seed-rbac-fixtures.mjs` — fixture seeding

### Docs
- `docs/audit/INITIAL_AUDIT.md`, `ADMIN_RBAC_MATRIX.md`,
  `IMPLEMENTATION_REPORT.md`, `TEST_RESULTS.md`, `LAUNCH_READINESS.md`,
  `OPERATIONS_RUNBOOK.md`

---

## 7. New environment variables

**None required.** The webhook cross-check and refund initiation reuse the
existing `FLUTTERWAVE_SECRET_KEY` and `FLUTTERWAVE_WEBHOOK_SECRET_HASH`. No new
secret is introduced by this work. (If a dedicated refund secret is later
required by Flutterwave, it must be added to `.env.example` and the deployment
config — see the runbook.)

---

## 8. Deferred items (require explicit authorization)

| Item | Why deferred |
|---|---|
| Converting existing `Float` money columns to integer minor units | **Destructive migration** — would rewrite financial columns. Requires a signed-off migration plan + backup. |
| Rewriting `lib/logistics/index.ts` to live GIGL/SPEEDAF/DHL clients | Requires live carrier credentials + commercial agreements. |
| Removing the `e2e-admin@trustship.test` account from the production DB | Production data operation — flagged prominently in the runbook for the operator to perform. |
| Meta WhatsApp template (`seller_escrow_invitation`) approval | External process owned by Meta; cannot be completed in-repo. |

### Low-severity findings also addressed

- **L-02** unused import removed from `app/api/admin/logistics/route.ts`.
- **L-03** stale `db:push` script corrected to `prisma db push`; added a
  `db:diff` helper for future additive-only checks.
- **L-01** axios/fetch duplication reduced on the paths touched by this work.

---

## 9. Known limitations

- The refund workflow depends on a Flutterwave refund endpoint whose exact
  availability was **not verifiable** from this environment. When no provider
  transaction id is available, an executed refund stays `PROCESSING` flagged for
  **manual settlement** — it is never marked `COMPLETED` without confirmation.
- Dispute financial resolution opens a refund **request**; a human must approve
  and execute it. This is intentional (separation of duties), not an omission.
- The test harness runs against a locally-built standalone server with synthetic
  data only. It cannot exercise a real Flutterwave sandbox without credentials,
  so provider-boundary behaviour is asserted structurally (status transitions,
  no false `COMPLETED`) rather than end-to-end with the provider.

---

## 10. Required manual configuration / external approvals

1. **Meta:** create and get approval for the `seller_escrow_invitation` message
   template; confirm business verification status.
2. **Flutterwave:** confirm the refund API contract for this account; if a
   separate refund credential exists, add it to the environment.
3. **Operator:** delete `e2e-admin@trustship.test` before production.
4. **Operator:** confirm the `verif-hash` in the Flutterwave dashboard matches
   `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.
5. **Operator:** decide on a formal data-retention policy for `WebhookLog`
   (currently unbounded — finding L-05, not fixed here).

---

## 11. Verification performed

- `npm run build` — **passes**, all new routes registered, no TypeScript errors.
- `prisma validate` — passes; `prisma migrate diff` — additive only.
- `scripts/audit/audit-e2e.mjs` — **42 passed / 0 failed / 0 skipped**.
- Pre-existing admin security harness — **20 passed / 0 failed**.

Full details, raw output, and the exact commands are in `TEST_RESULTS.md`.
