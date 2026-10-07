-- AlterTable
ALTER TABLE "CustomOrder" ADD COLUMN     "deliveryFee" INTEGER,
ADD COLUMN     "discountType" "PromotionType",
ADD COLUMN     "discountValue" INTEGER,
ADD COLUMN     "price" INTEGER,
ADD COLUMN     "total" INTEGER;
