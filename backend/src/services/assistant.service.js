const advertisementService = require("./advertisement.service");
const categoryService = require("./category.service");
const orderService = require("./order.service");
const planService = require("./subscriptionPlan.service");

/**
 * Storefront chat for shoppers and sellers. It answers without any AI model: keyword intents in
 * English and French over live data (product search with budgets, the user's own orders, escrow,
 * cash on delivery, plans, selling, deals, categories) and a hand-off to a person on WhatsApp.
 * Gemini is reserved for the Super Admin back-office assistant (adminAssistant.service.js).
 */

const CARD_LIMIT = 6;
const isEnabled = () => true;
const mode = () => "basic";

const money = (value) => `${Math.round(Number(value)).toLocaleString("en-US")} FCFA`;

const productCard = (ad) => ({
  id: ad.id,
  title: ad.title,
  slug: ad.slug,
  price: String(ad.price),
  compareAtPrice: ad.compareAtPrice ? String(ad.compareAtPrice) : null,
  condition: ad.condition,
  location: ad.location,
  image: ad.images?.[0] ?? null,
  store: ad.store ? { name: ad.store.name, slug: ad.store.slug } : null,
});

const orderCard = (order) => ({
  id: order.id,
  title: order.advertisement?.title ?? "",
  slug: order.advertisement?.slug ?? null,
  image: order.advertisement?.images?.[0] ?? null,
  status: order.status,
  totalAmount: String(order.totalAmount),
  createdAt: order.createdAt,
});

/** Runs one tool call. Returns { text, products?, orders? } — text goes back to the model. */
/* ------------------------------------------------------------------------- */
/* Built-in answers                                                           */
/* ------------------------------------------------------------------------- */

const fold = (text) => String(text ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const FRENCH_HINTS = /\b(je|j'|bonjour|salut|bonsoir|merci|commande|commandes|vendre|vendeur|boutique|prix|livraison|cherche|voudrais|acheter|combien|pourquoi|comment|quoi|mes|mon|ma|abonnement|especes|paiement|sequestre)\b/;

const INTENTS = [
  ["human", /\b(human|agent|person|someone|real person|support|customer service|whatsapp|call|phone|contact|humain|conseiller|parler a|appeler|joindre|service client|assistance)\b/],
  ["orders", /\b(my orders?|order status|track|tracking|where is my|delivered|mes commandes|ma commande|commande|suivi|suivre|colis|statut)\b/],
  ["cod", /\b(cash|cash on delivery|pay on delivery|especes|a la livraison|paiement a la livraison|cod)\b/],
  ["escrow", /\b(escrow|sequestre|safe|secure|refund|rembours\w*|dispute|litige|mobile money|momo|orange money|mtn|payment|paiement|payer|pay)\b/],
  ["plans", /\b(plans?|subscriptions?|abonnements?|pricing|quota|forfaits?)\b/],
  ["sell", /\b(sell|seller|selling|vendre|vendeur|open a store|open a shop|ouvrir une boutique|become a|devenir)\b/],
  ["deals", /\b(deals?|promos?|promotions?|discounts?|reductions?|flash|sales?|soldes?)\b/],
  ["categories", /\b(categor\w*|departments?|rayons?|what do you sell|what can i buy|que vendez)\b/],
];

const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|bonjour|salut|bonsoir|coucou|yo)\b[\s!.,?]*$/;
const THANKS = /^(thanks|thank you|merci|ok|okay|d'accord|super|great|cool)\b[\s!.,?a-z]*$/;

// Words that carry no product meaning, dropped before searching the catalogue.
const STOP_WORDS = new Set(("i im i'm want wanna need looking look for find show me please buy get a an the some any do you have is there are there price prices cost how much of in on at to with " +
  "je veux voudrais cherche chercher recherche trouver acheter besoin avez vous un une des de du le la les pour avec prix combien coute svp stp moi il y a est ce que qu").split(" "));

/** "under 50 000", "moins de 50k", "max 20000 fcfa" → 50000 / 20000. */
function parseMaxPrice(text) {
  const match = text.match(/\b(under|below|less than|max(?:imum)?|moins de|sous|pas plus de|au plus)\s*([\d][\d\s.,]*)\s*(k|mille)?/);
  if (!match) return undefined;
  const amount = Number(match[2].replace(/[\s.,]/g, "")) * (match[3] ? 1000 : 1);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

// Catalogue titles are mostly English: common French product words are translated before searching.
const FR_TO_EN = {
  canape: "sofa", canapes: "sofa", fauteuil: "armchair", chaise: "chair", chaises: "chair", lit: "bed", matelas: "mattress", armoire: "wardrobe",
  table: "table", lampe: "lamp", rideau: "curtain", rideaux: "curtain", tableau: "canvas", tableaux: "canvas", cadre: "frame", cadres: "frame",
  telephone: "phone", telephones: "phone", portable: "phone", ordinateur: "laptop", ordinateurs: "laptop", tablette: "tablet", ecouteurs: "earbuds",
  television: "tv", tele: "tv", camera: "camera", cameras: "camera", montre: "watch", montres: "watch", enceinte: "speaker",
  refrigerateur: "fridge", frigo: "fridge", congelateur: "freezer", mixeur: "blender", cuisiniere: "cooker", ventilateur: "fan", climatiseur: "air conditioner",
  chaussures: "shoes", chaussure: "shoes", baskets: "sneakers", robe: "dress", robes: "dress", chemise: "shirt", pantalon: "trousers", sac: "bag", sacs: "bag",
  parfum: "perfume", lunettes: "glasses", bijoux: "jewellery", voiture: "car", voitures: "car", moto: "motorbike", velo: "bike", pneu: "tyre", pneus: "tyre",
  jouet: "toy", jouets: "toy", livre: "book", livres: "book", solaire: "solar", occasion: "used",
};

function searchTerms(text) {
  return text
    .replace(/\b(under|below|less than|max(?:imum)?|moins de|sous|pas plus de|au plus)\s*[\d][\d\s.,]*\s*(k|mille|fcfa|f|xaf)?/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => FR_TO_EN[w] ?? w)
    .slice(0, 6)
    .join(" ");
}

const say = (lang, en, fr) => (lang === "fr" ? fr : en);

function contactLine(lang) {
  const { site } = require("../config/env");
  const whatsapp = site.whatsapp ? `WhatsApp: https://wa.me/${site.whatsapp}` : null;
  return say(
    lang,
    `You can reach our team${whatsapp ? ` on ${whatsapp}` : ""} or through the contact form at /help/contact.`,
    `Vous pouvez joindre notre équipe${whatsapp ? ` sur ${whatsapp}` : ""} ou via le formulaire /help/contact.`
  );
}

async function basicChat({ messages, locale = "en", user = null }) {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const raw = typeof last?.content === "string" ? last.content : "";
  const text = fold(raw).trim();
  const lang = FRENCH_HINTS.test(text) ? "fr" : locale === "fr" ? "fr" : "en";
  const done = (reply, extra = {}) => ({ reply, products: [], orders: [], model: "basic", usage: { input: 0, output: 0 }, ...extra });

  if (!text) return done(say(lang, "What are you looking for today?", "Que recherchez-vous aujourd'hui ?"));
  if (GREETING.test(text)) {
    return done(say(lang,
      "Hello! Tell me what you are looking for (for example \"sofa under 300000\") and I will show you listings. I can also track your orders, explain escrow or cash on delivery, and help you start selling.",
      "Bonjour ! Dites-moi ce que vous cherchez (par exemple « canapé moins de 300000 ») et je vous montre les annonces. Je peux aussi suivre vos commandes, expliquer le séquestre ou le paiement à la livraison, et vous aider à vendre."));
  }
  if (THANKS.test(text)) return done(say(lang, "You're welcome! Anything else I can help with?", "Avec plaisir ! Puis-je vous aider pour autre chose ?"));

  const intent = INTENTS.find(([, pattern]) => pattern.test(text))?.[0];

  switch (intent) {
    case "human":
      return done(say(lang, "Of course. ", "Bien sûr. ") + contactLine(lang));
    case "orders": {
      if (!user) {
        return done(say(lang,
          "Sign in at /login to see your orders here. If you ordered as a guest, open the tracking link from your confirmation, or enter your order reference and phone number at /orders/track.",
          "Connectez-vous sur /login pour voir vos commandes ici. Si vous avez commandé en invité, ouvrez le lien de suivi de votre confirmation, ou saisissez votre référence et votre numéro sur /orders/track."));
      }
      const { items } = await orderService.listMineAsBuyer(user.id, { pageSize: 5 });
      if (items.length === 0) return done(say(lang, "You have no orders yet. Browse /categories to find something you like.", "Vous n'avez pas encore de commande. Parcourez /categories pour trouver votre bonheur."));
      return done(say(lang, `Here are your ${items.length} most recent orders. Open one to confirm receipt or see its status. All of them are also in /account/orders.`, `Voici vos ${items.length} dernières commandes. Ouvrez-en une pour confirmer la réception ou voir son statut. Elles sont toutes dans /account/orders.`), { orders: items.map(orderCard) });
    }
    case "cod":
      return done(say(lang,
        "Most stores accept cash on delivery: choose it at checkout, give your address and phone, and pay the seller in cash when you receive the item. Then confirm receipt in /account/orders. Cash orders are not covered by escrow, but you can cancel until the seller confirms delivery.",
        "La plupart des boutiques acceptent le paiement à la livraison : choisissez-le à la commande, indiquez votre adresse et votre téléphone, puis payez le vendeur en espèces à la réception. Confirmez ensuite la réception dans /account/orders. Les commandes en espèces ne sont pas couvertes par le séquestre, mais vous pouvez annuler tant que le vendeur n'a pas confirmé la livraison."));
    case "escrow":
      return done(say(lang,
        "When you pay by MTN Mobile Money or Orange Money, SmartPlaze holds the money in escrow. The seller delivers, you check the item and confirm receipt in /account/orders, and only then is the seller paid. If something is wrong, open a dispute from the order page before confirming and our team will review it. More at /how-it-works.",
        "Quand vous payez par MTN Mobile Money ou Orange Money, SmartPlaze garde l'argent sous séquestre. Le vendeur livre, vous vérifiez l'article et confirmez la réception dans /account/orders, et seulement alors le vendeur est payé. En cas de problème, ouvrez un litige depuis la commande avant de confirmer et notre équipe l'examinera. Plus de détails sur /how-it-works."));
    case "plans": {
      const plans = await planService.listPlans();
      const lines = plans.map((p) => `• ${p.name}: ${money(p.price)} / ${p.durationDays} ${say(lang, "days", "jours")}, ${p.adQuota} ${say(lang, "listings", "annonces")}`).join("\n");
      return done(say(lang, `Our seller plans:\n${lines}\nCompare them at /subscriptions.`, `Nos forfaits vendeurs :\n${lines}\nComparez-les sur /subscriptions.`));
    }
    case "sell":
      return done(say(lang,
        "Selling on SmartPlaze:\n1. Create an account and verify your email.\n2. Open your store at /sell. Our team reviews new stores, usually quickly.\n3. Once approved, pick a plan at /subscriptions and publish your listings (up to 8 photos each).\n4. Deliver your orders and withdraw your earnings to Mobile Money.",
        "Vendre sur SmartPlaze :\n1. Créez un compte et vérifiez votre e-mail.\n2. Ouvrez votre boutique sur /sell. Notre équipe valide les nouvelles boutiques, généralement rapidement.\n3. Une fois validée, choisissez un forfait sur /subscriptions et publiez vos annonces (jusqu'à 8 photos).\n4. Livrez vos commandes et retirez vos gains vers Mobile Money."));
    case "deals": {
      const { items } = await advertisementService.list({ deals: true, sort: "popular", pageSize: CARD_LIMIT });
      if (items.length === 0) return done(say(lang, "No deals are running right now. New ones appear on /deals.", "Aucune promotion en ce moment. Les nouvelles apparaissent sur /deals."));
      return done(say(lang, "Here are today's best deals. See them all at /deals.", "Voici les meilleures promos du jour. Toutes sur /deals."), { products: items.map(productCard) });
    }
    case "categories": {
      const { items } = await categoryService.listCategories({ parentId: "root", pageSize: 30 });
      const names = items.map((c) => c.name).join(", ");
      return done(say(lang, `We have: ${names}. Browse them at /categories, or tell me what you need.`, `Nous avons : ${names}. Parcourez-les sur /categories, ou dites-moi ce qu'il vous faut.`));
    }
    default: {
      const maxPrice = parseMaxPrice(text);
      const query = searchTerms(text);
      if (!query && !maxPrice) return done(say(lang, "Tell me the product you want, for example \"iPhone\", \"sofa\" or \"shoes under 20000\".", "Dites-moi le produit voulu, par exemple « iPhone », « canapé » ou « chaussures moins de 20000 »."));
      let { items } = await advertisementService.list({ search: query || undefined, maxPrice, sort: "popular", pageSize: CARD_LIMIT });
      // Several words with no hit: retry with the most specific single word.
      if (items.length === 0 && query.includes(" ")) {
        const longest = query.split(" ").sort((a, b) => b.length - a.length)[0];
        ({ items } = await advertisementService.list({ search: longest, maxPrice, sort: "popular", pageSize: CARD_LIMIT }));
      }
      if (items.length === 0) {
        return done(say(lang,
          `I couldn't find listings for "${raw.trim().slice(0, 60)}". Try another word or browse /categories. `,
          `Je n'ai pas trouvé d'annonce pour « ${raw.trim().slice(0, 60)} ». Essayez un autre mot ou parcourez /categories. `) + contactLine(lang));
      }
      const label = query || say(lang, "your budget", "votre budget");
      return done(say(lang,
        `Here ${items.length === 1 ? "is 1 listing" : `are ${items.length} listings`} for "${label}"${maxPrice ? ` under ${money(maxPrice)}` : ""}. More results at /search?q=${encodeURIComponent(query)}.`,
        `Voici ${items.length} annonce${items.length > 1 ? "s" : ""} pour « ${label} »${maxPrice ? ` à moins de ${money(maxPrice)}` : ""}. Plus de résultats sur /search?q=${encodeURIComponent(query)}.`), { products: items.map(productCard) });
    }
  }
}

async function chat({ messages, locale = "en", user = null }) {
  return basicChat({ messages, locale, user });
}

module.exports = { chat, isEnabled, mode, basicChat };
