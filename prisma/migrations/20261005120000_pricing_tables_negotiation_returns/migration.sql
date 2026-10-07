-- Table-based pricing (standard 10 cm grid + exact "Sur Mesure" measures), per-order
-- negotiation history, CONTACTING status and return/exchange requests.
-- Area / perimeter pricing is removed. Only prices that the admin had typed explicitly are
-- carried over to the new tables; formula-derived sizes are NOT converted into prices.

-- CreateEnum
CREATE TYPE "PricingSource" AS ENUM ('STANDARD', 'SPECIAL');
CREATE TYPE "AdjustmentKind" AS ENUM ('NEGOTIATION', 'DIMENSION_CHANGE', 'DELIVERY_FEE');
CREATE TYPE "ReturnType" AS ENUM ('RETURN', 'EXCHANGE');
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURN_RECEIVED', 'EXCHANGE_PROCESSING', 'COMPLETED', 'CANCELLED');

-- AlterEnum: SHIPPED no longer exists; such orders were confirmed and on their way.
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'CONTACTING', 'CONFIRMED', 'DELIVERED', 'CANCELLED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (CASE WHEN "status"::text = 'SHIPPED' THEN 'CONFIRMED' ELSE "status"::text END::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "fromStatus" TYPE "OrderStatus_new" USING (CASE WHEN "fromStatus"::text = 'SHIPPED' THEN 'CONFIRMED' ELSE "fromStatus"::text END::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "toStatus" TYPE "OrderStatus_new" USING (CASE WHEN "toStatus"::text = 'SHIPPED' THEN 'CONFIRMED' ELSE "toStatus"::text END::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- CreateTable
CREATE TABLE "StandardDimensionPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "widthCm" INTEGER NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardDimensionPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialMeasurePrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "widthCm" INTEGER NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialMeasurePrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderPriceAdjustment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "AdjustmentKind" NOT NULL,
    "previousPrice" INTEGER NOT NULL,
    "newPrice" INTEGER NOT NULL,
    "discountAmount" INTEGER,
    "discountPercent" DOUBLE PRECISION,
    "previousTotal" INTEGER NOT NULL,
    "newTotal" INTEGER NOT NULL,
    "details" JSONB,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPriceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "ReturnType" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "source" "ReviewSource" NOT NULL DEFAULT 'CUSTOMER',
    "managerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnStatusHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "ReturnStatus",
    "toStatus" "ReturnStatus" NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandardDimensionPrice_productId_isActive_idx" ON "StandardDimensionPrice"("productId", "isActive");
CREATE UNIQUE INDEX "StandardDimensionPrice_productId_widthCm_heightCm_key" ON "StandardDimensionPrice"("productId", "widthCm", "heightCm");
CREATE INDEX "SpecialMeasurePrice_productId_isActive_idx" ON "SpecialMeasurePrice"("productId", "isActive");
CREATE UNIQUE INDEX "SpecialMeasurePrice_productId_widthCm_heightCm_key" ON "SpecialMeasurePrice"("productId", "widthCm", "heightCm");
CREATE INDEX "OrderPriceAdjustment_orderId_createdAt_idx" ON "OrderPriceAdjustment"("orderId", "createdAt");
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status", "createdAt");
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");
CREATE INDEX "ReturnStatusHistory_requestId_createdAt_idx" ON "ReturnStatusHistory"("requestId", "createdAt");

-- Data: carry over explicit prices only.
--  • preset sizes with a typed price
--  • the reference size, whose price was the typed "basePrice"
-- 10 cm multiples go to the standard table, any other exact size becomes a special measure.
CREATE TEMP TABLE "_explicit_prices" AS
  SELECT s."productId", s."widthCm", s."heightCm", s."price" FROM "ProductSize" s WHERE s."price" IS NOT NULL
  UNION
  SELECT p."id", p."refWidthCm", p."refHeightCm", p."basePrice" FROM "Product" p
  WHERE NOT EXISTS (
    SELECT 1 FROM "ProductSize" s
    WHERE s."productId" = p."id" AND s."widthCm" = p."refWidthCm" AND s."heightCm" = p."refHeightCm" AND s."price" IS NOT NULL
  );

INSERT INTO "StandardDimensionPrice" ("id", "productId", "widthCm", "heightCm", "price", "updatedAt")
SELECT 'mig' || substr(md5(random()::text || e."productId" || e."widthCm" || 'x' || e."heightCm"), 1, 22), e."productId", e."widthCm", e."heightCm", e."price", CURRENT_TIMESTAMP
FROM "_explicit_prices" e
WHERE e."widthCm" % 10 = 0 AND e."heightCm" % 10 = 0 AND e."price" > 0
ON CONFLICT DO NOTHING;

INSERT INTO "SpecialMeasurePrice" ("id", "productId", "widthCm", "heightCm", "price", "updatedAt")
SELECT 'mig' || substr(md5(random()::text || e."productId" || e."widthCm" || 'x' || e."heightCm"), 1, 22), e."productId", e."widthCm", e."heightCm", e."price", CURRENT_TIMESTAMP
FROM "_explicit_prices" e
WHERE (e."widthCm" % 10 <> 0 OR e."heightCm" % 10 <> 0) AND e."price" > 0
ON CONFLICT DO NOTHING;

DROP TABLE "_explicit_prices";

-- AlterTable: order price snapshot. Legacy rows are filled from their stored breakdown.
ALTER TABLE "Order" ADD COLUMN "managerNotes" TEXT,
ADD COLUMN "negotiatedDiscount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem" ADD COLUMN "officialPrice" INTEGER,
ADD COLUMN "optionsPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "priceAfterPromotion" INTEGER,
ADD COLUMN "pricingLabel" TEXT,
ADD COLUMN "pricingRefId" TEXT,
ADD COLUMN "pricingType" "PricingSource",
ADD COLUMN "promotionDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "promotionType" "PromotionType",
ADD COLUMN "promotionValue" INTEGER;

UPDATE "OrderItem" SET
  "officialPrice" = COALESCE(("pricingBreakdown"->>'sizePrice')::int, "unitPrice"),
  "optionsPrice" = GREATEST(0, COALESCE(("pricingBreakdown"->>'unitBeforeDiscount')::int - ("pricingBreakdown"->>'sizePrice')::int, 0)),
  "promotionDiscount" = COALESCE(("pricingBreakdown"->>'discount')::int, 0),
  "promotionType" = ("pricingBreakdown"->'promotion'->>'type')::"PromotionType",
  "promotionValue" = ("pricingBreakdown"->'promotion'->>'value')::int;
UPDATE "OrderItem" SET "priceAfterPromotion" = GREATEST(0, "officialPrice" - "promotionDiscount");

ALTER TABLE "OrderItem" ALTER COLUMN "officialPrice" SET NOT NULL,
ALTER COLUMN "priceAfterPromotion" SET NOT NULL;

-- Drop the formula-based pricing
ALTER TABLE "ProductSize" DROP CONSTRAINT "ProductSize_productId_fkey";
DROP TABLE "ProductSize";
ALTER TABLE "CustomOrder" DROP COLUMN "estimatedPrice";
ALTER TABLE "FrameOption" DROP COLUMN "priceType";
ALTER TABLE "Product" DROP COLUMN "availability",
DROP COLUMN "basePrice",
DROP COLUMN "maxHeightCm",
DROP COLUMN "maxWidthCm",
DROP COLUMN "minHeightCm",
DROP COLUMN "minPrice",
DROP COLUMN "minWidthCm",
DROP COLUMN "pricePerM2",
DROP COLUMN "refHeightCm",
DROP COLUMN "refWidthCm";
DROP TYPE "Availability";
DROP TYPE "PriceType";
DELETE FROM "Setting" WHERE "key" IN ('custom.pricePerM2', 'custom.minPrice', 'pricing.rounding');

-- AddForeignKey
ALTER TABLE "StandardDimensionPrice" ADD CONSTRAINT "StandardDimensionPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialMeasurePrice" ADD CONSTRAINT "SpecialMeasurePrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderPriceAdjustment" ADD CONSTRAINT "OrderPriceAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderPriceAdjustment" ADD CONSTRAINT "OrderPriceAdjustment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnStatusHistory" ADD CONSTRAINT "ReturnStatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnStatusHistory" ADD CONSTRAINT "ReturnStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
