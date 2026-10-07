import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { adminRoute, parseJson } from "@/server/http";
import { deleteMedia } from "@/server/services/media";

export const PATCH = adminRoute<{ id: string }>(async (req, { params }) => {
  const { alt } = await parseJson(req, z.object({ alt: z.string().trim().max(200) }));
  const media = await prisma.media.update({ where: { id: params.id }, data: { alt: alt || null } });
  return NextResponse.json({ id: media.id, alt: media.alt });
});

export const DELETE = adminRoute<{ id: string }>(async (req, { params, user }) => {
  await deleteMedia(params.id, user.id, req.nextUrl.searchParams.get("force") === "1");
  return NextResponse.json({ deleted: true });
});
