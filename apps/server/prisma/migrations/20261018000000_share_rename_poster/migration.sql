-- Game management and share pages (2026-10-18): the player's own name for a game, sharing a game
-- at typeplay.app/play/<id> (private by default), and whether a build published a poster.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "renamed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Version" ADD COLUMN     "poster" BOOLEAN NOT NULL DEFAULT false;
