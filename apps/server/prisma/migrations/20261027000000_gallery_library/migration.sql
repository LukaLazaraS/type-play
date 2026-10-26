-- The gallery as a library (2026-10-27): its genre filter needs each game's genre in the database (until now the gallery
-- read it from the game folder's GENRE file, one file per card). Each build copies it here; the API fills it in for games
-- built before, from their folders, when it starts (GalleryService.backfillGenres). Additive: an API that does not know
-- the column yet keeps working.

-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('runner', 'puzzle', 'racer', 'towerdefence');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "genre" "Genre";
