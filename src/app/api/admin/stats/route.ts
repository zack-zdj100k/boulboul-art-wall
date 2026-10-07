import { NextResponse } from "next/server";
import { adminRoute } from "@/server/http";
import { getDashboardStats } from "@/server/services/stats";

export const GET = adminRoute(async () => NextResponse.json(await getDashboardStats()));
