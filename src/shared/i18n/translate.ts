import type { Messages } from "./messages/fr";

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function lookup(messages: Messages, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, messages);
}

export function createTranslator(messages: Messages, fallback?: Messages): TranslateFn {
  return (key, vars) => {
    let value = lookup(messages, key);
    if (typeof value !== "string" && fallback) value = lookup(fallback, key);
    if (typeof value !== "string") {
      if (process.env.NODE_ENV !== "production") console.warn(`[i18n] missing key: ${key}`);
      return key;
    }
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
  };
}

/** Read a non-string (array/object) message, e.g. a list of steps. */
export function getMessage<T = unknown>(messages: Messages, key: string): T | undefined {
  return lookup(messages, key) as T | undefined;
}
