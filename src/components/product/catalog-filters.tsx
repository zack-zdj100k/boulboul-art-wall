"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { fieldClasses } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type Category = { slug: string; name: string };

/**
 * URL-driven filters: the server renders results from the query string, so links are
 * shareable and the page works without JavaScript (the form submits with GET).
 */
export function CatalogFilters({ categories, total }: { categories: Category[]; total: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(!!(params.get("min") || params.get("max")));

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  // Debounced search-as-you-type.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const id = setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = params.get("category");
  const hasFilters = !!(params.get("q") || active || params.get("min") || params.get("max") || params.get("sort"));

  return (
    <form
      role="search"
      action={pathname}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        update({ q: String(fd.get("q") ?? "") || null, min: String(fd.get("min") ?? "") || null, max: String(fd.get("max") ?? "") || null });
      }}
      className={cn("flex flex-col gap-5 transition-opacity", pending && "opacity-70")}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t("common.search")}</span>
          <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-stone" aria-hidden />
          <input name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("shop.searchPlaceholder")} className={cn(fieldClasses, "h-12 ps-11")} type="search" maxLength={80} />
        </label>
        <div className="flex gap-3">
          <label className="relative min-w-0 flex-1 md:w-56 md:flex-none">
            <span className="sr-only">{t("shop.sort")}</span>
            <select
              name="sort"
              value={params.get("sort") ?? "featured"}
              onChange={(e) => update({ sort: e.target.value === "featured" ? null : e.target.value })}
              className={cn(fieldClasses, "h-12 appearance-none pe-10")}
            >
              {(["featured", "newest", "priceAsc", "priceDesc"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`shop.sortOptions.${s}`)}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-stone">▾</span>
          </label>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="price-filters" className="inline-flex h-12 items-center gap-2 rounded-field border border-line-strong px-4 text-sm font-semibold text-sand hover:text-ivory">
            <SlidersHorizontal className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("shop.filters")}</span>
          </button>
        </div>
      </div>

      {open && (
        <div id="price-filters" className="flex flex-wrap items-end gap-3 rounded-field border border-line bg-umber-900/60 p-4">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-sand">
            {t("shop.priceMin")}
            <input name="min" type="number" min={0} inputMode="numeric" defaultValue={params.get("min") ?? ""} className={cn(fieldClasses, "h-11 w-36")} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-sand">
            {t("shop.priceMax")}
            <input name="max" type="number" min={0} inputMode="numeric" defaultValue={params.get("max") ?? ""} className={cn(fieldClasses, "h-11 w-36")} />
          </label>
          <button type="submit" className="h-11 rounded-full bg-ivory px-5 text-sm font-bold text-ink">
            {t("shop.apply")}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("home.categoriesEyebrow")}>
          {[{ slug: "", name: t("shop.allCategories") }, ...categories].map((c) => {
            const isActive = (active ?? "") === c.slug;
            return (
              <li key={c.slug || "all"}>
                <button
                  type="button"
                  onClick={() => update({ category: c.slug || null })}
                  aria-pressed={isActive}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
                    isActive ? "border-ivory bg-ivory text-ink" : "border-line-strong text-sand hover:border-ivory/60 hover:text-ivory",
                  )}
                >
                  {c.name}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 text-sm text-stone">
          <span aria-live="polite">{t("shop.results", { count: total })}</span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                start(() => router.replace(pathname, { scroll: false }));
              }}
              className="inline-flex items-center gap-1 font-semibold text-gold hover:underline"
            >
              <X className="size-3.5" aria-hidden /> {t("shop.reset")}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
