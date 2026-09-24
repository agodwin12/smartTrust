import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/ui/PageHero";
import type { Crumb } from "@/components/ui/Breadcrumbs";

export type ContentSection = {
  id?: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: { title: string; description: string }[];
};

export type PageContent = {
  title: string;
  subtitle?: string;
  intro?: string;
  updated?: string;
  sections: ContentSection[];
};

type ContentPageProps = {
  content: PageContent;
  crumbs?: Crumb[];
  aside?: ReactNode;
  children?: ReactNode;
  image?: string | null;
  eyebrow?: string;
};

/** Long-form bilingual page (legal, help, about…): hero + readable column + optional aside. */
export function ContentPage({ content, crumbs, aside, children, image, eyebrow }: ContentPageProps) {
  return (
    <>
      <PageHero title={content.title} subtitle={content.subtitle} crumbs={crumbs} image={image} eyebrow={eyebrow} size="compact" />
      <Container className="py-10 sm:py-14">
        <div className={aside ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]" : "mx-auto max-w-3xl"}>
          <article className="min-w-0">
            {content.intro && <p className="text-base leading-relaxed text-foreground-secondary sm:text-lg">{content.intro}</p>}
            {content.updated && <p className="mt-2 text-xs text-foreground-muted">{content.updated}</p>}
            <div className="mt-8 space-y-10">
              {content.sections.map((section, i) => (
                <section key={section.id ?? i} id={section.id} className="scroll-mt-28">
                  <h2 className="text-2xl text-foreground sm:text-3xl">{section.heading}</h2>
                  {section.paragraphs?.map((p, j) => (
                    <p key={j} className="mt-3 text-sm leading-relaxed text-foreground-secondary sm:text-base">
                      {p}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground-secondary sm:text-base">
                      {section.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {section.steps && (
                    <ol className="mt-4 space-y-3">
                      {section.steps.map((step, j) => (
                        <li key={j} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-bold text-white">{j + 1}</span>
                          <div>
                            <h3 className="font-sans text-base font-semibold text-foreground">{step.title}</h3>
                            <p className="mt-1 text-sm text-foreground-secondary">{step.description}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              ))}
            </div>
            {children}
          </article>
          {aside && <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">{aside}</aside>}
        </div>
      </Container>
    </>
  );
}
