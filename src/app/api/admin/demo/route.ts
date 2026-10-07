import { NextResponse } from "next/server";
import { adminRoute } from "@/backend/http";
import { purgeDemoData } from "@/backend/services/catalog-admin";

export const DELETE = adminRoute(async (_req, { user }) => NextResponse.json(await purgeDemoData(user.id)));
