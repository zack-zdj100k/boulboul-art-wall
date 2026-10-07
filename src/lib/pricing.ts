// Pricing engine — the single implementation of Boulboul's price rules.
//
//   dimensions ─▶ a measure created by the admin with exactly these dimensions?  → its price (PRESET)
//              ─▶ otherwise, Sur Mesure enabled & configured?                     → calculated (SUR_MESURE)
//                   reference price ± step price for each 10 cm of length / height away from
//                   the reference measure (e.g. +10 cm on both = + 2 × 200 DA)
//              ─▶ otherwise no price: "contact us"
//   official price ─▶ promotion ─▶ (+ fixed options) ─▶ negotiation (per order) ─▶ delivery ─▶ total
//
// Pure functions (no DB) so the server, the admin previews and the tests share exactly the same
// code; the server always re-prices orders — browser amounts are ignored.

export type PricingSource = "PRESET" | "SUR_MESURE";
export type PromotionKind = "PERCENT" | "FIXED";

/** A measure created by the admin, with its exact price. */
export type MeasurePrice = { id: string; widthCm: number; heightCm: number; price: number; isActive: boolean; label?: string | null; description?: string | null };

/** Sur Mesure parameters: stable reference price and price per 10 cm step. */
export type SurMesureConfig = {
  enabled: boolean;
  refWidthCm: number | null;
  refHeightCm: number | null;
  refPrice: number | null;
  widthStepPrice: number | null; // DA per 10 cm of length
  heightStepPrice: number | null; // DA per 10 cm of height
  minWidthCm?: number | null;
  maxWidthCm?: number | null;
  minHeightCm?: number | null;
  maxHeightCm?: number | null;
  minPrice?: number | null;
};

export type SurMesureDetail = {
  refWidthCm: number;
  refHeightCm: number;
  refPrice: number;
  widthSteps: number; // signed number of 10 cm steps
  heightSteps: number;
  widthAdjustment: number; // signed DA
  heightAdjustment: number;
  floored: boolean; // raised to the minimum price
};

export type PromotionConfig = {
  promoType: PromotionKind | null;
  promoValue: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
};

export type PricingOption = { id: string; name: string; price: number; isActive: boolean };

export type PricingProduct = PromotionConfig & {
  id: string;
  measures: MeasurePrice[];
  surMesure: SurMesureConfig;
  frames: PricingOption[];
  extras: PricingOption[];
};

export type PriceLookup = { source: PricingSource; refId: string | null; price: number; label: string | null; surMesure: SurMesureDetail | null };

export type PromotionResult = { active: boolean; type: PromotionKind | null; value: number | null; discount: number; priceAfterPromotion: number };

export type LineQuote = {
  widthCm: number;
  heightCm: number;
  pricingType: PricingSource;
  pricingRefId: string | null;
  pricingLabel: string | null;
  surMesure: SurMesureDetail | null;
  officialPrice: number;
  promotion: { type: PromotionKind; value: number } | null;
  promotionDiscount: number;
  priceAfterPromotion: number;
  frame: { id: string; name: string; price: number } | null;
  extras: { id: string; name: string; price: number; color?: string | null; note?: string | null }[];
  optionsPrice: number;
  unitPrice: number;
  quantity: number;
  total: number;
};

export type LineConfig = { widthCm: number; heightCm: number; frameId?: string | null; extraIds?: string[]; quantity?: number };

/** Error codes are i18n keys. */
export type PricingErrorCode = "errors.invalidSize" | "errors.invalidOption" | "pricing.needsSurMesure" | "pricing.invalidDiscount" | "pricing.invalidDeliveryFee";

export class PricingError extends Error {
  constructor(public code: PricingErrorCode) {
    super(code);
  }
}

export const MAX_DIMENSION_CM = 1000;
/** Sur Mesure prices move by one step for each 10 cm. */
export const SUR_MESURE_STEP_CM = 10;
export const MAX_QUANTITY = 50;

export function isValidDimension(n: number) {
  return Number.isInteger(n) && n > 0 && n <= MAX_DIMENSION_CM;
}

// ───────────────────────── Measures created by the admin

export function findMeasure<T extends MeasurePrice>(rows: T[], widthCm: number, heightCm: number): T | null {
  return rows.find((r) => r.isActive && r.widthCm === widthCm && r.heightCm === heightCm && r.price > 0) ?? null;
}

// ───────────────────────── Sur Mesure (stable price ± per 10 cm)

export function isSurMesureConfigured(c: SurMesureConfig) {
  return (
    c.enabled &&
    !!c.refWidthCm && c.refWidthCm > 0 &&
    !!c.refHeightCm && c.refHeightCm > 0 &&
    !!c.refPrice && c.refPrice > 0 &&
    c.widthStepPrice != null && c.widthStepPrice >= 0 &&
    c.heightStepPrice != null && c.heightStepPrice >= 0
  );
}

/**
 * Number of 10 cm steps between a dimension and the reference. Every started 10 cm above the
 * reference counts as a step (+5 cm → +1 step); below it, only full 10 cm are removed
 * (−5 cm → 0, −10 cm → −1). Exact multiples of 10 behave exactly as "±200 DA per 10 cm".
 */
export function surMesureSteps(value: number, reference: number) {
  return Math.ceil((value - reference) / SUR_MESURE_STEP_CM) + 0;
}

/** Calculated Sur Mesure price, or null when not configured / outside the limits / not positive. */
export function calculateSurMesurePrice(c: SurMesureConfig, widthCm: number, heightCm: number): { price: number; detail: SurMesureDetail } | null {
  if (!isSurMesureConfigured(c) || !isValidDimension(widthCm) || !isValidDimension(heightCm)) return null;
  if (c.minWidthCm && widthCm < c.minWidthCm) return null;
  if (c.maxWidthCm && widthCm > c.maxWidthCm) return null;
  if (c.minHeightCm && heightCm < c.minHeightCm) return null;
  if (c.maxHeightCm && heightCm > c.maxHeightCm) return null;
  const widthSteps = surMesureSteps(widthCm, c.refWidthCm!);
  const heightSteps = surMesureSteps(heightCm, c.refHeightCm!);
  const widthAdjustment = widthSteps * c.widthStepPrice!;
  const heightAdjustment = heightSteps * c.heightStepPrice!;
  const raw = c.refPrice! + widthAdjustment + heightAdjustment;
  const floor = c.minPrice ?? 0;
  const price = Math.max(raw, floor);
  if (price <= 0) return null;
  return {
    price,
    detail: { refWidthCm: c.refWidthCm!, refHeightCm: c.refHeightCm!, refPrice: c.refPrice!, widthSteps, heightSteps, widthAdjustment, heightAdjustment, floored: price !== raw },
  };
}

/**
 * Official price for exact dimensions: a created measure first, otherwise the Sur Mesure
 * calculation. Null → the customer must contact Boulboul.
 */
export function resolveDimensionPrice(p: { measures: MeasurePrice[]; surMesure: SurMesureConfig }, widthCm: number, heightCm: number): PriceLookup | null {
  if (!isValidDimension(widthCm) || !isValidDimension(heightCm)) return null;
  const measure = findMeasure(p.measures, widthCm, heightCm);
  if (measure) return { source: "PRESET", refId: measure.id, price: measure.price, label: measure.label ?? null, surMesure: null };
  const calc = calculateSurMesurePrice(p.surMesure, widthCm, heightCm);
  if (calc) return { source: "SUR_MESURE", refId: null, price: calc.price, label: null, surMesure: calc.detail };
  return null;
}

// ───────────────────────── Promotion

export function isPromotionActive(p: PromotionConfig, now = new Date()) {
  if (!p.promoType || !p.promoValue || p.promoValue <= 0) return false;
  if (p.promoStartsAt && now < p.promoStartsAt) return false;
  if (p.promoEndsAt && now > p.promoEndsAt) return false;
  return true;
}

/** Applies the product's promotion (percentage or fixed amount) to an official price. Never below 0. */
export function calculatePromotion(officialPrice: number, promo: PromotionConfig, now = new Date()): PromotionResult {
  if (!isPromotionActive(promo, now)) return { active: false, type: null, value: null, discount: 0, priceAfterPromotion: officialPrice };
  const value = promo.promoValue!;
  const discount = promo.promoType === "PERCENT" ? Math.round((officialPrice * Math.min(100, value)) / 100) : Math.min(value, officialPrice);
  return { active: true, type: promo.promoType, value, discount, priceAfterPromotion: officialPrice - discount };
}

// ───────────────────────── Negotiation (per order — never touches the product prices)

export type NegotiationInput = { type: "AMOUNT" | "PERCENT"; value: number };

/** Negotiated discount on the order's products after promotion. Never negative, never above the price. */
export function calculateNegotiatedPrice(price: number, input: NegotiationInput) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0 || price < 0) throw new PricingError("pricing.invalidDiscount");
  if (input.type === "PERCENT") {
    if (value > 100) throw new PricingError("pricing.invalidDiscount");
    const discount = Math.round((price * value) / 100);
    return { discount, percent: value, finalPrice: price - discount };
  }
  const discount = Math.round(value);
  if (discount > price) throw new PricingError("pricing.invalidDiscount");
  return { discount, percent: price > 0 ? Math.round((discount / price) * 10_000) / 100 : null, finalPrice: price - discount };
}

/** Final amounts of an order. `deliveryFee` null = still to be confirmed (not added). */
export function calculateOrderTotal(input: { subtotal: number; negotiatedDiscount?: number; deliveryFee: number | null }) {
  const negotiatedDiscount = input.negotiatedDiscount ?? 0;
  if (!Number.isInteger(negotiatedDiscount) || negotiatedDiscount < 0 || negotiatedDiscount > input.subtotal) throw new PricingError("pricing.invalidDiscount");
  if (input.deliveryFee != null && (!Number.isInteger(input.deliveryFee) || input.deliveryFee < 0)) throw new PricingError("pricing.invalidDeliveryFee");
  const finalProductPrice = input.subtotal - negotiatedDiscount;
  return { subtotal: input.subtotal, negotiatedDiscount, finalProductPrice, deliveryFee: input.deliveryFee, total: finalProductPrice + (input.deliveryFee ?? 0) };
}

// ───────────────────────── One product line (dimensions + options)

export function priceLine(product: PricingProduct, config: LineConfig, now = new Date()): LineQuote {
  const widthCm = Number(config.widthCm);
  const heightCm = Number(config.heightCm);
  if (!isValidDimension(widthCm) || !isValidDimension(heightCm)) throw new PricingError("errors.invalidSize");
  const quantity = Number.isInteger(config.quantity) ? Math.min(MAX_QUANTITY, Math.max(1, config.quantity!)) : 1;

  const lookup = resolveDimensionPrice(product, widthCm, heightCm);
  if (!lookup) throw new PricingError("pricing.needsSurMesure");
  const promo = calculatePromotion(lookup.price, product, now);

  let frame: LineQuote["frame"] = null;
  if (config.frameId) {
    const f = product.frames.find((x) => x.id === config.frameId && x.isActive);
    if (!f) throw new PricingError("errors.invalidOption");
    frame = { id: f.id, name: f.name, price: f.price };
  }
  const extras = [...new Set(config.extraIds ?? [])].map((id) => {
    const e = product.extras.find((x) => x.id === id && x.isActive);
    if (!e) throw new PricingError("errors.invalidOption");
    return { id: e.id, name: e.name, price: e.price };
  });
  const optionsPrice = (frame?.price ?? 0) + extras.reduce((s, e) => s + e.price, 0);
  const unitPrice = promo.priceAfterPromotion + optionsPrice;

  return {
    widthCm,
    heightCm,
    pricingType: lookup.source,
    pricingRefId: lookup.refId,
    pricingLabel: lookup.label,
    surMesure: lookup.surMesure,
    officialPrice: lookup.price,
    promotion: promo.active ? { type: promo.type!, value: promo.value! } : null,
    promotionDiscount: promo.discount,
    priceAfterPromotion: promo.priceAfterPromotion,
    frame,
    extras,
    optionsPrice,
    unitPrice,
    quantity,
    total: unitPrice * quantity,
  };
}

/**
 * "À partir de": the lowest price among the created measures and the Sur Mesure price at its
 * smallest allowed measure (or the reference measure). Null when nothing is configured.
 */
export function startingPrice(product: Pick<PricingProduct, "measures" | "surMesure"> & PromotionConfig, now = new Date()) {
  const prices = product.measures.filter((r) => r.isActive && r.price > 0).map((r) => r.price);
  const c = product.surMesure;
  if (isSurMesureConfigured(c)) {
    const calc = calculateSurMesurePrice(c, c.minWidthCm ?? c.refWidthCm!, c.minHeightCm ?? c.refHeightCm!);
    if (calc) prices.push(calc.price);
  }
  if (!prices.length) return null;
  const original = Math.min(...prices);
  const promo = calculatePromotion(original, product, now);
  return { original, final: promo.priceAfterPromotion, promoActive: promo.active };
}

export function hasActivePricing(product: Pick<PricingProduct, "measures" | "surMesure">) {
  return product.measures.some((r) => r.isActive && r.price > 0) || isSurMesureConfigured(product.surMesure);
}

/** Sur Mesure configuration stored on a product row. */
export function surMesureFromProduct(p: {
  allowCustomSize: boolean;
  refWidthCm: number | null;
  refHeightCm: number | null;
  refPrice: number | null;
  widthStepPrice: number | null;
  heightStepPrice: number | null;
  customMinWidthCm: number | null;
  customMaxWidthCm: number | null;
  customMinHeightCm: number | null;
  customMaxHeightCm: number | null;
  customMinPrice: number | null;
}): SurMesureConfig {
  return {
    enabled: p.allowCustomSize,
    refWidthCm: p.refWidthCm,
    refHeightCm: p.refHeightCm,
    refPrice: p.refPrice,
    widthStepPrice: p.widthStepPrice,
    heightStepPrice: p.heightStepPrice,
    minWidthCm: p.customMinWidthCm,
    maxWidthCm: p.customMaxWidthCm,
    minHeightCm: p.customMinHeightCm,
    maxHeightCm: p.customMaxHeightCm,
    minPrice: p.customMinPrice,
  };
}
