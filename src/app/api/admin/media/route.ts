import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, badRequest } from "@/server/http";
import { listMedia } from "@/server/services/admin-queries";
import { audit } from "@/server/services/audit";
import { toMediaDto, uploadImage } from "@/server/services/media";

const schema = z.object({ page: z.coerce.number().int().min(1).optional(), visibility: z.enum(["PUBLIC", "PRIVATE"]).optional() });

export const GET = adminRoute(async (req) => NextResponse.json(await listMedia(schema.parse(Object.fromEntries(req.nextUrl.searchParams)))));

export const POST = adminRoute(async (req, { user }) => {
  const form = await req.formData().catch(() => null);
  const files = form?.getAll("file").filter((f): f is File => f instanceof File) ?? [];
  if (!files.length) throw badRequest("validation.required");
  const alt = (form?.get("alt") as string | null) ?? null;
  const items = [];
  for (const file of files.slice(0, 20)) items.push(toMediaDto(await uploadImage({ file, visibility: "PUBLIC", userId: user.id, alt })));
  await audit({ actorId: user.id, action: "media.upload", entityType: "Media", metadata: { count: items.length } });
  return NextResponse.json({ items }, { status: 201 });
});
