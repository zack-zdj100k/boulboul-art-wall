"use client";

import { useSyncExternalStore } from "react";

// "Ma commande" — the pieces a customer wants in the same delivery. Stored in this browser only;
// it holds configurations, never prices: every amount is re-quoted by the server.

export type CartConfig = {
  productId: string;
  widthCm: number;
  heightCm: number;
  frameId: string | null;
  extraIds: string[];
  extraChoices: { id: string; color: string | null; note: string | null }[];
  color: string | null;
  quantity: number;
};

export type CartLine = {
  key: string;
  config: CartConfig;
  product: { name: string; image: string | null; slug: string };
  /** Human summary for the list (dimensions, frame, options). */
  summary: string;
};

const KEY = "baw_cart_v1";
const MAX_LINES = 20;
const EMPTY: CartLine[] = [];
let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? (parsed as CartLine[]).slice(0, MAX_LINES) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines.slice(0, MAX_LINES);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode — the basket still works for this visit */
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
};

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Same product + same configuration → one line with a bigger quantity. */
const sameConfig = (a: CartConfig, b: CartConfig) =>
  JSON.stringify({ ...a, quantity: 0, extraIds: [...a.extraIds].sort() }) === JSON.stringify({ ...b, quantity: 0, extraIds: [...b.extraIds].sort() });

export const cart = {
  add(line: Omit<CartLine, "key">) {
    const lines = read();
    const i = lines.findIndex((l) => sameConfig(l.config, line.config));
    if (i >= 0) {
      const next = [...lines];
      next[i] = { ...next[i], config: { ...next[i].config, quantity: Math.min(50, next[i].config.quantity + line.config.quantity) } };
      return write(next);
    }
    write([...lines, { ...line, key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` }]);
  },
  setQuantity(key: string, quantity: number) {
    write(read().map((l) => (l.key === key ? { ...l, config: { ...l.config, quantity: Math.min(50, Math.max(1, quantity)) } } : l)));
  },
  remove(key: string) {
    write(read().filter((l) => l.key !== key));
  },
  clear() {
    write([]);
  },
};
