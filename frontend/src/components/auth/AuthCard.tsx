import Image from "next/image";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";

/** Centered card used by every auth screen (login, register, OTP, reset…). */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Container className="flex flex-1 items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 block w-fit" aria-label="SmartPlaze — home">
          <Image src="/logo.png" alt="Smarttrustexpress" width={1080} height={374} className="h-12 w-auto" priority />
        </Link>
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.4)] sm:p-8">
          <h1 className="text-3xl text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-foreground-secondary">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-foreground-secondary">{footer}</div>}
      </div>
    </Container>
  );
}

export const authField =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)]";
export const authPrimaryButton =
  "inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-blue text-sm font-semibold text-white transition-colors hover:bg-brand-blue-light disabled:opacity-60";
export const authSecondaryButton =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover disabled:opacity-60";
