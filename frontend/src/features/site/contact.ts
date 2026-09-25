import { apiFetch } from "@/lib/api";

export type SiteContact = { whatsapp: string | null; whatsappUrl: string | null; email: string | null };

const EMPTY: SiteContact = { whatsapp: null, whatsappUrl: null, email: null };

/** Public contact channels configured on the server (SUPPORT_WHATSAPP / SUPPORT_EMAIL). */
export async function getSiteContact(): Promise<SiteContact> {
  try {
    return await apiFetch<SiteContact>("site/contact", { next: { revalidate: 300 } });
  } catch {
    return EMPTY; // API down: the page still renders, only the WhatsApp bubble is hidden
  }
}
