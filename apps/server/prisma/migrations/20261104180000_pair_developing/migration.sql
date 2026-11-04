-- Pair developing (2026-11-04, docs/design/pair-developing.md): the owner of a game lets someone in to build it with them.
-- ProjectMember: the people in a game besides its owner (editors); ProjectInvite: the invitations, one per game and email,
-- the link's secret kept only as its SHA-256 (an accepted one stays, so its link opens the game). Message.authorId: who sent a player message, and
-- whose message an agent answer answers; every existing message is the game owner's, so it is filled with the owner.
-- Additive: no column changes type and nothing is dropped; an API that doesn't know the new columns keeps working.

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('editor');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "authorId" TEXT;

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'editor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "ProjectInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "match" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'editor',
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_authorId_idx" ON "Message"("authorId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_createdAt_idx" ON "ProjectMember"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvite_tokenHash_key" ON "ProjectInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ProjectInvite_match_idx" ON "ProjectInvite"("match");

-- CreateIndex
CREATE INDEX "ProjectInvite_sentAt_idx" ON "ProjectInvite"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvite_projectId_match_key" ON "ProjectInvite"("projectId", "match");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every message so far is its game owner's (there were no members before).
UPDATE "Message" AS m SET "authorId" = p."ownerId" FROM "Project" AS p WHERE m."projectId" = p."id" AND m."authorId" IS NULL;
