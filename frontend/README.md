# Smart Market — Frontend

Next.js 16 (App Router, TypeScript, Turbopack) · Tailwind v4 · shadcn/ui (base-nova) · Motion · next-intl · PWA.

```bash
npm install
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm run dev -- -p 3020            # http://localhost:3020  (English)  ·  http://localhost:3020/fr  (French)
npm run build && npm start
```

Checks: `npx tsc --noEmit` · `npx eslint .`

## Structure

```
messages/                 en.json · fr.json — every user-facing string, by namespace
src/app/[locale]/         one folder per route (see "Routes" below) · layout.tsx (fonts, theme, i18n, providers, PWA)
src/app/manifest.ts       PWA manifest (served at /manifest.webmanifest)
src/app/globals.css       design tokens (light palette + dark palette), fonts, shadcn variables
src/proxy.ts              next-intl locale routing (Next 16 "proxy", formerly middleware)
src/i18n/                 routing.ts (locales, "as-needed" prefix) · navigation.ts (Link/useRouter) · request.ts
src/features/
  auth/AuthProvider.tsx   session: access token in memory, refresh cookie owned by the API, authFetch() with one retry
  cart/                   localStorage-backed cart (useLocalStorageState → useSyncExternalStore, hydration-safe)
  wishlist/               same local cache, mirrored to the account's server list once signed in (merge at sign-in, PUT/DELETE per toggle)
  notifications/          href + template values for each notification type
  catalog/api.ts          server fetchers: listProducts / getProduct / categories / stores / plans (+ revalidate windows)
  home/getHomeData.ts     home sections, demo top-up when the database is empty
src/content/              bilingual long-form content: help.ts (how-it-works, seller guide, returns, FAQ), company.ts (about), legal.ts
src/lib/                  api.ts (fetch wrapper + ApiRequestError) · format.ts (XAF prices, dates, discounts) · search-params.ts · motion.ts · local-store.ts
src/components/
  layout/                 Header (sticky, account menu, live cart/wishlist badges, mobile Sheet) · Footer · PageShell · SearchBar
  home/                   Hero (4-slide swipe carousel) · CategoryGrid · TrendingProducts · FeaturedStores · SellerCTA · EscrowFlow
  marketplace/            ProductCard · ProductGrid · ProductListing · ProductFilters (URL-driven) · ProductGallery · BuyBox · CategoryCard/Chips · StoreCard · StoreHeader · StoreReviews
  auth/                   AuthCard · LoginForm · RegisterForm · VerifyEmailForm · PasswordResetForms · GoogleCallback · RequireAuth
  checkout/CheckoutFlow   order → Mobile Money prompt → polling → success/failure
  orders/                 OrdersView (list, lookup, confirm receipt, dispute) · OrderDetail (timeline, payment, dispute history, review form)
  account/                AccountNav · AccountOverview · ProfileForms
  notifications/          NotificationBell (header, polls unread count) · NotificationsView (inbox, localized by type)
  seller/                 SellerShell (sign-in + store gate + nav) · StoreForm/StoreSettings · SellerDashboard · ListingsView · ListingForm/ListingEditor · SellerOrdersView · SubscriptionView · WalletView · MobileMoneyPayment (shared USSD prompt + polling)
  cart/ · wishlist/       page views
  content/                ContentPage (long-form layout) · FaqAccordion
  subscriptions/PlanCard  · seller/SellCta · search/SearchResults · support/ContactForm
  trust/ · chatbot/ · pwa/ · motion/ · ui/ (shadcn primitives + Breadcrumbs, Pagination, EmptyState, PageHero, SectionHeading…)
public/                   logo.png · logo-icon.png · icons/ (PWA) · apple-touch-icon.png · sw.js
```

## Routes

| Area | Routes | Data |
|---|---|---|
| Discovery | `/` · `/categories` · `/categories/[slug]` · `/products` · `/products/[slug]` · `/search?q=` · `/deals` · `/new-arrivals` | `GET /categories`, `/advertisements` (+ `categorySlug`, `sort`, `minPrice`, `maxPrice`, `condition`, `location`, `deals`, `search`), `/advertisements/hero` |
| Stores | `/stores` · `/stores/[slug]` | `GET /stores`, `/stores/:slug`, `/advertisements?storeId=` |
| Selling | `/sell` · `/subscriptions` · `/seller-guide` | `GET /subscription-plans` |
| Auth | `/login` · `/register` · `/verify-email` · `/forgot-password` · `/reset-password` · `/auth/callback` | `POST /auth/*`, Google via `GET /auth/google` |
| Buying | `/cart` · `/wishlist` · `/checkout/[slug]` | `POST /orders`, `/orders/:id/pay`, `GET /wishlist` + `PUT/DELETE /wishlist/:id` + `POST /wishlist/merge` |
| Account | `/account` · `/account/orders` · `/account/orders/[id]` · `/account/notifications` · `/account/profile` (`/orders/track` redirects to the orders list) | `GET /orders/me`, `/orders/:id`, confirm-receipt, dispute, `POST /orders/:id/review`, `GET/PATCH /notifications*`, `PATCH /users/me`, `/users/me/password` |
| Seller area | `/seller` · `/seller/onboarding` · `/seller/store` · `/seller/listings` · `/seller/listings/new` · `/seller/listings/[id]/edit` · `/seller/orders` · `/seller/orders/[id]` · `/seller/subscription` · `/seller/wallet` | `GET /stores/me` (dashboard aggregate), `POST /stores` + `PATCH /stores/me` (multipart logo/banner), `GET /advertisements/me[/:id]`, `POST /advertisements` + `PATCH /:id` (multipart images), publish/archive/feature, `GET /orders/store`, confirm-delivery, `GET /subscriptions/me`, `POST /subscriptions/checkout` + `/:id/refresh`, `POST /withdrawals`, `GET /withdrawals/me` + `/:id/refresh` |
| Admin back-office | `/admin` · `/admin/orders[/[id]]` · `/admin/disputes[/[id]]` · `/admin/payments` · `/admin/withdrawals` · `/admin/users` · `/admin/stores` · `/admin/listings` · `/admin/categories` · `/admin/plans` · `/admin/support` · `/admin/audit` | `GET /admin/stats`, `/audit-logs`, `/users` (+ `POST /users/staff`, `PATCH /:id/status`, `/:id/role`), `/stores/all` + `PATCH /stores/:id/status`, `/advertisements/all` + feature/unfeature/archive, `/categories` CRUD (multipart image), `/subscription-plans/all` CRUD, `/orders`, `/payments`, `/withdrawals`, `/disputes[/:id]` + `PATCH`, release-to-seller, refund-buyer, `/support/messages` + `PATCH /:id/handled`, `/support/subscribers` |
| Help & company | `/help/faq` · `/help/returns` · `/help/contact` · `/how-it-works` · `/about` · `/legal/terms` · `/legal/privacy` | `POST /support/contact`, `/support/newsletter` |

Listing pages read their filters from the URL (`?sort=price_asc&condition=NEW&minPrice=&maxPrice=&location=&page=`), so every result set is shareable and server-rendered.

## Design tokens

Components never use raw hex values — only semantic Tailwind classes generated from `globals.css`:

| Class | Light (Coolors palette) | Dark (design-system doc) |
|---|---|---|
| `bg-background` | `#FDFDFD` | `#070B12` |
| `bg-surface` / `-elevated` / `-hover` | `#FEFEFE` / `#FFFFFF` / `#EEF6FC` | `#0D131D` / `#121A26` / `#172131` |
| `text-foreground` / `-secondary` / `-muted` | `#1F2D4D` / `#4B6186` / `#7B8BA8` | `#F8FAFC` / `#AAB4C3` / `#6F7B8C` |
| `brand-blue` (primary) | `#4B6186` | `#087CF0` |
| `brand-orange` (conversion CTAs) | `#EFA732` | `#FF7A00` |
| `brand-sky` (accent surface) | `#D4ECFA` | `#163A5C` |

Dark mode is the `.dark` class on `<html>` (next-themes, follows the OS by default; `ThemeToggle` overrides).

## Typography

| Role | Font | Class |
|---|---|---|
| Paragraphs / UI | Montserrat | `font-sans` (default) |
| H1 | Changa One | `font-display` (applied to `h1` globally) |
| H2 | Share Tech | `font-heading` (applied to `h2` globally) |
| H3 | Lobster Two | `font-accent` (applied to `h3` globally; opt out with `font-sans`) |
| Prices & product descriptions | Satisfy | `font-script` |

All loaded with `next/font/google` in `src/app/[locale]/layout.tsx` (self-hosted, no layout shift).

## Internationalisation

- English at `/`, French at `/fr/...` (`localePrefix: "as-needed"`). The proxy detects the browser language on first visit.
- Always import `Link`, `useRouter`, `usePathname` from `@/i18n/navigation`, never from `next/link` / `next/navigation`.
- Server components: `const t = await getTranslations("ns")`. Client components: `const t = useTranslations("ns")`.
- Add a key to **both** `messages/en.json` and `messages/fr.json`; ICU plurals are supported (`{count, plural, …}`).
- Prices: `formatPrice(amount, locale)` → `XAF 120,000` (en) / `120 000 FCFA` (fr).

## PWA

- Manifest: `src/app/manifest.ts`; icons generated from `public/logo-icon.png` (`icons/icon-*.png` any, `icons/maskable-*.png`).
- Service worker `public/sw.js`: stale-while-revalidate for images/fonts/icons only, network-only for HTML/JS/CSS/API, so a deploy is never masked by a stale cache. Registered in production only (set `NEXT_PUBLIC_SW_DEV=true` to test locally).
- `InstallPrompt`: on the first visit, Chromium browsers get the native install prompt (via `beforeinstallprompt`), iOS Safari gets the "Share → Add to Home Screen" hint. Dismissal is remembered for 14 days (`localStorage` key `sm:install-dismissed-at`). Never shown when already running installed.

## Data

All catalog pages call the Express API from the server through `src/features/catalog/api.ts` (30–60 s revalidation). `getHomeData()` calls the backend (`categories`, `advertisements/hero`, `advertisements`, `stores`) with a 3 s timeout and 60 s revalidation. If the backend is down or a section has too few rows, editorial placeholders from `src/lib/demo-data.ts` (ids prefixed `demo-`, Unsplash photography) top it up — real rows always come first and duplicates by slug/name are skipped. Real rows without an image fall back to a category photo.

## Auth model (client)

`AuthProvider` keeps the access token in memory only. The API sets an httpOnly refresh cookie; on load the provider calls `POST /auth/refresh` (only when a previous sign-in left the `sm:has-session` hint in localStorage), and `authFetch()` retries once after a transparent refresh on 401. `RequireAuth` wraps account pages and shows a sign-in card with a `?next=` return path.

## Notifications

The API writes a notification row on every business event (payment confirmed, new order, delivery/receipt confirmed, escrow released, dispute opened/resolved, refund, withdrawal outcome, subscription activated, review received). Rows carry `type` + `data`; the frontend renders `messages.notifications.types.<TYPE>` with those values so the inbox is bilingual. `NotificationBell` polls `/notifications/unread-count` once a minute.

## Reviews

A buyer can review a store once per **completed** order (`POST /orders/:id/review`). Store rating/count are aggregated by the API on `GET /stores` and `GET /stores/:slug`; the store page lists reviews from `GET /stores/:slug/reviews`.

## Seller area

`SellerShell` gates every `/seller/*` page: sign-in first, then a store (`/seller/onboarding` creates one — multipart with logo/banner). `GET /stores/me` returns the dashboard aggregate (wallet, active plan with quota, listing/order counts, rating). Listings are created as drafts (up to 8 photos uploaded to R2) and published against the plan quota; Business/Premium sellers can feature a listing in the hero. Plan checkout and withdrawals use `MobileMoneyPayment` / the wallet form: the API starts a K-Pay USSD prompt and the page polls `…/refresh` until it settles.

## Admin back-office

`AdminShell` gates every `/admin/*` page: sign-in first, then a staff role (`SUPER_ADMIN`, `ACCOUNTANT`, `CUSTOMER_SERVICE` — anyone else sees a "staff only" card). Role helpers live in `features/admin/roles.ts` and mirror the API's `utils/roles.js`: the sidebar hides Payments/Withdrawals from customer service, only super admins see "Create staff account" and the role selector, and the dispute page shows a lock instead of the release/refund buttons for anyone who cannot move escrowed money. The API stays the source of truth — a forbidden request renders its error message in place of the table.

Lists are fetched client-side with the access token through `useAdminList` (filters → page reset, `reload()` after a mutation). `AdminTable` is a real `<table>` from `md` up and a stacked definition-list card below, so every screen works on a phone. Create/edit forms (categories with image upload, plans, staff accounts) open in a side sheet; destructive actions ask for confirmation. The order detail page is the same `OrderDetail` component as the buyer/seller views with `perspective="admin"`.

## Home hero carousel

`components/home/Hero.tsx` is a four-slide carousel (marketplace, deals, sell, escrow). The track moves in pixels on a Motion value so drag constraints line up with slide edges: swipe/drag on touch and mouse, previous/next buttons, dot tabs with an autoplay progress bar (6.5 s, pauses on hover, while dragging, when the tab is hidden, on the pause button, and entirely under `prefers-reduced-motion`), and arrow keys. Inactive slides are `aria-hidden` + `inert` so their links are not tabbable; a polite live region announces "Slide n of 4". Copy lives under `hero.slides.*` in both catalogs; the deals slide reads real discounts from the hero products and the marketplace slide keeps the original product/trust cards.

## Chat assistant

`components/chatbot/ChatLauncher.tsx` talks to `POST /assistant/chat` (stateless: it sends the last 12 turns plus the locale, with the bearer token when signed in so the model can read the user's orders). The reply comes back as text plus `products` / `orders` cards that the widget renders as real links. `GET /assistant/status` tells the widget whether a model key is configured; when it is not, the panel shows an offline notice and keeps the shortcut chips. 503/429 from the API are shown inline as error bubbles.

Refunds: `admin/payments` has a Refunds tab (finance roles) listing every buyer refund with its payout status, a retry sheet (operator + number) and a status check; the dispute page shows the same card; buyers see a "Refund" panel on their order page. Background jobs: the admin dashboard lists the housekeeping jobs with their last outcome and a "Run now" button for super admins.

## Tests

`npm test` runs Vitest (`src/**/*.test.ts`): the SEO helper (paths, hreflang, canonical, Open Graph), search-param parsing and notification routing/values. Type-check with `npx tsc --noEmit`, lint with `npm run lint`; CI (`.github/workflows/ci.yml`) runs lint, types, tests and the production build, plus the backend suite against Postgres and Redis services.

## SEO

`src/lib/seo.ts` builds what every indexable page needs from one call — `seo(locale, "/path", { title, description }, { images, noIndex })` — canonical URL, hreflang (`en`, `fr`, `x-default`), Open Graph and Twitter cards, all absolute thanks to `NEXT_PUBLIC_SITE_URL`. `src/app/sitemap.ts` lists static routes plus every category, published listing and store (hourly ISR); `src/app/robots.ts` blocks private/transactional pages. `components/seo/JsonLd.tsx` emits schema.org data: WebSite + Organization on the home page, Product + Offer + BreadcrumbList on listings, Store on store pages. Page-by-page status: `docs/SEO_Audit_2026-09-23.md`.

## Docker

`Dockerfile` builds the standalone Next server (multi-stage, non-root, `/healthz` healthcheck). `NEXT_PUBLIC_*` values are build args because they are inlined into the browser bundle; `API_INTERNAL_URL` (run time) lets server-side rendering reach the backend over the compose network. See the root `docker-compose.yml` (local/staging) and `docker-compose.prod.yml` + `deploy/README.md` (production with Caddy HTTPS).

Cash on delivery: the checkout offers Mobile Money (escrow) or cash at handover when the store allows it (delivery address + phone required for cash); order pages show the method, delivery details, a cancel button until the seller confirms delivery, and a cash-specific timeline; sellers toggle the option in store settings and see the amount to collect on each order; listing pages show a "Cash on delivery available" badge.

## Adding a page

1. Create `src/app/[locale]/<route>/page.tsx`; call `setRequestLocale(locale)` first for static rendering.
2. Use `<Header />`, `<Container>` and the existing sections/cards; keep every string in `messages/`.
3. Verify at 375 px, 768 px and 1280 px in both themes; the page must never scroll horizontally.
