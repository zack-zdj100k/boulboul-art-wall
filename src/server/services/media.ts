import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/server/db";
import { AppError, badRequest } from "@/server/http";
import { getStorage, mediaUrl } from "@/server/storage";
import { audit } from "./audit";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] as const;
type AcceptedMime = (typeof ACCEPTED_MIME)[number];

const EXT: Record<AcceptedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/** Detect the real type from the file signature — the browser-provided type/name are never trusted. */
export function sniffImageMime(buf: Buffer): AcceptedMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const head6 = buf.subarray(0, 6).toString("ascii");
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const boxSize = Math.min(buf.readUInt32BE(0), buf.length, 64);
    const brands = buf.subarray(8, boxSize).toString("ascii");
    if (/avif|avis/.test(brands)) return "image/avif";
  }
  return null;
}

export function sanitizeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "image";
  return (
    base
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._ -]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "image"
  );
}

type UploadInput = { file: File; visibility: "PUBLIC" | "PRIVATE"; userId: string | null; alt?: string | null };

export async function uploadImage({ file, visibility, userId, alt }: UploadInput) {
  if (!(file instanceof File) || file.size === 0) throw badRequest("validation.required");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError(413, "errors.uploadSize");

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageMime(buffer);
  if (!mime) throw new AppError(415, "errors.uploadType");

  // Decode with sharp: rejects corrupt/polyglot files and gives trusted dimensions.
  let width: number | undefined;
  let height: number | undefined;
  try {
    const image = sharp(buffer, { animated: mime === "image/gif", limitInputPixels: 80_000_000 });
    const meta = await image.metadata();
    const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp", "image/avif": "heif", "image/gif": "gif" }[mime];
    if (meta.format !== expected) throw new Error(`format mismatch ${meta.format}`);
    width = meta.width;
    height = meta.pageHeight ?? meta.height;
    // Re-encode still images: applies EXIF orientation and strips metadata (GPS, camera…).
    if (mime === "image/jpeg") buffer = await sharp(buffer).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    else if (mime === "image/png") buffer = await sharp(buffer).rotate().png({ compressionLevel: 9 }).toBuffer();
    else if (mime === "image/webp") buffer = await sharp(buffer).rotate().webp({ quality: 90 }).toBuffer();
    if (meta.orientation && meta.orientation >= 5 && width && height) [width, height] = [height, width];
  } catch {
    throw new AppError(415, "errors.uploadType");
  }

  const now = new Date();
  const folder = visibility === "PRIVATE" ? "private" : "public";
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(16).toString("hex")}.${EXT[mime]}`;
  await getStorage().put(key, buffer, mime);

  return prisma.media.create({
    data: {
      key,
      mime,
      size: buffer.length,
      width: width ?? null,
      height: height ?? null,
      originalName: sanitizeFilename(file.name),
      alt: alt?.slice(0, 200) || null,
      visibility,
      uploadedById: userId,
    },
  });
}

/** Where a media item is used — prevents deleting images still referenced. */
export async function mediaUsage(id: string, key: string) {
  const [products, categories, frames, customOrders, cms] = await Promise.all([
    prisma.productImage.count({ where: { mediaId: id } }),
    prisma.category.count({ where: { imageId: id } }),
    prisma.frameOption.count({ where: { imageId: id } }),
    prisma.customOrder.count({ where: { designMediaId: id } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "CmsSection"
      WHERE "draft"::text LIKE ${"%" + key + "%"} OR COALESCE("published"::text, '') LIKE ${"%" + key + "%"}`,
  ]);
  const cmsCount = Number(cms[0]?.count ?? 0);
  return { products, categories, frames, customOrders, cms: cmsCount, total: products + categories + frames + customOrders + cmsCount };
}

/**
 * Delete a media file. Without `force`, refuses when the image is used anywhere.
 * With `force`, detaches it from products, categories, frames and custom requests first.
 * Images referenced by CMS content are never force-deleted (the page would show a broken image).
 */
export async function deleteMedia(id: string, actorId: string, force = false) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new AppError(404, "errors.notFound");
  const usage = await mediaUsage(id, media.key);
  if (usage.cms > 0) throw new AppError(409, "media.inCms");
  if (usage.total > 0 && !force) throw new AppError(409, "media.inUse");
  await prisma.$transaction([
    prisma.productImage.deleteMany({ where: { mediaId: id } }),
    prisma.category.updateMany({ where: { imageId: id }, data: { imageId: null } }),
    prisma.frameOption.updateMany({ where: { imageId: id }, data: { imageId: null } }),
    prisma.customOrder.updateMany({ where: { designMediaId: id }, data: { designMediaId: null } }),
    prisma.media.delete({ where: { id } }),
  ]);
  await getStorage().delete(media.key);
  await audit({ actorId, action: "media.delete", entityType: "Media", entityId: id, metadata: { key: media.key, forced: force, usage } });
}

export function toMediaDto(m: { id: string; key: string; alt: string | null; width: number | null; height: number | null }) {
  return { id: m.id, url: mediaUrl(m.key), alt: m.alt, width: m.width, height: m.height };
}
