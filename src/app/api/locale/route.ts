import { NextResponse } from "next/server";
import { z } from "zod";
import { LOCALE_COOKIE, LOCALES } from "@/shared/i18n/config";
import { parseJson, publicRoute } from "@/backend/http";

export const POST = publicRoute(async (req) => {
  const { locale } = await parseJson(req, z.object({ locale: z.enum(LOCALES) }));
  const res = NextResponse.json({ locale });
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
});
