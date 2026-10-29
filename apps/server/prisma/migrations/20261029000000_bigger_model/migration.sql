-- The size check (2026-10-29, packages/agent/tools/size-check.mjs): a change too big for the AI it was sent on stops
-- before the build, charged like any finished answer; its message offers the bigger AI the plan has, and the chat's one
-- tap puts the message back in the box with it picked. Null on every other answer.
-- Adding the column changes nothing for an API that doesn't know it yet.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "biggerModel" "ModelChoice";
