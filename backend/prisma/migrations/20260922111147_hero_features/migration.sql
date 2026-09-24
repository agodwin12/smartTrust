-- AlterTable
ALTER TABLE "advertisements" ADD COLUMN     "featuredAt" TIMESTAMP(3),
ADD COLUMN     "featuredById" TEXT,
ADD COLUMN     "featuredUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "heroDurationHours" INTEGER,
ADD COLUMN     "heroEligible" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "advertisements_featuredUntil_idx" ON "advertisements"("featuredUntil");

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_featuredById_fkey" FOREIGN KEY ("featuredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
