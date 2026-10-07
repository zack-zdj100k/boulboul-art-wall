import { NextResponse } from "next/server";
import { adminRoute } from "@/server/http";
import { purgeDemoData } from "@/server/services/catalog-admin";

export const DELETE = adminRoute(async (_req, { user }) => NextResponse.json(await purgeDemoData(user.id)));
