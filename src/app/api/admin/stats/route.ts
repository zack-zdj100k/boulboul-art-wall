import { NextResponse } from "next/server";
import { adminRoute } from "@/backend/http";
import { getDashboardStats } from "@/backend/services/stats";

export const GET = adminRoute(async () => NextResponse.json(await getDashboardStats()));
