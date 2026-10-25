-- The screens a game is made for (2026-10-25, the platform choice on the new-game screen): phone or computer (one shape,
-- scaled to fit with bars) or fill (every shape). Additive: games made before have none, and an API that does not
-- know the column yet keeps working.

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('phone', 'computer', 'fill');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "platform" "Platform";
