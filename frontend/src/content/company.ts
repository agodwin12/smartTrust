import type { Localized, PageContent } from "@/content/types";

export const about: Localized<PageContent> = {
  en: {
    title: "About SmartPlaze",
    subtitle: "A marketplace built on trust, made in Cameroon.",
    intro:
      "SmartPlaze (SmartTrustExpress) was built to make online buying and selling safer and more trustworthy across Cameroon and Central Africa. Through our secure escrow system, buyers can shop with confidence while sellers receive payments securely. The vision was conceived by Che Blaise and developed into a modern digital marketplace by Godwin Tech Solution, combining local insight with innovative technology. Today, we continue to connect people and businesses through a reliable eCommerce experience.",
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
        heading: "Contact",
        bullets: ["Support: support@smartplaze.com", "Partnerships: hello@smartplaze.com"],
      },
    ],
  },
  fr: {
    title: "À propos de SmartPlaze",
    subtitle: "Une marketplace fondée sur la confiance, faite au Cameroun.",
    intro:
      "SmartPlaze (SmartTrustExpress) a été créée pour rendre l'achat et la vente en ligne plus sûrs et plus fiables au Cameroun et en Afrique centrale. Grâce à notre système de séquestre sécurisé, les acheteurs achètent en toute confiance et les vendeurs reçoivent leurs paiements en toute sécurité. La vision a été conçue par Che Blaise et transformée en une marketplace numérique moderne par Godwin Tech Solution, alliant la connaissance du terrain à une technologie innovante. Aujourd'hui, nous continuons de connecter les personnes et les entreprises grâce à une expérience e-commerce fiable.",
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
        heading: "Contact",
        bullets: ["Support : support@smartplaze.com", "Partenariats : hello@smartplaze.com"],
      },
    ],
  },
};
