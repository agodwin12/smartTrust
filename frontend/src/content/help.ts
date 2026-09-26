import type { FaqItem } from "@/components/content/FaqAccordion";
import type { Localized, PageContent } from "@/content/types";

export const howItWorks: Localized<PageContent> = {
  en: {
    title: "How SmartPlaze works",
    subtitle: "Buying and selling with escrow, step by step.",
    intro:
      "SmartPlaze is a marketplace where every payment goes through escrow: the buyer pays SmartPlaze, not the seller, and the money is only released once the order is confirmed by both sides. Here is exactly what happens.",
    sections: [
      {
        id: "buying",
        heading: "Buying",
        steps: [
          { title: "Find a listing", description: "Browse categories, deals or search. Every listing belongs to a verified store with a public profile." },
          { title: "Buy now", description: "Choose a quantity and pay with MTN Mobile Money or Orange Money. You approve the payment on your phone with your PIN." },
          { title: "SmartPlaze holds the money", description: "The amount sits in escrow. The seller can see the order is paid but cannot touch the funds." },
          { title: "The seller delivers", description: "The seller hands over or ships the item and confirms delivery in their dashboard." },
          { title: "You confirm receipt", description: "Check the item, then confirm receipt in My orders. Only then is the seller paid." },
        ],
      },
      {
        id: "escrow-explained",
        heading: "Escrow, in plain words",
        paragraphs: [
          "Escrow means a trusted third party keeps the money while a deal is being completed. On SmartPlaze that third party is the platform itself.",
          "Because both the buyer and the seller have to confirm before funds move, neither side can be cheated: a buyer never pays for something that never arrives, and a seller never delivers something that never gets paid.",
        ],
      },
      {
        id: "selling",
        heading: "Selling",
        steps: [
          { title: "Create your account and store", description: "Sign up, verify your email, then open your store with a name, logo, location and contact details." },
          { title: "Choose a plan", description: "Starter, Business or Premium — each plan gives you a number of listings for a period. Pay with Mobile Money." },
          { title: "Publish listings", description: "Add photos, a price, a description and the condition. Business and Premium sellers can feature a listing in the hero." },
          { title: "Deliver, confirm, get paid", description: "When an order is paid, deliver it and confirm. Once the buyer confirms too, the money lands in your wallet, ready to withdraw." },
        ],
      },
      {
        id: "disputes",
        heading: "When something goes wrong",
        bullets: [
          "Either side can open a dispute while an order is paid and not yet completed.",
          "A dispute freezes the order: nobody can confirm or release funds until SmartPlaze reviews it.",
          "Our team looks at the evidence from both sides and either releases the money to the seller or refunds the buyer.",
        ],
      },
      {
        id: "payments",
        heading: "Payments and payouts",
        bullets: [
          "Buyers pay with MTN Mobile Money or Orange Money (Cameroon).",
          "Sellers withdraw their wallet balance to their own Mobile Money number.",
          "All amounts are in FCFA. Prices shown are the final prices.",
        ],
      },
    ],
  },
  fr: {
    title: "Comment fonctionne SmartPlaze",
    subtitle: "Acheter et vendre avec le séquestre, étape par étape.",
    intro:
      "SmartPlaze est une marketplace où chaque paiement passe par un séquestre : l'acheteur paie SmartPlaze, pas le vendeur, et l'argent n'est libéré qu'une fois la commande confirmée par les deux parties. Voici exactement ce qui se passe.",
    sections: [
      {
        id: "buying",
        heading: "Acheter",
        steps: [
          { title: "Trouvez une annonce", description: "Parcourez les catégories, les promos ou la recherche. Chaque annonce appartient à une boutique vérifiée avec un profil public." },
          { title: "Achetez", description: "Choisissez une quantité et payez avec MTN Mobile Money ou Orange Money. Vous approuvez le paiement sur votre téléphone avec votre code PIN." },
          { title: "SmartPlaze conserve l'argent", description: "Le montant est placé sous séquestre. Le vendeur voit que la commande est payée mais ne peut pas toucher les fonds." },
          { title: "Le vendeur livre", description: "Le vendeur remet ou expédie l'article et confirme la livraison dans son espace." },
          { title: "Vous confirmez la réception", description: "Vérifiez l'article, puis confirmez la réception dans Mes commandes. Ce n'est qu'à ce moment que le vendeur est payé." },
        ],
      },
      {
        id: "escrow-explained",
        heading: "Le séquestre, en clair",
        paragraphs: [
          "Le séquestre, c'est un tiers de confiance qui garde l'argent pendant qu'une transaction se termine. Sur SmartPlaze, ce tiers est la plateforme elle-même.",
          "Comme l'acheteur et le vendeur doivent tous deux confirmer avant que les fonds bougent, personne ne peut être lésé : un acheteur ne paie jamais pour un article qui n'arrive pas, et un vendeur ne livre jamais un article qui ne sera pas payé.",
        ],
      },
      {
        id: "selling",
        heading: "Vendre",
        steps: [
          { title: "Créez votre compte et votre boutique", description: "Inscrivez-vous, vérifiez votre e-mail, puis ouvrez votre boutique avec un nom, un logo, un lieu et des coordonnées." },
          { title: "Choisissez un plan", description: "Starter, Business ou Premium — chaque plan donne un nombre d'annonces pour une période. Payez par Mobile Money." },
          { title: "Publiez des annonces", description: "Ajoutez des photos, un prix, une description et l'état. Les vendeurs Business et Premium peuvent mettre une annonce à la une." },
          { title: "Livrez, confirmez, soyez payé", description: "Quand une commande est payée, livrez-la et confirmez. Dès que l'acheteur confirme aussi, l'argent arrive dans votre portefeuille, prêt à être retiré." },
        ],
      },
      {
        id: "disputes",
        heading: "Quand quelque chose ne va pas",
        bullets: [
          "Chaque partie peut ouvrir un litige tant qu'une commande est payée et pas encore terminée.",
          "Un litige gèle la commande : personne ne peut confirmer ni libérer les fonds tant que SmartPlaze ne l'a pas examiné.",
          "Notre équipe étudie les éléments des deux parties et libère l'argent au vendeur ou rembourse l'acheteur.",
        ],
      },
      {
        id: "payments",
        heading: "Paiements et retraits",
        bullets: [
          "Les acheteurs paient avec MTN Mobile Money ou Orange Money (Cameroun).",
          "Les vendeurs retirent le solde de leur portefeuille vers leur propre numéro Mobile Money.",
          "Tous les montants sont en FCFA. Les prix affichés sont les prix finaux.",
        ],
      },
    ],
  },
};

export const sellerGuide: Localized<PageContent> = {
  en: {
    title: "Seller guide",
    subtitle: "Everything you need to open a store and get paid.",
    intro: "From your first listing to your first withdrawal — this is the playbook our best sellers follow.",
    sections: [
      {
        heading: "1. Open your store",
        bullets: [
          "Use a clear store name buyers can remember and a square logo (at least 400 × 400 px).",
          "Add a banner photo, your city and a phone number buyers can tap to call.",
          "Write two or three sentences about what you sell and why buyers can trust you.",
        ],
      },
      {
        heading: "2. Pick the right plan",
        paragraphs: [
          "Starter is for testing the waters. Business gives you more listings and 48-hour hero placement. Premium is for shops that list every day and want a year of visibility with 72-hour hero placements.",
          "Your plan renews from your seller dashboard; expired plans hide your listings until you renew — nothing is deleted.",
        ],
      },
      {
        heading: "3. Publish listings that sell",
        bullets: [
          "Photos: bright, sharp, plain background, several angles. Up to 8 per listing.",
          "Title: brand + model + key detail (\"iPhone 14 Pro 128 GB — Deep Purple\").",
          "Price: the final price in FCFA. Add a compare-at price to appear in Deals when you discount.",
          "Condition and location: be honest — buyers can open a dispute if the item doesn't match.",
        ],
      },
      {
        heading: "4. Hero placement",
        paragraphs: [
          "Business and Premium sellers can feature one of their published listings in the homepage hero and in its category hero for the duration defined by their plan. SmartPlaze admins may also feature outstanding listings.",
        ],
      },
      {
        heading: "5. Handle orders",
        steps: [
          { title: "You get a paid order", description: "The buyer's money is in escrow. Prepare the item." },
          { title: "Deliver", description: "Hand it over in person or ship it. Keep a proof of delivery." },
          { title: "Confirm delivery", description: "Mark the order as delivered in your dashboard." },
          { title: "Buyer confirms", description: "Once they confirm receipt, the money is credited to your wallet." },
        ],
      },
      {
        heading: "6. Get paid",
        bullets: [
          "Your wallet shows every credited order.",
          "Withdraw to MTN Mobile Money or Orange Money — minimum 100 FCFA, arrives within minutes.",
          "Withdrawals that fail on the operator's side are credited back automatically.",
        ],
      },
      {
        heading: "Rules of the marketplace",
        bullets: [
          "No counterfeit, stolen or prohibited goods.",
          "One store per account.",
          "Repeated disputes lost by the seller lead to suspension.",
        ],
      },
    ],
  },
  fr: {
    title: "Guide du vendeur",
    subtitle: "Tout pour ouvrir une boutique et être payé.",
    intro: "De votre première annonce à votre premier retrait — voici la méthode que suivent nos meilleurs vendeurs.",
    sections: [
      {
        heading: "1. Ouvrez votre boutique",
        bullets: [
          "Choisissez un nom clair et mémorisable, et un logo carré (au moins 400 × 400 px).",
          "Ajoutez une bannière, votre ville et un numéro que les acheteurs peuvent appeler d'un geste.",
          "Écrivez deux ou trois phrases sur ce que vous vendez et pourquoi on peut vous faire confiance.",
        ],
      },
      {
        heading: "2. Choisissez le bon plan",
        paragraphs: [
          "Starter sert à tester. Business offre plus d'annonces et une mise en avant de 48 h. Premium s'adresse aux boutiques qui publient chaque jour et veulent un an de visibilité avec des mises en avant de 72 h.",
          "Votre plan se renouvelle depuis votre espace vendeur ; un plan expiré masque vos annonces jusqu'au renouvellement — rien n'est supprimé.",
        ],
      },
      {
        heading: "3. Publiez des annonces qui se vendent",
        bullets: [
          "Photos : lumineuses, nettes, fond neutre, plusieurs angles. Jusqu'à 8 par annonce.",
          "Titre : marque + modèle + détail clé (« iPhone 14 Pro 128 Go — Violet intense »).",
          "Prix : le prix final en FCFA. Ajoutez un prix barré pour apparaître dans les Promos.",
          "État et lieu : soyez honnête — l'acheteur peut ouvrir un litige si l'article ne correspond pas.",
        ],
      },
      {
        heading: "4. Mise en avant",
        paragraphs: [
          "Les vendeurs Business et Premium peuvent mettre l'une de leurs annonces publiées à la une de l'accueil et de sa catégorie pendant la durée définie par leur plan. Les administrateurs de SmartPlaze peuvent aussi mettre en avant des annonces remarquables.",
        ],
      },
      {
        heading: "5. Gérez les commandes",
        steps: [
          { title: "Vous recevez une commande payée", description: "L'argent de l'acheteur est sous séquestre. Préparez l'article." },
          { title: "Livrez", description: "Remettez-le en main propre ou expédiez-le. Gardez une preuve de livraison." },
          { title: "Confirmez la livraison", description: "Marquez la commande comme livrée dans votre espace." },
          { title: "L'acheteur confirme", description: "Dès qu'il confirme la réception, l'argent est crédité sur votre portefeuille." },
        ],
      },
      {
        heading: "6. Soyez payé",
        bullets: [
          "Votre portefeuille affiche chaque commande créditée.",
          "Retirez vers MTN Mobile Money ou Orange Money — minimum 100 FCFA, reçu en quelques minutes.",
          "Les retraits échoués côté opérateur sont recrédités automatiquement.",
        ],
      },
      {
        heading: "Règles de la marketplace",
        bullets: ["Pas de contrefaçons, d'articles volés ou interdits.", "Une boutique par compte.", "Des litiges répétés perdus par le vendeur entraînent une suspension."],
      },
    ],
  },
};

export const returns: Localized<PageContent> = {
  en: {
    title: "Returns & refunds",
    subtitle: "What happens when an order doesn't go as planned.",
    intro: "Because every payment is held in escrow, a refund on SmartPlaze is never a matter of chasing a seller. Here is how protection works.",
    sections: [
      {
        heading: "You are protected until you confirm",
        paragraphs: ["The seller is only paid after you confirm receipt. Until then your money stays with SmartPlaze. Take the time to inspect the item before confirming."],
      },
      {
        heading: "When to open a dispute",
        bullets: [
          "The item never arrived, or the seller stopped responding.",
          "The item is materially different from the listing (model, condition, missing parts).",
          "The item is counterfeit or does not work.",
        ],
      },
      {
        heading: "How a dispute is resolved",
        steps: [
          { title: "Open it from My orders", description: "Describe the problem. The order is frozen immediately." },
          { title: "Both sides are heard", description: "Our team asks the seller for their version and may request photos or proof of delivery." },
          { title: "Decision", description: "We either release the funds to the seller or refund you. Most disputes are settled within 3 business days." },
        ],
      },
      {
        heading: "Refund timing",
        bullets: ["Refunds go back to the Mobile Money number used to pay.", "Once approved, a refund appears within 1–3 business days depending on the operator."],
      },
      {
        heading: "Cancellations",
        paragraphs: ["An order that is never paid expires automatically. A paid order can only be cancelled through a dispute so that both sides are protected."],
      },
    ],
  },
  fr: {
    title: "Retours et remboursements",
    subtitle: "Ce qui se passe quand une commande ne se déroule pas comme prévu.",
    intro: "Comme chaque paiement est sous séquestre, un remboursement sur SmartPlaze ne consiste jamais à courir après un vendeur. Voici comment fonctionne la protection.",
    sections: [
      {
        heading: "Vous êtes protégé jusqu'à votre confirmation",
        paragraphs: ["Le vendeur n'est payé qu'après votre confirmation de réception. Jusque-là, votre argent reste chez SmartPlaze. Prenez le temps d'inspecter l'article avant de confirmer."],
      },
      {
        heading: "Quand ouvrir un litige",
        bullets: [
          "L'article n'est jamais arrivé, ou le vendeur ne répond plus.",
          "L'article est sensiblement différent de l'annonce (modèle, état, pièces manquantes).",
          "L'article est une contrefaçon ou ne fonctionne pas.",
        ],
      },
      {
        heading: "Comment un litige est résolu",
        steps: [
          { title: "Ouvrez-le depuis Mes commandes", description: "Décrivez le problème. La commande est gelée immédiatement." },
          { title: "Les deux parties sont entendues", description: "Notre équipe demande sa version au vendeur et peut exiger des photos ou une preuve de livraison." },
          { title: "Décision", description: "Nous libérons les fonds au vendeur ou nous vous remboursons. La plupart des litiges sont réglés sous 3 jours ouvrés." },
        ],
      },
      {
        heading: "Délai de remboursement",
        bullets: ["Les remboursements reviennent sur le numéro Mobile Money utilisé pour payer.", "Une fois approuvé, un remboursement apparaît sous 1 à 3 jours ouvrés selon l'opérateur."],
      },
      {
        heading: "Annulations",
        paragraphs: ["Une commande jamais payée expire automatiquement. Une commande payée ne peut être annulée que via un litige, afin de protéger les deux parties."],
      },
    ],
  },
};

export const faq: Localized<{ group: string; items: FaqItem[] }[]> = {
  en: [
    {
      group: "Buying",
      items: [
        { question: "Do I need an account to buy?", answer: "Yes — an account with a verified email lets you track your order, confirm receipt and open a dispute if needed. Sign-up takes a minute, with email or Google." },
        { question: "How do I pay?", answer: "With MTN Mobile Money or Orange Money. You enter your number, receive a prompt on your phone and approve with your PIN." },
        { question: "When is the seller paid?", answer: "Only after you confirm receipt in My orders. Until then your money is held in escrow by SmartPlaze." },
        { question: "Can I buy several items at once?", answer: "You can keep several items in your cart, but each item is paid through its own escrow order so every purchase is protected separately." },
      ],
    },
    {
      group: "Escrow & disputes",
      items: [
        { question: "What is escrow?", answer: "A trusted third party — SmartPlaze — keeps the money until both the buyer and the seller confirm the deal is done." },
        { question: "What if the item is not as described?", answer: "Don't confirm receipt. Open a dispute from My orders; the order is frozen and our team reviews both sides." },
        { question: "How long does a dispute take?", answer: "Most are resolved within 3 business days." },
      ],
    },
    {
      group: "Selling",
      items: [
        { question: "How much does it cost to sell?", answer: "You choose a subscription plan (Starter, Business or Premium). There is no listing fee beyond your plan." },
        { question: "What happens when my plan expires?", answer: "Your listings are hidden until you renew. Nothing is deleted." },
        { question: "How do I withdraw my earnings?", answer: "From your wallet to MTN Mobile Money or Orange Money, minimum 100 FCFA." },
        { question: "What is hero placement?", answer: "A featured spot at the top of the homepage and of your listing's category. Business and Premium plans include it for 48 h and 72 h respectively." },
      ],
    },
    {
      group: "Account",
      items: [
        { question: "I didn't receive my verification code.", answer: "Check your spam folder, then use \"Send a new code\" on the verification page. Codes expire after 10 minutes." },
        { question: "Can I sign in with Google?", answer: "Yes. If you already have an account with the same email, Google is linked to it — no duplicate account." },
        { question: "How do I change my password?", answer: "From the sign-in page, choose \"Forgot password?\" and follow the emailed code." },
      ],
    },
  ],
  fr: [
    {
      group: "Acheter",
      items: [
        { question: "Faut-il un compte pour acheter ?", answer: "Oui — un compte avec un e-mail vérifié vous permet de suivre votre commande, de confirmer la réception et d'ouvrir un litige si besoin. L'inscription prend une minute, par e-mail ou Google." },
        { question: "Comment payer ?", answer: "Avec MTN Mobile Money ou Orange Money. Vous saisissez votre numéro, recevez une demande sur votre téléphone et approuvez avec votre code PIN." },
        { question: "Quand le vendeur est-il payé ?", answer: "Seulement après votre confirmation de réception dans Mes commandes. Jusque-là, votre argent est sous séquestre chez SmartPlaze." },
        { question: "Puis-je acheter plusieurs articles à la fois ?", answer: "Vous pouvez garder plusieurs articles dans votre panier, mais chaque article est payé via sa propre commande sous séquestre, pour que chaque achat soit protégé séparément." },
      ],
    },
    {
      group: "Séquestre et litiges",
      items: [
        { question: "Qu'est-ce que le séquestre ?", answer: "Un tiers de confiance — SmartPlaze — garde l'argent jusqu'à ce que l'acheteur et le vendeur confirment tous deux que la transaction est terminée." },
        { question: "Et si l'article n'est pas conforme ?", answer: "Ne confirmez pas la réception. Ouvrez un litige depuis Mes commandes ; la commande est gelée et notre équipe examine les deux versions." },
        { question: "Combien de temps dure un litige ?", answer: "La plupart sont résolus sous 3 jours ouvrés." },
      ],
    },
    {
      group: "Vendre",
      items: [
        { question: "Combien coûte la vente ?", answer: "Vous choisissez un abonnement (Starter, Business ou Premium). Aucun frais par annonce en dehors de votre plan." },
        { question: "Que se passe-t-il quand mon plan expire ?", answer: "Vos annonces sont masquées jusqu'au renouvellement. Rien n'est supprimé." },
        { question: "Comment retirer mes gains ?", answer: "Depuis votre portefeuille vers MTN Mobile Money ou Orange Money, minimum 100 FCFA." },
        { question: "Qu'est-ce que la mise en avant ?", answer: "Une place en haut de l'accueil et de la catégorie de votre annonce. Les plans Business et Premium l'incluent pour 48 h et 72 h respectivement." },
      ],
    },
    {
      group: "Compte",
      items: [
        { question: "Je n'ai pas reçu mon code de vérification.", answer: "Vérifiez vos spams, puis utilisez « Envoyer un nouveau code » sur la page de vérification. Les codes expirent après 10 minutes." },
        { question: "Puis-je me connecter avec Google ?", answer: "Oui. Si vous avez déjà un compte avec le même e-mail, Google y est rattaché — pas de doublon." },
        { question: "Comment changer mon mot de passe ?", answer: "Depuis la page de connexion, choisissez « Mot de passe oublié ? » et suivez le code reçu par e-mail." },
      ],
    },
  ],
};
