import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { createSession } from "@/server/auth/session";
import { clientIp, parseJson, publicRoute } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { authenticate } from "@/server/services/user";

export const POST = publicRoute(async (req) => {
  const input = await parseJson(req, loginSchema);
  rateLimit(`login:ip:${clientIp(req)}`, 20, 15 * 60_000);
  rateLimit(`login:email:${input.email}`, 8, 15 * 60_000);
  const user = await authenticate(input.email, input.password);
  await createSession(user.id, req.headers.get("user-agent"));
  return NextResponse.json({ user });
});
