-- The public gallery and play counts (2026-10-18; PLAN.md "Better than the competitors" #9): a shared game can also be
-- listed in the gallery (typeplay.app/explore), an admin can take it out again, plays are counted per game and UTC day
-- (a number, nothing about the visitor), and anyone can report a game.

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('sexual', 'hate', 'copied', 'scam', 'other');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "listedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlayCount" (
    "projectId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayCount_pkey" PRIMARY KEY ("projectId","day")
);

-- CreateTable
CREATE TABLE "GameReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "GameReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayCount_day_idx" ON "PlayCount"("day");

-- CreateIndex
CREATE INDEX "GameReport_projectId_createdAt_idx" ON "GameReport"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "GameReport_handledAt_createdAt_idx" ON "GameReport"("handledAt", "createdAt");

-- CreateIndex
CREATE INDEX "Project_listed_listedAt_idx" ON "Project"("listed", "listedAt");

-- AddForeignKey
ALTER TABLE "PlayCount" ADD CONSTRAINT "PlayCount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReport" ADD CONSTRAINT "GameReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

