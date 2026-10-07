import { NextResponse } from "next/server";
import { publicRoute } from "@/server/http";

export const GET = publicRoute(async (_req, { user }) => NextResponse.json({ user }));
