-- Questions before a build (2026-11-04, packages/agent/tools/questions.mjs): with "Ask me first" ticked, the AI may ask
-- the player up to 3 short questions before it builds, when the idea leaves a real gap. The answer that asks carries them
-- (Message.questions, JSON); the player's next message is their answer. The tick's starting state per account (on for a
-- new game, off for a change), and a waiting build's flags (it may ask; it answers questions; its size check ran already).
-- Additive: no existing row changes, and an API that doesn't know the columns yet keeps working.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "questions" JSONB;

-- AlterTable
ALTER TABLE "QueuedRun" ADD COLUMN     "answered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ask" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "sized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "askFirstEdit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "askFirstNew" BOOLEAN NOT NULL DEFAULT true;
