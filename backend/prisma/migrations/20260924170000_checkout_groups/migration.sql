-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'GUEST';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "checkout_groups" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'MOBILE_MONEY',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "deliveryAddress" TEXT,
    "deliveryPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_groups_reference_key" ON "checkout_groups"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_groups_accessToken_key" ON "checkout_groups"("accessToken");

-- CreateIndex
CREATE INDEX "checkout_groups_buyerId_idx" ON "checkout_groups"("buyerId");

-- CreateIndex
CREATE INDEX "orders_groupId_idx" ON "orders"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_groupId_key" ON "payments"("groupId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "checkout_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "checkout_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_groups" ADD CONSTRAINT "checkout_groups_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

