import { z } from "zod";
import { RETURN_REASON_KEYS } from "./returns";

const money = z.coerce.number().int().min(0).max(100_000_000);
const optMoney = z.preprocess((v) => (v === "" || v == null ? null : v), money.nullable());
const cm = z.coerce.number().int().min(1, "Dimension > 0").max(1000, "Dimension ≤ 1000 cm");
const price = z.coerce.number().int().min(1, "Le prix doit être supérieur à 0").max(100_000_000);
const optStr = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable());
const optDecimal = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(10_000).nullable());

export const productAdminSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    nameAr: optStr(160),
    slug: z
      .string()
      .trim()
      .max(90)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug : lettres minuscules, chiffres et tirets")
      .optional()
      .or(z.literal("")),
    description: z.string().trim().max(10_000).default(""),
    descriptionAr: optStr(10_000),
    categoryId: optStr(64),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    isFeatured: z.boolean().default(false),
    freeDelivery: z.boolean().default(false),
    isDemo: z.boolean().default(false),
    promoType: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(["PERCENT", "FIXED"]).nullable()),
    promoValue: optMoney,
    promoStartsAt: optDate,
    promoEndsAt: optDate,
    materials: optStr(500),
    weightKg: optDecimal,
    depthCm: optDecimal,
    colors: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    characteristics: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
    seoTitle: optStr(70),
    seoDescription: optStr(170),
    sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
    images: z.array(z.object({ mediaId: z.string().min(1), alt: optStr(200) })).max(20).default([]),
    frames: z.array(z.object({ frameId: z.string().min(1), priceOverride: optMoney, isDefault: z.boolean().default(false) })).max(30).default([]),
    extras: z.array(z.object({ extraId: z.string().min(1), priceOverride: optMoney })).max(30).default([]),
  })
  .refine((p) => !(p.promoType && p.promoType === "PERCENT" && (p.promoValue ?? 0) > 100), { path: ["promoValue"], message: "Pourcentage ≤ 100" })
  .refine((p) => !(p.promoStartsAt && p.promoEndsAt && p.promoStartsAt > p.promoEndsAt), { path: ["promoEndsAt"], message: "La fin doit suivre le début" })
  .refine((p) => p.frames.filter((f) => f.isDefault).length <= 1, { path: ["frames"], message: "Un seul cadre par défaut" });
export type ProductAdminInput = z.infer<typeof productAdminSchema>;

// ───────────────────────── Product pricing

/** A measure created by the admin: any dimensions, one explicit price. */
export const measureSchema = z.object({
  widthCm: cm,
  heightCm: cm,
  price,
  label: optStr(80),
  description: optStr(500),
  isActive: z.boolean().default(true),
});

/** Bulk save (single add or grid generator) — every price is typed by the admin. */
export const measureBulkSchema = z.object({ rows: z.array(measureSchema).min(1).max(400) });

export const measurePatchSchema = measureSchema.partial();

const optCm = z.preprocess((v) => (v === "" || v == null ? null : v), cm.nullable());

/** Sur Mesure: stable price at a reference measure, ± DA for each 10 cm of length / height. */
export const surMesureSchema = z
  .object({
    enabled: z.boolean(),
    refWidthCm: optCm,
    refHeightCm: optCm,
    refPrice: z.preprocess((v) => (v === "" || v == null ? null : v), price.nullable()),
    widthStepPrice: optMoney,
    heightStepPrice: optMoney,
    minWidthCm: optCm,
    maxWidthCm: optCm,
    minHeightCm: optCm,
    maxHeightCm: optCm,
    minPrice: optMoney,
  })
  .refine((d) => !d.enabled || (d.refWidthCm && d.refHeightCm && d.refPrice && d.widthStepPrice != null && d.heightStepPrice != null), {
    path: ["refPrice"],
    message: "Mesure de référence, prix de référence et prix par 10 cm sont obligatoires pour activer le Sur Mesure",
  })
  .refine((d) => !(d.minWidthCm && d.maxWidthCm && d.minWidthCm > d.maxWidthCm), { path: ["maxWidthCm"], message: "Maximum < minimum" })
  .refine((d) => !(d.minHeightCm && d.maxHeightCm && d.minHeightCm > d.maxHeightCm), { path: ["maxHeightCm"], message: "Maximum < minimum" });
export type SurMesureInput = z.infer<typeof surMesureSchema>;

export const categoryAdminSchema = z.object({
  name: z.string().trim().min(2).max(80),
  nameAr: optStr(80),
  slug: z.string().trim().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional().or(z.literal("")),
  description: optStr(500),
  descriptionAr: optStr(500),
  imageId: optStr(64),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export const frameAdminSchema = z.object({
  name: z.string().trim().min(2).max(80),
  nameAr: optStr(80),
  description: optStr(300),
  swatch: optStr(30),
  imageId: optStr(64),
  price: money,
  isActive: z.boolean().default(true),
  isDemo: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export const extraAdminSchema = z.object({
  name: z.string().trim().min(2).max(80),
  nameAr: optStr(80),
  description: optStr(300),
  price: money,
  isActive: z.boolean().default(true),
  availableForCustom: z.boolean().default(true),
  isDemo: z.boolean().default(false),
  colors: z.array(z.object({ name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(24).default([]),
  askNote: z.boolean().default(false),
  notePrompt: optStr(160),
  notePromptAr: optStr(160),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export const deliveryRuleSchema = z.object({
  wilayaCode: optStr(3),
  commune: optStr(120),
  fee: money,
  stopDeskFee: optMoney,
  returnFee: optMoney,
  freeAbove: optMoney,
  isActive: z.boolean().default(true),
  note: optStr(200),
});

export const orderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONTACTING", "CONFIRMED", "DELIVERED", "CANCELLED"]),
  note: optStr(500),
});

// ───────────────────────── Manager order changes

export const negotiationSchema = z
  .object({
    type: z.enum(["AMOUNT", "PERCENT"]),
    value: z.coerce.number().min(0, "Remise invalide").max(100_000_000),
    note: optStr(500),
  })
  .refine((d) => d.type === "AMOUNT" ? Number.isInteger(d.value) : d.value <= 100, { path: ["value"], message: "Remise invalide" });

export const dimensionChangeSchema = z.object({ itemId: z.string().min(1).max(64), widthCm: cm, heightCm: cm, note: optStr(500) });

export const deliveryFeeSchema = z.object({ deliveryFee: optMoney, note: optStr(500) });

export const managerNotesSchema = z.object({ managerNotes: optStr(5000) });

// ───────────────────────── Returns & exchanges

export const RETURN_STATUSES = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "RETURN_RECEIVED", "EXCHANGE_PROCESSING", "COMPLETED", "CANCELLED"] as const;

export const returnStatusSchema = z.object({ status: z.enum(RETURN_STATUSES), note: optStr(500), managerNote: optStr(2000) });

export const adminReturnSchema = z.object({
  type: z.enum(["RETURN", "EXCHANGE"]),
  orderItemId: z.string().min(1).max(64),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  reason: z.enum(RETURN_REASON_KEYS),
  details: optStr(2000),
  // Exchange: the measure the customer takes instead
  replacement: z
    .object({ productId: optStr(64), widthCm: cm, heightCm: cm, frameId: optStr(64), extraIds: z.array(z.string().min(1).max(64)).max(20).default([]) })
    .nullish(),
  approve: z.boolean().default(false),
});

export const customOrderAdminSchema = z
  .object({
    status: z.enum(["PENDING", "REVIEWING", "CONTACTED", "APPROVED", "REJECTED", "DELIVERED", "COMPLETED"]).optional(),
    adminNotes: optStr(5000),
    // Quote (DZD). Empty = not quoted yet.
    price: optMoney.optional(),
    discountType: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(["PERCENT", "FIXED"]).nullable()).optional(),
    discountValue: optMoney.optional(),
    deliveryFee: optMoney.optional(),
  })
  .refine((d) => !(d.discountType === "PERCENT" && (d.discountValue ?? 0) > 100), { path: ["discountValue"], message: "Pourcentage ≤ 100" });

export const reviewModerationSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "HIDDEN"]).optional(),
  isFeatured: z.boolean().optional(),
});

/** A real review received outside the website (e.g. by message), entered by an admin. */
export const adminReviewSchema = z.object({
  productId: optStr(64),
  authorName: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(5).max(1500),
  isFeatured: z.boolean().default(false),
  confirmReal: z.literal(true, { message: "Confirmez qu'il s'agit d'un avis réel" }),
});
