import { NextResponse } from "next/server";
import { adminRoute } from "@/backend/http";
import { separateDelivery } from "@/backend/services/order";

/** Ship a grouped order on its own (its delivery fee is looked up again). */
export const POST = adminRoute<{ id: string }>(async (_req, { params, user }) => NextResponse.json({ totals: await separateDelivery(params.id, user) }));
