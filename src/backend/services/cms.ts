import "server-only";
import { cache } from "react";
import type { Prisma } from "@/backend/generated/prisma/client";
import { CMS_SECTIONS, getSectionDef, type CmsField } from "@/shared/lib/cms-schema";
import { prisma } from "@/backend/db";
import { AppError } from "@/backend/http";
import { audit } from "./audit";

// CMSService — admins edit `draft`, publishing copies it to `published`. Public pages read
// `published` only, so unfinished edits never leak.

export type CmsContent = Record<string, unknown>;

/** Published content for a set of sections (memoised per request). */
export const getPublished = cache(async (keys: string[]): Promise<Record<string, CmsContent>> => {
  const rows = await prisma.cmsSection.findMany({ where: { key: { in: keys } }, select: { key: true, published: true } });
  const out: Record<string, CmsContent> = {};
  for (const key of keys) out[key] = ((rows.find((r) => r.key === key)?.published as CmsContent) ?? {}) as CmsContent;
  return out;
});

export async function getSection(key: string) {
  const def = getSectionDef(key);
  if (!def) throw new AppError(404, "errors.notFound");
  const row = await prisma.cmsSection.findUnique({ where: { key } });
  return { def, draft: (row?.draft as CmsContent) ?? {}, published: (row?.published as CmsContent) ?? null, publishedAt: row?.publishedAt ?? null, updatedAt: row?.updatedAt ?? null };
}

export async function listSections() {
  const rows = await prisma.cmsSection.findMany({ select: { key: true, updatedAt: true, publishedAt: true } });
  return CMS_SECTIONS.map((def) => {
    const row = rows.find((r) => r.key === def.key);
    return { ...def, updatedAt: row?.updatedAt ?? null, publishedAt: row?.publishedAt ?? null, hasUnpublished: !!row && (!row.publishedAt || row.updatedAt.getTime() - row.publishedAt.getTime() > 1500) };
  });
}

/** Keep only declared fields, coerce to strings, cap lengths. */
function sanitize(fields: CmsField[], input: unknown): CmsContent {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: CmsContent = {};
  for (const f of fields) {
    const v = src[f.key];
    if (f.type === "list") {
      out[f.key] = Array.isArray(v) ? v.slice(0, 30).map((item) => sanitize(f.fields, item)) : [];
    } else if ("localized" in f && f.localized) {
      const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
      out[f.key] = Object.fromEntries(["fr", "ar"].map((l) => [l, typeof o[l] === "string" ? (o[l] as string).slice(0, 20_000) : ""]));
    } else {
      out[f.key] = typeof v === "string" ? v.slice(0, 2_000) : "";
    }
  }
  return out;
}

export async function saveDraft(key: string, content: unknown, actorId: string, publish = false) {
  const def = getSectionDef(key);
  if (!def) throw new AppError(404, "errors.notFound");
  const draft = sanitize(def.fields, content) as Prisma.InputJsonValue;
  const now = new Date();
  const row = await prisma.cmsSection.upsert({
    where: { key },
    create: { key, draft, updatedById: actorId, ...(publish ? { published: draft, publishedAt: now } : {}) },
    update: { draft, updatedById: actorId, ...(publish ? { published: draft, publishedAt: now } : {}) },
  });
  await audit({ actorId, action: publish ? "cms.publish" : "cms.saveDraft", entityType: "CmsSection", entityId: key });
  return row;
}

export async function publishSection(key: string, actorId: string) {
  const row = await prisma.cmsSection.findUnique({ where: { key } });
  if (!row) throw new AppError(404, "errors.notFound");
  const updated = await prisma.cmsSection.update({ where: { key }, data: { published: row.draft as Prisma.InputJsonValue, publishedAt: new Date() } });
  await audit({ actorId, action: "cms.publish", entityType: "CmsSection", entityId: key });
  return updated;
}
