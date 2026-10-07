-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "trafficCampaign" TEXT,
ADD COLUMN     "trafficSource" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupCampaign" TEXT,
ADD COLUMN     "signupSource" TEXT;

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT,
    "campaign" TEXT,
    "referrerHost" TEXT,
    "landingPath" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_createdAt_idx" ON "Visit"("createdAt");

-- CreateIndex
CREATE INDEX "Visit_source_createdAt_idx" ON "Visit"("source", "createdAt");

