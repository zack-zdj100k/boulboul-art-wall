import { NextResponse } from "next/server";
import { registerSchema } from "@/shared/lib/validation";
import { createSession } from "@/backend/auth/session";
import { clientIp, parseJson, publicRoute } from "@/backend/http";
import { rateLimit } from "@/backend/rate-limit";
import { readAttribution } from "@/backend/services/traffic";
import { registerUser } from "@/backend/services/user";

export const POST = publicRoute(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 5, 15 * 60_000);
  const input = await parseJson(req, registerSchema);
  const user = await registerUser(input, await readAttribution());
  await createSession(user.id, req.headers.get("user-agent"));
  return NextResponse.json({ user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } }, { status: 201 });
});
