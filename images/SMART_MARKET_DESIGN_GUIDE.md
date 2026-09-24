# Smart Market — UI Design & Tailwind Implementation Guide

> **Purpose:** This file is the visual and implementation reference for Claude Code when building the Smart Market marketplace UI.
>
> **Primary rule:** The supplied screenshot is the visual source of truth. This document explains how to reproduce its design language, proportions, density, responsiveness, and component structure using Tailwind CSS.

---

## 1. Product Vision

Smart Market is a Cameroon-focused online marketplace for new and used products.

The interface should feel:

- commercial
- trustworthy
- compact
- fast
- modern
- familiar to marketplace users
- optimized for product discovery
- optimized for desktop and mobile commerce
- visually close to a Jumia-style ecommerce experience

This is **not** a SaaS dashboard.

Do not redesign the interface into a card-heavy analytics product.

The UI must prioritize:

1. product discovery
2. categories
3. promotions
4. trusted transactions
5. fast navigation
6. visible product density

---

## 2. Visual Source of Truth

The supplied Smart Market screenshot is the primary design reference.

When there is a conflict between:

- generic ecommerce conventions
- framework defaults
- component library defaults
- Claude's own design preference
- this document
- the screenshot

follow this order:

1. **Screenshot**
2. **This document**
3. Existing project architecture
4. Tailwind best practices
5. Generic design conventions

Do not "improve" the design by making it significantly more spacious, rounded, minimal, or SaaS-like.

---

## 3. Core Design Principle: High Information Density

The screenshot succeeds because a large amount of relevant marketplace information is visible without excessive scrolling.

The page must remain compact.

### Avoid

- 24–40px padding inside every card
- giant typography
- oversized cards
- large empty white areas
- huge hero sections
- excessive whitespace
- oversized pills
- glassmorphism
- floating dashboard-style panels
- large 20–32px border radii everywhere

### Prefer

- 8–14px internal spacing
- compact product cards
- dense category navigation
- thin borders
- subtle shadows
- restrained border radii
- horizontal scrolling on mobile
- visible product rows
- short section heights

---

# 4. Brand Palette

Use these values as design tokens.

```css
:root {
  --market-navy: #082D61;
  --market-navy-dark: #05234C;

  --market-blue: #1374D1;
  --market-blue-light: #EAF6FF;
  --market-sky: #D9F1FF;

  --market-orange: #F7931A;
  --market-orange-dark: #E67800;
  --market-orange-soft: #FFF3E3;

  --market-red: #F53232;
  --market-red-dark: #D92020;

  --market-ink: #102A4E;
  --market-text: #314867;
  --market-text-secondary: #425772;
  --market-muted: #718096;

  --market-canvas: #F4F8FC;
  --market-surface: #FFFFFF;

  --market-border: #DCE7F1;
  --market-border-soft: #EAF0F6;
}
```

---

# 5. Tailwind Theme

Extend Tailwind instead of scattering raw hex values throughout components.

Example:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{html,ts,tsx,js,jsx,vue}"
  ],

  theme: {
    extend: {
      colors: {
        market: {
          navy: "#082D61",
          navyDark: "#05234C",

          blue: "#1374D1",
          blueLight: "#EAF6FF",
          sky: "#D9F1FF",

          orange: "#F7931A",
          orangeDark: "#E67800",
          orangeSoft: "#FFF3E3",

          red: "#F53232",

          ink: "#102A4E",
          text: "#314867",
          muted: "#718096",

          canvas: "#F4F8FC",
          surface: "#FFFFFF",

          border: "#DCE7F1",
          borderSoft: "#EAF0F6"
        }
      },

      fontFamily: {
        sans: ["Inter", "Roboto", "Arial", "sans-serif"]
      },

      borderRadius: {
        market: "10px",
        "market-lg": "14px"
      },

      boxShadow: {
        market: "0 2px 8px rgba(15, 42, 76, 0.08)",
        "market-hover": "0 9px 24px rgba(15, 42, 76, 0.13)"
      },

      maxWidth: {
        market: "1440px"
      }
    }
  },

  plugins: []
};
```

---

# 6. Typography

Preferred font:

```text
Inter
```

Fallbacks:

```text
Roboto, Arial, sans-serif
```

## Recommended sizes

| Element | Desktop |
|---|---:|
| Main hero title | 26–29px |
| Section title | 16–19px |
| Header controls | 11–13px |
| Product title | 11–13px |
| Product price | 12–14px |
| Product metadata | 9–11px |
| Category labels | 10–12px |
| Mobile hero title | 19–22px |
| Mobile navigation label | 9–10px |

### Font weight hierarchy

- Primary headline: `800` or `900`
- Section titles: `700` or `800`
- Product title: `600` or `700`
- Current price: `800` or `900`
- Metadata: `400` or `500`
- Buttons: `700` or `800`

Do not make normal product text oversized.

---

# 7. Global Page Layout

Desktop page width:

```text
max-width: 1400–1440px
```

Center the content.

Recommended desktop structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ TOP HEADER ~58px                                            │
├──────────────┬───────────────────────────────────────────────┤
│              │ HERO ~200–215px                              │
│ CATEGORY     ├───────────────────────────────────────────────┤
│ SIDEBAR      │ CATEGORY ICONS ~80–95px                       │
│ ~200–210px   ├───────────────────────────────────────────────┤
│              │ FLASH DEALS ~220–250px                        │
│              ├───────────────────────────────────────────────┤
│              │ TRUST / PAYMENT STRIP ~65–80px                │
│              ├───────────────────────────────────────────────┤
│              │ LOWER MARKETPLACE PANELS                      │
└──────────────┴───────────────────────────────────────────────┘
```

Recommended spacing:

```text
Page horizontal padding: 12–16px
Main layout gap: 10–14px
Section gap: 8–14px
Card gap: 6–10px
```

---

# 8. Desktop Header

The desktop header is a dark navy marketplace navigation bar.

Approximate height:

```text
56–60px
```

Use:

```text
background: #082D61
```

The header should include:

1. Smart Market logo
2. search field
3. category dropdown
4. search button
5. language selector
6. wishlist
7. cart
8. seller CTA

## Header proportions

Logo:

```text
~190–210px
```

Search:

```text
takes most remaining width
```

Seller CTA:

```text
compact orange button
```

### Search input

Height:

```text
36–40px
```

Radius:

```text
6–8px
```

Search button:

```text
orange
```

Do not use a large rounded pill search field.

---

# 9. Category Sidebar

Visible only on desktop.

Width:

```text
200–210px
```

Each row:

```text
30–34px high
```

Sidebar title:

- blue background
- white text
- category/menu icon

Category rows:

- small icon
- 11–12px text
- subtle hover background
- no oversized padding

Example visual rhythm:

```text
[icon] Phones & Tablets
[icon] Computers & Accessories
[icon] Electronics
[icon] Home & Appliances
[icon] Fashion
...
```

---

# 10. Hero Banner

The hero should remain compact.

Desktop height:

```text
200–215px
```

Suggested composition:

```text
LEFT
Headline + subtitle + CTA

CENTER
Product montage

RIGHT
Secure transaction / escrow message
```

## Background

Left area:

```text
light sky blue
```

Right area:

```text
dark navy
```

A suitable gradient:

```css
background:
  linear-gradient(
    110deg,
    #C7EAFF 0%,
    #E8F7FF 55%,
    #0A356C 55%,
    #082B5B 100%
  );
```

## Hero title

Desktop:

```text
26–29px
line-height around 1.0–1.08
font-weight 800–900
```

## CTA

Height:

```text
38–42px
```

Radius:

```text
6–8px
```

Use the Smart Market orange.

---

# 11. Category Strip

Place directly below the hero.

Categories are shown as compact circular product/category illustrations.

Each category unit:

```text
width: ~80–100px
```

Circle:

```text
48–58px
```

Label:

```text
10–11px
```

On desktop:

- display several categories in one row
- avoid wrapping if possible

On tablet/mobile:

- horizontal scroll
- hide scrollbar

---

# 12. Flash Deals

This is one of the most visually important sections.

Use a very pale orange background.

Example:

```css
background: linear-gradient(90deg, #FFF0DD, #FFF8EE);
```

Border:

```text
#FFE5C5
```

The header contains:

- red flash icon
- "Flash Deals"
- short subtitle
- countdown
- "See all deals"

Keep the header compact.

## Countdown

Use 3 small red boxes.

Example:

```text
12 : 34 : 56
Hrs  Mins Secs
```

Each desktop box:

```text
40–46px wide
38–42px high
```

---

# 13. Product Card

Product cards must be compact.

Desktop flash deal card:

```text
width: ~145–170px
height: ~190–210px
```

Structure:

```text
discount badge
product image
product title
condition
current price
old price
cart button
```

## Product image area

Use approximately:

```text
80–95px height
```

Use:

```css
object-fit: contain;
```

unless a specific asset requires otherwise.

## Discount badge

Position:

```text
top-left
```

Color:

```text
#F53232
```

Font:

```text
10–11px
700–900 weight
```

## Price

Current:

```text
red
bold
```

Previous:

```text
muted
strikethrough
```

## Cart button

Compact square:

```text
26–30px
```

Orange background.

---

# 14. Trust / Payment Strip

The screenshot uses a light blue reassurance area.

Desktop:

```text
3 columns
```

Example content:

1. Secure Escrow Payments
2. Verified Sellers
3. Buyer Protection

Each item should include:

- icon
- compact heading
- one short supporting sentence

Do not make these large feature cards.

Approx height:

```text
65–80px
```

---

# 15. Lower Marketplace Panels

The desktop screenshot includes multiple compact panels below the trust strip.

Suggested modules:

- Top Categories
- Newest Listings
- Featured Stores

Use a 3-column grid on large desktop.

Each panel:

- white background
- thin border
- 8–10px radius
- compact title
- tiny "See all" action
- miniature item grid

Do not turn these into large landing-page sections.

---

# 16. Mobile Layout

The mobile screenshot is a separate composition, not merely a squeezed desktop layout.

Breakpoint:

```text
< 1024px
```

Hide:

- desktop header
- sidebar
- desktop-only hero payment panel when necessary

Show:

- mobile header
- mobile search
- horizontal categories
- horizontal product lists
- fixed bottom navigation

---

# 17. Mobile Header

Recommended structure:

```text
row 1:
hamburger
Smart Market logo
search icon
wishlist
cart

row 2:
full-width search field
```

Approx total height:

```text
90–100px
```

Keep it visually clean and compact.

---

# 18. Mobile Hero

Mobile hero height:

```text
160–180px
```

Structure:

```text
left:
headline + subtitle + CTA

right:
product montage
```

Use a light-blue background.

Do not use the desktop sidebar or desktop right security block here.

---

# 19. Mobile Category Strip

Use horizontal scrolling.

Category circle:

```text
44–50px
```

Each category item:

```text
60–70px wide
```

Scrollbar should not be visible.

---

# 20. Mobile Flash Deals

Display products horizontally.

Each product card:

```text
130–145px wide
```

Use:

```css
overflow-x: auto;
scroll-snap-type: x mandatory;
```

Cards:

```css
scroll-snap-align: start;
```

Do not collapse mobile Flash Deals into a single-column vertical list.

---

# 21. Mobile Bottom Navigation

Fixed to bottom.

Use exactly five primary actions:

1. Home
2. Categories
3. Deals
4. Wishlist
5. Account

Height:

```text
58–64px
```

Active item:

```text
orange
```

Inactive:

```text
navy/gray
```

Icons:

```text
18–21px
```

Labels:

```text
9–10px
```

Add bottom padding to page content so the navigation does not cover content.

---

# 22. Responsive Breakpoints

Use these general behaviors.

## Mobile

```text
320px+
```

- mobile header
- bottom navigation
- no desktop sidebar
- horizontal scrolling sections
- compact hero

## Tablet

```text
768px+
```

- still no desktop category sidebar unless layout has sufficient room
- wider cards
- more visible products
- preserve touch-friendly layout

## Desktop

```text
1024px+
```

- desktop header
- left category sidebar
- standard hero
- product grid

## Wide Desktop

```text
1280px+
```

- show more hero details
- show up to 6 flash deal products
- show full seller CTA

## Large Desktop

```text
1440px+
```

Do not stretch the content indefinitely.

Keep:

```text
max-width: 1440px
```

---

# 23. Border Radius Rules

Use restrained radii.

| Element | Radius |
|---|---:|
| Header search | 6–8px |
| Main panels | 8–10px |
| Hero | 10–12px |
| Product card | 6–8px |
| Buttons | 6–8px |
| Category circle | 9999px |

Avoid large 20–32px radii unless the visual reference explicitly uses them.

---

# 24. Shadow Rules

Default panel shadow:

```css
box-shadow:
  0 2px 8px rgba(15, 42, 76, 0.08);
```

Hover:

```css
box-shadow:
  0 9px 24px rgba(15, 42, 76, 0.13);
```

Keep shadows subtle.

Do not make every element float.

---

# 25. Icons

Use one icon system consistently.

Recommended:

```text
Lucide Icons
```

Do not use emoji in the production implementation.

Typical sizes:

```text
Desktop controls: 15–17px
Category/sidebar icons: 15–17px
Mobile actions: 18–21px
Primary feature icons: 20–26px
```

---

# 26. Image Behavior

For products:

```css
object-fit: contain;
```

For hero collages:

```text
prefer transparent PNG/WebP
```

For category icons:

```text
transparent isolated product image
```

Do not distort images.

Do not stretch product photos to fill containers.

---

# 27. Tailwind Architecture

Do not fill every template with enormous utility strings.

Use:

1. Tailwind utilities
2. shared design tokens
3. reusable component classes
4. reusable framework components

Recommended CSS structure:

```text
styles/
  market.css

or

src/styles/
  _market.css
```

Suggested semantic classes:

```text
.market-page
.market-container
.market-header
.market-search
.market-sidebar
.market-hero
.market-category-strip
.flash-section
.product-card
.market-trust-grid
.market-home-grid
.market-bottom-nav
```

These classes may use `@apply`.

---

# 28. Example Base Component Classes

```css
@layer components {

  .market-panel {
    @apply overflow-hidden bg-white;
    border: 1px solid #EAF0F6;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(15, 42, 76, 0.08);
  }

  .market-card {
    @apply bg-white transition-all duration-200;
    border: 1px solid #EAF0F6;
    border-radius: 8px;
  }

  .market-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 9px 24px rgba(15, 42, 76, 0.13);
  }

  .market-link {
    @apply inline-flex items-center gap-1 text-xs font-bold;
    color: #1374D1;
  }

  .market-link:hover {
    color: #F7931A;
  }

}
```

---

# 29. Suggested Component Structure

Use reusable components instead of repeating markup.

Suggested architecture:

```text
MarketplacePage
│
├── MarketplaceHeader
├── MobileMarketplaceHeader
│
├── MainMarketplaceLayout
│   ├── CategorySidebar
│   └── MarketplaceContent
│       ├── HeroBanner
│       ├── CategoryStrip
│       ├── FlashDeals
│       │   ├── CountdownTimer
│       │   └── ProductCard[]
│       ├── TrustStrip
│       └── MarketplaceHomeGrid
│           ├── TopCategories
│           ├── NewestListings
│           └── FeaturedStores
│
└── MobileBottomNavigation
```

---

# 30. Product Card Component Contract

Recommended data structure:

```ts
interface MarketplaceProduct {
  id: string | number;
  name: string;
  price: number;
  oldPrice?: number;
  currency: "XAF";
  image: string;
  discountPercent?: number;
  condition?: "New" | "Used - Like New" | "Used - Good";
  sellerName?: string;
  rating?: number;
}
```

Recommended component API:

```text
<ProductCard
  product={product}
  compact
  showDiscount
  showCartButton
/>
```

---

# 31. Section Header Pattern

Every marketplace section should use the same compact heading pattern.

Example:

```html
<div class="flex items-center justify-between gap-3">
  <div>
    <h2 class="text-base font-extrabold text-market-ink">
      Flash Deals
    </h2>

    <p class="text-[10px] text-market-muted">
      Limited time offers on top products
    </p>
  </div>

  <a class="market-link">
    See all →
  </a>
</div>
```

---

# 32. Hover Behavior

Desktop hover interactions should be subtle.

Cards:

```text
translateY(-2px)
small shadow increase
```

Links:

```text
blue → orange
```

Buttons:

```text
slightly darker background
```

Sidebar rows:

```text
very pale blue background
```

Do not use dramatic animation.

Recommended transition:

```text
150–200ms ease
```

---

# 33. Accessibility

Maintain:

- visible focus states
- semantic button elements
- semantic links
- alt text
- sufficient contrast
- keyboard navigation
- accessible labels for icon-only controls

Do not sacrifice usability to visually reproduce the screenshot.

---

# 34. Performance

The marketplace may contain many product images.

Use:

```html
loading="lazy"
```

for below-the-fold product images.

Prefer:

```text
WebP / AVIF
```

where appropriate.

Avoid:

- loading giant hero assets at full original resolution
- rendering hundreds of product cards simultaneously
- excessive runtime layout calculations

---

# 35. Things Claude Code Must Not Do

Claude must not:

- redesign the UI from scratch
- convert it into a dashboard
- introduce glassmorphism
- use gradient-heavy SaaS cards everywhere
- make cards excessively rounded
- make the hero taller than necessary
- create huge gaps between sections
- remove marketplace density
- hide important commerce actions
- use random colors outside the brand palette
- use emoji as production icons
- use inconsistent icon libraries
- use giant heading typography
- use excessive animations
- replace working application logic for visual reasons
- duplicate the same CSS repeatedly across components

---

# 36. Implementation Workflow for Claude Code

Claude Code should implement the redesign in this order.

## Step 1 — Inspect Project

Identify:

- framework
- routing
- current Tailwind version
- global CSS entrypoint
- component structure
- existing UI dependencies
- existing product/category APIs
- existing icons
- existing image assets

Do not modify code before understanding the structure.

---

## Step 2 — Establish Tokens

Create or update:

- Tailwind colors
- radii
- shadows
- font family
- max-width
- marketplace shared CSS classes

Avoid raw repeated hex values inside templates.

---

## Step 3 — Build Structural Components

Create:

1. desktop header
2. mobile header
3. category sidebar
4. main page container
5. bottom navigation

Do not start with tiny cosmetic details.

---

## Step 4 — Build Hero

Reproduce:

- dimensions
- blue background
- headline placement
- product image placement
- orange CTA
- navy payment/security area

---

## Step 5 — Build Category Strip

Ensure:

- desktop horizontal display
- mobile horizontal scroll
- consistent category circles

---

## Step 6 — Build Product Card

Build one accurate reusable ProductCard before rendering Flash Deals.

Verify:

- image scale
- discount badge
- typography
- price
- old price
- cart control
- spacing

---

## Step 7 — Build Flash Deals

Add:

- title
- subtitle
- countdown
- responsive grid
- mobile horizontal scroll

---

## Step 8 — Trust Strip

Create compact trust/payment cards.

---

## Step 9 — Lower Sections

Create compact marketplace panels.

---

## Step 10 — Responsive Refinement

Compare at:

```text
375px
768px
1024px
1280px
1440px
```

---

# 37. Visual QA Checklist

Claude must compare the implementation against the screenshot.

## Desktop

Check:

- [ ] header height is compact
- [ ] search bar is dominant in header
- [ ] sidebar width is close to reference
- [ ] hero is not too tall
- [ ] product montage is visually central
- [ ] security/payment content is on right
- [ ] category strip fits tightly below hero
- [ ] Flash Deals products remain compact
- [ ] six products can fit on a wide screen
- [ ] trust strip remains shallow
- [ ] lower content appears without excessive scrolling
- [ ] page background is subtle blue-gray
- [ ] border radii remain small
- [ ] shadows remain subtle

## Mobile

Check:

- [ ] desktop header is hidden
- [ ] mobile header is compact
- [ ] search field is visible
- [ ] mobile hero resembles reference
- [ ] categories horizontally scroll
- [ ] Flash Deals horizontally scroll
- [ ] bottom navigation is fixed
- [ ] active Home icon uses orange
- [ ] cards are not oversized
- [ ] page has enough bottom padding for fixed nav

---

# 38. Acceptance Criteria

The work is complete when:

1. The page visually resembles the supplied screenshot at first glance.
2. The desktop experience preserves high information density.
3. The mobile experience behaves like a real marketplace app.
4. Tailwind is used systematically.
5. Reusable components are used.
6. Brand tokens are centralized.
7. Product cards remain compact.
8. The page does not look like a generic AI-generated SaaS design.
9. Responsive behavior is intentional rather than accidental.
10. Existing business logic continues to work.

---

# 39. Final Instruction to Claude Code

Use the screenshot continuously while implementing.

Do not treat this document as permission to reinterpret the design.

The objective is:

> **Reproduce the Smart Market screenshot as closely as possible while implementing it cleanly, responsively, and maintainably with Tailwind CSS.**

When unsure about spacing, component size, or information density, choose the option that is visually closest to the screenshot.

When unsure whether an element should be large or compact, prefer compact.

When unsure whether to add decorative styling, do not add it unless visible in the reference.

**Visual fidelity + maintainable Tailwind architecture are the two main goals.**
