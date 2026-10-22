# Admin RBAC Matrix

> Source of truth: `lib/rbac.ts`. This document is derived from that module —
> if they disagree, the code is authoritative and this file is stale.

## Why this exists

Before this work, authorization was spread across three drifting mechanisms:

1. bare `requireAdmin(request)` (any authenticated admin),
2. inline `requireAdmin(request, { roles: [...] })` allow-lists on some routes,
3. client-side role-string comparisons that merely *hid* buttons.

Several money-moving routes (`/api/escrow/release`, `/api/admin/release`,
`/api/escrow/ref`) ended up with **no role gate at all**, so a
`SUPPORT_MODERATOR` could release funds.

We now have a single permission matrix. **Routes check permissions, never role
strings.** Client-side checks are UI hints only; the server always re-checks.

## Roles

| Canonical role | DB literal (Prisma `@map`) | Aliases accepted |
| --- | --- | --- |
| `SUPER_ADMIN` | `SUPER_ADMIN` | `SUPERADMIN` |
| `FINANCE_ADMIN` | `FINANCE` | `FINANCE`, `FINANCE_ADMIN` |
| `SUPPORT_MODERATOR` | `SUPPORT` | `SUPPORT`, `SUPPORT_MODERATOR` |

`canonicalRole()` maps **any unrecognized role string to
`SUPPORT_MODERATOR`** (the least privileged role). A stale or corrupted JWT
with `role: "super_admin "` (or `"SUPERADMIN"`, etc.) cannot therefore be
treated as super-admin by accident.

## Permissions

| Permission | Meaning |
| --- | --- |
| `transactions:read` | Read the transaction list/detail (masked view). |
| `transactions:read_pii` | Read unmasked customer PII (phone, bank account). |
| `transactions:read_pin` | Read the release PIN. |
| `escrow:release` | Authorize a release of escrowed funds to the seller. |
| `payouts:read` | Read the payout queue + stats. |
| `payouts:manage` | Enqueue / retry payouts (real transfers). |
| `refunds:read` | See refund records. |
| `refunds:request` | Open a refund request (does **not** move money). |
| `refunds:approve` | Approve / reject a refund request. |
| `refunds:execute` | Execute an approved refund against the provider. |
| `disputes:read` | Read dispute cases. |
| `disputes:manage` | Assign, annotate, advance dispute stages. |
| `disputes:resolve_financial` | Apply the financial consequence of a resolved dispute. |
| `logistics:read` | Read shipments / tracking. |
| `logistics:manage` | Book waybills, update dispatch state. |
| `risk:read` | Read risk bands and recompute scores. |
| `audit:read` | Read the administrative audit trail. |
| `admins:manage` | Create / list admin accounts and assign roles. |
| `support_scripts:read` | Read customer-support scripts. |
| `support_scripts:manage` | Create / edit support scripts. |

## Matrix

| Permission | SUPER_ADMIN | FINANCE_ADMIN | SUPPORT_MODERATOR |
| --- | :---: | :---: | :---: |
| `transactions:read` | ✅ | ✅ | ✅ |
| `transactions:read_pii` | ✅ | ✅ | ❌ |
| `transactions:read_pin` | ✅ | ✅ | ❌ |
| `escrow:release` | ✅ | ✅ | ❌ |
| `payouts:read` | ✅ | ✅ | ❌ |
| `payouts:manage` | ✅ | ✅ | ❌ |
| `refunds:read` | ✅ | ✅ | ✅ |
| `refunds:request` | ✅ | ✅ | ✅ |
| `refunds:approve` | ✅ | ✅ | ❌ |
| `refunds:execute` | ✅ | ✅ | ❌ |
| `disputes:read` | ✅ | ✅ | ✅ |
| `disputes:manage` | ✅ | ❌ | ✅ |
| `disputes:resolve_financial` | ✅ | ✅ | ❌ |
| `logistics:read` | ✅ | ✅ | ✅ |
| `logistics:manage` | ✅ | ❌ | ✅ |
| `risk:read` | ✅ | ✅ | ✅ |
| `audit:read` | ✅ | ❌ | ❌ |
| `admins:manage` | ✅ | ❌ | ❌ |
| `support_scripts:read` | ✅ | ✅ | ✅ |
| `support_scripts:manage` | ✅ | ❌ | ❌ |

### Design notes

- **`SUPPORT_MODERATOR` may request refunds but never approve or execute
  them.** A support agent can therefore log a customer's request and hand it to
  finance, but cannot move money.
- **`SUPPORT_MODERATOR` has no `escrow:release`.** Releasing funds is a
  financial action.
- **`FINANCE_ADMIN` has no `admins:manage` and no `support_scripts:manage`.**
  Money power is not account power, and finance is not the author of
  customer-facing copy.
- **`audit:read` is SUPER_ADMIN-only.** This preserves the previous
  `SUPER_ADMIN_ONLY` behaviour on `/api/admin/audit-logs`: finance can act but
  cannot rewrite or review the trail; only the top role can.
- **`disputes:manage` is `SUPPORT_MODERATOR` + `SUPER_ADMIN`, while
  `disputes:resolve_financial` is finance-side.** A moderator runs the case; a
  financial role applies the money outcome. This separation is deliberate.

## Route → permission map

| Route | Method | Permission |
| --- | --- | --- |
| `/api/admin/overview` | GET | `transactions:read` |
| `/api/admin/transactions` | GET | `transactions:read` (+ masking unless `read_pii`) |
| `/api/admin/transactions/[id]` | GET | `transactions:read` (+ PIN/PII gated) |
| `/api/admin/transactions/release` | POST | `escrow:release` |
| `/api/admin/release` | POST | `escrow:release` |
| `/api/admin/escrow/[ref]/[action]` | POST | per-action: `fund`/`release` → `escrow:release`; `deliver` → `logistics:manage`; `dispute` → `disputes:manage` |
| `/api/admin/escrow/[ref]/[action]` | GET | `transactions:read_pin` |
| `/api/admin/payouts` | GET | `payouts:read` |
| `/api/admin/payouts` | POST | `payouts:manage` |
| `/api/admin/payouts/[id]/retry` | POST | `payouts:manage` |
| `/api/admin/refunds` | GET | `refunds:read` |
| `/api/admin/refunds` | POST | `refunds:request` |
| `/api/admin/refunds/[id]` | POST | `review` → `refunds:request`; `approve`/`reject` → `refunds:approve`; `execute` → `refunds:execute` |
| `/api/admin/disputes/[ref]` | GET | `disputes:read` |
| `/api/admin/disputes/[ref]` | POST | `disputes:manage` |
| `/api/admin/resolve-disputes` | POST | `disputes:resolve_financial` |
| `/api/admin/dispute-evidence` | GET | `disputes:read` (+ masking unless `read_pii`) |
| `/api/admin/logistics` | GET | `logistics:read` |
| `/api/admin/logistics` | POST | `logistics:manage` |
| `/api/admin/logistics/track` | GET | `logistics:read` |
| `/api/admin/risk` | GET/POST | `risk:read` |
| `/api/admin/audit-logs` | GET | `audit:read` |
| `/api/admin/support-scripts` | GET | `support_scripts:read` |
| `/api/admin/support-scripts` | POST | `support_scripts:manage` |
| `/api/admin/support-scripts/[id]` | GET | `support_scripts:read` |
| `/api/admin/support-scripts/[id]` | PATCH | `support_scripts:manage` |
| `/api/admin/admins` (management) | * | `admins:manage` |

## Enforcement points

1. **`proxy.ts`** — the outer gate: verifies the admin JWT on `/admin/*` and
   `/api/admin/*`, applies the CSP nonce, and locks down unauthenticated access.
2. **`requirePermission(request, permission)`** (`lib/admin-auth.ts`) — the
   inner gate every privileged route calls. It delegates to `requireAdmin` and
   then checks the RBAC matrix, returning `403` with no detail on failure.
3. **Server-side field gating** — PII and the release PIN are removed/masked
   *before* the response leaves the server; a lower-privileged admin never
   receives the raw value, so client filtering can never substitute for
   authorization.

## Testing

RBAC is exercised by the admin security harness (`admin-security-e2e.mjs`) and
the RBAC case suite, which assert that:

- each role can reach exactly its permitted endpoints and gets `403` elsewhere;
- a `SUPPORT_MODERATOR` cannot release funds or execute a refund;
- a `FINANCE_ADMIN` cannot manage admins or edit scripts;
- an unknown role string resolves to `SUPPORT_MODERATOR`;
- PII/PIN are absent from responses for roles lacking the permission.

See `TEST_RESULTS.md` for the executed results.
