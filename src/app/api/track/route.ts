import { z } from "zod";
import { clientIp, parseJson, publicRoute } from "@/backend/http";
import { rateLimit } from "@/backend/rate-limit";
import { recordVisit } from "@/backend/services/traffic";
import { BOT_RE } from "@/shared/lib/traffic";

const visitSchema = z.object({
  url: z.string().max(2000),
  referrer: z.string().max(2000).nullish(),
});

// One call per browsing session from <TrafficTracker />: where did this visitor come from?
// Bots and admins are not counted.
export const POST = publicRoute(async (req, { user }) => {
  rateLimit(`track:${clientIp(req)}`, 30, 60_000);
  const { url, referrer } = await parseJson(req, visitSchema);
  const userAgent = req.headers.get("user-agent");
  if (user?.role === "ADMIN" || !userAgent || BOT_RE.test(userAgent)) return new Response(null, { status: 204 });
  // Only pages of this site (the beacon cannot be used to record arbitrary URLs).
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return new Response(null, { status: 204 });
  }
  if (host !== req.nextUrl.host && host !== req.headers.get("host")) return new Response(null, { status: 204 });
  await recordVisit({ url, referrer: referrer ?? null, userAgent, ownHost: new URL(url).hostname });
  return new Response(null, { status: 204 });
});
