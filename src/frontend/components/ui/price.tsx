import { formatPrice, type Locale } from "@/shared/i18n/config";
import { cn } from "@/shared/lib/utils";

export function Price({ amount, original, locale, className, size = "md" }: { amount: number; original?: number | null; locale: Locale; className?: string; size?: "sm" | "md" | "lg" }) {
  const discounted = original != null && original > amount;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-semibold tabular-nums", size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-sm", discounted && "text-gold")}>{formatPrice(amount, locale)}</span>
      {discounted && <s className="text-sm text-stone tabular-nums">{formatPrice(original!, locale)}</s>}
    </span>
  );
}
