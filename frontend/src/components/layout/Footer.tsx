import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { NewsletterForm } from "@/components/layout/NewsletterForm";
import { SocialIcon, type SocialNetwork } from "@/components/ui/SocialIcon";

const SOCIALS: { network: SocialNetwork; label: string; href: string }[] = [
  { network: "facebook", label: "Facebook", href: "https://facebook.com" },
  { network: "instagram", label: "Instagram", href: "https://instagram.com" },
  { network: "linkedin", label: "LinkedIn", href: "https://linkedin.com" },
  { network: "x", label: "X", href: "https://x.com" },
  { network: "youtube", label: "YouTube", href: "https://youtube.com" },
];

export async function Footer() {
  const t = await getTranslations("footer");

  const columns = [
    {
      title: t("marketplace.title"),
      links: [
        { label: t("marketplace.allCategories"), href: "/categories" },
        { label: t("marketplace.deals"), href: "/deals" },
        { label: t("marketplace.newArrivals"), href: "/new-arrivals" },
        { label: t("marketplace.topStores"), href: "/stores" },
      ],
    },
    {
      title: t("sell.title"),
      links: [
        { label: t("sell.becomeSeller"), href: "/sell" },
        { label: t("sell.plans"), href: "/subscriptions" },
        { label: t("sell.guide"), href: "/seller-guide" },
      ],
    },
    {
      title: t("help.title"),
      links: [
        { label: t("help.trackOrder"), href: "/account/orders" },
        { label: t("help.returns"), href: "/help/returns" },
        { label: t("help.faq"), href: "/help/faq" },
        { label: t("help.contact"), href: "/help/contact" },
      ],
    },
    {
      title: t("company.title"),
      links: [
        { label: t("company.about"), href: "/about" },
        { label: t("company.terms"), href: "/legal/terms" },
        { label: t("company.privacy"), href: "/legal/privacy" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-surface">
      <Container className="py-12 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-12 xl:gap-8">
          {/* Brand */}
          <div className="xl:col-span-3">
            <Link href="/" className="inline-block" aria-label="SmartPlaze — home">
              <Image src="/logo.png" alt="Smarttrustexpress" width={1080} height={374} className="h-12 w-auto" />
            </Link>
            <p className="mt-3 font-accent text-lg text-foreground-secondary">{t("tagline")}</p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.network}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={s.label}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors hover:border-brand-blue hover:text-brand-blue"
                >
                  <SocialIcon network={s.network} className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 md:order-last md:col-span-2 xl:order-none xl:col-span-6">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-foreground">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-foreground-secondary transition-colors hover:text-brand-orange"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter */}
          <div className="xl:col-span-3">
            <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-foreground">{t("newsletter.title")}</h3>
            <p className="mt-3 text-sm text-foreground-secondary">{t("newsletter.description")}</p>
            <NewsletterForm className="mt-4" />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year: new Date().getFullYear() })}</p>
          <p className="font-accent text-sm text-foreground-secondary">Smarttrustexpress</p>
        </div>
      </Container>
    </footer>
  );
}
