"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/shared/i18n/client";
import { LOCALE_META, LOCALES, type Locale } from "@/shared/i18n/config";
import { cn } from "@/shared/lib/utils";

export function LanguageSwitcher({ className, variant = "compact" }: { className?: string; variant?: "compact" | "full" }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    start(async () => {
      await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: next }) });
      router.refresh();
    });
  };

  return (
    <div role="group" aria-label={t("nav.language")} className={cn("flex items-center gap-0.5 rounded-full border border-line p-0.5", pending && "opacity-60", className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => change(l)}
          aria-pressed={l === locale}
          title={LOCALE_META[l].label}
          className={cn(
            "rounded-full font-bold transition-colors",
            variant === "full" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-[11px]",
            l === locale ? "bg-ivory text-ink" : "text-sand hover:text-ivory",
          )}
        >
          {variant === "full" ? LOCALE_META[l].label : LOCALE_META[l].short}
        </button>
      ))}
    </div>
  );
}
