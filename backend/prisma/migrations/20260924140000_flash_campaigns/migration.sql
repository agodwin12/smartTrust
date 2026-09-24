-- CreateEnum
CREATE TYPE "FlashCampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FlashItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FLASH_APPLICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'FLASH_APPLICATION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'FLASH_CAMPAIGN_LIVE';
ALTER TYPE "NotificationType" ADD VALUE 'FLASH_CAMPAIGN_ENDED';

-- CreateTable
CREATE TABLE "flash_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "FlashCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "minDiscountPercent" INTEGER NOT NULL DEFAULT 10,
    "applicationsOpen" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flash_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flash_campaign_items" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "FlashItemStatus" NOT NULL DEFAULT 'PENDING',
    "campaignPrice" DECIMAL(12,2) NOT NULL,
    "originalPrice" DECIMAL(12,2),
    "originalCompareAtPrice" DECIMAL(12,2),
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "note" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flash_campaign_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flash_campaigns_slug_key" ON "flash_campaigns"("slug");

-- CreateIndex
CREATE INDEX "flash_campaigns_status_startsAt_endsAt_idx" ON "flash_campaigns"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "flash_campaign_items_campaignId_status_idx" ON "flash_campaign_items"("campaignId", "status");

-- CreateIndex
CREATE INDEX "flash_campaign_items_advertisementId_applied_idx" ON "flash_campaign_items"("advertisementId", "applied");

-- CreateIndex
CREATE UNIQUE INDEX "flash_campaign_items_campaignId_advertisementId_key" ON "flash_campaign_items"("campaignId", "advertisementId");

-- AddForeignKey
ALTER TABLE "flash_campaign_items" ADD CONSTRAINT "flash_campaign_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "flash_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_campaign_items" ADD CONSTRAINT "flash_campaign_items_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "advertisements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_campaign_items" ADD CONSTRAINT "flash_campaign_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

