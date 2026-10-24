-- Next-step suggestions (2026-10-24, Luka's UX batch 1.1): up to 3 chips under a run's answer in the chat, made by
-- the agent beside its player message (packages/agent/tools/next-steps.mjs). Adding the column changes nothing for
-- an API that doesn't know it yet.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[];
