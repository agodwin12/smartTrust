import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";

/** Legacy entry point kept for footer/chat links — orders live in the account area now. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TrackOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/account/orders", locale });
}
