-- The build queue (2026-10-26, apps/server/README.md "The build queue"): when every builder is busy (MAX_RUNS), a build
-- waits in line here instead of being refused with 409 busy, so a restart keeps the line. Paid plans first, first come
-- first served; a free build lines up as if it had come QUEUE_FREE_DELAY_MIN later (turnAt). Agent messages gain the
-- status "queued" and their build's start and end times (older rows: null).

-- CreateEnum
CREATE TYPE "QueueLane" AS ENUM ('paid', 'free');

-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'queued';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "QueuedRun" (
    "messageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "platform" "Platform",
    "lane" "QueueLane" NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turnAt" TIMESTAMP(3) NOT NULL,
    "holdTenths" INTEGER NOT NULL,

    CONSTRAINT "QueuedRun_pkey" PRIMARY KEY ("messageId"),
    CONSTRAINT "QueuedRun_kind_check" CHECK ("kind" IN ('new', 'edit')),
    CONSTRAINT "QueuedRun_holdTenths_check" CHECK ("holdTenths" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "QueuedRun_projectId_key" ON "QueuedRun"("projectId");

-- CreateIndex
CREATE INDEX "QueuedRun_turnAt_idx" ON "QueuedRun"("turnAt");

-- AddForeignKey
ALTER TABLE "QueuedRun" ADD CONSTRAINT "QueuedRun_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
