import { NextResponse } from "next/server";
import { destroySession } from "@/server/auth/session";
import { publicRoute } from "@/server/http";

export const POST = publicRoute(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
