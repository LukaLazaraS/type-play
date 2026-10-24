-- "More ideas" (2026-10-24, Luka's UX batch 2.1): up to three more rounds of next-step ideas per answer; the new ones
-- are appended to "suggestions", and this counts the rounds. Adding the column changes nothing for an older API.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "ideaRounds" INTEGER NOT NULL DEFAULT 0;
