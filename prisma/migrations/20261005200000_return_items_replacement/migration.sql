-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "replacementHeightCm" INTEGER,
ADD COLUMN     "replacementPrice" INTEGER,
ADD COLUMN     "replacementPricingType" "PricingSource",
ADD COLUMN     "replacementWidthCm" INTEGER;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing requests concern the order's (single) item.
UPDATE "ReturnRequest" r SET "orderItemId" = (SELECT i."id" FROM "OrderItem" i WHERE i."orderId" = r."orderId" ORDER BY i."id" LIMIT 1) WHERE r."orderItemId" IS NULL;
