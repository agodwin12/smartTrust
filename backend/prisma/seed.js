/* eslint-disable no-console */
/**
 * Development seed — realistic marketplace content so the frontend can be built
 * against live data: 10 top-level categories (+ sub-categories), 7 seller stores
 * on an active Premium subscription, ~50 published listings (some featured in the
 * hero, some with a compare-at price → /deals).
 *
 * Idempotent: everything is upserted by slug / email, so it can be re-run safely.
 * Photography: Unsplash URLs (licence-free) stored directly as image URLs.
 *
 *   node prisma/seed.js
 */
require("dotenv/config");
const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");

const u = (id, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
const toSlug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "") // "Men's" → "mens", not "men-s"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const SELLER_PASSWORD = "Seller123!";

const CATEGORIES = [
  { name: "Electronics", image: "photo-1498049794561-7780e7231661", children: [
    { name: "Laptops & Computers", image: "photo-1496181133206-80ce9b88a853" },
    { name: "Audio & Headphones", image: "photo-1505740420928-5e560c06d30e" },
    { name: "Cameras", image: "photo-1516035069371-29a1b244cc32" },
    { name: "TVs & Home Theater", image: "photo-1593359677879-a4bb92f829d1" },
  ] },
  { name: "Phones & Tablets", image: "photo-1511707171634-5f897ff02aa9", children: [
    { name: "Smartphones", image: "photo-1592750475338-74b7b21085ab" },
    { name: "Tablets", image: "photo-1544244015-0df4b3ffc6b0" },
    { name: "Wearables & Accessories", image: "photo-1546868871-7041f2a55e12" },
  ] },
  { name: "Fashion", image: "photo-1445205170230-053b83016050", children: [
    { name: "Men's Clothing", image: "photo-1521572163474-6864f9cf17ab" },
    { name: "Women's Clothing", image: "photo-1594633312681-425c7b97ccd1" },
    { name: "Shoes", image: "photo-1542291026-7eec264c27ff" },
    { name: "Bags", image: "photo-1548036328-c9fa89d128fa" },
    { name: "Watches & Jewelry", image: "photo-1515562141207-7a88fb7ce338" },
  ] },
  { name: "Home & Living", image: "photo-1556228453-efd6c1ff04f6", children: [
    { name: "Furniture", image: "photo-1555041469-a586c61ea9bc" },
    { name: "Kitchen & Dining", image: "photo-1556909114-f6e7ad7d3136" },
    { name: "Decor", image: "photo-1524758631624-e2822e304c36" },
  ] },
  { name: "Beauty & Health", image: "photo-1596462502278-27bfdc403348", children: [
    { name: "Skincare", image: "photo-1571781926291-c477ebfd024b" },
    { name: "Makeup", image: "photo-1522335789203-aabd1fc54bc9" },
    { name: "Fragrance", image: "photo-1541643600914-78b084683601" },
  ] },
  { name: "Sports & Outdoors", image: "photo-1517836357463-d25dfeac3438", children: [
    { name: "Fitness", image: "photo-1534438327276-14e5300c3a48" },
    { name: "Football", image: "photo-1461896836934-ffe607ba8211" },
    { name: "Bikes", image: "photo-1485965120184-e220f721d03e" },
  ] },
  { name: "Automotive", image: "photo-1492144534655-ae79c964c9d7", children: [
    { name: "Cars", image: "photo-1503376780353-7e6692767b70" },
    { name: "Motorbikes", image: "photo-1558981403-c5f9899a28bc" },
    { name: "Parts & Accessories", image: "photo-1558618666-fcd25c85cd64" },
  ] },
  { name: "Kids & Toys", image: "photo-1515488042361-ee00e0ddd4e4", children: [
    { name: "Toys", image: "photo-1587654780291-39c9404d746b" },
  ] },
  { name: "Groceries", image: "photo-1542838132-92c53300491e", children: [
    { name: "Fresh Produce", image: "photo-1488459716781-31db52582fe9" },
    { name: "Pantry", image: "photo-1543168256-418811576931" },
  ] },
  { name: "Books & Stationery", image: "photo-1512820790803-83ca734da794", children: [
    { name: "Books", image: "photo-1495446815901-a7297e633e8d" },
  ] },
];

const STORES = [
  { key: "tech", name: "Tech Elite", email: "tech.elite@smartmarket.dev", firstName: "Armand", lastName: "Nkeng", location: "Douala", phone: "+237690000101", banner: "photo-1441986300917-64674bd600d8", description: "Authorised reseller of laptops, phones, audio and cameras. Sealed boxes, 12-month warranty on new items, same-day delivery in Douala." },
  { key: "style", name: "Style Avenue", email: "style.avenue@smartmarket.dev", firstName: "Laura", lastName: "Mbah", location: "Yaoundé", phone: "+237690000102", banner: "photo-1441984904996-e0b6ba687e04", description: "Curated fashion and beauty from international brands. New drops every week, sizes 36–46, exchanges accepted within 7 days." },
  { key: "home", name: "Home Gallery", email: "home.gallery@smartmarket.dev", firstName: "Patrick", lastName: "Fotso", location: "Douala", phone: "+237690000103", banner: "photo-1524758631624-e2822e304c36", description: "Furniture, decor and everything for the home — Scandinavian and modern African styles, delivered and assembled." },
  { key: "luxury", name: "Luxury Finds", email: "luxury.finds@smartmarket.dev", firstName: "Sandrine", lastName: "Etoundi", location: "Bafoussam", phone: "+237690000104", banner: "photo-1472851294608-062f824d29cc", description: "Bags, watches, jewellery and eyewear — 100 % authentic, every item comes with its certificate." },
  { key: "motor", name: "Motor Hub", email: "motor.hub@smartmarket.dev", firstName: "Jean", lastName: "Kamga", location: "Douala", phone: "+237690000105", banner: "photo-1492144534655-ae79c964c9d7", description: "Inspected used cars and motorbikes, plus genuine parts. Every vehicle comes with a 120-point inspection report." },
  { key: "fit", name: "Fit Zone", email: "fit.zone@smartmarket.dev", firstName: "Brice", lastName: "Tchoua", location: "Yaoundé", phone: "+237690000106", banner: "photo-1534438327276-14e5300c3a48", description: "Gym equipment, football gear and bikes for every level. Free delivery in Yaoundé over 50 000 FCFA." },
  { key: "fresh", name: "Fresh Basket", email: "fresh.basket@smartmarket.dev", firstName: "Marie", lastName: "Ngo", location: "Buea", phone: "+237690000107", banner: "photo-1542838132-92c53300491e", description: "Farm-fresh produce and pantry staples from the South-West, delivered within 24 hours of harvest." },
];

// [title, category slug, store key, price, compareAt, condition, images[], options]
const PRODUCTS = [
  ["Sony WH-1000XM5 Wireless Headphones", "audio-headphones", "tech", 185000, 215000, "NEW", ["photo-1505740420928-5e560c06d30e", "photo-1583394838336-acd977736f90"], { featured: true, description: "Industry-leading noise cancelling with two processors and eight microphones. 30-hour battery, multipoint connection, crystal-clear hands-free calling. Sealed box, 12-month warranty." }],
  ["JBL Flip 6 Bluetooth Speaker", "audio-headphones", "tech", 65000, null, "NEW", ["photo-1608043152269-423dbba4e7e1"], { description: "Bold JBL Original Pro sound, IP67 waterproof and dustproof, 12 hours of playtime. Pair two speakers for stereo." }],
  ['MacBook Air M2 13"', "laptops-computers", "tech", 850000, null, "NEW", ["photo-1517336714731-489689fd1ca8", "photo-1496181133206-80ce9b88a853"], { featured: true, description: "Apple M2 chip, 8 GB unified memory, 256 GB SSD, Liquid Retina display, 18-hour battery. Midnight finish, sealed with Apple warranty." }],
  ["HP Pavilion 15 — Core i5, 16 GB RAM, 512 GB SSD", "laptops-computers", "tech", 420000, 480000, "NEW", ["photo-1496181133206-80ce9b88a853"], { description: "12th-gen Intel Core i5, 16 GB RAM, 512 GB NVMe SSD, 15.6-inch Full HD display, backlit keyboard, Windows 11 Home." }],
  ["Dell Latitude 7420 — Refurbished", "laptops-computers", "tech", 260000, null, "USED", ["photo-1541807084-5c52b6b3adef"], { description: "Business-grade ultrabook, Core i7 11th gen, 16 GB RAM, 512 GB SSD. Professionally refurbished, grade A, 6-month warranty." }],
  ["Canon EOS R50 Mirrorless Kit (18–45 mm)", "cameras", "tech", 480000, null, "NEW", ["photo-1516035069371-29a1b244cc32"], { description: "24.2 MP APS-C sensor, 4K 30p video, Dual Pixel autofocus with subject detection. Perfect first mirrorless for creators." }],
  ["Sony Alpha a6400 with 16–50 mm lens", "cameras", "tech", 620000, null, "USED", ["photo-1526170375885-4d8ecf77b99f"], { description: "Lightly used, 4 200 shutter count, includes two batteries and a bag. Real-time eye AF, 4K video, tilting screen." }],
  ['Samsung 55" Crystal UHD 4K Smart TV', "tvs-home-theater", "tech", 390000, 450000, "NEW", ["photo-1593359677879-a4bb92f829d1"], { description: "4K Crystal processor, HDR, Tizen smart platform with Netflix, YouTube and Canal+. Slim design, 3 HDMI ports." }],
  ["iPhone 14 Pro 128 GB — Deep Purple", "smartphones", "tech", 720000, null, "NEW", ["photo-1592750475338-74b7b21085ab", "photo-1511707171634-5f897ff02aa9"], { featured: true, description: "A16 Bionic, Dynamic Island, 48 MP main camera, Always-On display. Sealed, dual SIM (nano + eSIM), 1-year Apple warranty." }],
  ["Samsung Galaxy S23 256 GB", "smartphones", "tech", 540000, 600000, "NEW", ["photo-1610945415295-d9bbf067e59c"], { description: "Snapdragon 8 Gen 2, 50 MP camera with Nightography, 6.1-inch 120 Hz display. Phantom Black, sealed box." }],
  ["Tecno Camon 20 — 256 GB", "smartphones", "tech", 145000, null, "NEW", ["photo-1565849904461-04a58ad377e0"], { description: "64 MP RGBW camera, 8 GB RAM, 5 000 mAh battery with 33 W fast charge. Includes case and screen protector." }],
  ["iPhone 11 64 GB — Black", "smartphones", "tech", 210000, null, "USED", ["photo-1511707171634-5f897ff02aa9"], { description: "Excellent condition, battery health 89 %, no scratches on the screen. Unlocked, comes with cable." }],
  ["iPad 10th Generation 64 GB Wi-Fi", "tablets", "tech", 380000, null, "NEW", ["photo-1544244015-0df4b3ffc6b0"], { description: "10.9-inch Liquid Retina display, A14 Bionic, USB-C, 12 MP landscape front camera. Blue, sealed." }],
  ["Samsung Galaxy Watch 6 44 mm", "wearables-accessories", "tech", 190000, null, "NEW", ["photo-1546868871-7041f2a55e12"], { description: "Sleep coaching, body composition, 40-hour battery, sapphire crystal glass. Bluetooth, graphite." }],

  ["Nike Air Max 270", "shoes", "style", 65000, 78000, "NEW", ["photo-1542291026-7eec264c27ff"], { featured: true, description: "Original Nike Air Max 270 with the tallest Air unit yet. Sizes 40–45 available, sealed box with receipt." }],
  ["Adidas Ultraboost 22", "shoes", "style", 72000, null, "NEW", ["photo-1560343090-f0409e92791a"], { description: "Responsive BOOST cushioning, Primeknit upper, Continental rubber outsole. Sizes 39–45." }],
  ["New Balance 574 Classic", "shoes", "style", 58000, null, "NEW", ["photo-1491553895911-0055eca6402d"], { description: "The iconic 574 in grey suede and mesh. ENCAP midsole for all-day comfort. Sizes 38–44." }],
  ["Slim-Fit Cotton Oxford Shirt", "mens-clothing", "style", 15000, null, "NEW", ["photo-1521572163474-6864f9cf17ab"], { description: "100 % cotton, slim fit, button-down collar. White, sky blue or navy — S to XXL." }],
  ["Summer Floral Midi Dress", "womens-clothing", "style", 22000, 28000, "NEW", ["photo-1594633312681-425c7b97ccd1"], { description: "Lightweight viscose, adjustable straps, side pockets. Sizes 36–44, three prints available." }],
  ["Classic Denim Jacket", "womens-clothing", "style", 28000, null, "NEW", ["photo-1512436991641-6745cdb1723f"], { description: "Mid-wash denim, relaxed fit, brass buttons. Unisex sizing XS–XL." }],
  ["Linen Summer Blazer", "mens-clothing", "style", 45000, null, "NEW", ["photo-1434389677669-e08b4cac3105"], { description: "Breathable European linen, half-lined, two-button. Beige or olive, sizes 46–56." }],
  ["Dior Sauvage Eau de Parfum 100 ml", "fragrance", "style", 78000, null, "NEW", ["photo-1541643600914-78b084683601"], { description: "Authentic with batch code, sealed cellophane. Fresh bergamot, ambroxan and vanilla — the signature men's fragrance." }],
  ["Vitamin C Brightening Skincare Set", "skincare", "style", 25000, 30000, "NEW", ["photo-1571781926291-c477ebfd024b"], { description: "Cleanser, serum, moisturiser and SPF 50 — a complete 4-step routine for even, glowing skin." }],
  ["Matte Lipstick Collection (6 shades)", "makeup", "style", 12000, null, "NEW", ["photo-1522335789203-aabd1fc54bc9"], { description: "Long-wear, transfer-proof matte formula in six nude-to-red shades. Vegan and cruelty-free." }],
  ["Makeup Essentials Kit", "makeup", "style", 32000, null, "NEW", ["photo-1596462502278-27bfdc403348"], { description: "Foundation, concealer, palette, brushes and setting spray in a travel case. Shades for every skin tone." }],

  ["Leather Weekender Bag", "bags", "luxury", 85000, null, "NEW", ["photo-1548036328-c9fa89d128fa"], { featured: true, description: "Full-grain leather, hand-stitched, brass hardware, cotton lining. Fits a 15-inch laptop and two days of clothes." }],
  ["Daniel Wellington Classic 40 mm", "watches-jewelry", "luxury", 95000, null, "NEW", ["photo-1523275335684-37898b6baf30"], { description: "Rose-gold case, eggshell white dial, interchangeable leather strap. Includes box, certificate and 2-year warranty." }],
  ["Ray-Ban Aviator Classic", "watches-jewelry", "luxury", 42000, 49000, "NEW", ["photo-1572635196237-14b3f281503f"], { description: "Gold frame, green G-15 crystal lenses, 100 % UV protection. Original case and cleaning cloth." }],
  ["Gold-Plated Pendant Necklace", "watches-jewelry", "luxury", 35000, null, "NEW", ["photo-1515562141207-7a88fb7ce338"], { description: "18k gold-plated sterling silver, 45 cm chain, minimalist bar pendant. Gift box included." }],
  ["Diamond Stud Earrings 0.5 ct", "watches-jewelry", "luxury", 150000, null, "NEW", ["photo-1573408301185-9146fe634ad0"], { description: "Round brilliant diamonds, 14k white gold settings, GIA-graded. Certificate of authenticity included." }],

  ["Scandinavian Lounge Chair", "furniture", "home", 145000, null, "NEW", ["photo-1555041469-a586c61ea9bc"], { featured: true, description: "Solid oak frame, wool-blend cushion, curved armrests. Assembled and delivered in Douala within 48 hours." }],
  ["3-Seater Fabric Sofa — Grey", "furniture", "home", 320000, 380000, "NEW", ["photo-1567016432779-094069958ea5"], { description: "Deep seats, high-density foam, removable washable covers. 210 cm wide, solid wood legs." }],
  ["Queen Bed Frame with Upholstered Headboard", "furniture", "home", 260000, null, "NEW", ["photo-1505693416388-ac5ce068fe85"], { description: "160 × 200 cm, slatted base included, linen-look upholstery. Mattress sold separately." }],
  ["Ceramic Dinner Set — 24 pieces", "kitchen-dining", "home", 38000, null, "NEW", ["photo-1556909114-f6e7ad7d3136"], { description: "Service for six: dinner plates, side plates, bowls and mugs. Dishwasher and microwave safe." }],
  ["Boho Wall Decor Set", "decor", "home", 24000, null, "NEW", ["photo-1524758631624-e2822e304c36"], { description: "Macramé hanging, two rattan mirrors and a woven basket — a ready-made accent wall." }],
  ["Modern Living Room Rug 200 × 290", "decor", "home", 55000, null, "NEW", ["photo-1586023492125-27b2c045efd7"], { description: "Low-pile, stain-resistant polypropylene, geometric pattern in warm neutrals. Non-slip backing." }],
  ["Wooden Educational Toy Set", "toys", "home", 18000, null, "NEW", ["photo-1587654780291-39c9404d746b"], { description: "Shape sorter, stacking rings and abacus in natural beech wood. Non-toxic paint, ages 1–4." }],
  ["Plush Animals Bundle (5 pcs)", "toys", "home", 12000, null, "NEW", ["photo-1515488042361-ee00e0ddd4e4"], { description: "Five super-soft plush animals, machine washable, safety-tested for newborns." }],
  ["Atomic Habits — James Clear", "books", "home", 9500, null, "NEW", ["photo-1512820790803-83ca734da794"], { description: "The #1 bestseller on building good habits and breaking bad ones. Paperback, English edition." }],
  ["Classic Novels Bundle (5 books)", "books", "home", 22000, null, "USED", ["photo-1495446815901-a7297e633e8d"], { description: "Pride and Prejudice, 1984, The Great Gatsby, Things Fall Apart and Jane Eyre. Good condition, no markings." }],

  ["Adjustable Dumbbell Set 20 kg", "fitness", "fit", 68000, null, "NEW", ["photo-1534438327276-14e5300c3a48"], { description: "Two dumbbells with cast-iron plates, 2.5 to 10 kg each, knurled grips and secure spin-lock collars." }],
  ["Premium Non-Slip Yoga Mat", "fitness", "fit", 15000, null, "NEW", ["photo-1571019613454-1cb2f99b2d8b"], { description: "6 mm TPE, dual-layer, alignment lines, carry strap. Odourless and eco-friendly." }],
  ["Adidas Match Football — Size 5", "football", "fit", 18000, null, "NEW", ["photo-1461896836934-ffe607ba8211"], { description: "FIFA Quality Pro, thermally bonded panels, butyl bladder for air retention. Training and match play." }],
  ['Mountain Bike 27.5" — 21 speed', "bikes", "fit", 185000, null, "USED", ["photo-1485965120184-e220f721d03e"], { description: "Aluminium frame, Shimano gears, front suspension, disc brakes. Serviced last month, new tyres." }],

  ["Toyota Corolla 2016 — 1.8 automatic", "cars", "motor", 7500000, null, "USED", ["photo-1503376780353-7e6692767b70"], { featured: true, description: "98 000 km, one owner, full service history, air conditioning, reverse camera. Inspection report available on request." }],
  ["Honda CB 125F", "motorbikes", "motor", 950000, null, "USED", ["photo-1558981403-c5f9899a28bc"], { description: "2021 model, 12 500 km, fuel-injected, excellent commuter. Papers in order, helmet included." }],
  ["LED Headlight Kit H4 — 6000K", "parts-accessories", "motor", 25000, null, "NEW", ["photo-1558618666-fcd25c85cd64"], { description: "Plug-and-play, 12 000 lumens per pair, IP68, fan-cooled. Fits most Toyota, Hyundai and Kia models." }],
  ["Mercedes-Benz C200 2018", "cars", "motor", 16500000, null, "USED", ["photo-1552519507-da3b142c6e3d"], { description: "62 000 km, AMG Line, panoramic roof, leather interior, full Mercedes service history. Duty paid." }],

  ["Organic Vegetable Box (5 kg)", "fresh-produce", "fresh", 8500, null, "NEW", ["photo-1488459716781-31db52582fe9"], { description: "Seasonal vegetables from Buea farms: tomatoes, peppers, huckleberry, carrots, plantains. Harvested the day before delivery." }],
  ["Weekly Pantry Basket", "pantry", "fresh", 25000, 29000, "NEW", ["photo-1543168256-418811576931"], { description: "Rice, oil, pasta, tomato paste, sugar, salt and spices for a family of four for one week." }],
  ["Fresh Fruit Selection (3 kg)", "fresh-produce", "fresh", 9000, null, "NEW", ["photo-1542838132-92c53300491e"], { description: "Papaya, pineapple, bananas, mangoes and passion fruit — whatever is ripest this week." }],
];

async function main() {
  console.log("Seeding SmartPlaze…");

  // --- Categories -----------------------------------------------------------
  const categoryBySlug = new Map();
  for (const top of CATEGORIES) {
    const slug = toSlug(top.name);
    const parent = await prisma.category.upsert({
      where: { slug },
      create: { name: top.name, slug, imageUrl: u(top.image, 900) },
      update: { name: top.name, imageUrl: u(top.image, 900) },
    });
    categoryBySlug.set(slug, parent);
    for (const child of top.children) {
      const childSlug = toSlug(child.name);
      const row = await prisma.category.upsert({
        where: { slug: childSlug },
        create: { name: child.name, slug: childSlug, imageUrl: u(child.image, 900), parentId: parent.id },
        update: { name: child.name, imageUrl: u(child.image, 900), parentId: parent.id },
      });
      categoryBySlug.set(childSlug, row);
    }
  }
  console.log(`  categories: ${categoryBySlug.size}`);

  // --- Sellers, stores, wallets, subscriptions ------------------------------
  const premium = await prisma.subscriptionPlan.findUnique({ where: { name: "Premium" } });
  if (!premium) throw new Error("Subscription plan 'Premium' not found — seed plans first.");

  const passwordHash = await bcrypt.hash(SELLER_PASSWORD, 12);
  const storeByKey = new Map();
  for (const s of STORES) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: { email: s.email, passwordHash, firstName: s.firstName, lastName: s.lastName, phone: s.phone, emailVerifiedAt: new Date() },
      update: { firstName: s.firstName, lastName: s.lastName, emailVerifiedAt: new Date() },
    });
    const slug = toSlug(s.name);
    const store = await prisma.store.upsert({
      where: { slug },
      create: {
        ownerId: user.id, name: s.name, slug, description: s.description, bannerUrl: u(s.banner, 1600),
        location: s.location, contactEmail: s.email, contactPhone: s.phone, status: "ACTIVE",
        wallet: { create: {} },
      },
      update: { description: s.description, bannerUrl: u(s.banner, 1600), location: s.location, status: "ACTIVE" },
    });
    await prisma.wallet.upsert({ where: { storeId: store.id }, create: { storeId: store.id }, update: {} });

    const active = await prisma.subscription.findFirst({
      where: { storeId: store.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (!active) {
      await prisma.subscription.create({
        data: { storeId: store.id, planId: premium.id, status: "ACTIVE", startsAt: new Date(), expiresAt: daysFromNow(premium.durationDays) },
      });
    }
    storeByKey.set(s.key, store);
  }
  console.log(`  stores: ${storeByKey.size} (password for every seller: ${SELLER_PASSWORD})`);

  // --- Listings --------------------------------------------------------------
  let created = 0;
  const publishedPerStore = new Map();
  for (let i = 0; i < PRODUCTS.length; i++) {
    const [title, categorySlug, storeKey, price, compareAtPrice, condition, images, opts = {}] = PRODUCTS[i];
    const category = categoryBySlug.get(categorySlug);
    const store = storeByKey.get(storeKey);
    if (!category || !store) throw new Error(`Bad seed row: ${title} (${categorySlug}/${storeKey})`);

    const slug = toSlug(title);
    const data = {
      title,
      description: opts.description ?? `${title} — available now from ${store.name}.`,
      price,
      compareAtPrice,
      condition,
      location: store.location,
      images: images.map((id) => u(id)),
      status: "PUBLISHED",
      categoryId: category.id,
      storeId: store.id,
      viewCount: 20 + ((i * 137) % 880),
      ...(opts.featured
        ? { featuredAt: daysAgo(1), featuredUntil: daysFromNow(14), featuredById: store.ownerId }
        : {}),
    };
    await prisma.advertisement.upsert({
      where: { slug },
      create: { ...data, slug, createdAt: daysAgo((i * 7) % 30) },
      update: data,
    });
    publishedPerStore.set(store.id, (publishedPerStore.get(store.id) ?? 0) + 1);
    created++;
  }
  for (const [storeId, count] of publishedPerStore) {
    await prisma.subscription.updateMany({ where: { storeId, status: "ACTIVE" }, data: { adsUsed: count } });
  }
  console.log(`  listings: ${created} published (${PRODUCTS.filter((p) => p[7]?.featured).length} featured, ${PRODUCTS.filter((p) => p[4]).length} deals)`);

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
