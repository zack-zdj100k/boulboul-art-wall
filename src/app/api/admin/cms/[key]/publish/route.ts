import { NextResponse } from "next/server";
import { adminRoute } from "@/server/http";
import { publishSection } from "@/server/services/cms";

export const POST = adminRoute<{ key: string }>(async (_req, { params, user }) => {
  const row = await publishSection(params.key, user.id);
  return NextResponse.json({ publishedAt: row.publishedAt });
});
