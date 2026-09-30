import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Short link people type or share: the profile lives in the account area. */
export default async function ProfileRedirect({ params }: Props) {
  const { locale } = await params;
  redirect({ href: "/account/profile", locale });
}
