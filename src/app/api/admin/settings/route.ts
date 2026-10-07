import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, parseJson } from "@/server/http";
import { audit } from "@/server/services/audit";
import { getAllSettings, updateSettings } from "@/server/services/settings";

export const GET = adminRoute(async () => NextResponse.json({ settings: await getAllSettings() }));

export const PUT = adminRoute(async (req, { user }) => {
  const values = await parseJson(req, z.record(z.string(), z.unknown()));
  await updateSettings(values);
  await audit({ actorId: user.id, action: "settings.update", entityType: "Setting", metadata: { keys: Object.keys(values) } });
  return NextResponse.json({ settings: await getAllSettings() });
});
