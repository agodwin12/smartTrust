import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChatThread } from "@/components/chat/ChatThread";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "messaging" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ConversationPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <ChatThread key={id} conversationId={id} />;
}
