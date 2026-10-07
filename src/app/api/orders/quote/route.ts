import { NextResponse } from "next/server";
import { z } from "zod";
import { configurationSchema } from "@/lib/validation";
import { clientIp, parseJson, publicRoute } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { quoteOrder } from "@/server/services/order";

const schema = z.object({
  items: z.array(configurationSchema).min(1).max(20),
  wilayaCode: z.string().max(3).optional(),
  commune: z.string().max(120).optional(),
  deliveryMethod: z.enum(["HOME", "STOP_DESK"]).default("HOME"),
});

export const POST = publicRoute(async (req) => {
  rateLimit(`order-quote:${clientIp(req)}`, 120, 60_000);
  const input = await parseJson(req, schema);
  const quote = await quoteOrder(input);
  return NextResponse.json({
    items: quote.items.map((i) => ({ productId: i.productId, productName: i.productName, quote: i.quote })),
    subtotal: quote.subtotal,
    delivery: { fee: quote.delivery.fee, free: quote.delivery.free, home: quote.delivery.home, stopDesk: quote.delivery.stopDesk, method: quote.delivery.method },
    total: quote.total,
  });
});
