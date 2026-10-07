import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_META, isLocale, type Locale } from "./config";
import { createTranslator } from "./translate";
import fr from "./messages/fr";
import ar from "./messages/ar";
import type { Messages } from "./messages/fr";

const DICTIONARIES: Record<Locale, Messages> = { fr, ar };

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export const getI18n = cache(async () => {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return {
    locale,
    dir: LOCALE_META[locale].dir,
    messages,
    t: createTranslator(messages, fr),
  };
});
