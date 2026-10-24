-- Next-step suggestions (2026-10-24, Luka's UX batches 1.1 and 3.1): up to 12 ideas, best first, under a run's
-- answer in the chat, three at a time, made by the agent beside its player message (packages/agent/tools/next-steps.mjs).
-- Adding the column changes nothing for an API that doesn't know it yet.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[];
