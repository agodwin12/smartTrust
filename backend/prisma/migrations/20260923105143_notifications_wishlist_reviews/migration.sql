-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERY_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'RECEIPT_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'ESCROW_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_REFUNDED';
ALTER TYPE "NotificationType" ADD VALUE 'WITHDRAWAL_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'WITHDRAWAL_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_ACTIVATED';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_RECEIVED';
-- DropIndex
DROP INDEX "notifications_userId_idx";
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "data" JSONB,
ADD COLUMN     "readAt" TIMESTAMP(3);
-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "wishlist_items_userId_createdAt_idx" ON "wishlist_items"("userId", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_userId_advertisementId_key" ON "wishlist_items"("userId", "advertisementId");
-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");
-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "advertisements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
