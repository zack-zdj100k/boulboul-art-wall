import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";

// Typed, validated key/value settings editable from /admin/settings.
export const SETTINGS = {
  "custom.maxWidthCm": z.coerce.number().int().min(10).max(1000).default(300),
  "custom.maxHeightCm": z.coerce.number().int().min(10).max(1000).default(300),
  "custom.minWidthCm": z.coerce.number().int().min(1).max(1000).default(10),
  "custom.minHeightCm": z.coerce.number().int().min(1).max(1000).default(10),
  // Live estimate on the custom-design form: stable price at a reference measure ± per 10 cm.
  // Reference price 0 = no estimate shown.
  "custom.refWidthCm": z.coerce.number().int().min(0).max(1000).default(0),
  "custom.refHeightCm": z.coerce.number().int().min(0).max(1000).default(0),
  "custom.refPrice": z.coerce.number().int().min(0).max(100_000_000).default(0),
  "custom.widthStepPrice": z.coerce.number().int().min(0).max(10_000_000).default(0),
  "custom.heightStepPrice": z.coerce.number().int().min(0).max(10_000_000).default(0),
  // E-mail notifications (KING 253 style). Recipients: comma-separated; empty = ADMIN_EMAIL (.env).
  "email.adminRecipients": z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || v.split(",").every((e) => z.email().safeParse(e.trim()).success), "Adresse e-mail invalide")
    .default(""),
  "email.fromName": z.string().trim().max(60).default(""),
  "email.customerConfirmed": z.boolean().default(true),
  "email.customerDelivered": z.boolean().default(true),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]>;

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<{ [P in K]: SettingValue<P> }> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as { [P in K]: SettingValue<P> };
  for (const key of keys) {
    const parsed = SETTINGS[key].safeParse(map.get(key));
    out[key] = (parsed.success ? parsed.data : SETTINGS[key].parse(undefined)) as SettingValue<K>;
  }
  return out;
}

export async function getAllSettings() {
  return getSettings(Object.keys(SETTINGS) as SettingKey[]);
}

export async function updateSettings(values: Partial<Record<SettingKey, unknown>>) {
  const entries = Object.entries(values).filter(([k]) => k in SETTINGS) as [SettingKey, unknown][];
  const parsed = entries.map(([k, v]) => [k, SETTINGS[k].parse(v)] as const);
  await prisma.$transaction(
    parsed.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
}

/** Sur Mesure parameters used for the custom-design estimate (null when not configured). */
export async function getCustomEstimateConfig() {
  const s = await getSettings(["custom.refWidthCm", "custom.refHeightCm", "custom.refPrice", "custom.widthStepPrice", "custom.heightStepPrice", "custom.minWidthCm", "custom.maxWidthCm", "custom.minHeightCm", "custom.maxHeightCm"]);
  if (!s["custom.refPrice"] || !s["custom.refWidthCm"] || !s["custom.refHeightCm"]) return null;
  return {
    enabled: true,
    refWidthCm: s["custom.refWidthCm"],
    refHeightCm: s["custom.refHeightCm"],
    refPrice: s["custom.refPrice"],
    widthStepPrice: s["custom.widthStepPrice"],
    heightStepPrice: s["custom.heightStepPrice"],
    minWidthCm: s["custom.minWidthCm"],
    maxWidthCm: s["custom.maxWidthCm"],
    minHeightCm: s["custom.minHeightCm"],
    maxHeightCm: s["custom.maxHeightCm"],
  };
}

export type EmailSettings = { adminRecipients: string[]; fromName: string; customerConfirmed: boolean; customerDelivered: boolean };

/** Notification settings, with ADMIN_EMAIL (.env) as the fallback recipient. */
export async function getEmailSettings(fallbackAdmin: string): Promise<EmailSettings> {
  const s = await getSettings(["email.adminRecipients", "email.fromName", "email.customerConfirmed", "email.customerDelivered"]);
  const list = s["email.adminRecipients"].split(",").map((e) => e.trim()).filter(Boolean);
  return {
    adminRecipients: list.length ? list : fallbackAdmin ? [fallbackAdmin] : [],
    fromName: s["email.fromName"],
    customerConfirmed: s["email.customerConfirmed"],
    customerDelivered: s["email.customerDelivered"],
  };
}
