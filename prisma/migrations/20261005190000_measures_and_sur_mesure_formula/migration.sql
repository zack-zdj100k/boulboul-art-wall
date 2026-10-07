-- Measures created by the admin (one table) + Sur Mesure calculated from a stable reference price
-- (± step price per 10 cm of length / height). Existing prices are all kept as created measures.

-- AlterEnum: every existing snapshot came from an explicit price → PRESET.
BEGIN;
CREATE TYPE "PricingSource_new" AS ENUM ('PRESET', 'SUR_MESURE');
ALTER TABLE "OrderItem" ALTER COLUMN "pricingType" TYPE "PricingSource_new" USING (CASE WHEN "pricingType" IS NULL THEN NULL ELSE 'PRESET' END::"PricingSource_new");
ALTER TYPE "PricingSource" RENAME TO "PricingSource_old";
ALTER TYPE "PricingSource_new" RENAME TO "PricingSource";
DROP TYPE "public"."PricingSource_old";
COMMIT;

-- The former "special measures" table becomes the measures table; standard rows are merged in
-- (a special measure with the same size keeps priority, as before).
ALTER TABLE "SpecialMeasurePrice" RENAME TO "ProductMeasure";
ALTER TABLE "ProductMeasure" RENAME CONSTRAINT "SpecialMeasurePrice_pkey" TO "ProductMeasure_pkey";
ALTER TABLE "ProductMeasure" RENAME CONSTRAINT "SpecialMeasurePrice_productId_fkey" TO "ProductMeasure_productId_fkey";
ALTER INDEX "SpecialMeasurePrice_productId_isActive_idx" RENAME TO "ProductMeasure_productId_isActive_idx";
ALTER INDEX "SpecialMeasurePrice_productId_widthCm_heightCm_key" RENAME TO "ProductMeasure_productId_widthCm_heightCm_key";

INSERT INTO "ProductMeasure" ("id", "productId", "widthCm", "heightCm", "price", "isActive", "createdAt", "updatedAt")
SELECT "id", "productId", "widthCm", "heightCm", "price", "isActive", "createdAt", "updatedAt" FROM "StandardDimensionPrice"
ON CONFLICT ("productId", "widthCm", "heightCm") DO NOTHING;

ALTER TABLE "StandardDimensionPrice" DROP CONSTRAINT "StandardDimensionPrice_productId_fkey";
DROP TABLE "StandardDimensionPrice";

-- Sur Mesure parameters (all optional: nothing is calculated until the admin fills them).
ALTER TABLE "Product" ADD COLUMN "refWidthCm" INTEGER,
ADD COLUMN "refHeightCm" INTEGER,
ADD COLUMN "refPrice" INTEGER,
ADD COLUMN "widthStepPrice" INTEGER,
ADD COLUMN "heightStepPrice" INTEGER,
ADD COLUMN "customMinWidthCm" INTEGER,
ADD COLUMN "customMaxWidthCm" INTEGER,
ADD COLUMN "customMinHeightCm" INTEGER,
ADD COLUMN "customMaxHeightCm" INTEGER,
ADD COLUMN "customMinPrice" INTEGER;

-- Custom design requests: estimate from the Sur Mesure settings again.
ALTER TABLE "CustomOrder" ADD COLUMN "estimatedPrice" INTEGER;
