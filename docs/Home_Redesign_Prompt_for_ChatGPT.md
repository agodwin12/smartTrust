# Prompt for ChatGPT — Smart Market home page redesign (5 concepts)

Copy everything below the line into ChatGPT. Paste its answer back here and the chosen concept
will be implemented on the existing frontend without any backend change.

---

You are a senior e-commerce product designer. Design **five distinct home page concepts** for
**Smart Market** ("Smarttrustexpress"), a multi-vendor marketplace in Cameroon, taking
**Amazon, Jumia and Oraimo** (and other popular marketplaces) as references. I will implement
the concept I pick, so the output must be a precise, implementable specification, not mood
boards.

## 1. The product

- Marketplace where independent stores sell new and used items. Every purchase is paid with
  **MTN Mobile Money or Orange Money** into **escrow**; the seller is paid only after the
  buyer confirms receipt. This escrow guarantee is the brand's main promise and must stay
  visible on the home page.
- Audience: Cameroonian shoppers on mid-range Android phones (mobile first, often slow
  networks) and desktop users; sellers are small businesses and individuals.
- Languages: English and French. Every text you propose must be given in both.
- Prices are in FCFA (XAF), no decimals.

## 2. Hard constraints (do not break these)

1. **No backend changes.** The page can only use the data that already exists (listed in §3).
   Do not invent widgets that need data we do not have (no "1,000,000 customers", no fake
   reviews, no countdown timers unless tied to real listing data, no personalised
   recommendations beyond what §3 allows).
2. **Existing tech and design system stays**: Next.js 16 App Router, Tailwind CSS v4,
   shadcn/ui components, lucide-react icons, Motion for animation.
   - Light palette: background #FDFDFD, surface #FEFEFE, sky accent #D4ECFA, primary blue
     #4B6186, accent orange #EFA732. A dark mode exists; every proposal must work in both.
   - Fonts already loaded: Montserrat (body), Share Tech (h2), Changa One (h1), Lobster Two
     (h3), Satisfy (prices and product descriptions).
   - **No emojis anywhere**; icons are lucide icons, imagery is real product/category photos.
3. **100% responsive**: describe the mobile layout (360–430 px) and the desktop layout
   (≥1280 px) for every section; tablet may reuse either.
4. Keep these existing elements, restyled if you like: sticky header with search, language
   switch EN/FR, theme toggle, cart and wishlist icons, "Become a seller" button; footer;
   floating chat assistant button; PWA install prompt on first visit.
5. Accessibility: visible focus states, contrast AA, tap targets ≥ 44 px, no text in images.
6. Performance: at most one large hero image per viewport; product photos lazy-loaded.

## 3. Data the home page can already use (backend endpoints exist)

| Data | What it contains | Notes |
|---|---|---|
| Categories (root + sub-categories) | name, slug, image, listing count | 10 roots, 28 sub-categories |
| Hero / featured listings | listings paid to be featured, up to 12 | title, price, compare-at price, photos, store name, condition, location |
| Newest listings | paginated, sortable by newest / price / popularity | same fields as above |
| Deals | listings with a compare-at price (discount %) | can be sorted by popularity |
| Search | free text + category / price / condition / location filters | `/search?q=` page exists |
| Stores | name, slug, logo, banner, location, rating, review count, listing count | rating only when reviews exist |
| Subscription plans | Starter / Business / Premium name, price, quota | for the seller call-to-action |
| Buyer state (browser only) | cart count, wishlist, recently viewed listings (can be added client-side in localStorage), signed-in name | no server "recommended for you" |
| Escrow steps | pay → held → seller delivers → buyer confirms → seller paid | static content, illustrated |

There are **no**: flash-sale schedules, brand pages, vouchers/coupons, sponsored slots,
customer-count statistics, product-level reviews (ratings are per store).

## 4. What already exists on the home page (to be replaced or reorganised)

Hero carousel (4 slides), trust strip (escrow / verified sellers / secure payments / buyer
protection), category grid, trending products rail, featured stores, seller call-to-action,
"how escrow works" section, newsletter in the footer.

## 5. What I want from you

Produce **five concepts**, each clearly different in structure (not five colour variations).
Suggested starting points, adapt freely:

1. **Amazon-dense**: mega-menu category rail under the header, multi-card promotional grid
   above the fold, many horizontal product rails, "continue where you left off" from recently
   viewed, compact footer.
2. **Jumia-style**: left category sidebar on desktop, wide promo banner slider, flash-deal
   block, icon strip of departments on mobile, sticky bottom nav on mobile.
3. **Oraimo-style brand storytelling**: bold full-width hero with one featured product, few
   sections, big typography, trust-first.
4. **Deal-first**: discount rail on top, price-tiered blocks ("under 10,000 FCFA", "under
   50,000 FCFA"), category tiles by demand.
5. **Seller-and-trust-first**: escrow explainer near the top, top-rated stores as heroes,
   category rails below.

For **each concept** give, in this order:

1. **One-paragraph positioning**: who it serves best and why it beats the current page.
2. **Section list, top to bottom**, with for every section: purpose, data source from §3,
   desktop layout (columns, card sizes, how many items), mobile layout (stack, rail or
   grid; swipe or not), and the copy (title + sub-line) in **English and French**.
3. **A text wireframe** (ASCII boxes) for desktop and for mobile.
4. **Component inventory**: which existing pieces are reused as-is (hero carousel, product
   card, category card, store card, trust strip, escrow flow, seller CTA) and which new
   components are needed, with their props described in plain words.
5. **Interactions and motion**: hover, swipe, sticky elements, skeleton loading, empty states
   (what shows when a section has no data, e.g. zero deals).
6. **Risks**: what could look empty or fake with a small catalogue (we start with ~50
   listings and 8 stores) and how the design degrades gracefully.

Finish with:

- A **comparison table** (conversion potential, mobile friendliness, implementation effort
  1–5, catalogue-size sensitivity) and **your single recommendation** with reasons.
- For the recommended concept only: a **section-by-section implementation checklist** and
  the exact **Tailwind spacing/typography scale** you would use (max-width, gutters, card
  radius, rail item width on mobile and desktop) so it can be built without further design
  rounds.

Output format: Markdown only. Keep every section heading explicit so the specification can
be followed top to bottom by a developer.
