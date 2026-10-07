import { NextResponse } from "next/server";
import { configurationSchema } from "@/shared/lib/validation";
import { badRequest, clientIp, parseJson, publicRoute } from "@/backend/http";
import { rateLimit } from "@/backend/rate-limit";
import { priceLine, PricingError } from "@/backend/services/pricing";
import { getPricingProductOrThrow } from "@/backend/services/product";

// Live price for the product page. Display only — orders are re-priced on creation.
// Dimensions without a configured price answer `{ available: false }` (no price is invented).
export const POST = publicRoute(async (req) => {
  rateLimit(`quote:${clientIp(req)}`, 240, 60_000);
  const config = await parseJson(req, configurationSchema);
  const product = await getPricingProductOrThrow(config.productId);
  try {
    return NextResponse.json({ available: true, quote: priceLine(product, config) });
  } catch (err) {
    if (err instanceof PricingError && err.code === "pricing.needsSurMesure") {
      return NextResponse.json({ available: false, reason: err.code, widthCm: config.widthCm, heightCm: config.heightCm });
    }
    if (err instanceof PricingError) throw badRequest(err.code);
    throw err;
  }
});
