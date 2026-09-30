"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Classes for the wrapper (spacing such as `mt-1.5` goes here so the eye stays centred on the field). */
  wrapperClassName?: string;
};

/** Password field with an eye button to show or hide what was typed. */
export function PasswordInput({ className, wrapperClassName, ...props }: PasswordInputProps) {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  return (
    <span className={cn("relative block", wrapperClassName)}>
      <input {...props} type={visible ? "text" : "password"} className={cn(className, "pr-11")} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        title={visible ? t("hidePassword") : t("showPassword")}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-foreground-muted transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
      </button>
    </span>
  );
}
