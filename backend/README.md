# Smart Market — Backend API

Express.js (JavaScript) + PostgreSQL via [Prisma](https://www.prisma.io/), organized as MVC.

## Structure

```
prisma/
  schema.prisma     Database schema (the "Model" layer — Prisma generates the client from this)
src/
  config/           Env loading (config/env.js) and the Prisma client singleton (config/prisma.js)
  controllers/      Request handlers — read input, call a service, shape the response
  services/         Business logic and data access (Prisma queries live here)
  routes/           Express routers, one file per resource, aggregated in routes/index.js
  middlewares/       Cross-cutting concerns (error handling, auth, validation, rate limiting, ...)
  validators/       zod request-body schemas
  utils/            Shared helpers (ApiError, cookies, hashing)
  app.js            Express app: middleware wiring, route mounting, error handling
  server.js         Entry point — starts the HTTP server
```

Request flow: `routes/*.routes.js` → `controllers/*.controller.js` → `services/*.service.js` → `prisma`.

## Auth & security model

- **Access token**: short-lived JWT (15 min default), returned in the JSON response body. The
  frontend keeps it in memory and sends it as `Authorization: Bearer <token>`.
- **Refresh token**: opaque random token (not a JWT), set as an `httpOnly`, `SameSite=Lax` cookie
  scoped to `/api/auth` only. Only a SHA-256 hash of it is ever stored in the database.
- **Rotation**: every `/api/auth/refresh` call revokes the presented refresh token and issues a new
  one (single-use). If an already-revoked token is presented again — a replayed/stolen token — the
  **entire refresh-token family for that user is revoked**, forcing re-login on every device.
- **`authenticate` middleware** re-checks the user's `status` in the database on every request (not
  just at login), so suspending/banning a user takes effect immediately rather than waiting for
  their access token to expire.
- **CSRF**: mitigated by strict CORS (`credentials: true` + a specific allowed origin, never `*`)
  combined with `SameSite=Lax` — a foreign origin's request is rejected by the CORS preflight before
  it reaches a route. No separate CSRF token is issued.
- Passwords hashed with bcrypt (12 salt rounds). Login/register are rate-limited
  (`middlewares/rateLimiter.js`). Login always returns a generic "Invalid email or password" to
  avoid leaking whether an email is registered.

### Endpoints

```
POST /api/auth/register   { email, password, firstName, lastName, phone? }
POST /api/auth/login      { email, password }
POST /api/auth/refresh    (reads the refresh cookie, rotates it)
POST /api/auth/logout     (revokes the current refresh token)
GET  /api/auth/me         (Bearer access token required)

POST /api/auth/verify-email          Bearer token required — { code }
POST /api/auth/resend-verification   Bearer token required — 409 if already verified

POST /api/auth/forgot-password       public — { email }, always the same response either way
POST /api/auth/reset-password        public — { email, code, newPassword }, revokes every session

GET  /api/auth/google            redirects to Google's consent screen
GET  /api/auth/google/callback   Google redirects here — links/creates the account, then
                                  redirects to `${FRONTEND_URL}/auth/callback#accessToken=...`
                                  (or `?error=...` on failure)
```

**Email verification & password reset (OTP via Resend)** — `services/otp.service.js` is a single
generic mechanism behind both: a 6-digit code, SHA-256 hashed at rest (same "never store the raw
secret" principle as refresh tokens), capped at 5 guesses, and only one active code per user+purpose
at a time (requesting a new one invalidates whatever was still outstanding). `User.emailVerifiedAt`
was in the schema from the very first Auth pass but was never actually wired up until now — it just
sat unused. Registration still succeeds even if the verification email fails to send (a broken email
provider shouldn't block account creation); `/resend-verification` exists for exactly that case.
`/forgot-password` never reveals whether an email is registered — verified directly: a real account
and a nonexistent one get byte-for-byte the same response.

**Resend isn't configured yet** (`RESEND_API_KEY` is empty in `.env`) — and that's fine by design: the
Resend SDK throws *synchronously in its constructor* if the key is missing, which would otherwise
crash the entire server at startup (found and fixed this — `services/email.service.js` now
lazy-constructs the client only when actually sending, so the rest of the app works normally with
email simply unavailable until a real key is added; every caller already expects a catchable error
here). When the real key arrives, it's a one-line `.env` change — nothing else to build.

**Google OAuth** is fully implemented, not just "schema-ready" — `services/googleOAuth.service.js`
(auth URL building, code-for-token exchange, profile fetch) plus the redirect/callback routes above.
No `passport` dependency; it's a plain OAuth2 authorization-code flow via `fetch`, consistent with
how `kpay.service.js` talks to an external API. CSRF is handled with a `state` value round-tripped
through a short-lived `httpOnly` cookie (`oauth_state`, 10 min, scoped to `/api/auth/google`) rather
than server-side session storage, matching this app's fully-stateless design. On success it sets the
refresh cookie exactly like a normal login, then redirects the browser with the access token in the
URL **fragment** (`#accessToken=...`), not a query string — fragments are never sent to any server
(not ours, not analytics, not a Referer header), which is the whole reason the classic OAuth implicit
flow used one for this same handoff. Sign-in behavior: an existing `googleId` logs in; no `googleId`
match but a matching `email` **links** the Google identity to that existing account rather than
creating a duplicate; neither match creates a brand-new account with `passwordHash: null`.
**`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` aren't set yet** — verified everything that doesn't need
them: the redirect URL builds correctly, the `oauth_state` cookie round-trips correctly, a
state-mismatch is rejected before ever contacting Google, and a bad/fake code fails cleanly at the
token-exchange step with a redirect to a frontend error page instead of a crash or a raw stack trace.

**Rate limiting, hardened** (`middlewares/rateLimiter.js`) — previously only `/register` and
`/login` were covered. Now: a stricter limiter on anything that **sends an email**
(`/forgot-password`, `/resend-verification` — 5/15min, since abuse here means spamming a stranger's
inbox or burning the Resend quota, not just guessing), a moderate one on anything that **guesses a
code** (`/verify-email`, `/reset-password` — 10/15min, on top of each code's own 5-attempt cap), and
a generous general-purpose limiter (120/min) applied to the **entire API** in `app.js` as a baseline
backstop. All of them share the same Redis-backed, fail-open design as before. **Caveat**: verified
the fail-open behavior for real (no Redis running, every endpoint still works); the actual "does it
429 after N requests" throttling behavior needs a live Redis to exercise, which wasn't available this
pass — logic reviewed, not live-load-tested.

### Users & Stores

```
GET   /api/users/me              own profile
PATCH /api/users/me              update firstName/lastName/phone
PATCH /api/users/me/password     change password — revokes every other session; 422 for a
                                  Google-only account (passwordHash is null, nothing to change)
GET   /api/users                 SUPER_ADMIN/CUSTOMER_SERVICE only, paginated, ?role=&status=
PATCH /api/users/:id/status      SUPER_ADMIN/CUSTOMER_SERVICE only — ACTIVE/SUSPENDED/BANNED

GET   /api/stores                public, paginated, ?search=
GET   /api/stores/:slug          public storefront (404 unless the store is ACTIVE)
POST  /api/stores                create own store (one per user — 409 if you already have one)
GET   /api/stores/me             own store
PATCH /api/stores/me             update own store
PATCH /api/stores/:id/status     SUPER_ADMIN only — PENDING/ACTIVE/SUSPENDED
```

A store's slug is generated once from its name at creation and never changes on update (stable
SEO URLs). A `Wallet` (balance 0, XAF) is created atomically alongside every store, ready for the
escrow/payout module. Changing a role or suspending/banning a user takes effect on their *next*
request, not just after their access token expires — `authenticate` re-reads the user from the
database every time, not just at login.

### Categories (with image upload)

```
GET    /api/categories               public, ?parentId=<id> or ?parentId=root to filter
GET    /api/categories/:slug         public, includes immediate children
POST   /api/categories               SUPER_ADMIN only, multipart/form-data: name, parentId?, image?
PATCH  /api/categories/:id           SUPER_ADMIN only, multipart: name?, parentId?, image?, removeImage?
DELETE /api/categories/:id           SUPER_ADMIN only — 409 if it still has subcategories or advertisements
```

Images upload to Cloudflare R2 (S3-compatible) via `services/storage.service.js` — JPEG/PNG/WebP
only, 5MB max. The bucket (`heyama-objects`) is **shared with another project**, so every object
Smart Market writes is namespaced under the `smart-market/` key prefix (`config/env.js` →
`r2.keyPrefix`) to avoid any collision. Replacing or removing a category's image deletes the old
R2 object; deleting a category deletes its image too — nothing is left orphaned in the shared
bucket. Uploads go through the backend (multer, in-memory, never touches disk) rather than
presigned direct-to-R2 URLs, which keeps the upload path simple to test and reuse for the next
module that needs images (store logos/banners, product photos).

### Subscription Plans, Subscriptions & Payments (K-Pay — Mobile Money / Orange Money)

```
GET    /api/subscription-plans          public — active plans only
GET    /api/subscription-plans/all      SUPER_ADMIN only — includes inactive plans
POST   /api/subscription-plans          SUPER_ADMIN only — { name, durationDays, adQuota, price, features?, isActive? }
PATCH  /api/subscription-plans/:id      SUPER_ADMIN only
DELETE /api/subscription-plans/:id      SUPER_ADMIN only — 409 if any subscription used this plan (deactivate instead)

POST   /api/subscriptions/checkout      seller only — { planId, provider, phoneNumber } → charges Mobile Money
GET    /api/subscriptions/me            seller's current/latest subscription (+plan +payment)
GET    /api/subscriptions/:id/refresh   re-checks the live K-Pay status for a still-pending payment

POST   /api/payments/webhooks/kpay      public — authenticated by HMAC signature, not a session
```

**How a subscription gets paid for:** `checkout` creates a `Subscription` (`PENDING_PAYMENT`) and a
`Payment` row, then calls K-Pay's `POST /payments/init` in USSD mode (a specific `provider` like
`MTN_MOMO_CMR`/`ORANGE_CMR` + `phoneNumber` — the customer gets a push notification on their phone
to approve). If K-Pay's own request fails outright, both rows are rolled back to `CANCELLED`/`FAILED`
immediately rather than left dangling. From there, either K-Pay's webhook or a live status poll
(`GET /:id/refresh`) reports the outcome; both funnel through the same idempotent
`services/payment.service.js#applyStatusUpdate`, which:
- No-ops if the payment is already in a terminal state (`COMPLETED`/`FAILED`/`CANCELLED`) — safe
  against K-Pay's webhook retries and duplicate polls.
- On the first transition to `COMPLETED`, activates the subscription (`ACTIVE`, `startsAt = now`,
  `expiresAt = now + plan.durationDays`, `adsUsed` reset) and **expires any other `ACTIVE`
  subscription the same store had** — only one active subscription per store at a time.

**Webhook security**: `POST /api/payments/webhooks/kpay` verifies the `X-KPAY-Signature` header —
`HMAC-SHA256(rawRequestBody, KPAY_WEBHOOK_SECRET)`, hex, `timingSafeEqual` — computed over the exact
raw bytes (`app.js` captures `req.rawBody` via `express.json({ verify })`), never a re-serialization
of the parsed body. An invalid signature gets a flat 401 with no detail.

**Endpoint correction (again, easy to get wrong):** `KPAY_BASE_URL` already includes `/api/v1`, and
K-Pay's auth needs **two** headers together — `X-API-Key` **and** `X-Secret-Key` — not the single
`x-api-key` a generic doc summary might suggest. Confirmed against the live "Parcourir l'API"
reference page, not the shorter guide page.

**`services/kpay.service.js`** also exposes `initGatewayPayment` (hosted payment page — customer
picks their own operator/card) and `verifyGatewayReturn` (HMAC over
`status|reference|externalId|ts`, keyed with `KPAY_GATEWAY_SECRET`, +10-minute anti-replay window)
for when a hosted-checkout flow gets built — neither is wired into any route yet, only USSD mode is.

**Known gap:** the K-Pay sandbox keys currently in `.env` return `401 Invalid API credentials`
directly from K-Pay's own API (confirmed with a raw `curl`, independent of this code) — get working
keys from the K-Pay dashboard before relying on a live checkout. Everything *not* requiring a live
K-Pay call has been verified against the real database: the rollback-on-init-failure path, the
webhook signature check (both a rejected bad signature and an accepted valid one), the idempotent
terminal-state guard (a stale webhook can't reopen an already-failed payment), the full
activation transaction (correct `expiresAt` math, `adsUsed` reset), and the
one-active-subscription-per-store guard (activating a second subscription auto-expires the first).

### Advertisements (products) — quota, lifecycle & hero placement

```
GET    /api/advertisements              public, ?categoryId=&storeId=&search= — only visible listings
GET    /api/advertisements/hero         public, ?categoryId=<id> for a category's own hero, omit for the homepage hero
GET    /api/advertisements/me           seller's own listings, any status, ?status=
GET    /api/advertisements/:slug        public detail — 404 unless visible; increments viewCount
POST   /api/advertisements              seller, multipart: title, description, price, categoryId, condition?, location?, video?, images[]?
PATCH  /api/advertisements/:id          seller (owner only), same fields — new images[] replaces the old set
POST   /api/advertisements/:id/publish  seller — enforces the active-subscription + ad-quota check
POST   /api/advertisements/:id/archive  seller (own) or SUPER_ADMIN (any) — frees a quota slot if it was published
POST   /api/advertisements/:id/feature  seller (own, plan must be hero-eligible) or SUPER_ADMIN (any, any duration)
DELETE /api/advertisements/:id/feature  seller (own) or SUPER_ADMIN — un-features immediately
```

**Visibility** is never a stored flag: a listing is publicly visible when `status = PUBLISHED` AND
its store currently has `Subscription.status = ACTIVE` with `expiresAt` in the future — computed at
query time (`advertisement.service.js#visibilityFilter`), same lazy-expiry approach as Stores and
Categories. This is exactly the Cahier de Charges behavior ("advertisements lose public visibility"
when a subscription lapses) without needing a cron job to flip statuses.

**Quota**: `Subscription.adsUsed` (already on the schema) is incremented on `publish` and
decremented on `archive` — checked against `plan.adQuota` before allowing a publish, inside a
`$transaction` with the status change so the two can never drift apart.

**Hero placement** (new requirement, 2026-09-22): each `SubscriptionPlan` has its own
`heroEligible`/`heroDurationHours` (admin-configured per plan, `heroDurationHours` has a 48-hour
floor). Two ways to feature an ad:
- **Self-serve** — the owning seller, only if their store's active plan is `heroEligible`; duration
  is always the plan's configured `heroDurationHours`, never chosen by the seller.
- **Admin override** — `SUPER_ADMIN` can feature *any* advertisement regardless of its store's plan,
  with a custom `durationHours` in the request body (defaults to 48 if omitted).

A category's hero section and the homepage hero are the same underlying query
(`GET /advertisements/hero`) — pass `categoryId` for one category's hero, omit it for the
site-wide one. "Currently featured" is `featuredUntil` in the future — no separate boolean, so it
can never disagree with the expiry it's supposed to reflect.

All of the above was verified against the real database end-to-end: draft invisibility, quota
rejection at the limit and success once raised, `adsUsed` incrementing/decrementing correctly
across publish/archive, self-serve featuring at the plan's exact configured duration, admin
overriding with a custom duration regardless of plan, un-featuring taking effect immediately in the
hero feed, category-scoped vs. site-wide hero filtering, and self-serve correctly rejected (403)
once a plan's `heroEligible` was turned off.

### Orders, Escrow, Disputes & Withdrawals

```
POST   /api/orders                       buyer — { advertisementId, quantity? }
GET    /api/orders/me                    buyer's own orders
GET    /api/orders/store                 seller's orders for their store
GET    /api/orders/:id                   buyer, seller, or SUPER_ADMIN/CUSTOMER_SERVICE
POST   /api/orders/:id/pay               buyer — { provider, phoneNumber } → charges Mobile Money, retry-safe
POST   /api/orders/:id/confirm-delivery  seller — "I fulfilled this"
POST   /api/orders/:id/confirm-receipt   buyer — "I received it, all good"
POST   /api/orders/:id/dispute           buyer or seller — { reason } → freezes the order

POST   /api/withdrawals                  seller — { provider, phoneNumber, amount } → cashes out the Wallet to Mobile Money
GET    /api/withdrawals/me               seller's withdrawal history
GET    /api/withdrawals/:id/refresh      re-checks the live K-Pay payout status

GET    /api/disputes                     SUPER_ADMIN/CUSTOMER_SERVICE — ?status=
PATCH  /api/disputes/:id                 update { status?, resolution? } — record-keeping only
POST   /api/disputes/:id/release-to-seller  admin sides with the seller — releases escrow as normal
POST   /api/disputes/:id/refund-buyer       admin sides with the buyer — marks REFUNDED, no K-Pay payout yet (see below)
```

**Dual confirmation, per the explicit requirement**: escrow never releases off a single "it's done"
click. `Order` has two independent nullable timestamps, `sellerConfirmedAt` and `buyerConfirmedAt` —
either can be set first, and `order.service.js#maybeComplete` only calls `escrow.service.js#release`
once **both** are set. A single confirmation just records that side's timestamp and leaves the order
`PAID`.

**Raising a dispute** (`POST /orders/:id/dispute`, either party, only while `PAID`) flips the order to
`DISPUTED`, which blocks `confirm-delivery`/`confirm-receipt` from doing anything further (both
require `status = PAID`) — a dispute is a hard stop on the normal flow until an admin resolves it via
`/disputes/:id/release-to-seller` or `/disputes/:id/refund-buyer`.

**Concurrency correctness (added 2026-09-22 on request)** — every place money or a quota-affecting
status moves now uses a **conditional `updateMany` + `count` check** as the linearization point,
instead of a "read status, check it, then write" sequence that two concurrent requests could both
pass before either writes:
- `escrow.service.js#release`/`markRefundedNoPayout` — `updateMany({ where: { status: "HELD" } })`.
  Verified directly: fired 5 truly concurrent `release()` calls at the same order (`Promise.allSettled`,
  not sequential requests) and confirmed the wallet was credited exactly once, not five times.
- `payment.service.js#applyStatusUpdate` — same pattern on `Payment.status`. Also verified with 5
  concurrent calls against the same order-linked payment: before this fix this would have thrown a
  unique-constraint crash (`EscrowTransaction.orderId` is unique, so a second concurrent "create the
  escrow hold" would fail loudly) — confirmed exactly one `EscrowTransaction` row was created and no
  errors were thrown.
- `withdrawal.service.js#applyStatusUpdate` — same pattern, guards the wallet credit-back on a
  FAILED/CANCELLED payout from happening twice.
- `withdrawal.service.js#request` — the balance check itself was a check-then-act race (two
  concurrent withdrawals could both read a sufficient balance before either decremented). Fixed the
  same way: `updateMany({ where: { balance: { gte: amount } } })` — the check and the decrement are
  now the same atomic statement, so a second concurrent request sees the already-reduced balance and
  correctly fails with `INSUFFICIENT_BALANCE` instead of over-drawing the wallet.

**Retry safety**: `orders/:id/pay` also had a real bug during testing — retrying a failed payment on
the same order crashed on `Payment.orderId`'s unique constraint (a raw Prisma error leaking to the
client). Fixed: a dead (`FAILED`/`CANCELLED`) payment on the order is cleared before a retry, an
in-flight one (`PENDING`/`PROCESSING`) blocks a second attempt with a clean 409, and each attempt now
gets its own `externalId` (K-Pay's own idempotency key) rather than reusing one derived from the
order id.

**Known gap, same as Subscriptions**: real K-Pay credentials still needed for a live checkout/payout.
Everything above was verified either directly against the database or by seeding a `PAID`
order/`HELD` escrow and driving the rest of the flow through the real endpoints.

**Not built yet**: an actual K-Pay payout to the *buyer* on `refund-buyer` — that dispute resolution
only updates records today; sending the money back requires the same withdrawal machinery pointed at
the buyer's number, which wasn't in scope for this pass.

## Chat assistant (Claude)

`src/services/assistant.service.js` powers the storefront widget through the Anthropic SDK (`ANTHROPIC_API_KEY`, `ASSISTANT_MODEL` default `claude-opus-5`, `ASSISTANT_MAX_TOOL_TURNS` default 4). Without a key `GET /assistant/status` reports `enabled: false` and `POST /assistant/chat` answers `503 ASSISTANT_UNAVAILABLE`, so the site keeps working.

- `POST /assistant/chat` — body `{ messages: [{role, content}] (≤12, starts and ends with the user), locale: "en"|"fr" }`; optional bearer token (a bad token still 401s so the client can refresh). Rate limited to 30 messages / 10 min per IP.
- The model gets a static, cached system prompt (escrow flow, selling flow, site routes, guardrails) plus a per-request context block (language, who is signed in), `effort: low`, `max_tokens: 1024`, and seven read-only tools: `search_products`, `browse_category`, `list_categories`, `get_deals`, `get_subscription_plans`, `get_store`, `get_my_orders` (only returns data for the signed-in user). Tool inputs are validated with zod; invalid input goes back as an `is_error` tool result.
- Parallel tool calls are executed together and returned in one user message; after `ASSISTANT_MAX_TOOL_TURNS` rounds the last request forbids tools so the model must answer in text. `stop_reason: "refusal"` becomes a fixed polite reply.
- Response: `{ reply, products[], orders[], model, usage }` — every listing/order the tools touched is returned as a card so the UI never depends on links inside the prose.
- Error mapping: authentication → 503 `ASSISTANT_UNAVAILABLE`, rate limit → 503 `ASSISTANT_BUSY`, connection → 503, other API errors → 502 `ASSISTANT_ERROR`.

## Tests

`npm test` — Node's built-in runner (`node --test`) with supertest against the real Express app and a **dedicated `smart_market_test` database** (created and migrated automatically by `npm run pretest`; derived from `DATABASE_URL`, or set `TEST_DATABASE_URL`). Redis database 9 is used and flushed between files (`TEST_REDIS_URL` to change); rate limits are disabled and every provider (K-Pay, Resend, Sentry, Claude) is pointed at a closed port so nothing external is ever called. Files run one at a time (`--test-concurrency=1`) because they share the database.

What is covered (`test/*.test.js`, ~40 tests): registration/login/refresh rotation + replay detection + logout + suspended accounts; role matrix (customer vs customer service vs accountant vs super admin, strict outranking, self-action guard); order → payment → escrow (idempotent webhook), dual confirmation, concurrent double-release, disputes, refund creation, payout webhook signature/replay; subscription quota including the last-slot race; withdrawals (reservation, insufficient balance, concurrent spend, provider rejection, FAILED webhook refund); background jobs (expiry + notices, stale payments, audit retention, view-count flush); public catalogue visibility rules, search/deals/price/category roll-up, hero rail, store ratings; health, request ids, assistant offline path, support inbox.

## Observability

- **Structured logs** — `pino` via `src/config/logger.js` (JSON in production, pretty in development, `LOG_LEVEL` to tune). Every request gets an id (`x-request-id`, honoured if a proxy sends one, echoed on the response, included in every error JSON as `requestId`) and one access-log line with method, URL, status, duration and user id (`src/middlewares/requestContext.js`). Passwords, tokens and PINs are redacted. `console.*` is gone from `src/`.
- **Error tracking** — `@sentry/node` behind `SENTRY_DSN` (`src/config/sentry.js`). Unset = no-op. Captures unhandled request errors, unhandled rejections, uncaught exceptions and failed background jobs.
- **Health** — `GET /api/health` checks Postgres (mandatory → 503 `down`) and Redis (optional → 200 `degraded`) with timeouts and reports uptime/version; `GET /api/health/live` is the cheap liveness probe.
- **Cache visibility** — `cache.service` logs every hit/miss at debug level (`result: "hit"|"miss"`), so a suspiciously slow endpoint can be checked in one grep.

## Background jobs

`src/jobs/` — a small in-process scheduler (`scheduler.js`). Each instance ticks each job on its interval; a Redis `SET NX PX` lock makes sure only one instance behind the load balancer runs it per period (Redis down → runs without the lock; every job is idempotent). Last outcome per job is stored in Redis and shown in the back-office (`GET /admin/jobs`, `POST /admin/jobs/:name/run` for super admins, which bypasses the lock). `JOBS_ENABLED=false` disables them on an instance.

| Job | Every | What it does |
|---|---|---|
| `subscription-expiry` | 15 min | ACTIVE plans past `expiresAt` → `EXPIRED` + `SUBSCRIPTION_EXPIRED` notice (with the number of listings that just went invisible); plans expiring within 3 days get one `SUBSCRIPTION_EXPIRING` notice (`expiryNoticeSentAt`). |
| `stale-payments` | 10 min | PENDING/PROCESSING payments older than 30 min are re-checked with K-Pay; anything unconfirmed after `PAYMENT_EXPIRY_HOURS` (2) is CANCELLED, and a subscription checkout whose payment died is CANCELLED too. |
| `payout-status` | 5 min | Polls K-Pay for withdrawals and refunds still in flight (a missed webhook can't leave money "processing" forever). |
| `view-counts` | 1 min | Flushes the Redis view counters (`ads:views`, `HINCRBY` per detail view) into `viewCount` — one write per listing per minute instead of one per page view. |
| `audit-retention` | 24 h | Deletes audit rows older than `AUDIT_LOG_RETENTION_DAYS` (365, never under 30). |

## Cash on delivery

A second payment method next to Mobile Money escrow. `Order.paymentMethod` is `MOBILE_MONEY` (default) or `CASH_ON_DELIVERY`; stores opt in/out with `Store.acceptsCashOnDelivery` (default on, editable from the seller store settings and exposed on every listing payload).

- `POST /orders` with `paymentMethod: "CASH_ON_DELIVERY"` requires `deliveryAddress` and `deliveryPhone` and the store's opt-in (`422 COD_NOT_ACCEPTED` otherwise). The order is created directly as **CONFIRMED**: no payment row, no escrow. Buyer gets `ORDER_CONFIRMED`, seller gets `NEW_ORDER`.
- Handover works like an escrow order — seller confirms delivery (and that cash was received), buyer confirms receipt — but completion flips CONFIRMED → COMPLETED without touching the wallet. Reviews work as usual.
- `POST /orders/:id/pay` and `POST /orders/:id/dispute` are refused on cash orders (`409`). Instead, either side can cancel with `POST /orders/:id/cancel` until the seller confirms delivery (also lets a buyer cancel an unpaid Mobile Money order with no payment in flight). Cancellation stores `cancelledBy`/`cancelReason` and notifies the other party (`ORDER_CANCELLED`).
- Delivery details are optional on Mobile Money orders and shown to the seller when present.
- Tests: `test/cash-on-delivery.test.js`.

## Buyer refunds (real money)

`src/services/refund.service.js`. When staff settle a dispute in the buyer's favour, escrow and order flip to REFUNDED and one `Refund` row is created per order (`refunds` table) and paid through K-Pay's payout API from the platform wallet, to the operator + number the buyer paid with (`payments.operator` is stored since this change). K-Pay reports the outcome through the same webhook as withdrawals (`externalId` prefix `rf-` vs `wd-`) or the `payout-status` job. A payout the provider refuses is stored as FAILED with the reason; finance staff (`FINANCE` roles) can correct the operator/number and retry (`POST /refunds/:id/retry`), check status (`GET /refunds/:id/refresh`) and list refunds (`GET /refunds`); the dispute resolution itself never rolls back. Buyers get `REFUND_SENT` / `REFUND_FAILED` notifications and see the refund status on their order page.

## Performance notes

- Public listing pages (`GET /advertisements` with any filter) are cached in Redis for 45 s (`ads:list:*`) and busted on every seller/staff write, store suspension, plan activation and plan expiry. The hero rail was already cached.
- `visibilityFilter()` now also requires `store.status = ACTIVE`, so suspending a store hides its listings immediately.
- Load test (autocannon, 100 connections, 15 s, dev laptop, dedicated instance on :5001 with the general rate limit lifted) — see `docs/Load_Test_2026-09-23.md` for before/after numbers.

## Roles & permissions

Defined once in `src/utils/roles.js`; every route references a named group, never an inline role list.

| Capability | SUPER_ADMIN | ACCOUNTANT | CUSTOMER_SERVICE |
|---|:-:|:-:|:-:|
| Create staff accounts (`POST /users/staff`), change roles | ✅ | — | — |
| View users, orders, disputes, audit logs, all plans | ✅ | ✅ | ✅ |
| Suspend/ban users, suspend stores, archive/feature listings, manage categories & plans, work disputes | ✅ | — | ✅ |
| View all payments & withdrawals | ✅ | ✅ | — |
| **Validate escrow** — release to seller / refund buyer | ✅ | ✅ | — |

Groups: `STAFF` (all three), `OPERATIONS` (Super Admin + Customer Service), `FINANCE` /
`ESCROW_VALIDATORS` (Super Admin + Accountant). Customer Service can do everything *except* touch
money. Nobody, including staff, can initiate a payment or withdrawal on someone else's behalf —
those endpoints are self-scoped by construction.

**Rank guard** (`user.service.js#assertCanActOn`): a staff member can only act on an account they
strictly outrank, and never on themselves. This closed a real hole — previously any Customer Service
account could suspend the Super Admin. The last active Super Admin can't be suspended or demoted.

## Audit trail

`audit_logs` records who did what, to which record, from which IP/user-agent — every
state-changing action across the API (registrations, logins **and failed logins**, status/role
changes, staff creation, store/listing/category/plan changes, orders, confirmations, disputes,
escrow releases/refunds, withdrawals) plus `SYSTEM` entries for webhook-driven changes (payment
completed, subscription activated, escrow held, payout completed/failed).

```
GET /api/audit-logs   STAFF — ?actorId=&action=&entityType=&entityId=&from=ISO&to=ISO&page=&pageSize=
```

Writes are fire-and-forget (`services/audit.service.js`): they never add a DB round trip to the
request they describe, and a failed log write never fails the action. **Reads are deliberately not
logged** — at hundreds of concurrent users that's a Postgres write per page view; that's what HTTP
access logs / log aggregation are for. Retention isn't automated yet — the table will grow until a
cleanup/partitioning policy is added.

## Security, performance & logic audit (2026-09-22)

Findings from a read-through, each fixed and verified against the running app:

**Security**
- Privilege escalation: Customer Service could suspend the Super Admin → rank guard (above).
- Upload validation trusted the client-supplied mimetype → now checks the file's magic bytes
  (`storage.service.js#detectImageType`); a text file labelled `image/png` is rejected with 422.
- 500 responses echoed internal error messages (Prisma constraint names etc.) → generic message in
  production, Prisma `P2002`/`P2025` mapped to clean 409/404.
- K-Pay's own `401` was passed through to the client as a 401 → now 502 (a frontend would otherwise
  log the user out over a provider misconfiguration).
- Sensitive actions (open a store, checkout, pay, withdraw) now require a verified email.
- Per-IP upload rate limit (`uploadRateLimiter`) — 8 × 5MB in-memory buffers per request was a cheap
  memory-exhaustion vector.

**Performance (target: 500+ concurrent users)**
- The per-request user lookup in `authenticate` — the single hottest query in the app — is cached in
  Redis for 60s. Every status/role/verification/Google-link change busts the key, so "takes effect
  immediately" still holds; verified: a suspension returns 401 on the very next request.
- Outbound `fetch` to K-Pay and Google had **no timeout** — a provider outage would have pinned open
  sockets and pool connections until the process fell over. Now 10s, and a timeout is retried.
- Graceful shutdown on SIGTERM (in-flight requests finish, DB/Redis closed), `unhandledRejection`
  backstop (Node ≥15 otherwise crashes the whole process on one stray rejection), keep-alive timeout
  raised above a typical load balancer's idle timeout (prevents random 502s), gzip via `compression`.

**Logic**
- Ad quota check was check-then-act → conditional `updateMany` (verified: 5 concurrent publishes
  into 2 free slots → exactly 2 succeed, counter lands exactly on the cap).
- An abandoned Mobile Money prompt stays `PENDING` forever with no webhook (per K-Pay's docs), which
  locked a seller out of subscribing / a buyer out of retrying **permanently** → pending attempts
  older than 30 min are re-checked live, then written off so a new attempt can proceed.
- Orders could be placed against a listing whose store had lapsed or been suspended → order creation
  now uses the same visibility rule as public browsing.
- Withdrawal minimum (100 XAF, K-Pay's floor) validated up front.

**Known gaps, deliberately not silently "fixed"**: platform commission is still not deducted on
escrow release (the Cahier de Charges calls for it — needs a business decision on the rate);
buyer refunds still don't trigger a real K-Pay payout; `viewCount` is a write per detail view.

## Scalability (for hundreds–~1000 concurrent users)

**Indexes**: every field that's actually filtered on in a hot path now has one —
`Advertisement.status`, `Store.status`, `Category.parentId`, `Order.status`, `Dispute.status`, and a
composite `Subscription(storeId, status, expiresAt)` that covers both the active-subscription checks
(publish, hero, order confirm) and the nested `EXISTS` Prisma generates for every visibility filter.

**Connection pool**: explicit and configurable (`DB_POOL_MAX` etc. in `.env`), not left at the pg
driver's own default. With N app instances each holding up to `DB_POOL_MAX` connections, total
connections across all of them must stay under Postgres's own `max_connections` — size it with that
in mind once you know how many instances you're running.

**Caching (Redis)** — `services/cache.service.js`, a `getOrSet(key, ttlSeconds, fetchFn)` cache-aside
helper, applied to the three read paths that are both hit constantly and change rarely:
- Categories (60s TTL) — `services/category.service.js`
- Subscription plans (300s TTL — pricing tiers change even less often) — `services/subscriptionPlan.service.js`
- The hero feed (20s TTL — deliberately short, it's meant to feel live) — `services/advertisement.service.js`

Every write to one of these busts its whole cache namespace immediately (`cacheService.invalidatePrefix`)
rather than waiting out the TTL, so an admin's edit is visible right away, not up to a minute later.
**Caching is a pure optimization, never a hard dependency** — verified directly: with no Redis running
at all, every one of these endpoints still returns 200 with correct data, just uncached (Redis errors
are caught and logged, never thrown to the caller). `config/redis.js` has the reasoning on why
(`enableOfflineQueue: false` + `maxRetriesPerRequest: 1`, so a down Redis fails a cache lookup in
milliseconds instead of hanging the request).

**Rate limiting** now uses a Redis-backed store (`rate-limit-redis`) instead of express-rate-limit's
default in-memory one — the earlier version counted attempts separately per Node process, so running
more than one instance behind a load balancer silently multiplied the effective limit. Same fail-open
principle applies here too (`passOnStoreError: true`, express-rate-limit's own built-in escape hatch):
a Redis outage means requests go briefly unrate-limited, never that login/register start 500ing.

**K-Pay retry logic** — `services/kpay.service.js#request` now retries a transient failure (network
error, 5xx, 429) up to 3 attempts with exponential backoff + jitter, and never retries a 4xx (400/401/
403/409/422) since those are deterministic — retrying the same bad request just wastes K-Pay's 100
req/min budget. This is safe to do automatically because every write call already carries a caller-
supplied `externalId`, which is exactly K-Pay's own idempotency key — a retry with the same
`externalId` is the same request, not a duplicate one.

**Pagination**: audited every `GET` list endpoint. All user-generated-content listings
(advertisements, stores, orders, disputes, users, withdrawals, categories) are `page`/`pageSize`
paginated. `subscription-plans` is deliberately *not* page-based — it's admin-curated platform
configuration (a handful of pricing tiers, not user content) meant to render as one pricing table —
but still has a hard `take: 100` cap so it's never a truly unbounded query. The hero feed is a
bounded "top N" feed (`take`, capped at 30 in the controller), not a paginated list, by design.

**Images**: already effectively CDN-delivered — Cloudflare R2's public `*.r2.dev` domain is served
through Cloudflare's edge network, so a second viewer loading the same product photo doesn't refetch
it from an origin server.

**Not done this pass**: horizontal scaling itself (running N instances behind a load balancer) — the
app is stateless enough to support it today (JWT auth, refresh tokens and rate limits both live in
shared stores now, not in-process memory), but nothing here spins up multiple instances or a load
balancer.

## Docker

Production: `docker-compose.prod.yml` at the repository root runs Redis, this API, the Next frontend and Caddy (automatic HTTPS, `/api/*` → backend, everything else → frontend, one origin so cookies stay same-site). Runbook, DNS, Postgres-on-host and env templates: `deploy/README.md`, `deploy/compose.env.example`, `deploy/backend.env.example`.

### Local/staging compose

```bash
docker compose up --build   # from the project root (E:\projects\smart_market), not backend/
```

Builds and runs the backend (`Dockerfile`, multi-stage: `npm ci` → `prisma generate` → non-root
runtime user) plus a Redis container. **PostgreSQL is not containerized** — the backend container
reaches your local Postgres via `host.docker.internal` instead of `localhost` (inside a container,
`localhost` means the container itself). Real DB credentials for the container go in a root-level
`.env` (`DOCKER_DATABASE_URL=...`, gitignored — see the project root's `.env.example`), never in
`docker-compose.yml` itself since that file is meant to be committed.

On container start, `docker-entrypoint.sh` runs `prisma migrate deploy` before the server starts —
fine for a single instance or a small fixed number of replicas starting together (migrations track
what's already applied, so a late starter just sees "nothing to do"); for a larger fleet, prefer
running that as a one-off release step instead.

**Not build-tested against a live Docker daemon this pass** (explicitly asked not to launch Docker
locally while building this) — verified everything short of that: confirmed `prisma generate` needs
`DATABASE_URL` resolvable to *something* even though it never connects to a database (caught this by
temporarily removing `.env` and reproducing the exact error `prisma.config.js` would hit inside the
build), and fixed it with a placeholder `ENV DATABASE_URL=...` right before the `RUN npx prisma
generate` step — the real value from `docker-compose.yml`'s `environment:` block overrides it the
moment the container actually starts.

## Getting started

```bash
npm install
cp .env.example .env
```

Update `.env` with your local PostgreSQL credentials (a `smart_market` database must exist —
create it once with `createdb smart_market` or via pgAdmin). Redis is optional for local dev — the
app runs fine without it, just uncached; set `REDIS_URL` if you have one running locally.

```bash
npm run prisma:generate   # generate the Prisma client (re-run after any schema.prisma change)
npm run prisma:migrate    # apply schema changes to the database
npm run dev                # start the API on http://localhost:5000 (nodemon)
```

Health check: `GET /api/health`. Auth endpoints: see above.

## Search suggestions (typeahead)

`GET /api/search/suggest?q=<text>` powers the instant dropdown under the header search bar. It
returns at most 5 publicly visible listings (title, slug, price, first image, category), 3
categories and 3 active stores whose names contain the text, case-insensitively. Queries
shorter than 2 characters return empty lists; longer than 80 characters are truncated. Results
are cached in Redis for 30 seconds per normalised query and the response carries
`Cache-Control: public, max-age=15`. Tested in `test/search-suggest.test.js`.

## Flash-deal campaigns

Back-office driven promotions (`src/services/flashCampaign.service.js`, job `flash-campaigns`):

1. Operations staff create a campaign (`POST /api/flash-campaigns`: name, dates, minimum
   discount %, applications open) and publish it (`POST /api/flash-campaigns/:id/publish`).
2. Sellers see open campaigns (`GET /api/flash-campaigns/open`) and apply with a listing and a
   campaign price (`POST /api/flash-campaigns/:id/applications`); the price must be at least
   the campaign's minimum discount below the listing's current price. Staff can also add a
   listing directly (`POST /api/flash-campaigns/:id/items`, approved at once).
3. Staff approve or reject applications (`PATCH /api/flash-campaigns/:id/items/:itemId`, with an
   optional corrected price and a note); the seller is notified.
4. The `flash-campaigns` job (every 30 seconds) applies approved campaign prices when the start
   time passes: the listing's price becomes the campaign price and its previous price becomes
   the "was" price, so the ordinary deal badge and `/deals` filter apply. While applied, the
   seller cannot edit that listing's price (`409 FLASH_PRICE_LOCKED`). When the end time passes
   (or the campaign is cancelled), every price is restored.
5. The storefront reads `GET /api/flash-campaigns/current` (active campaign with its live items,
   cached 20 s) and `GET /api/flash-campaigns/upcoming` (next scheduled one).

Tested in `test/flash-campaigns.test.js`.
