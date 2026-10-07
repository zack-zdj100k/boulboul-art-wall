import { NextResponse } from "next/server";
import { frameAdminSchema } from "@/shared/lib/admin-validation";
import { prisma } from "@/backend/db";
import { adminRoute, parseJson } from "@/backend/http";
import { saveFrame } from "@/backend/services/catalog-admin";

export const GET = adminRoute(async () => NextResponse.json({ items: await prisma.frameOption.findMany({ orderBy: { sortOrder: "asc" } }) }));

export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, frameAdminSchema);
  return NextResponse.json({ item: await saveFrame(null, input, user.id) }, { status: 201 });
});
