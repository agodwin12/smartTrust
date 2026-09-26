import type { Localized, PageContent } from "@/content/types";

export const about: Localized<PageContent> = {
  en: {
    title: "About SmartPlaze",
    subtitle: "A marketplace built on trust, made in Cameroon.",
    intro:
      "SmartPlaze (Smarttrustexpress) was created by Godwin Tech Solution to fix the one thing that stops people from buying and selling online in Central Africa: trust. We put escrow at the centre of every transaction so that buyers pay with confidence and sellers get paid, every time.",
    sections: [
      {
        heading: "Our mission",
        paragraphs: [
          "Give every small business and independent seller a storefront that buyers can trust — and give every buyer a guarantee that their money is safe until they hold the product in their hands.",
        ],
      },
      {
        heading: "What makes us different",
        bullets: [
          "Escrow on every order: the seller is paid only after the buyer confirms receipt.",
          "Verified stores with public profiles, banners and tap-to-call contact.",
          "Mobile Money first: MTN Mobile Money and Orange Money for payments and payouts.",
          "Fair disputes: a human team reviews both sides and decides within days.",
        ],
      },
      {
        heading: "Who we are",
        paragraphs: [
          "Godwin Tech Solution is a software company building products for African businesses — from logistics and fintech to marketplaces. SmartPlaze is our own product: we design it, build it and run it.",
        ],
      },
      {
        heading: "Contact",
        bullets: ["Support: support@smartplaze.com", "Partnerships: hello@smartplaze.com"],
      },
    ],
  },
  fr: {
    title: "À propos de SmartPlaze",
    subtitle: "Une marketplace fondée sur la confiance, faite au Cameroun.",
    intro:
      "SmartPlaze (Smarttrustexpress) a été créée par Godwin Tech Solution pour résoudre ce qui empêche les gens d'acheter et de vendre en ligne en Afrique centrale : la confiance. Nous plaçons le séquestre au cœur de chaque transaction pour que les acheteurs paient en confiance et que les vendeurs soient payés, à chaque fois.",
    sections: [
      {
        heading: "Notre mission",
        paragraphs: [
          "Offrir à chaque petite entreprise et vendeur indépendant une vitrine à laquelle les acheteurs font confiance — et garantir à chaque acheteur que son argent est en sécurité jusqu'à ce qu'il tienne le produit entre ses mains.",
        ],
      },
      {
        heading: "Ce qui nous distingue",
        bullets: [
          "Séquestre sur chaque commande : le vendeur n'est payé qu'après la confirmation de réception par l'acheteur.",
          "Boutiques vérifiées avec profil public, bannière et contact d'un geste.",
          "Mobile Money d'abord : MTN Mobile Money et Orange Money pour les paiements et les retraits.",
          "Litiges équitables : une équipe humaine examine les deux parties et tranche en quelques jours.",
        ],
      },
      {
        heading: "Qui sommes-nous",
        paragraphs: [
          "Godwin Tech Solution est une société de logiciels qui construit des produits pour les entreprises africaines — de la logistique et la fintech aux marketplaces. SmartPlaze est notre propre produit : nous le concevons, le développons et l'exploitons.",
        ],
      },
      {
        heading: "Contact",
        bullets: ["Support : support@smartplaze.com", "Partenariats : hello@smartplaze.com"],
      },
    ],
  },
};
