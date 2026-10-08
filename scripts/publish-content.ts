/**
 * Publish the catalogue built locally to another database (typically production):
 * categories, products, measures & Sur Mesure, frames, options and photos — the photos are
 * uploaded to Cloudinary — plus the editorial texts of prisma/data/site-content.ts.
 *
 * Usage: npm run publish-content
 *   Asks (hidden) for the target database URL and CLOUDINARY_URL, unless TARGET_DATABASE_URL /
 *   CLOUDINARY_URL are already set. The source is DATABASE_URL from .env (your local database).
 *
 * Re-runnable: rows are upserted by id, photos re-uploaded under the same name; nothing is deleted.
 * Users, orders and reviews are never copied.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient, type Prisma } from "../src/backend/generated/prisma/client";
import { CATEGORY_CONTENT, CMS_CONTENT, PRODUCT_CONTENT } from "../prisma/data/site-content";

const ROOT = path.resolve(__dirname, "..");
const LOCAL_DIR = path.resolve(ROOT, process.env.STORAGE_LOCAL_DIR ?? "./storage/uploads");
const FOLDER = (process.env.CLOUDINARY_FOLDER || "boulboul").replace(/\/$/, "");

function askHidden(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Print the question, never what is typed or pasted.
  // readline redraws "question + input" on refresh, so print the question once and nothing else.
  let shown = false;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {
    if (!shown) process.stdout.write(question);
    shown = true;
  };
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    }),
  );
}

/** Keeps the first URL when it was pasted twice, drops any query string. */
function firstUrl(raw: string, scheme: string) {
  // Tolerates "CLOUDINARY_URL=" in front, quotes, <> left from the template, and a double paste.
  const clean = raw.replace(/[\s"'<>]+/g, "");
  const start = clean.indexOf(scheme);
  if (start < 0) return "";
  const rest = clean.slice(start + scheme.length);
  const first = rest.split(scheme).find(Boolean);
  return first ? scheme + first : "";
}

function cloudinaryFrom(raw: string) {
  const m = firstUrl(raw, "cloudinary://").match(/^cloudinary:\/\/([^:]+):([^@]+)@([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error("The Cloudinary value must be: cloudinary + :// + API_KEY + : + API_SECRET + @drtwdhve (one line, no spaces).");
  return { key: m[1], secret: m[2], cloud: m[3] };
}

async function uploadToCloudinary(c: { key: string; secret: string; cloud: string }, mediaKey: string, body: Buffer, mime: string) {
  if (process.env.PUBLISH_SKIP_UPLOAD === "1") return; // rehearsal against a local database
  const params: Record<string, string | number> = { overwrite: "true", public_id: `${FOLDER}/${mediaKey.replace(/\.[a-z0-9]+$/i, "")}`, timestamp: Math.floor(Date.now() / 1000), type: "upload" };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append("api_key", c.key);
  form.append("signature", createHash("sha1").update(toSign + c.secret).digest("hex"));
  form.append("file", new Blob([new Uint8Array(body)], { type: mime }));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Cloudinary upload failed for ${mediaKey}: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

const db = (url: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const strip = <T extends Record<string, unknown>>(row: T, ...keys: string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k))) as T;

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) throw new Error("DATABASE_URL (local source database) is missing from .env");

  const targetRaw = process.env.TARGET_DATABASE_URL || (await askHidden("Target (production) database URL — Render External Database URL, hidden: "));
  const targetBase = firstUrl(targetRaw, "postgresql://") || firstUrl(targetRaw, "postgres://");
  if (!targetBase) throw new Error("That is not a postgresql:// URL.");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(targetBase);
  const targetUrl = local ? targetBase : `${targetBase.split("?")[0]}?sslmode=verify-full`;
  if (targetUrl.split("?")[0] === sourceUrl.split("?")[0]) throw new Error("Source and target are the same database.");
  const cloudinary = cloudinaryFrom(process.env.CLOUDINARY_URL?.startsWith("cloudinary://") && process.env.TARGET_DATABASE_URL ? process.env.CLOUDINARY_URL : await askHidden("CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD), hidden: "));

  const src = db(sourceUrl);
  const dst = db(targetUrl);
  try {
    // ── Read the local catalogue
    const categories = await src.category.findMany();
    const products = await src.product.findMany({ include: { images: true, measures: true, frames: true, extras: true } });
    const frameIds = [...new Set(products.flatMap((p) => p.frames.map((f) => f.frameId)))];
    const extraIds = [...new Set(products.flatMap((p) => p.extras.map((e) => e.extraId)))];
    const [frames, extras, settings] = await Promise.all([
      src.frameOption.findMany({ where: { id: { in: frameIds } } }),
      src.extraOption.findMany({ where: { id: { in: extraIds } } }),
      src.setting.findMany({ where: { key: { startsWith: "custom." } } }),
    ]);
    const mediaIds = new Set([...products.flatMap((p) => p.images.map((i) => i.mediaId)), ...categories.flatMap((c) => (c.imageId ? [c.imageId] : [])), ...frames.flatMap((f) => (f.imageId ? [f.imageId] : []))]);
    const media = await src.media.findMany({ where: { id: { in: [...mediaIds] }, visibility: "PUBLIC" } });
    console.log(`Local catalogue: ${categories.length} categories, ${products.length} products, ${media.length} photos, ${frames.length} frames, ${extras.length} options.`);

    // ── Photos → Cloudinary + Media rows
    for (const [i, m] of media.entries()) {
      const body = await readFile(path.join(LOCAL_DIR, m.key));
      await uploadToCloudinary(cloudinary, m.key, body, m.mime);
      const data = strip(m, "uploadedById") as Prisma.MediaUncheckedCreateInput;
      await dst.media.upsert({ where: { id: m.id }, create: data, update: data });
      process.stdout.write(`\r  Photos uploaded: ${i + 1}/${media.length}`);
    }
    process.stdout.write("\n");

    // Extra gallery photos taken from public/brand (deterministic key → no duplicates on re-run).
    const addedImages: { productId: string; mediaId: string; alt: string }[] = [];
    for (const p of products) {
      const add = PRODUCT_CONTENT[p.slug]?.addImage;
      if (!add) continue;
      const body = await readFile(path.join(ROOT, add.file));
      const key = `public/seed/${createHash("sha1").update(add.file).digest("hex").slice(0, 24)}.jpg`;
      const meta = await sharp(body).metadata();
      await uploadToCloudinary(cloudinary, key, body, "image/jpeg");
      const row = await dst.media.upsert({
        where: { key },
        create: { key, mime: "image/jpeg", size: body.length, width: meta.width ?? null, height: meta.height ?? null, originalName: path.basename(add.file), alt: add.alt, visibility: "PUBLIC" },
        update: {},
      });
      addedImages.push({ productId: p.id, mediaId: row.id, alt: add.alt });
    }

    // ── Frames & options
    for (const f of frames) {
      const data = f as Prisma.FrameOptionUncheckedCreateInput;
      await dst.frameOption.upsert({ where: { id: f.id }, create: data, update: data });
    }
    for (const e of extras) {
      const data = { ...e, colors: e.colors as Prisma.InputJsonValue } as Prisma.ExtraOptionUncheckedCreateInput;
      await dst.extraOption.upsert({ where: { id: e.id }, create: data, update: data });
    }

    // ── Categories (with descriptions and a cover photo)
    for (const c of categories) {
      const content = CATEGORY_CONTENT[c.slug];
      const cover = content?.coverProduct ? products.find((p) => p.slug === content.coverProduct)?.images.sort((a, b) => a.sortOrder - b.sortOrder)[0]?.mediaId : undefined;
      const data = {
        ...c,
        description: content?.description.fr ?? c.description,
        descriptionAr: content?.description.ar ?? c.descriptionAr,
        sortOrder: content?.sortOrder ?? c.sortOrder,
        imageId: cover ?? c.imageId,
      } as Prisma.CategoryUncheckedCreateInput;
      await dst.category.upsert({ where: { id: c.id }, create: data, update: data });
    }

    // ── Products, photos, measures, frames, options
    for (const p of products) {
      const content = PRODUCT_CONTENT[p.slug];
      const { images, measures, frames: pf, extras: pe, ...row } = p;
      const data = {
        ...row,
        ...(content && {
          name: content.name?.fr ?? row.name,
          nameAr: content.name?.ar ?? row.nameAr,
          description: content.description.fr,
          descriptionAr: content.description.ar,
          characteristics: content.characteristics,
          seoDescription: content.seoDescription,
          isFeatured: content.isFeatured ?? row.isFeatured,
        }),
      } as Prisma.ProductUncheckedCreateInput;
      await dst.product.upsert({ where: { id: p.id }, create: data, update: data });

      for (const img of images.filter((i) => media.some((m) => m.id === i.mediaId))) {
        await dst.productImage.upsert({ where: { id: img.id }, create: img, update: img });
      }
      for (const add of addedImages.filter((a) => a.productId === p.id)) {
        const exists = await dst.productImage.findFirst({ where: { productId: p.id, mediaId: add.mediaId } });
        if (!exists) await dst.productImage.create({ data: { productId: p.id, mediaId: add.mediaId, alt: add.alt, sortOrder: images.length } });
      }
      for (const m of measures) await dst.productMeasure.upsert({ where: { id: m.id }, create: m, update: m });
      for (const f of pf) await dst.productFrame.upsert({ where: { productId_frameId: { productId: f.productId, frameId: f.frameId } }, create: f, update: f });
      for (const e of pe) await dst.productExtra.upsert({ where: { productId_extraId: { productId: e.productId, extraId: e.extraId } }, create: e, update: e });
    }

    for (const s of settings) {
      await dst.setting.upsert({ where: { key: s.key }, create: { key: s.key, value: s.value as Prisma.InputJsonValue }, update: { value: s.value as Prisma.InputJsonValue } });
    }

    // ── Editorial content (published right away)
    const now = new Date();
    for (const [key, content] of Object.entries(CMS_CONTENT)) {
      const json = content as Prisma.InputJsonValue;
      await dst.cmsSection.upsert({ where: { key }, create: { key, draft: json, published: json, publishedAt: now }, update: { draft: json, published: json, publishedAt: now } });
    }

    console.log(`✔ Published: ${categories.length} categories, ${products.length} products, ${media.length + addedImages.length} photos on Cloudinary, ${Object.keys(CMS_CONTENT).length} content sections.`);
  } finally {
    await Promise.all([src.$disconnect(), dst.$disconnect()]);
  }
}

main().catch((err: Error) => {
  // Never print a connection string (it contains the database password).
  console.error(`✘ ${(err.message ?? String(err)).replace(/(postgres(ql)?|cloudinary):\/\/\S*/g, "<url>")}`);
  process.exitCode = 1;
});
