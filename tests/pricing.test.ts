import { describe, expect, it } from "vitest";
import {
  calculateNegotiatedPrice,
  calculateOrderTotal,
  calculatePromotion,
  calculateSurMesurePrice,
  priceLine,
  PricingError,
  resolveDimensionPrice,
  startingPrice,
  type PricingProduct,
  type SurMesureConfig,
} from "@/shared/lib/pricing";
import { estimateCustom } from "@/shared/lib/quote";
import { quoteDelivery } from "@/backend/services/delivery";

const row = (id: string, widthCm: number, heightCm: number, price: number, isActive = true, label: string | null = null) => ({ id, widthCm, heightCm, price, isActive, label });

// Stable price 60 × 80 = 5 000 DA, ± 200 DA per 10 cm of length and of height.
const surMesure: SurMesureConfig = { enabled: true, refWidthCm: 60, refHeightCm: 80, refPrice: 5_000, widthStepPrice: 200, heightStepPrice: 200 };
const off: SurMesureConfig = { ...surMesure, enabled: false };

const product: PricingProduct = {
  id: "p1",
  promoType: null,
  promoValue: null,
  promoStartsAt: null,
  promoEndsAt: null,
  measures: [row("m1", 40, 40, 2_000), row("m2", 70, 100, 5_500), row("m3", 65, 90, 5_200, true, "Medium Custom"), row("off", 80, 120, 7_000, false)],
  surMesure,
  frames: [{ id: "f1", name: "Noir", price: 1_000, isActive: true }],
  extras: [{ id: "e1", name: "LED", price: 2_500, isActive: true }],
};

describe("Measures created by the admin (always first)", () => {
  it("uses the exact price of a created measure, of any size", () => {
    expect(priceLine(product, { widthCm: 70, heightCm: 100 })).toMatchObject({ pricingType: "PRESET", pricingRefId: "m2", officialPrice: 5_500, surMesure: null });
    expect(priceLine(product, { widthCm: 65, heightCm: 90 })).toMatchObject({ pricingType: "PRESET", pricingLabel: "Medium Custom", officialPrice: 5_200 });
  });
  it("takes priority over the Sur Mesure calculation", () => {
    // 40 × 40 would be 5 000 − 2×200 − 4×200 = 3 800 by calculation, the created price wins.
    expect(resolveDimensionPrice(product, 40, 40)).toMatchObject({ source: "PRESET", price: 2_000 });
  });
  it("ignores inactive measures (then Sur Mesure applies)", () => {
    expect(resolveDimensionPrice(product, 80, 120)).toMatchObject({ source: "SUR_MESURE", price: 5_000 + 2 * 200 + 4 * 200 });
  });
});

describe("Sur Mesure — stable price ± 200 DA per 10 cm", () => {
  it("+10 cm on both sides = + 400 DA; −10 cm height = − 200 DA", () => {
    expect(calculateSurMesurePrice(surMesure, 60, 80)?.price).toBe(5_000);
    expect(calculateSurMesurePrice(surMesure, 70, 90)?.price).toBe(5_400);
    expect(calculateSurMesurePrice(surMesure, 60, 70)?.price).toBe(4_800);
    expect(calculateSurMesurePrice(surMesure, 50, 70)?.price).toBe(4_600);
    expect(calculateSurMesurePrice(surMesure, 90, 60)?.detail).toMatchObject({ widthSteps: 3, heightSteps: -2, widthAdjustment: 600, heightAdjustment: -400 });
  });
  it("counts every started 10 cm above the reference, only full 10 cm below", () => {
    expect(calculateSurMesurePrice(surMesure, 65, 80)?.price).toBe(5_200);
    expect(calculateSurMesurePrice(surMesure, 55, 80)?.price).toBe(5_000);
    expect(calculateSurMesurePrice(surMesure, 45, 80)?.price).toBe(4_800);
  });
  it("supports different step prices for length and height", () => {
    expect(calculateSurMesurePrice({ ...surMesure, widthStepPrice: 300, heightStepPrice: 100 }, 70, 90)?.price).toBe(5_400);
  });
  it("respects limits and the minimum price, and never returns a price ≤ 0", () => {
    const limited = { ...surMesure, minWidthCm: 40, maxWidthCm: 150, minPrice: 4_000 };
    expect(calculateSurMesurePrice(limited, 30, 80)).toBeNull();
    expect(calculateSurMesurePrice(limited, 160, 80)).toBeNull();
    expect(calculateSurMesurePrice(limited, 40, 20)).toMatchObject({ price: 4_000, detail: { floored: true } });
    expect(calculateSurMesurePrice(surMesure, 1, 1)?.price).toBe(5_000 - 5 * 200 - 7 * 200);
    expect(calculateSurMesurePrice({ ...surMesure, refPrice: 500 }, 10, 10)).toBeNull();
  });
  it("is off when disabled or incomplete → no price, contact us", () => {
    expect(calculateSurMesurePrice(off, 70, 90)).toBeNull();
    expect(calculateSurMesurePrice({ ...surMesure, refPrice: null }, 70, 90)).toBeNull();
    expect(() => priceLine({ ...product, surMesure: off }, { widthCm: 67, heightCm: 93 })).toThrow(new PricingError("pricing.needsSurMesure"));
  });
  it("is part of the line quote, with its detail", () => {
    expect(priceLine(product, { widthCm: 70, heightCm: 90 })).toMatchObject({ pricingType: "SUR_MESURE", pricingRefId: null, officialPrice: 5_400, surMesure: { refPrice: 5_000, widthSteps: 1, heightSteps: 1 } });
  });
});

describe("Line quote", () => {
  it("rejects zero, negative and non-integer dimensions", () => {
    for (const [w, h] of [[0, 40], [-40, 40], [40.5, 40], [40, 2000]]) expect(() => priceLine(product, { widthCm: w, heightCm: h })).toThrow(new PricingError("errors.invalidSize"));
  });
  it("adds fixed-price frame and options, times quantity", () => {
    const q = priceLine(product, { widthCm: 40, heightCm: 40, frameId: "f1", extraIds: ["e1"], quantity: 2 });
    expect(q).toMatchObject({ optionsPrice: 3_500, unitPrice: 5_500, total: 11_000 });
  });
  it("rejects unknown or inactive options", () => {
    expect(() => priceLine(product, { widthCm: 40, heightCm: 40, frameId: "nope" })).toThrow(PricingError);
    expect(() => priceLine({ ...product, extras: [{ ...product.extras[0], isActive: false }] }, { widthCm: 40, heightCm: 40, extraIds: ["e1"] })).toThrow(PricingError);
  });
});

describe("Promotions", () => {
  const now = new Date("2026-06-15");
  it("applies a percentage or a fixed amount, on measures and on Sur Mesure prices", () => {
    expect(calculatePromotion(7_000, { promoType: "PERCENT", promoValue: 10, promoStartsAt: null, promoEndsAt: null }, now)).toMatchObject({ discount: 700, priceAfterPromotion: 6_300 });
    const promo = { ...product, promoType: "FIXED" as const, promoValue: 500 };
    expect(priceLine(promo, { widthCm: 70, heightCm: 100 }, now)).toMatchObject({ officialPrice: 5_500, priceAfterPromotion: 5_000 });
    expect(priceLine(promo, { widthCm: 70, heightCm: 90 }, now)).toMatchObject({ officialPrice: 5_400, priceAfterPromotion: 4_900 });
  });
  it("ignores expired / future promotions and never goes below 0", () => {
    expect(calculatePromotion(7_000, { promoType: "PERCENT", promoValue: 10, promoStartsAt: null, promoEndsAt: new Date("2026-06-01") }, now).active).toBe(false);
    expect(calculatePromotion(300, { promoType: "FIXED", promoValue: 500, promoStartsAt: null, promoEndsAt: null }, now).priceAfterPromotion).toBe(0);
  });
});

describe("Negotiation and totals", () => {
  it("5 500 − 500 promo + 800 delivery, then −300 negotiated", () => {
    expect(calculateOrderTotal({ subtotal: 5_000, negotiatedDiscount: 0, deliveryFee: 800 }).total).toBe(5_800);
    const n = calculateNegotiatedPrice(5_000, { type: "AMOUNT", value: 300 });
    expect(n).toMatchObject({ discount: 300, finalPrice: 4_700 });
    expect(calculateOrderTotal({ subtotal: 5_000, negotiatedDiscount: n.discount, deliveryFee: 800 }).total).toBe(5_500);
  });
  it("supports percentages and rejects invalid discounts or fees", () => {
    expect(calculateNegotiatedPrice(6_000, { type: "PERCENT", value: 10 })).toEqual({ discount: 600, percent: 10, finalPrice: 5_400 });
    expect(() => calculateNegotiatedPrice(6_000, { type: "PERCENT", value: 101 })).toThrow(PricingError);
    expect(() => calculateNegotiatedPrice(6_000, { type: "AMOUNT", value: 6_001 })).toThrow(PricingError);
    expect(() => calculateOrderTotal({ subtotal: 1_000, negotiatedDiscount: 0, deliveryFee: -5 })).toThrow(PricingError);
  });
});

describe("Starting price and custom-design estimate", () => {
  it("is the lowest of the measures and the Sur Mesure price at its smallest allowed size", () => {
    expect(startingPrice({ ...product, surMesure: off })).toEqual({ original: 2_000, final: 2_000, promoActive: false });
    expect(startingPrice({ ...product, measures: [], surMesure: { ...surMesure, minWidthCm: 50, minHeightCm: 70 } })?.original).toBe(4_600);
    expect(startingPrice({ ...product, measures: [], surMesure: off })).toBeNull();
  });
  it("estimates a custom design with the same rule plus options", () => {
    expect(estimateCustom(surMesure, 70, 90, [1_000, 2_500])).toMatchObject({ base: 5_400, options: 3_500, total: 8_900 });
    expect(estimateCustom(null, 70, 90)).toBeNull();
    expect(estimateCustom(surMesure, null, 90)).toBeNull();
  });
});

describe("DeliveryService", () => {
  const rules = [
    { id: "default", wilayaCode: null, commune: null, fee: 900, freeAbove: null, isActive: true },
    { id: "alger", wilayaCode: "16", commune: null, fee: 500, freeAbove: 20_000, isActive: true },
    { id: "bab", wilayaCode: "16", commune: "Bab Ezzouar", fee: 300, freeAbove: null, isActive: true },
  ];
  it("picks the most specific active rule and applies free thresholds", () => {
    expect(quoteDelivery(rules, "16", "bab ezzouar ", 1_000).ruleId).toBe("bab");
    expect(quoteDelivery(rules, "31", "Oran", 1_000).fee).toBe(900);
    expect(quoteDelivery(rules, "16", "Hydra", 25_000)).toMatchObject({ fee: 0, free: true });
    expect(quoteDelivery([], "16", "Hydra", 1_000)).toMatchObject({ fee: null, free: false, ruleId: null });
  });
  it("offers home and stop desk prices; stop desk null when not offered", () => {
    const zr = [{ id: "alger", wilayaCode: "16", commune: null, fee: 500, stopDeskFee: 430, freeAbove: null, isActive: true }, { id: "guezzam", wilayaCode: "54", commune: null, fee: 1600, stopDeskFee: null, freeAbove: null, isActive: true }];
    expect(quoteDelivery(zr, "16", "Hydra", 1_000, "STOP_DESK")).toMatchObject({ fee: 430, home: 500, stopDesk: 430, method: "STOP_DESK" });
    expect(quoteDelivery(zr, "54", "In Guezzam", 1_000, "STOP_DESK")).toMatchObject({ fee: null, home: 1600, stopDesk: null });
  });
  it("products with 'Livraison offerte' ship free everywhere (stop desk only where offered)", () => {
    const zr = [{ id: "alger", wilayaCode: "16", commune: null, fee: 500, stopDeskFee: 430, freeAbove: null, isActive: true }, { id: "guezzam", wilayaCode: "54", commune: null, fee: 1600, stopDeskFee: null, freeAbove: null, isActive: true }];
    expect(quoteDelivery(zr, "16", "Hydra", 1_000, "HOME", true)).toMatchObject({ fee: 0, free: true, home: 0, stopDesk: 0 });
    expect(quoteDelivery(zr, "54", "In Guezzam", 1_000, "STOP_DESK", true)).toMatchObject({ fee: null, home: 0, stopDesk: null });
    expect(quoteDelivery([], "16", "Hydra", 1_000, "HOME", true)).toMatchObject({ fee: 0, free: true });
  });
});

describe("Dashboard revenue", () => {
  it("delivered totals − returned pieces (minus their negotiated share) ± completed exchange differences", async () => {
    const { computeRevenue, returnRefund } = await import("@/backend/services/stats");
    const order = { subtotal: 10_000, negotiatedDiscount: 1_000 };
    const ret = { type: "RETURN" as const, status: "COMPLETED", quantity: 1, replacementPrice: null, orderItem: { unitPrice: 5_000 }, order };
    expect(returnRefund(ret)).toBe(4_500); // 5 000 × 9 000 / 10 000
    const requests = [
      ret,
      { ...ret, status: "REQUESTED" }, // not received yet → not deducted
      { type: "EXCHANGE" as const, status: "COMPLETED", quantity: 2, replacementPrice: 6_000, orderItem: { unitPrice: 5_000 }, order },
      { type: "EXCHANGE" as const, status: "APPROVED", quantity: 1, replacementPrice: 9_000, orderItem: { unitPrice: 5_000 }, order },
    ];
    expect(computeRevenue(20_000, requests)).toEqual({ delivered: 20_000, refunds: 4_500, exchanges: 2_000, revenue: 17_500 });
  });
});
