import { NextResponse } from "next/server";
import { frameAdminSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, parseJson } from "@/server/http";
import { saveFrame } from "@/server/services/catalog-admin";

export const GET = adminRoute(async () => NextResponse.json({ items: await prisma.frameOption.findMany({ orderBy: { sortOrder: "asc" } }) }));

export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, frameAdminSchema);
  return NextResponse.json({ item: await saveFrame(null, input, user.id) }, { status: 201 });
});
