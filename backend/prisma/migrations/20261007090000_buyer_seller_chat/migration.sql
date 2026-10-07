-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "advertisementId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "buyerUnread" INTEGER NOT NULL DEFAULT 0,
    "sellerUnread" INTEGER NOT NULL DEFAULT 0,
    "buyerLastReadAt" TIMESTAMP(3),
    "sellerLastReadAt" TIMESTAMP(3),
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "advertisementId" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_buyerId_lastMessageAt_idx" ON "conversations"("buyerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_storeId_lastMessageAt_idx" ON "conversations"("storeId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_flagged_lastMessageAt_idx" ON "conversations"("flagged", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_buyerId_storeId_key" ON "conversations"("buyerId", "storeId");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_senderId_clientId_key" ON "chat_messages"("senderId", "clientId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "advertisements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "advertisements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

