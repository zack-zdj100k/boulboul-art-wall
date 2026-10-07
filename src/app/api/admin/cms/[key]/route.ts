import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, parseJson } from "@/backend/http";
import { getSection, saveDraft } from "@/backend/services/cms";

export const GET = adminRoute<{ key: string }>(async (_req, { params }) => NextResponse.json(await getSection(params.key)));

/** Save the draft (and optionally publish it in the same step). */
export const PUT = adminRoute<{ key: string }>(async (req, { params, user }) => {
  const { content, publish } = await parseJson(req, z.object({ content: z.record(z.string(), z.unknown()), publish: z.boolean().default(false) }));
  const row = await saveDraft(params.key, content, user.id, publish);
  return NextResponse.json({ updatedAt: row.updatedAt, publishedAt: row.publishedAt });
});
