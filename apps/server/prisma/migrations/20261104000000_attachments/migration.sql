-- Pictures attached to a message (2026-11-04): reference pictures for the AI, or art the player asks it to put in the
-- game. One row per picture; its files live in the API's data folder (DATA_DIR/attachments). A row is staged (no
-- message) until it is sent, then it goes with its message, game and account (cascade). A build waiting in line keeps
-- its message's pictures in QueuedRun.images (Attachment ids, in order).
-- Additive: no existing row changes, and an API that does not know the table or the column yet keeps working.

-- CreateEnum
CREATE TYPE "ImageFormat" AS ENUM ('png', 'jpeg', 'webp');

-- AlterTable
ALTER TABLE "QueuedRun" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "format" "ImageFormat" NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_userId_messageId_idx" ON "Attachment"("userId", "messageId");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
