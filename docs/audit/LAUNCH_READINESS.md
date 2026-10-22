# TrustShip — Launch Readiness Assessment

**Date:** 2026-10-22
**Assessed commit:** working tree on top of `9acb4d3`
**Author:** Internal engineering (autonomous audit + remediation)

---

## Verdict

> ## 🟡 READY FOR CONTROLLED PILOT — SUBJECT TO EXTERNAL REQUIREMENTS

This is the **most conservative** verdict consistent with the evidence.

- The system is **not** "NOT READY" any longer: every CRITICAL finding from the
  initial audit has been remediated and the security-critical properties are
  **executed and green** (62 assertions).
- It is **not** "READY FOR GENERAL LAUNCH": there are open external dependencies
  (Meta template approval, Flutterwave refund-contract confirmation), a
  destructive money-representation migration still deferred, and end-to-end
  provider behaviour that was **structurally asserted but not verified against a
  live provider**.
- A **controlled pilot** — a limited set of real users, real (small) amounts,
  with human oversight of every release/refund and daily reconciliation — is
  appropriate **provided the external requirements below are satisfied first**.

**This assessment is about engineering readiness, not legal/regulatory
compliance.** Passing tests does not make the business compliant with CBN,
NDPC, FCCPC, tax, or consumer-protection obligations. Legal review is required
separately and is out of scope here.

---

## 1. What is launch-ready

| Area | Evidence |
|---|---|
| No unauthenticated money mutation | `waybill`/`dispute` gated; `ref` gated; `create` rate-limited, no PIN leak — 5 assertions green |
| No unauthorized release | Every release path requires `escrow:release`; support role gets 403 — green |
| No double payout | Atomic claim + rollback; second attempt rejected — green |
| No phantom refund | Real refund workflow; never `COMPLETED` without provider confirmation — 8 assertions green |
| Least-privilege admin | Centralized RBAC; finance can't manage admins/scripts; support can't read audit — green |
| Server-side PII/PIN gating | Masking/stripping before the response leaves the server — green |
| Webhook integrity | Signature + independent verify cross-check + idempotency — green |
| Build health | `npm run build` clean, all routes registered |
| Schema safety | Additive-only, verified with `prisma migrate diff` |

---

## 2. Launch blockers (must be resolved before ANY real money moves)

| # | Blocker | Owner | Notes |
|---|---|---|---|
| B-1 | Meta `seller_escrow_invitation` template not approved | External (Meta) | Without it, seller invitations cannot be delivered compliantly |
| B-2 | Flutterwave refund API contract unconfirmed | External (Flutterwave) | Refunds currently stay `PROCESSING` (manual settlement) if the endpoint is unavailable — no fabricated success, but manual ops needed |
| B-3 | Destructive `Float`→integer minor-units migration deferred | Internal + sign-off | Money currently stored as `Float` for legacy columns; a signed migration plan + backup is required before handling large volumes |
| B-4 | `e2e-admin@trustship.test` account removal | Operator | **Still present in the DB at assessment time.** Must be deleted before production |
| B-5 | One admin without 2FA (`superadmin2@trustship.com`) | Operator | Enable 2FA or remove |
| B-6 | `WebhookLog` retention unbounded | Internal | Not a security hole, but a data-protection/regulatory exposure |

---

## 3. External requirements (outside the repo)

1. **Meta:** business verification, template policy compliance, template
   approval. The app must not attempt to bypass these.
2. **Flutterwave:** confirm live refund capability for the account; confirm the
   `verif-hash` value in the dashboard matches `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.
3. **Legal/Regulatory:** consumer-protection, data-protection (NDPC), and
   payment-services posture reviewed by counsel. **Not established by this
   audit.**
4. **Carrier integration:** live GIGL/SPEEDAF/DHL clients + webhook signature
   verification (currently deferred).

---

## 4. Residual risk register

| Risk | Likelihood | Impact | Mitigation in place | Residual |
|---|---|---|---|---|
| Provider outage during refund | Medium | High | Refund stays `PROCESSING` + manual flag; never falsely `COMPLETED` | Manual reconciliation required |
| Duplicate webhook delivered | High | Low | Idempotency marker + `eventId` dedupe | Closed |
| Webhook verify cross-call fails (transport) | Medium | Medium | Fail-open on transport error, fail-closed on mismatch | Small window of unverified acceptance |
| Legacy `Float` rounding drift | Medium | High | Documented; new models use integer kobo | **Open** — deferred migration |
| Support social-engineering a refund | Low | Medium | Support can only *request*; finance approves+executes; all audited | Closed |
| Admin account compromise | Low | High | JWT + 2FA; audit trail with role + correlation id | Depends on 2FA adoption (see B-5) |
| Logger/i18n/DR gaps | — | — | see `INITIAL_AUDIT.md` LOW/INFO | Open, low priority |

---

## 5. Pilot operating conditions (recommended)

If launching a controlled pilot, run it under these conditions:

1. **Amount cap** per transaction, small enough that any single loss is
   tolerable.
2. **Human-in-the-loop** on every release and every refund execute.
3. **Daily reconciliation** of the payout queue and any `PROCESSING` refunds
   against the Flutterwave dashboard.
4. **Kill switch discipline:** to halt money movement, remove all money-moving
   permissions (or disable the relevant admins) — do not hand-edit the DB.
5. **Monitoring** on webhook `attemptCount`, payout backlog, and stuck refunds.
6. **No scale-up** until B-1…B-6 are closed and at least one provider-boundary
   test has been run against the Flutterwave sandbox.

---

## 6. Next steps

| Priority | Step |
|---|---|
| P0 | Delete `e2e-admin@trustship.test`; enable 2FA on all admins (B-4, B-5) |
| P0 | Obtain Meta template approval (B-1) |
| P0 | Confirm Flutterwave refund capability + webhook hash (B-2) |
| P1 | Run a sandbox charge→webhook→release→refund round-trip against Flutterwave test mode |
| P1 | Commission the destructive money-migration plan (B-3) with backup + sign-off |
| P2 | Set a `WebhookLog` retention policy (B-6) |
| P2 | Replace mock logistics with live carrier clients + webhook signature verification |
| P2 | Address remaining MEDIUM/LOW findings from `INITIAL_AUDIT.md` |

---

## 7. Executive summary

The initial audit found the payment **webhook** path was already well-built,
but that the escrow **state-mutation** and **money-movement** paths had serious,
launch-blocking gaps: unauthenticated endpoints that could freeze or fabricate
state, release routes with no role gate and a double-payout race, a "refund"
path that moved nothing while telling the customer it had, and an admin
authorization model spread across three drifting mechanisms.

All of that has been remediated and verified: authorization is now one
permission matrix; every release path is atomically claimed and role-gated;
refunds are a real, provider-confirmed workflow; the event and audit trails are
append-only and enriched; the admin dashboard gained an honest, basis-labelled
financial overview, a refunds queue, a transaction detail view, and versioned
support scripting. **62 assertions pass across two suites, with zero failures.**

What remains is **not** engineering debt but **external dependency and
operational readiness**: Meta template approval, Flutterwave refund-contract
confirmation, a deferred (destructive) money-format migration, removal of test
accounts, and — importantly — legal/regulatory review that this audit does not
and cannot provide.

**Recommendation: proceed to a controlled pilot only after the P0 blockers are
cleared and external requirements are signed off. Do not proceed to general
launch on the strength of tests alone.**
