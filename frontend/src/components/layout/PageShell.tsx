import type { ReactNode } from "react";
import { getRootCategories } from "@/features/catalog/api";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** Desktop quick-links row under the header (the home page turns it off: its sidebar does the job). */
  quickLinks?: boolean;
};

/** Header + main + footer frame used by every page, plus the fixed bottom navigation below 1024px. */
export async function PageShell({ children, className, quickLinks = true }: PageShellProps) {
  // Cached for a minute by the catalog fetcher; an API hiccup only hides the search select.
  const categories = await getRootCategories().catch(() => []);

  return (
    <>
      <Header categories={categories} quickLinks={quickLinks} />
      <main id="main" className={cn("flex flex-1 flex-col", className)}>
        {children}
      </main>
      <Footer />
      {/* Keeps the footer reachable above the fixed bottom navigation. */}
      <div aria-hidden className="h-[60px] lg:hidden" />
      <MobileBottomNav />
    </>
  );
}
