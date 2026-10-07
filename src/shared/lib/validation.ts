// Shared (client + server) validation schemas. Messages are i18n keys, translated in the UI.
import { z } from "zod";
import { ALGERIAN_PHONE_RE, getWilaya, normalizePhone } from "./algeria";
import { RETURN_REASON_KEYS } from "./returns";

const trimmed = (max = 200) =>
  z
    .string({ error: "validation.required" })
    .trim()
    .max(max, { error: "validation.tooLong" });

export const requiredText = (max = 200, min = 1) =>
  trimmed(max)
    .min(1, { error: "validation.required" })
    .min(min, { error: "validation.tooShort" });

export const optionalText = (max = 2000) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailSchema = z
  .string({ error: "validation.required" })
  .trim()
  .toLowerCase()
  .max(254, { error: "validation.tooLong" })
  .pipe(z.email({ error: "validation.email" }));

export const phoneSchema = z
  .string({ error: "validation.required" })
  .transform(normalizePhone)
  .refine((v) => ALGERIAN_PHONE_RE.test(v), { error: "validation.phone" });

export const passwordSchema = z
  .string({ error: "validation.required" })
  .min(8, { error: "validation.passwordWeak" })
  .max(128, { error: "validation.tooLong" })
  .refine((v) => /[A-Za-z؀-ۿ]/.test(v) && /\d/.test(v), { error: "validation.passwordWeak" });

export const wilayaSchema = z
  .string({ error: "validation.wilaya" })
  .refine((code) => !!getWilaya(code), { error: "validation.wilaya" });

export const dimensionSchema = z.coerce
  .number({ error: "validation.number" })
  .int({ error: "validation.number" })
  .min(1, { error: "validation.number" })
  .max(1000, { error: "validation.number" });

export const idSchema = z.string().min(1).max(64);

// ───────────────────────── Auth

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "validation.required" }).min(1, { error: "validation.required" }).max(128),
});

export const REFERRAL_SOURCES = ["TIKTOK", "INSTAGRAM", "FACEBOOK", "OTHER"] as const;

const ageSchema = z.coerce.number({ error: "validation.age" }).int({ error: "validation.age" }).min(13, { error: "validation.age" }).max(120, { error: "validation.age" });

export const registerSchema = z
  .object({
    fullName: requiredText(120, 2),
    age: ageSchema,
    phone: phoneSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: "validation.required" }),
    referralSource: z.enum(REFERRAL_SOURCES, { error: "validation.required" }),
    referralOther: optionalText(120),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], error: "validation.passwordMismatch" });

/** Account created while ordering: name, e-mail and phone come from the delivery details. */
export const checkoutAccountSchema = z
  .object({
    age: ageSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: "validation.required" }),
    referralSource: z.enum(REFERRAL_SOURCES, { error: "validation.required" }),
    referralOther: optionalText(120),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], error: "validation.passwordMismatch" });

export const profileSchema = z.object({
  fullName: requiredText(120, 2),
  phone: phoneSchema,
  age: z.coerce.number().int().min(13, { error: "validation.age" }).max(120, { error: "validation.age" }).optional(),
});

// ───────────────────────── Pricing / orders

export const extraChoiceSchema = z.object({
  id: idSchema,
  color: z.string().trim().max(40).nullish(),
  note: z.string().trim().max(300, { error: "validation.tooLong" }).nullish(),
});

export const configurationSchema = z.object({
  productId: idSchema,
  widthCm: dimensionSchema,
  heightCm: dimensionSchema,
  frameId: idSchema.nullish(),
  extraIds: z.array(idSchema).max(20).default([]),
  // Colour / note per chosen option (e.g. LED tone, mirror placement)
  extraChoices: z.array(extraChoiceSchema).max(20).default([]),
  color: z.string().trim().max(60).nullish(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
});
export type ConfigurationInput = z.infer<typeof configurationSchema>;

export const customerSchema = z.object({
  customerName: requiredText(120, 2),
  email: emailSchema,
  phone: phoneSchema,
  wilayaCode: wilayaSchema,
  commune: requiredText(120, 2),
  address: requiredText(300, 4),
  notes: optionalText(1000),
  deliveryMethod: z.enum(["HOME", "STOP_DESK"]).default("HOME"),
});

export const createOrderSchema = z.object({
  // `items` keeps the API cart-ready; Buy Now sends exactly one item.
  items: z.array(configurationSchema).min(1).max(20),
  customer: customerSchema,
  // Visitors who are not signed in create their account with the order.
  account: checkoutAccountSchema.optional(),
});
// Parsed shape, with `extraChoices` optional for internal callers (the API always passes parsed data).
type ItemInput = Omit<z.infer<typeof configurationSchema>, "extraChoices"> & { extraChoices?: z.infer<typeof extraChoiceSchema>[] };
export type CreateOrderInput = { items: ItemInput[]; customer: Omit<z.infer<typeof customerSchema>, "deliveryMethod"> & { deliveryMethod?: "HOME" | "STOP_DESK" } };

// ───────────────────────── Custom design requests

export const customOrderSchema = z
  .object({
    designMediaId: idSchema.nullish(),
    designToken: z.string().max(200).nullish(),
    description: optionalText(3000),
    widthCm: dimensionSchema.nullish(),
    heightCm: dimensionSchema.nullish(),
    frameId: idSchema.nullish(),
    extraIds: z.array(idSchema).max(20).default([]),
    extraChoices: z.array(extraChoiceSchema).max(20).default([]),
    otherIdea: optionalText(1000),
    notes: optionalText(1000),
    customerName: requiredText(120, 2),
    email: emailSchema,
    phone: phoneSchema,
    wilayaCode: wilayaSchema.nullish().or(z.literal("").transform(() => undefined)),
    commune: optionalText(120),
    address: optionalText(300),
  })
  .refine((d) => !!d.designMediaId || !!d.description || !!d.otherIdea, {
    path: ["description"],
    error: "validation.contactOrIdea",
  });
export type CustomOrderInput = z.infer<typeof customOrderSchema>;

// ───────────────────────── Returns & exchanges (customer)

export const returnRequestSchema = z.object({
  type: z.enum(["RETURN", "EXCHANGE"], { error: "validation.required" }),
  orderItemId: idSchema.optional(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  reason: z.enum(RETURN_REASON_KEYS, { error: "validation.required" }),
  details: optionalText(2000),
  // Exchange: the measure the customer would like instead (optional)
  replacementWidthCm: dimensionSchema.optional(),
  replacementHeightCm: dimensionSchema.optional(),
  // Guest access to their order page (same token as the order confirmation link)
  token: z.string().max(200).optional(),
});

// ───────────────────────── Reviews

export const reviewSchema = z.object({
  productId: idSchema,
  rating: z.coerce.number({ error: "validation.rating" }).int().min(1, { error: "validation.rating" }).max(5, { error: "validation.rating" }),
  comment: requiredText(1500, 10),
});
