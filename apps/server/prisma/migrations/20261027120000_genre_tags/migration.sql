-- The genre and tags a player picks on /create (2026-10-27): one genre at most (null: the AI picks from the idea) and
-- any tags (2d or 3d, retro, ...). The first build gets them, also when it waits in line or builds again after a failed
-- first try; the game folder keeps them (GENRE, TAGS) for every change. Additive: games made before have none, and an
-- API that does not know the columns yet keeps working.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "pickedGenre" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "QueuedRun" ADD COLUMN     "genre" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
