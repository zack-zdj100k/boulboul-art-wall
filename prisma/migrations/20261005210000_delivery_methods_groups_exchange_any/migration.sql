-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('HOME', 'STOP_DESK');

-- AlterTable
ALTER TABLE "DeliveryRule" ADD COLUMN     "returnFee" INTEGER,
ADD COLUMN     "stopDeskFee" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'HOME',
ADD COLUMN     "shipsWithId" TEXT;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "replacementExtras" JSONB,
ADD COLUMN     "replacementFrameName" TEXT,
ADD COLUMN     "replacementProductId" TEXT,
ADD COLUMN     "replacementProductName" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipsWithId_fkey" FOREIGN KEY ("shipsWithId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Replacement price now includes the options of the replacement piece; existing values had none.
