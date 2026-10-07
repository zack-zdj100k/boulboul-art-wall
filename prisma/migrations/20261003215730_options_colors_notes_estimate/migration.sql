-- AlterEnum
ALTER TYPE "CustomOrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "CustomOrder" ADD COLUMN     "estimatedPrice" INTEGER;

-- AlterTable
ALTER TABLE "ExtraOption" ADD COLUMN     "askNote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "colors" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "notePrompt" TEXT,
ADD COLUMN     "notePromptAr" TEXT;
