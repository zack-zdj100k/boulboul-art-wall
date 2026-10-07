export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "baw_locale";

export const LOCALE_META: Record<Locale, { label: string; short: string; dir: "ltr" | "rtl"; intl: string }> = {
  fr: { label: "Français", short: "FR", dir: "ltr", intl: "fr-DZ" },
  ar: { label: "العربية", short: "ع", dir: "rtl", intl: "ar-DZ" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Pick the localised variant of a DB field: `name` / `nameAr`, falling back to French. */
export function pick<T extends Record<string, unknown>>(obj: T, field: string, locale: Locale): string {
  const suffix = locale === "ar" ? "Ar" : "";
  const localized = suffix ? obj[`${field}${suffix}`] : undefined;
  if (typeof localized === "string" && localized.trim()) return localized;
  const base = obj[field];
  return typeof base === "string" ? base : "";
}

export function formatPrice(amount: number, locale: Locale = DEFAULT_LOCALE) {
  // Narrow no-break spaces (fr thousands separator) are missing from some display fonts.
  const n = new Intl.NumberFormat(LOCALE_META[locale].intl, { maximumFractionDigits: 0 }).format(amount).replace(/\u202f/g, "\u00a0");
  return locale === "ar" ? `${n} د.ج` : `${n} DA`;
}

export function formatDate(date: Date | string, locale: Locale = DEFAULT_LOCALE, withTime = false) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Africa/Algiers",
  }).format(d);
}
