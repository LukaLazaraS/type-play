-- Four more genres on /create (2026-10-27): platformer, shooter, arcade and adventure, each a skill in
-- packages/agent/genres/. Additive: new values at the end of the Genre type (from 20261027000000_gallery_library), so an
-- API that does not know them yet keeps working. The new tags need nothing here (Project.tags is TEXT[]).

-- AlterEnum
ALTER TYPE "Genre" ADD VALUE 'platformer';
ALTER TYPE "Genre" ADD VALUE 'shooter';
ALTER TYPE "Genre" ADD VALUE 'arcade';
ALTER TYPE "Genre" ADD VALUE 'adventure';
