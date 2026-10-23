-- Code review fixes (2026-10-18): a game folder that could not be reset ("dirty"), the key proxy's
-- metered cost per run, and closed accounts' tombstones (sign-in tokens refused, no second signup grant).

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "dirty" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "meteredUsd" DECIMAL(10,4);

-- CreateTable
CREATE TABLE "ClosedAccount" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClosedAccount_emailHash_idx" ON "ClosedAccount"("emailHash");
