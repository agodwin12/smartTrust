"use client";

import { Bell, Heart, LayoutDashboard, LogOut, Package, ShieldCheck, Store, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { isStaff } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, useRouter } from "@/i18n/navigation";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Header account control: "Sign in" while anonymous, avatar + menu once authenticated. */
export function UserMenu({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const { status, user, logout } = useAuth();
  const router = useRouter();

  if (status === "loading") {
    return <span className={cn("inline-block size-9 animate-pulse rounded-full bg-surface-hover", className)} aria-hidden />;
  }

  if (status === "anonymous" || !user) {
    return (
      <Link
        href="/login"
        aria-label={t("signIn")}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold transition-colors xl:px-3",
          tone === "dark" ? "text-white hover:bg-white/10" : "text-foreground hover:bg-surface-hover",
          className
        )}
      >
        <UserIcon className="size-5 xl:hidden" />
        <span className="hidden xl:inline">{t("signIn")}</span>
      </Link>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim();

  const onLogout = async () => {
    await logout();
    toast.success(ta("signedOut"));
    router.push("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("account")}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full text-xs font-bold text-white ring-offset-background transition-shadow hover:ring-2",
          tone === "dark" ? "bg-market-orange hover:ring-white/40" : "bg-brand-blue hover:ring-brand-blue/40",
          className
        )}
      >
        {initials(fullName || user.email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-[11px] font-normal text-foreground-muted">{t("signedInAs")}</span>
          <span className="truncate font-semibold">{fullName || user.email}</span>
          <span className="truncate text-xs font-normal text-foreground-muted">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>
          <LayoutDashboard className="size-4" /> {t("account")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/orders" />}>
          <Package className="size-4" /> {t("myOrders")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/notifications" />}>
          <Bell className="size-4" /> {t("notifications")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/wishlist" />}>
          <Heart className="size-4" /> {t("wishlist")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={user.store ? "/seller" : "/sell"} />}>
          <Store className="size-4" /> {user.store ? t("myStore") : t("sell")}
        </DropdownMenuItem>
        {isStaff(user) && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck className="size-4" /> {t("admin")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} variant="destructive">
          <LogOut className="size-4" /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
