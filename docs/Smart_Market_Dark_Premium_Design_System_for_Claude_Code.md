# Smart Market --- Dark Premium Design System & Claude Code Implementation Brief

**Project:** Smart Market\
**Brand:** Smarttrustexpress / Smart Market\
**Primary direction:** Dark Premium Marketplace\
**Required modes:** Dark Mode + Light Mode\
**Frontend:** Next.js\
**Styling:** Tailwind CSS\
**Motion:** Motion (Framer Motion successor)\
**Target:** Production-grade marketplace UI, not a marketing-only
prototype

------------------------------------------------------------------------

## 1. Purpose

This document is the visual and interaction specification that Claude
Code must follow when implementing the Smart Market frontend.

The selected visual direction is the **Dark Premium Marketplace**
concept from the approved homepage references.

The goal is to create a marketplace that feels:

-   Premium
-   Modern
-   Trustworthy
-   Fast
-   Sophisticated
-   Slightly futuristic
-   Commercial without looking cheap
-   Rich in interaction without becoming distracting

The platform is a **multi-vendor marketplace**, not a single-brand
e-commerce store.

Users can:

-   Browse products
-   Browse categories
-   Discover stores
-   Create accounts
-   Become sellers
-   Create storefronts
-   Subscribe to seller plans
-   Publish advertisements/products according to their subscription
    quota
-   Buy products
-   Pay through the platform
-   Benefit from escrow protection
-   Track orders
-   Confirm delivery
-   Receive support through an AI chatbot

The visual language must communicate this marketplace + trust +
technology combination.

------------------------------------------------------------------------

# 2. Non-Negotiable Design Principles

Claude Code must treat the following as design-system rules.

### 2.1 Premium first

Avoid generic SaaS styling.

Avoid:

-   excessive gradients
-   oversized rounded rectangles everywhere
-   random glassmorphism
-   excessive shadows
-   childish animations
-   template-like dashboards
-   excessive empty space that reduces information density
-   excessive use of orange

The design should feel closer to a premium global marketplace than a
basic local classifieds website.

### 2.2 Marketplace first

Smart Market must visually communicate:

> Thousands of products. Multiple independent sellers. One trusted
> marketplace.

Product cards, store cards, categories, search and discovery must remain
the visual priority.

### 2.3 Trust must be visible

Escrow is one of the platform's major differentiators.

Use visual trust cues throughout the experience:

-   Secure Escrow
-   Verified Sellers
-   Secure Payments
-   Buyer Protection
-   Funds Released After Confirmation
-   Customer Support

Do not make these claims visually overwhelming. They should feel
integrated into the interface.

### 2.4 Motion must enhance UX

Motion is required, but motion must never slow the user down.

Use:

-   subtle entrance transitions
-   spring-based interactions
-   depth movement
-   hover elevation
-   image zoom
-   card tilt where appropriate
-   layered parallax
-   smooth tab transitions
-   animated counters
-   scroll reveal
-   shared-layout transitions

Avoid:

-   constant bouncing
-   aggressive rotations
-   long animations
-   excessive particles
-   animations that cause layout shifts
-   animations that interfere with clicking

------------------------------------------------------------------------

# 3. Color System

The supplied Smarttrustexpress logo establishes the core brand colors:

-   Deep/Navy Blue
-   Bright Blue
-   Orange
-   White
-   Neutral Gray

The dark premium design should extend this palette rather than replacing
it.

## Dark Mode

Suggested semantic tokens:

``` css
--background: #070B12;
--surface: #0D131D;
--surface-elevated: #121A26;
--surface-hover: #172131;
--border: rgba(255,255,255,0.09);

--text-primary: #F8FAFC;
--text-secondary: #AAB4C3;
--text-muted: #6F7B8C;

--brand-blue: #087CF0;
--brand-blue-light: #27A4FF;
--brand-orange: #FF7A00;
--brand-orange-light: #FF9B32;

--success: #19C37D;
--warning: #F5B942;
--danger: #EF5350;
```

Do not hardcode these values throughout components.

Create centralized Tailwind theme tokens.

------------------------------------------------------------------------

# 4. Light Mode

Light mode must not simply be the dark design with the background
changed to white.

It should be intentionally designed.

Suggested semantic tokens:

``` css
--background: #F7F9FC;
--surface: #FFFFFF;
--surface-elevated: #FFFFFF;
--surface-hover: #F1F5F9;
--border: #E4E9F0;

--text-primary: #0B172A;
--text-secondary: #475569;
--text-muted: #7A8798;

--brand-blue: #087CF0;
--brand-orange: #F97316;
```

The visual hierarchy should remain equivalent between modes.

------------------------------------------------------------------------

# 5. Tailwind Architecture

Use semantic utility classes and reusable components.

Do NOT scatter arbitrary colors throughout JSX.

Prefer:

``` tsx
className="bg-background text-foreground border-border"
```

over:

``` tsx
className="bg-[#070B12] text-[#fff]"
```

unless the value is genuinely unique.

Create reusable design tokens in the Tailwind configuration/theme.

Recommended semantic names:

``` text
background
surface
surface-elevated
surface-hover
foreground
foreground-muted
border
brand
brand-blue
brand-orange
success
warning
danger
```

------------------------------------------------------------------------

# 6. Typography

Use a modern professional sans-serif.

Recommended:

-   Inter
-   Geist
-   Manrope

Geist or Inter should be preferred for the main UI.

Typography hierarchy:

``` text
Hero heading: 56–72px desktop
Section heading: 30–40px
Card heading: 16–20px
Body: 14–16px
Metadata: 12–14px
```

Use responsive typography.

Do not use huge text simply to fill space.

------------------------------------------------------------------------

# 7. Global Layout

Desktop:

``` text
max-width: 1440px
padding: 24–48px
```

Tablet:

``` text
padding: 20–32px
```

Mobile:

``` text
padding: 16px
```

The interface must work naturally from:

-   mobile
-   tablet
-   laptop
-   large desktop

Do not create a separate mobile visual language.

------------------------------------------------------------------------

# 8. Header

The header is one of the most important components.

Dark mode:

``` text
Dark background
Subtle bottom border
Logo
Search
Categories
Deals
Top Stores
Subscriptions
How It Works
Sign In
Become a Seller
Wishlist
Cart
```

The header should feel like a premium marketplace navigation system.

### Search

The search bar should be prominent.

Features:

-   rounded but not excessively pill-shaped
-   keyboard accessible
-   animated focus state
-   search suggestions
-   category suggestions
-   product suggestions
-   recent searches

Focus animation:

``` text
border transition
subtle blue glow
background elevation
```

Do not animate the entire header when search receives focus.

------------------------------------------------------------------------

# 9. Hero Section

Hero direction:

> Premium marketplace + trust + discovery

Example headline:

**Shop with confidence.\
Discover more.**

Alternative:

**Premium products.\
Trusted sellers. One marketplace.**

Supporting text should explain the marketplace and escrow concept.

Example:

> Discover products from trusted sellers and pay securely. Your payment
> stays protected until your order is confirmed.

Primary CTA:

**Shop Now**

Secondary CTA:

**Become a Seller**

Trust indicators:

-   Secure Escrow
-   Verified Sellers
-   Secure Payments
-   Buyer Protection

------------------------------------------------------------------------

# 10. Hero Visual Treatment

The hero should be visually rich without becoming a CSS experiment.

Use:

-   product photography
-   layered product cards
-   floating trust badge
-   subtle blue/orange ambient lighting
-   depth
-   soft gradient overlays

Use layered positioning only where it can still be implemented cleanly
with CSS.

Recommended structure:

``` text
Hero
 ├── Content
 │    ├── Eyebrow
 │    ├── Heading
 │    ├── Description
 │    ├── CTAs
 │    └── Trust indicators
 │
 └── Visual
      ├── Main product image
      ├── Secondary floating card
      ├── Trust badge
      └── Ambient background
```

------------------------------------------------------------------------

# 11. 3D Feeling Without Heavy 3D Libraries

Do not introduce Three.js just to make the interface feel 3D.

Use CSS and Motion.

Create depth through:

-   perspective
-   transform
-   translateZ
-   scale
-   shadow
-   blur
-   opacity
-   layered surfaces
-   parallax

Example conceptual interaction:

``` css
transform:
  perspective(1000px)
  rotateX(var(--rotate-x))
  rotateY(var(--rotate-y))
  translateZ(10px);
```

For product cards, use very subtle movement.

Maximum recommended tilt:

``` text
rotateX: ±2–4deg
rotateY: ±2–4deg
```

Never make cards spin.

------------------------------------------------------------------------

# 12. Motion System

Motion should be centralized.

Create reusable motion variants.

Example:

``` ts
fadeUp
fadeIn
scaleIn
slideIn
staggerContainer
cardHover
modalEnter
modalExit
pageEnter
```

Use spring physics for interactive elements.

Example philosophy:

``` text
stiffness: 300–500
damping: 25–40
mass: 0.5–1
```

Do not use the same animation everywhere.

------------------------------------------------------------------------

# 13. Page Entrance

On initial page load:

1.  Header appears quickly.
2.  Hero content fades/slides upward.
3.  Hero visual arrives with slight scale transition.
4.  Trust indicators appear with stagger.
5.  Below-the-fold sections reveal naturally.

Recommended duration:

``` text
0.4–0.8 seconds
```

Never make the user wait for the animation.

------------------------------------------------------------------------

# 14. Scroll Reveal

Use Intersection Observer / Motion viewport triggers.

Sections should reveal when approximately:

``` text
20–30% of section enters viewport
```

Use subtle:

``` text
opacity: 0 → 1
translateY: 20px → 0
```

Avoid:

``` text
translateY: 200px
```

because it feels theatrical rather than premium.

------------------------------------------------------------------------

# 15. Product Cards

Product cards are critical.

Dark mode:

``` text
surface
subtle border
large product image area
wishlist icon
product name
seller
rating
price
optional discount
cart/action button
```

Hover:

-   card rises 4--8px
-   border becomes slightly brighter
-   image scales 1.03--1.06
-   shadow increases subtly
-   action button becomes more visible

Animation should be approximately:

``` text
200–350ms
```

Use spring transitions where appropriate.

------------------------------------------------------------------------

# 16. Product Image Hover

Use:

``` text
scale: 1 → 1.04
```

Do not zoom excessively.

If a second product image exists:

``` text
image 1 → image 2
```

with a short opacity crossfade.

------------------------------------------------------------------------

# 17. Categories

Category navigation should be visually simple.

Cards may contain:

-   icon
-   image
-   category name
-   product count

Dark mode category cards:

``` text
surface
border
small glow on hover
```

Hover:

``` text
translateY(-3px)
border-color → brand blue
icon → brand orange/blue
```

------------------------------------------------------------------------

# 18. Featured / Trending Products

Create horizontal product discovery patterns where appropriate.

Desktop:

``` text
5–6 cards
```

Tablet:

``` text
3–4 cards
```

Mobile:

``` text
2 cards or horizontal scroll
```

Never squeeze six cards into a mobile viewport.

------------------------------------------------------------------------

# 19. Featured Stores

Stores are first-class entities.

Store card should display:

-   store logo
-   store name
-   category
-   rating
-   number of products
-   verification badge
-   View Store button

Verified sellers should have a clear but subtle verification indicator.

------------------------------------------------------------------------

# 20. Escrow Trust Section

This section is strategically important.

Suggested heading:

**Your payment stays protected until you receive your order.**

Visual flow:

``` text
1. You Pay
      ↓
2. Smart Market Holds Funds
      ↓
3. Seller Delivers
      ↓
4. You Confirm
      ↓
5. Seller Gets Paid
```

Use animated connecting lines.

When the section enters the viewport:

-   icons appear sequentially
-   connecting line draws
-   each step highlights briefly

Keep animation under approximately 1.5 seconds total.

------------------------------------------------------------------------

# 21. Seller CTA

The marketplace must also sell the seller experience.

Example:

**Turn your products into a business.**

Supporting text:

> Create your store, choose a subscription plan, publish your products
> and reach customers through Smart Market.

CTA:

**Become a Seller**

Secondary:

**View Subscription Plans**

Use orange strategically here because orange represents
action/conversion.

------------------------------------------------------------------------

# 22. Subscription Visual Language

Subscription plans should look premium.

Cards:

``` text
Starter
Business
Premium
```

Show:

-   number of ads
-   duration
-   price
-   features
-   remaining quota
-   renewal

Use one highlighted plan, but avoid excessive "best plan" visual
pressure.

------------------------------------------------------------------------

# 23. AI Chatbot

The AI assistant must feel like a native Smart Market feature.

Floating launcher:

-   bottom-right
-   circular
-   brand blue/orange accent
-   subtle idle animation

Do NOT constantly bounce the chatbot.

Idle behavior:

``` text
small pulse every 8–12 seconds
```

On hover:

``` text
scale 1.05
shadow increase
```

Opening:

``` text
scale 0.96 → 1
opacity 0 → 1
translateY 12px → 0
```

Chat window:

``` text
header
AI avatar
conversation
suggestion chips
input
send button
```

Example suggestion chips:

-   Find a product
-   Track my order
-   Explain escrow
-   Become a seller
-   View subscription plans

The chatbot must respect dark/light mode.

------------------------------------------------------------------------

# 24. Trust & Safety Strip

Use four or five compact items:

``` text
Secure Escrow
Verified Sellers
Secure Payments
Buyer Protection
Customer Support
```

Do not make them giant cards.

This section should feel like a confidence layer.

------------------------------------------------------------------------

# 25. Footer

Footer must include:

### Marketplace

-   All Categories
-   Deals
-   New Arrivals
-   Top Stores

### Sell

-   Become a Seller
-   Subscription Plans
-   Seller Guide

### Help

-   Track Order
-   Returns & Refunds
-   FAQ
-   Contact Support

### Company

-   About
-   Careers
-   Blog
-   Terms
-   Privacy

### Newsletter

``` text
Get the latest deals and marketplace updates.
[email address] [Subscribe]
```

Social links:

-   Facebook
-   Instagram
-   LinkedIn
-   X
-   YouTube

------------------------------------------------------------------------

# 26. Dark Mode Details

Dark mode should not be pure black.

Avoid:

``` text
#000000
```

Use layered dark surfaces.

Example:

``` text
background: #070B12
surface: #0D131D
elevated: #121A26
```

This creates visual depth.

Cards should be distinguishable without huge shadows.

Use borders and surface contrast.

------------------------------------------------------------------------

# 27. Light Mode Details

Light mode should feel like the same premium brand.

Avoid making everything pure white.

Use:

``` text
background: #F7F9FC
surface: #FFFFFF
secondary surface: #F1F5F9
```

Orange and blue remain brand accents.

------------------------------------------------------------------------

# 28. Theme Switching

Theme switching must be animated subtly.

Do not animate every component individually.

Use a short global color transition:

``` css
transition:
  background-color 200ms ease,
  border-color 200ms ease,
  color 200ms ease;
```

Respect:

``` text
prefers-color-scheme
```

and allow explicit user selection.

Persist the user's choice.

------------------------------------------------------------------------

# 29. Accessibility

All animations must respect:

``` css
prefers-reduced-motion
```

When reduced motion is enabled:

-   disable parallax
-   disable tilt
-   remove non-essential transforms
-   shorten transitions
-   retain functional state changes

Maintain:

-   keyboard navigation
-   focus indicators
-   ARIA labels
-   sufficient contrast
-   semantic HTML

------------------------------------------------------------------------

# 30. Performance Requirements

Motion must never compromise performance.

Use:

``` text
transform
opacity
```

for animations whenever possible.

Avoid animating:

``` text
width
height
top
left
margin
padding
```

unless necessary.

Use GPU-friendly transforms.

Lazy-load below-the-fold images.

Use Next.js image optimization.

Avoid loading huge hero assets unnecessarily.

------------------------------------------------------------------------

# 31. Responsive Motion

Do not use identical motion intensity on every device.

Desktop:

``` text
Full hover interactions
Subtle 3D tilt
Parallax
```

Tablet:

``` text
Reduced tilt
Reduced parallax
```

Mobile:

``` text
Mostly tap-based interactions
No cursor-dependent 3D tilt
Minimal parallax
```

Touch interfaces should feel fast.

------------------------------------------------------------------------

# 32. Microinteractions

Important microinteractions:

### Add to cart

Button:

``` text
idle → pressed → success
```

Optional:

-   icon moves toward cart
-   button briefly changes state
-   quantity badge increments

### Wishlist

Heart:

``` text
scale → fill → settle
```

### Follow store

Button:

``` text
Follow → Following
```

Use a short spring transition.

### Copy

For seller/store information:

``` text
copy icon → check icon
```

------------------------------------------------------------------------

# 33. Loading States

Use skeleton loaders.

Avoid generic spinning loaders wherever possible.

Skeletons should match actual content dimensions.

Use subtle shimmer only when necessary.

Dark mode skeleton:

``` text
#121A26 → #182332 → #121A26
```

Light mode:

``` text
#E8EDF3 → #F3F6F9 → #E8EDF3
```

Keep shimmer slow and subtle.

------------------------------------------------------------------------

# 34. Empty States

Empty states must remain premium.

Examples:

-   No products found
-   Empty cart
-   No orders
-   No wishlist
-   No active advertisements

Use:

-   simple illustration
-   concise message
-   clear CTA

Avoid giant illustrations that consume the page.

------------------------------------------------------------------------

# 35. Error States

Errors should be clear.

Use:

-   concise message
-   reason when useful
-   recovery action

Example:

**Payment could not be completed**

> Your payment was not confirmed. Your order has not been charged.

**Try Again**

------------------------------------------------------------------------

# 36. Motion Component Strategy

Create reusable components instead of repeating animation code.

Recommended:

``` text
MotionReveal
MotionFade
MotionScale
MotionCard
MotionButton
MotionStagger
MotionSection
MotionModal
MotionDrawer
MotionImage
```

Components should expose configurable props rather than duplicating
variants.

------------------------------------------------------------------------

# 37. Recommended Motion Tokens

Create a central motion configuration.

``` ts
export const motionConfig = {
  fast: 0.18,
  normal: 0.3,
  slow: 0.55,

  spring: {
    stiffness: 380,
    damping: 30,
    mass: 0.7,
  },

  softSpring: {
    stiffness: 240,
    damping: 28,
    mass: 0.8,
  }
}
```

These are starting points, not absolute values.

Tune them according to the final UI.

------------------------------------------------------------------------

# 38. Visual Depth Rules

Use three depth levels:

### Level 1

Normal surface.

### Level 2

Hover / elevated surface.

### Level 3

Modal / dropdown / floating UI.

Example:

``` text
Level 1:
surface + subtle border

Level 2:
surface-elevated + shadow

Level 3:
surface-elevated + stronger shadow + backdrop
```

Do not create a shadow on every element.

------------------------------------------------------------------------

# 39. Glassmorphism

Glass effects are allowed only for selected floating UI:

-   search suggestions
-   account dropdown
-   chatbot
-   floating trust badge
-   navigation overlays

Do not make the entire website glassmorphic.

Use:

``` css
backdrop-filter: blur(...)
```

sparingly.

------------------------------------------------------------------------

# 40. Hero Ambient Lighting

For the dark premium homepage, use subtle ambient gradients.

Example:

``` css
background:
  radial-gradient(
    circle at 75% 30%,
    rgba(8,124,240,0.18),
    transparent 35%
  ),
  radial-gradient(
    circle at 90% 60%,
    rgba(255,122,0,0.12),
    transparent 30%
  );
```

This must remain subtle.

The products and content remain the focus.

------------------------------------------------------------------------

# 41. Navigation Behavior

Desktop navigation can become slightly more compact after scrolling.

Recommended:

``` text
Initial:
large header

Scrolled:
slightly smaller header
backdrop blur
stronger surface
```

Animation must be smooth.

Mobile navigation should use a clean drawer.

Drawer:

-   slide from side
-   backdrop fade
-   spring transition
-   clear close button

------------------------------------------------------------------------

# 42. Dropdown Menus

Dropdowns should not instantly appear.

Use:

``` text
opacity
scale
translateY
```

Example:

``` text
opacity: 0 → 1
scale: 0.98 → 1
translateY: -4px → 0
```

Duration:

``` text
150–220ms
```

------------------------------------------------------------------------

# 43. Product Discovery UX

The homepage should prioritize discovery.

Recommended order:

``` text
Header
Hero
Trust indicators
Categories
Trending / Featured Products
Promotional collection
Featured Stores
Escrow explanation
Seller CTA
Newsletter
Footer
```

The exact order may be adjusted after UX testing, but product discovery
and trust must remain prominent.

------------------------------------------------------------------------

# 44. Homepage Section Rhythm

Do not make every section visually identical.

Alternate:

``` text
surface
background
surface
accent section
background
```

Use different visual densities.

The homepage should feel like a curated editorial marketplace.

------------------------------------------------------------------------

# 45. Avoid Generic AI-Generated UI

Claude Code must NOT blindly generate:

-   random gradients
-   excessive rounded cards
-   huge hero typography
-   fake statistics everywhere
-   decorative blobs everywhere
-   excessive glassmorphism
-   unnecessary 3D objects
-   excessive animations

Every visual element must serve:

1.  Navigation
2.  Discovery
3.  Trust
4.  Conversion
5.  Seller acquisition

------------------------------------------------------------------------

# 46. Component Architecture

Recommended structure:

``` text
components/
  layout/
    Header
    Footer
    MobileNavigation

  marketplace/
    Hero
    CategoryGrid
    ProductCard
    ProductGrid
    StoreCard
    StoreGrid
    PromotionalBanner

  trust/
    TrustStrip
    EscrowFlow
    VerificationBadge

  seller/
    SellerCTA
    SubscriptionPreview

  chatbot/
    ChatLauncher
    ChatWindow

  motion/
    MotionReveal
    MotionCard
    MotionStagger

  ui/
    Button
    Badge
    Input
    Modal
    Dropdown
    Tabs
    Skeleton
```

------------------------------------------------------------------------

# 47. Tailwind Rules

Use Tailwind for layout, spacing, responsive design and state variants.

Example:

``` tsx
className="
  bg-surface
  border border-border
  text-foreground
  transition-transform
  duration-300
  hover:-translate-y-1
"
```

For complex animation use Motion rather than trying to force everything
into Tailwind.

Tailwind handles:

``` text
layout
spacing
colors
typography
responsive
hover/focus states
```

Motion handles:

``` text
entrance
exit
spring
layout animation
gesture
stagger
3D transform
scroll-linked motion
```

------------------------------------------------------------------------

# 48. Next.js Requirements

Use modern Next.js patterns.

Prioritize:

-   Server Components where appropriate
-   Client Components only when interaction requires them
-   Next/Image
-   dynamic imports where useful
-   metadata API
-   structured data
-   semantic HTML
-   route-based SEO

Interactive Motion components should be isolated as client components
rather than converting entire pages unnecessarily.

------------------------------------------------------------------------

# 49. SEO Compatibility

Motion must never compromise SEO.

Content must exist in the rendered HTML structure.

Do not hide important SEO content behind client-only animation logic.

Important indexable content:

-   product titles
-   product descriptions
-   category names
-   store names
-   store descriptions
-   FAQ content
-   trust content

Use:

``` text
Metadata API
JSON-LD
Product schema
Organization schema
Breadcrumb schema
ItemList schema
```

where appropriate.

------------------------------------------------------------------------

# 50. Final Visual Objective

The final Smart Market experience should feel like:

> **A premium technology-driven marketplace where users feel safe enough
> to transact and excited enough to explore.**

The dark theme should communicate:

``` text
Technology
Premium
Trust
Depth
Security
```

The light theme should communicate:

``` text
Clarity
Accessibility
Freshness
Trust
Professionalism
```

Blue should communicate the technology/trust layer.

Orange should communicate action, commerce and energy.

White should provide clarity.

Gray should provide hierarchy.

------------------------------------------------------------------------

# 51. Claude Code Execution Instructions

When implementing this specification:

1.  Inspect the existing project before modifying files.
2.  Reuse existing components when they are compatible.
3.  Do not introduce unnecessary dependencies.
4.  Use the latest stable Next.js/Tailwind/Motion APIs compatible with
    the project.
5.  Keep components modular.
6.  Centralize theme tokens.
7.  Implement dark and light modes from the beginning.
8.  Implement responsive layouts from the beginning.
9.  Build the homepage using reusable marketplace components.
10. Use Motion for meaningful interactions.
11. Respect reduced-motion preferences.
12. Optimize images and animation performance.
13. Avoid layout shifts.
14. Keep accessibility intact.
15. Test desktop, tablet and mobile breakpoints.
16. Test both dark and light modes.
17. Test keyboard navigation.
18. Test hover and touch behavior separately.
19. Do not use fake loading delays.
20. Do not create unnecessary animations simply to demonstrate Motion.

------------------------------------------------------------------------

# 52. Definition of Done

The homepage is considered visually complete when:

-   Dark mode matches the selected premium direction.
-   Light mode feels equally intentional.
-   Logo colors are consistently integrated.
-   Header is polished and responsive.
-   Search feels interactive.
-   Hero has subtle depth.
-   Product cards have premium hover states.
-   Category browsing is clear.
-   Featured stores feel trustworthy.
-   Escrow flow is visually understandable.
-   Seller CTA is commercially clear.
-   AI chatbot feels native to the platform.
-   Footer is complete.
-   All sections animate smoothly.
-   Animations remain performant.
-   Reduced motion is supported.
-   No horizontal overflow exists.
-   Mobile interactions do not depend on hover.
-   SEO content remains indexable.
-   No major component contains duplicated styling logic.

------------------------------------------------------------------------

# 53. Brand Signature

The Smart Market visual signature should consistently combine:

**Deep navy + electric blue + controlled orange + premium surfaces +
subtle depth + precise motion.**

The design should never feel like a generic template.

It should feel like a real product that could launch commercially.
