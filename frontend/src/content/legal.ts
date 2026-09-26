import type { Localized, PageContent } from "@/content/types";

export const terms: Localized<PageContent> = {
  en: {
    title: "Terms of service",
    subtitle: "The rules of the marketplace.",
    updated: "Last updated: 22 September 2026",
    intro: "These terms govern your use of SmartPlaze (Smarttrustexpress), operated by Godwin Tech Solution. By creating an account you agree to them.",
    sections: [
      { heading: "1. The service", paragraphs: ["SmartPlaze is an online marketplace connecting independent sellers and buyers. SmartPlaze holds payments in escrow but is not a party to the sale itself, except for the dispute process described below."] },
      { heading: "2. Accounts", bullets: ["You must be at least 18 and provide accurate information.", "One person, one account; one store per account.", "You are responsible for everything done with your credentials. Tell us immediately if you suspect misuse."] },
      { heading: "3. Buying", bullets: ["Every order is paid in advance into escrow via Mobile Money.", "You must confirm receipt promptly once you have checked the item, or open a dispute.", "Confirming receipt releases the payment to the seller and is final."] },
      { heading: "4. Selling", bullets: ["Sellers need an active subscription plan to publish listings.", "Listings must be accurate: title, photos, price, condition and location must describe the actual item.", "Prohibited: counterfeit, stolen, illegal or dangerous goods, and anything requiring a licence you do not hold.", "Sellers must confirm delivery through the platform."] },
      { heading: "5. Escrow and payouts", paragraphs: ["Funds are released to the seller's wallet only after both parties confirm, or after a dispute decision. Sellers withdraw to their own Mobile Money number. SmartPlaze may charge a platform commission on completed orders; any commission is shown before you publish."] },
      { heading: "6. Disputes", paragraphs: ["Either party may open a dispute on a paid order. SmartPlaze's decision, made in good faith on the available evidence, is binding for the release or refund of the escrowed amount."] },
      { heading: "7. Subscriptions", bullets: ["Plans are prepaid for a fixed duration and are not refundable once activated.", "When a plan expires, listings are hidden until renewal."] },
      { heading: "8. Suspension", paragraphs: ["We may suspend or close accounts that break these terms, receive repeated valid disputes, or attempt fraud. Escrowed funds are handled according to the dispute rules."] },
      { heading: "9. Liability", paragraphs: ["SmartPlaze is provided as is. To the extent permitted by law, our liability is limited to the amount held in escrow for the order concerned."] },
      { heading: "10. Changes and contact", paragraphs: ["We may update these terms; material changes are announced on the site. Questions: support@smartplaze.com."] },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    subtitle: "Les règles de la marketplace.",
    updated: "Dernière mise à jour : 22 septembre 2026",
    intro: "Ces conditions régissent votre utilisation de SmartPlaze (Smarttrustexpress), exploitée par Godwin Tech Solution. En créant un compte, vous les acceptez.",
    sections: [
      { heading: "1. Le service", paragraphs: ["SmartPlaze est une marketplace en ligne qui met en relation des vendeurs indépendants et des acheteurs. SmartPlaze conserve les paiements sous séquestre mais n'est pas partie à la vente elle-même, en dehors du processus de litige décrit ci-dessous."] },
      { heading: "2. Comptes", bullets: ["Vous devez avoir au moins 18 ans et fournir des informations exactes.", "Une personne, un compte ; une boutique par compte.", "Vous êtes responsable de tout ce qui est fait avec vos identifiants. Prévenez-nous immédiatement en cas d'utilisation suspecte."] },
      { heading: "3. Acheter", bullets: ["Chaque commande est payée à l'avance sous séquestre via Mobile Money.", "Vous devez confirmer la réception rapidement après avoir vérifié l'article, ou ouvrir un litige.", "La confirmation de réception libère le paiement au vendeur et est définitive."] },
      { heading: "4. Vendre", bullets: ["Les vendeurs ont besoin d'un abonnement actif pour publier des annonces.", "Les annonces doivent être exactes : titre, photos, prix, état et lieu doivent décrire l'article réel.", "Interdits : contrefaçons, articles volés, illégaux ou dangereux, et tout ce qui nécessite une licence que vous ne détenez pas.", "Les vendeurs doivent confirmer la livraison via la plateforme."] },
      { heading: "5. Séquestre et retraits", paragraphs: ["Les fonds sont libérés vers le portefeuille du vendeur uniquement après confirmation des deux parties, ou après décision sur un litige. Les vendeurs retirent vers leur propre numéro Mobile Money. SmartPlaze peut prélever une commission sur les commandes terminées ; toute commission est affichée avant publication."] },
      { heading: "6. Litiges", paragraphs: ["Chaque partie peut ouvrir un litige sur une commande payée. La décision de SmartPlaze, prise de bonne foi sur les éléments disponibles, s'impose pour la libération ou le remboursement du montant sous séquestre."] },
      { heading: "7. Abonnements", bullets: ["Les plans sont prépayés pour une durée fixe et non remboursables une fois activés.", "À l'expiration d'un plan, les annonces sont masquées jusqu'au renouvellement."] },
      { heading: "8. Suspension", paragraphs: ["Nous pouvons suspendre ou fermer les comptes qui enfreignent ces conditions, font l'objet de litiges fondés répétés ou tentent une fraude. Les fonds sous séquestre sont traités selon les règles de litige."] },
      { heading: "9. Responsabilité", paragraphs: ["SmartPlaze est fourni en l'état. Dans la limite permise par la loi, notre responsabilité est limitée au montant sous séquestre pour la commande concernée."] },
      { heading: "10. Modifications et contact", paragraphs: ["Nous pouvons mettre à jour ces conditions ; les changements importants sont annoncés sur le site. Questions : support@smartplaze.com."] },
    ],
  },
};

export const privacy: Localized<PageContent> = {
  en: {
    title: "Privacy policy",
    subtitle: "How we handle your data.",
    updated: "Last updated: 22 September 2026",
    intro: "We collect only what the marketplace needs to work, and we never sell your data.",
    sections: [
      { heading: "What we collect", bullets: ["Account data: name, email, phone, password (stored hashed), Google ID if you sign in with Google.", "Store data: store name, logo, banner, location and contact details you choose to publish.", "Transaction data: orders, payments, escrow movements, withdrawals, disputes.", "Technical data: IP address, browser, and an audit log of actions taken on your account."] },
      { heading: "Why we use it", bullets: ["To run the marketplace: accounts, listings, escrow, payouts and disputes.", "To keep the platform safe: fraud prevention, rate limiting, audit trail.", "To contact you: verification codes, order updates, support replies, and the newsletter if you subscribed."] },
      { heading: "Who sees it", bullets: ["Sellers see the name and delivery details of buyers who ordered from them.", "Payment operators (MTN, Orange via K-Pay) receive the phone number and amount needed to process a payment.", "Email is delivered through Resend. Images are stored on Cloudflare R2.", "SmartPlaze staff access data only to operate the service and resolve disputes; every access is logged."] },
      { heading: "Your rights", bullets: ["Access, correct or delete your personal data by writing to support@smartplaze.com.", "Unsubscribe from the newsletter at any time.", "Transaction records may be kept as long as required by law or open disputes."] },
      { heading: "Cookies and storage", paragraphs: ["We use one httpOnly cookie to keep you signed in, and local storage on your device for preferences, your cart and your wishlist. No advertising trackers."] },
      { heading: "Security", paragraphs: ["Passwords are hashed with bcrypt, refresh tokens are stored hashed, all traffic is encrypted in transit, and money-moving operations are protected against replay and double-processing."] },
      { heading: "Contact", paragraphs: ["Data controller: Godwin Tech Solution, Douala, Cameroon — privacy@smartplaze.com."] },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    subtitle: "Comment nous traitons vos données.",
    updated: "Dernière mise à jour : 22 septembre 2026",
    intro: "Nous ne collectons que ce dont la marketplace a besoin pour fonctionner, et nous ne vendons jamais vos données.",
    sections: [
      { heading: "Ce que nous collectons", bullets: ["Données de compte : nom, e-mail, téléphone, mot de passe (stocké haché), identifiant Google si vous vous connectez avec Google.", "Données de boutique : nom, logo, bannière, lieu et coordonnées que vous choisissez de publier.", "Données de transaction : commandes, paiements, mouvements de séquestre, retraits, litiges.", "Données techniques : adresse IP, navigateur et journal d'audit des actions sur votre compte."] },
      { heading: "Pourquoi nous les utilisons", bullets: ["Pour faire fonctionner la marketplace : comptes, annonces, séquestre, retraits et litiges.", "Pour sécuriser la plateforme : prévention de la fraude, limitation de débit, journal d'audit.", "Pour vous contacter : codes de vérification, suivi de commande, réponses du support et newsletter si vous êtes inscrit."] },
      { heading: "Qui y a accès", bullets: ["Les vendeurs voient le nom et les informations de livraison des acheteurs qui leur ont commandé.", "Les opérateurs de paiement (MTN, Orange via K-Pay) reçoivent le numéro et le montant nécessaires au traitement.", "Les e-mails sont envoyés via Resend. Les images sont stockées sur Cloudflare R2.", "L'équipe SmartPlaze n'accède aux données que pour exploiter le service et résoudre les litiges ; chaque accès est journalisé."] },
      { heading: "Vos droits", bullets: ["Accéder, corriger ou supprimer vos données personnelles en écrivant à support@smartplaze.com.", "Vous désinscrire de la newsletter à tout moment.", "Les enregistrements de transaction peuvent être conservés aussi longtemps que la loi ou un litige ouvert l'exige."] },
      { heading: "Cookies et stockage", paragraphs: ["Nous utilisons un cookie httpOnly pour vous garder connecté, et le stockage local de votre appareil pour vos préférences, votre panier et vos favoris. Aucun traceur publicitaire."] },
      { heading: "Sécurité", paragraphs: ["Les mots de passe sont hachés avec bcrypt, les jetons de rafraîchissement sont stockés hachés, tout le trafic est chiffré en transit, et les opérations financières sont protégées contre le rejeu et le double traitement."] },
      { heading: "Contact", paragraphs: ["Responsable du traitement : Godwin Tech Solution, Douala, Cameroun — privacy@smartplaze.com."] },
    ],
  },
};
