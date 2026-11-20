-- The game's public line (2026-11-20): the AI's, read from the game folder's PITCH after each build, and the owner's own,
-- shown instead of it (null: the AI's). Both null for every game until its next build, the backfill or its owner.
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "ownerPitch" TEXT,
ADD COLUMN     "pitch" TEXT;
