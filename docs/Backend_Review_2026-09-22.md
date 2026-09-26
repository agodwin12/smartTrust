# SmartPlaze — Backend Review & Backlog (2026-09-22)

**Overall score: 6.5 / 10** — solid architecture, verified correctness, not yet production-ready.

| Dimension | Score | Notes |
|---|:-:|---|
| Architecture & security design | 8 | Refresh-token rotation + reuse detection, hashed secrets, rank-guarded RBAC, race-safe money paths (conditional `updateMany`), fail-open caching, audit trail. |
| Correctness, as verified | 7 | Every guarantee was proven against the real database (including concurrency races) — but with one-off scripts, run once. |
| Production readiness | 5 | See gaps below. |

## What's done
Auth (JWT + rotating refresh cookie, OTP email verification via Resend, forgot/reset password, Google OAuth), Users & Stores, Categories (R2 uploads), Subscription plans & K-Pay Mobile Money checkout, Advertisements (quota, lifecycle, hero placement per plan/admin), Orders with dual-confirmation escrow, Disputes, Withdrawals (K-Pay payouts), RBAC (`utils/roles.js`), audit log, Redis caching + distributed rate limiting, indexes/pool sizing, K-Pay retry with backoff + timeouts, graceful shutdown, Dockerfile + compose (Postgres stays on host).

## Status update — 2026-09-23

- Gap 4 (observability) — **done**: pino structured logs with request ids, Sentry behind `SENTRY_DSN`, health endpoint with DB/Redis checks. See README → Observability.
- Gap 6 (buyer refunds) — **done**: `refund.service.js` pays the buyer back through K-Pay's payout API, webhook + polling, retry from the back-office. Real round-trip still blocked on valid K-Pay keys.
- Gap 7 (background jobs) — **done**: subscription expiry + notices, stale payments, payout polling, view-count flush, audit retention (`src/jobs`).
- Gap 3 (load / Redis) — **measured**: `docs/Load_Test_2026-09-23.md`. Redis is running locally; cache hits and rate-limit throttling verified. Found and fixed: the Redis rate-limit store never limited (boot-time race), a thundering herd on cache expiry, and suspended stores' listings staying visible.
- Gap 10 (`viewCount` write per view) — **done** (batched through Redis).
- Gap 1 (tests) — **done 2026-09-23**: `backend/test` (node:test + supertest, dedicated test DB) covers escrow double-release, quota race, refresh reuse, RBAC, refunds/webhooks, jobs, catalogue; `frontend` has Vitest unit tests; `.github/workflows/ci.yml` runs both.
- Still open: 2 (real payment round-trip), 5 (commission), 8 partially (reviews are per store, notifications built).

## Gaps — in priority order

1. **No automated tests.** Every guarantee (double-credit protection, escrow gates, quota race, refresh reuse detection) was verified manually once. Nothing prevents a future change from silently breaking them. *Highest-leverage next step.*
2. **Payment path has never completed a real round-trip.** K-Pay, Resend and Google were built from documentation and tested up to the credential boundary. One real K-Pay sandbox payment end-to-end is required before trusting it. (Current `.env` K-Pay keys return `401 Invalid API credentials` from K-Pay itself.)
3. **"500 concurrent users" is reasoned, not measured.** No load test has been run. Redis has never actually been started — cache *hits* and rate-limit *throttling* are unobserved (fail-open paths are verified).
4. **No observability.** `console.log` only — no structured logging, request IDs, metrics or error tracking (e.g. Sentry).
5. **Platform commission is not deducted on escrow release.** Cahier de Charges requires it. Needs a rate decision.
6. **Buyer refunds don't move money** — `refund-buyer` updates records only; needs `initWithdrawal` pointed at the buyer.
7. **No background jobs** — subscription/ad expiry notifications, audit-log retention, stale-payment cleanup (currently lazy, on next checkout).
8. **Reviews & Notifications modules** (Cahier de Charges) not built.
9. Docker image/compose never built against a live daemon.
10. Minor: `viewCount` is a DB write per detail view; `Number()` on Decimal amounts (fine for whole-unit XAF).

## Pending credentials
- `KPAY_API_KEY` / `KPAY_SECRET_KEY` (current ones invalid)
- `RESEND_API_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (+ register the redirect URI in Google Cloud Console)

## Test accounts (local DB)
- Local test accounts (super admin, accountant, customer service, buyer) exist only in the dev database; their passwords are kept out of the repository — ask the maintainer.
- `unverified@smartmarket.dev` / `Unverif123` — CUSTOMER, email not verified
