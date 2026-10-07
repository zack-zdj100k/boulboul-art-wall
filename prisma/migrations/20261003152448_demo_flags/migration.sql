-- AlterTable
ALTER TABLE "ExtraOption" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FrameOption" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;
