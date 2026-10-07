import { NextResponse } from "next/server";
import { destroySession } from "@/backend/auth/session";
import { publicRoute } from "@/backend/http";

export const POST = publicRoute(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
