import { NextResponse } from "next/server";
import { publicRoute } from "@/backend/http";

export const GET = publicRoute(async (_req, { user }) => NextResponse.json({ user }));
