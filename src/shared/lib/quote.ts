// Shared (client preview + server) quote maths for custom design requests. Server is authoritative.
import { calculateSurMesurePrice, type SurMesureConfig } from "./pricing";

export type CustomQuoteInput = {
  price?: number | null;
  discountType?: "PERCENT" | "FIXED" | null;
  discountValue?: number | null;
  deliveryFee?: number | null;
};

/** Quote total for a custom request: price − discount (never below 0) + delivery. Null until priced. */
export function computeCustomQuote(q: CustomQuoteInput) {
  if (q.price == null) return { discount: 0, total: null as number | null };
  const value = q.discountType ? Math.max(0, q.discountValue ?? 0) : 0;
  const discount = q.discountType === "PERCENT" ? Math.round((q.price * Math.min(100, value)) / 100) : Math.min(value, q.price);
  return { discount, total: q.price - discount + (q.deliveryFee ?? 0) };
}

/**
 * Indicative price of a custom design: the Sur Mesure rule (stable reference price ± a fixed
 * amount per 10 cm of length / height) + the fixed prices of the chosen options. Null when not
 * configured or dimensions are missing — Boulboul always confirms the final quote.
 */
export function estimateCustom(config: SurMesureConfig | null, widthCm: number | null | undefined, heightCm: number | null | undefined, optionPrices: number[] = []) {
  if (!config || !widthCm || !heightCm) return null;
  const calc = calculateSurMesurePrice(config, widthCm, heightCm);
  if (!calc) return null;
  const options = optionPrices.reduce((s, p) => s + p, 0);
  return { base: calc.price, detail: calc.detail, options, total: calc.price + options };
}
