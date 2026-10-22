# TrustShip — Initial Security & Architecture Audit

**Audit date:** 2026-10-22
**Auditor:** Internal engineering (autonomous audit)
**Commit under audit:** `9acb4d3` (branch `main`, clean working tree at audit start)
**Method:** Static inspection of the repository (Prisma schema, API routes, lib modules,
proxy, admin pages), plus route/handler authorization inventory. Findings marked
**CONFIRMED** were verified by reading the exact code path that proves them; findings marked
**SUSPECTED** are reasoned but not empirically exercised in this environment.

> **Reading note.** This audit covers the application *as it exists in the repository*. It does
> not assume any feature from the assignment brief is present. Where a capability is absent, it
> is recorded as absent — not as "broken".

---

## 1. Scope inspected

| Area | Artefacts reviewed |
|---|---|
| Framework | `package.json` (Next.js 16.4, React 19, Prisma 5.22, Tailwind 3/4 mix) |
| Data model | `prisma/schema.prisma` (all enums + models) |
| Auth (admin) | `lib/admin-auth.ts`, `lib/admin-guards.ts`, `app/api/admin/login|logout|me`, `proxy.ts` |
| Authz | Every `app/api/**/route.ts`, `app/actions/**` |
| Payments | `lib/flutterwave.ts`, `app/api/flutterwave/webhook/route.ts`, `lib/payout.ts` |
| Escrow money paths | `lib/escrow-service.ts`, `app/api/escrow/*`, `app/api/admin/release`, `app/api/admin/transactions/release`, `app/api/admin/escrow/[ref]/[action]` |
| WhatsApp | `app/api/whatsapp/webhook/route.ts`, `lib/whatsapp.ts`, `lib/whatsapp/botEngine.ts` |
| Audit | `lib/audit.ts`, `prisma.AdminAuditLog` |
| Admin UI | `app/admin/**` pages + components |
| Infra | `proxy.ts`, `next.config.mjs`, `vercel.json`, `.env.example` |
| Tests | **No test framework configured** (no jest/vitest/playwright config, no `*.test.*` files) |

---

## 2. Summary of findings

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 5 | C-01 … C-05 |
| HIGH | 6 | H-01 … H-06 |
| MEDIUM | 8 | M-01 … M-08 |
| LOW | 6 | L-01 … L-06 |
| INFORMATIONAL | 5 | I-01 … I-05 |

**Headline:** the payment *webhook* path is genuinely well-built (signature verification,
idempotency marker with rollback, amount integrity check, lockable-state guard). The
**weaknesses cluster around (a) unauthenticated escrow state-mutation routes and (b) money
paths that either lack a role gate or move state without calling the payment provider at all.**
Those are the launch blockers.

---

## 3. CRITICAL findings

### C-01 — Unauthenticated escrow creation, including release-PIN disclosure
- **File:** `app/api/escrow/create/route.ts` (POST)
- **Description:** The route takes a JSON body and calls `createEscrow(body)` with **no auth,
  no action token, no rate limit**. `createEscrow` (`lib/escrow-service.ts`) creates buyer/seller
  `User` rows, an `EscrowTransaction`, and a live Flutterwave checkout link, and **returns
  `releasePin`** in the JSON response.
- **Business impact:** Any unauthenticated caller can (1) mass-create escrow records and
  Flutterwave checkout links, polluting the ledger and the Flutterwave account; (2) create
  arbitrary buyer/seller `User` rows keyed by phone number; (3) obtain the release PIN for any
  escrow it creates. Combined with C-02 this is end-to-end fund-release abuse.
- **Reproduction:** `POST /api/escrow/create` with a valid body and no cookie → `200` +
  `{ success, transactionRef, paymentUrl, releasePin }`.
- **Recommended fix:** Remove the public surface or gate it behind the signed action-token
  mechanism already used by `dispatch`/`confirm-delivery`, plus rate limiting. Never return
  `releasePin` from an unauthenticated endpoint.
- **Status:** **CONFIRMED** (route + service both read; `reject` absent).

### C-02 — Unauthenticated escrow state mutation via `/api/escrow/waybill`
- **File:** `app/api/escrow/waybill/route.ts` (POST)
- **Description:** Mutates `waybillPayer`, `dispatchStatus`, and can set `status = DELIVERED`,
  keyed only on a caller-supplied `transactionRef`. No session, no token.
- **Business impact:** An attacker who knows or guesses a reference (references are
  `TS-ESCROW-<epoch-ms>-<4 digits>` — low entropy, partially time-predictable) can mark an
  escrow **DELIVERED**, which is the precondition most release flows expect. Integrity of the
  delivery state is a financial control.
- **Reproduction:** `POST /api/escrow/waybill { transactionRef, dispatchStatus: "DELIVERED" }`
  with no cookie → transaction updated.
- **Recommended fix:** Require an admin session **or** a signed action token
  (`signActionToken("waybill", ref)`), and validate the state transition.
- **Status:** **CONFIRMED** (route read end-to-end).

### C-03 — Unauthenticated dispute freeze + outbound WhatsApp fan-out
- **File:** `app/api/escrow/dispute/route.ts` (POST)
- **Description:** Sets `status = DISPUTE_OPEN`, arms both parties' WhatsApp sessions for the
  evidence flow, and sends real customer-facing WhatsApp messages to buyer **and** seller —
  all from an unauthenticated request supplying `transactionRef` or `transactionId`.
- **Business impact:** Freeze-any-escrow DoS; attacker-chosen `disputeFault` poisons a later
  resolution; unsolicited messaging to real customers (Meta policy risk + trust damage);
  evidence sessions hijacked.
- **Reproduction:** `POST /api/escrow/dispute { transactionRef, disputeFault: "SELLER_FAULT" }`
  with no cookie → transaction moved to `DISPUTE_OPEN`, messages dispatched.
- **Recommended fix:** Require an authenticated admin session, or a signed action token minted
  server-side for the specific party. Validate the target status. Never let the caller choose
  `disputeFault` unauthenticated.
- **Status:** **CONFIRMED**.

### C-04 — Phantom refund: status flip + customer notification, **no provider call**
- **File:** `app/api/escrow/ref/route.ts` (POST)
- **Description:** Sets `status = REFUNDED` and messages both parties *"Full amount will be
  returned to the buyer's original payment method."* There is **no Flutterwave refund call
  anywhere** in this route (or in `lib/flutterwave.ts`).
- **Business impact:** **Financial misrepresentation.** The customer is told money is coming
  back and the ledger says `REFUNDED`, but no money moves. This is the single most dangerous
  finding — it corrupts both the customer relationship and the reconciliation record. There is
  also no guard that only truly *funded* escrows (`ESCROW_LOCKED`/`DELIVERED`) may be refunded,
  and no cumulative/duplicate-refund cap.
- **Reproduction:** inspect the route — no `initiateFlutterwaveTransfer`/refund import.
- **Recommended fix:** Introduce a real refund workflow: a `Refund` model with an explicit
  lifecycle (`REQUESTED → UNDER_REVIEW → APPROVED → PROCESSING → COMPLETED|FAILED|REJECTED`),
  a server-authoritative eligible-amount calculation, and completion **only** on provider
  confirmation. Until the Flutterwave refund endpoint is wired and verified, the UI must mark
  refunds as `PENDING`/manual and the message copy must not promise a completed refund.
- **Status:** **CONFIRMED**.

### C-05 — Release paths lack a status/role guard and are double-spend raceable
- **Files:** `app/api/escrow/release/route.ts`, `app/api/admin/release/route.ts`,
  `app/api/admin/escrow/[ref]/[action]/route.ts` (`release`)
- **Description:** All three initiate a real Flutterwave transfer. Each checks only
  `status === COMPLETED` for idempotency (a read-then-write **TOCTOU race**: two concurrent
  requests both pass and send **two** transfers). None require the escrow to be in a fundable/
  deliverable state first — an escrow merely in `PENDING_DEPOSIT` (never paid) can be "released".
  `escrow/release` and `admin/release` also have **no role restriction** (any authenticated
  admin role, including `SUPPORT_MODERATOR`, can move money).
- **Business impact:** Double payout; release of never-collected funds; privilege escalation on
  the money path. Direct, unbounded financial loss.
- **Recommended fix:** (1) Enforce an allowed *from*-status set. (2) Claim the transition
  atomically before the provider call (conditional `updateMany WHERE status IN (allowed)`),
  mirroring the pattern already proven in `lib/payouts/processor.ts`. (3) Gate every money path
  on `SUPER_ADMIN`/`FINANCE_ADMIN`. (4) Record a durable release/payout row keyed by a unique
  provider reference (the `PayoutQueue` model already exists and does exactly this — the legacy
  routes bypass it).
- **Status:** **CONFIRMED** (all three routes read).

---

## 4. HIGH findings

### H-01 — Inconsistent authorization across money paths
- **Files:** `app/api/escrow/release`, `app/api/admin/release`, `app/api/escrow/ref` use bare
  `requireAdmin(request)`; `app/api/admin/transactions/release` and `app/api/admin/payouts`
  correctly use `{ roles: ["SUPER_ADMIN","FINANCE_ADMIN"] }`, and `app/api/admin/transactions/release/route.ts` matches the stronger form.
- **Impact:** Two parallel, contradictory authorization models for the same class of action.
- **Fix:** One centralized policy module (see Phase 4) and route every money path through it.
- **Status:** **CONFIRMED**.

### H-02 — `twoFactorSecret` returned by `/api/admin/me`
- **File:** `app/api/admin/me/route.ts` line 80 (also does its own inline `jwt.verify`, bypassing
  `requireAdmin`).
- **Impact:** TOTP secret serialized to the client on every session check — widens the blast
  radius of any XSS or a compromised admin browser; also a needless standing secret exposure.
- **Fix:** Return it only from the explicit 2FA setup endpoint; `me` returns
  `isTwoFactorEnabled` only. Route through `requireAdmin`.
- **Status:** **CONFIRMED**.

### H-03 — No test suite of any kind
- **Evidence:** no test runner config, no `*.test.*`/`*.spec.*` files, `package.json` has no
  `test` script.
- **Impact:** every claim about financial correctness/RBAC is currently unverified; regressions
  are invisible.
- **Fix:** a lightweight, dependency-free Node test harness (this repository has no jest/vitest,
  and the brief says not to add unnecessary test deps) plus an E2E script.
- **Status:** **CONFIRMED**.

### H-04 — Webhook-driven state has no independent provider verification
- **File:** `app/api/flutterwave/webhook/route.ts`
- **Description:** A `charge.completed` event moves an escrow to `ESCROW_LOCKED`. The handler
  trusts `payload.data.amount` for the amount check but does **not** call Flutterwave's
  *verify transaction* endpoint to independently confirm status/amount/currency/`tx_ref`
  ownership. Signature verification means the event is genuine, but a replayed-with-altered
  body (if the `verif-hash` scheme is ever weakened) or a mismatch between `data.tx_ref` and the
  real transaction would not be caught by an out-of-band check.
- **Impact:** reduces defence-in-depth on the single most important transition (money in).
  **Not currently exploitable given signature verification is enforced.**
- **Fix:** add an optional `verifyFlutterwaveTransaction(flwId)` cross-check before locking.
- **Status:** **CONFIRMED** (absence), **SUSPECTED** (exploitability — signature gate holds).

### H-05 — Payout/release and refund do not share one auditable financial record
- **Description:** `PayoutQueue` exists and is idempotent, but the four legacy release routes
  bypass it entirely and mint ad-hoc `TS-PAYOUT-<Date.now()>` / `TS-ADMIN-REL-<id>-<Date.now()>`
  references. There is no `Refund` model and no `TransactionEvent`/timeline table.
- **Impact:** reconciliation gaps; no single source of truth for "what did we actually send,
  when, under which reference".
- **Fix:** Phase 6 models (Refund, TransactionEvent) and route releases through `PayoutQueue`.
- **Status:** **CONFIRMED**.

### H-06 — Audit trail is namespaced inconsistently and not uniformly applied
- **Description:** `AdminAuditLog` is solid (actor, IP, UA, action, target). However actor role
  is not stored as-of-time, there is no correlation id, and several sensitive reads (e.g. the
  escrow detail GET that returns `releasePin`) are unaudited. Also `app/api/admin/me` writes no
  login-adjacent events from the read path.
- **Impact:** weaker forensic reconstruction; "who saw the PIN" is unanswerable.
- **Fix:** add `actorRole`, `correlationId`; audit sensitive reads.
- **Status:** **CONFIRMED**.

---

## 5. MEDIUM findings

### M-01 — `escrow/status` is an unauthenticated reference oracle
`app/api/escrow/status/route.ts` returns item title, fees, party-adjacent fields and status for
any `ref` with no auth. `releasePin` is correctly omitted. Format is enumerable.
**Fix:** keep it public (tracking UX) but return a minimal field set and add rate limiting.
**Status:** CONFIRMED (disclosure), SUSPECTED (enumeration feasibility).

### M-02 — No server-side pagination guarantee on several list endpoints
`app/api/admin/escrows`, `transactions`, `logistics` accept `limit` but rely on client-side
filtering in the admin pages. Large datasets will over-fetch.
**Status:** CONFIRMED.

### M-03 — Money stored as `Float`/`DOUBLE PRECISION`
All monetary columns use `Float`. `lib/payout.ts` rounds to 2dp defensively, but float
comparisons for equality (`chargedAmount !== transaction.totalEscrow`) are exact-equality on
floats — fragile. The brief prefers integer minor units.
**Fix:** documented decision + integer minor units for *new* financial models; do **not** rewrite
existing columns (destructive).
**Status:** CONFIRMED.

### M-04 — No `TransactionEvent` timeline
Timelines are synthesised in the UI from a single row's timestamps; there is no append-only
event log, so "only display events that actually occurred" cannot be satisfied rigorously.
**Status:** CONFIRMED.

### M-05 — Dispute model is thin
`DisputeEvidence` exists; there is no `Dispute` entity (no assignee, category, status history,
resolution notes beyond `disputeFault` on the transaction).
**Status:** CONFIRMED.

### M-06 — `WebhookLog` stores full raw payloads, no processing metadata
No processing status, attempt count, error category, or retry info; raw payloads may contain
customer PII. No redaction on read.
**Status:** CONFIRMED.

### M-07 — Admin pages `transactions` and `settings/security` are unguarded client components
They rely solely on the proxy redirect and the fact that their data comes from guarded APIs.
Defence-in-depth gap (not a direct data leak, since the APIs themselves are guarded).
**Status:** CONFIRMED.

### M-08 — Rate limiting is absent on auth and public mutation endpoints
`/api/admin/login`, `/api/escrow/create`, `/api/escrow/waybill`, `/api/escrow/dispute` have no
throttle (login has password + optional TOTP but no lockout visible in the route).
**Status:** CONFIRMED (route inspection).

---

## 6. LOW findings

- **L-01** Duplicate HTTP clients: both `axios` and native `fetch` are used.
- **L-02** `lib/logistics/index.ts` has an unused `getLogisticsProvider` import in
  `app/api/admin/logistics/route.ts`.
- **L-03** `package.json` `db:push` script uses long-removed Prisma `migrate save --preview-feature`.
- **L-04** `next.config.mjs` mixes Tailwind 3 (`tailwind.config.ts`) with `@tailwindcss/postcss` 4.
- **L-05** `WebhookLog` has no retention/TTL policy.
- **L-06** `AdminAuditLog.details` is a JSON *string*, not `Json`, so it cannot be queried
  structurally.

---

## 7. INFORMATIONAL

- **I-01** The Flutterwave webhook is the best-engineered component in the repo: constant-time
  signature compare, fail-closed in production, idempotency marker inserted before processing
  with rollback-on-throw, amount integrity check, and a lockable-status guard.
- **I-02** `proxy.ts` implements a correct CSP with per-request nonce and same-origin admin API
  lockdown.
- **I-03** `lib/action-token.ts` correctly binds an HMAC to `action:ref:exp`.
- **I-04** Admin session cookie policy is centralised and correct (httpOnly, strict, 8h, secure
  in prod with an explicit local opt-out).
- **I-05** `lib/payouts/processor.ts` demonstrates the correct idempotent-claim pattern that the
  legacy release routes should adopt.

---

## 8. Prioritised remediation plan

| Order | Finding(s) | Action |
|---|---|---|
| 1 | C-05, H-01 | Centralized RBAC policy + money-path role gates + atomic release claim |
| 2 | C-01, C-02, C-03 | Authenticate/gate public escrow mutation routes |
| 3 | C-04, H-05 | Real `Refund` model + lifecycle; stop promising unexecuted refunds |
| 4 | H-02, H-06 | Harden `/api/admin/me`; extend audit (role, correlationId, sensitive reads) |
| 5 | M-04, M-05, M-06 | Add `TransactionEvent`, `Dispute`, webhook processing metadata |
| 6 | — | Admin dashboard: overview, all-transactions, detail page, refunds, disputes, support scripts |
| 7 | H-03 | Dependency-free test harness + E2E suite |
| 8 | M-08, M-01 | Rate limiting + minimal public field sets |
| 9 | M-03 | Document money representation; integers for new models |

**Explicitly deferred (requires authorization / destructive):**
- Converting existing `Float` money columns to integer minor units (destructive migration).
- Any real Flutterwave refund execution against production.
- Enabling/altering Meta WhatsApp templates or business verification.

---

## 9. Launch-blocker statement

As of this audit the application is **NOT READY** for any real-money traffic. The unauthenticated
escrow mutation routes (C-01…C-03) and the phantom-refund path (C-04) are direct financial and
trust risks, and the release paths (C-05) can double-pay. The payment *webhook* itself is sound.
Remediation is tracked in `IMPLEMENTATION_REPORT.md`.
