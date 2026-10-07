import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/backend/env";
import { AppError, adminRoute, parseJson } from "@/backend/http";
import { sendTestEmail } from "@/backend/email/service";
import { getEmailSettings } from "@/backend/services/settings";

/** Sends a test email to the given address, or to the first notification recipient. */
export const POST = adminRoute(async (req) => {
  const { to } = await parseJson(req, z.object({ to: z.email().optional() }));
  const target = to ?? (await getEmailSettings(env.ADMIN_EMAIL)).adminRecipients[0];
  if (!target) throw new AppError(400, "email.noRecipient");
  try {
    const res = await sendTestEmail(target);
    return NextResponse.json({ ok: true, to: target, provider: res.provider });
  } catch (err) {
    return NextResponse.json({ ok: false, to: target, error: err instanceof Error ? err.message.slice(0, 300) : "Erreur" }, { status: 502 });
  }
});
