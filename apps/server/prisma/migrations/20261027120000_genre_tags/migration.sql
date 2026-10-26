-- The genre and tags a player picks on /create (2026-10-27): one genre at most (null: the AI picks from the idea; the
-- Genre type comes from 20261027000000_gallery_library) and any tags (2d or 3d, retro, cute, cozy, hard). The first
-- build gets them, also when it waits in line or builds again after a failed first try; the game folder keeps them
-- (GENRE, TAGS) for every change. Additive: games made before have none, and an API that does not know the columns yet
-- keeps working.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "pickedGenre" "Genre",
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "QueuedRun" ADD COLUMN     "genre" "Genre",
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
