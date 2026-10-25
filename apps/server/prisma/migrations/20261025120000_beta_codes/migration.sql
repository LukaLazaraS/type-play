-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "BetaCode" (
    "code" TEXT NOT NULL,
    "uses" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "BetaCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "BetaCodeUse" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "match" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedAt" TIMESTAMP(3),

    CONSTRAINT "BetaCodeUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaCodeTry" (
    "id" SERIAL NOT NULL,
    "match" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaCodeTry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BetaCodeUse_match_idx" ON "BetaCodeUse"("match");

-- CreateIndex
CREATE UNIQUE INDEX "BetaCodeUse_code_match_key" ON "BetaCodeUse"("code", "match");

-- CreateIndex
CREATE INDEX "BetaCodeTry_match_at_idx" ON "BetaCodeTry"("match", "at");

-- CreateIndex
CREATE INDEX "BetaCodeTry_at_idx" ON "BetaCodeTry"("at");

-- AddForeignKey
ALTER TABLE "BetaCodeUse" ADD CONSTRAINT "BetaCodeUse_code_fkey" FOREIGN KEY ("code") REFERENCES "BetaCode"("code") ON DELETE CASCADE ON UPDATE CASCADE;

