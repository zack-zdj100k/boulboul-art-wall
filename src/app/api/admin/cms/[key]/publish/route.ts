import { NextResponse } from "next/server";
import { adminRoute } from "@/backend/http";
import { publishSection } from "@/backend/services/cms";

export const POST = adminRoute<{ key: string }>(async (_req, { params, user }) => {
  const row = await publishSection(params.key, user.id);
  return NextResponse.json({ publishedAt: row.publishedAt });
});
