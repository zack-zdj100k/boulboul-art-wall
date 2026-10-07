import { NextResponse } from "next/server";
import { loginSchema } from "@/shared/lib/validation";
import { createSession } from "@/backend/auth/session";
import { clientIp, parseJson, publicRoute } from "@/backend/http";
import { rateLimit } from "@/backend/rate-limit";
import { authenticate } from "@/backend/services/user";

export const POST = publicRoute(async (req) => {
  const input = await parseJson(req, loginSchema);
  rateLimit(`login:ip:${clientIp(req)}`, 20, 15 * 60_000);
  rateLimit(`login:email:${input.email}`, 8, 15 * 60_000);
  const user = await authenticate(input.email, input.password);
  await createSession(user.id, req.headers.get("user-agent"));
  return NextResponse.json({ user });
});
