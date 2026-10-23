-- The kill switch's number survives a game's deletion (2026-10-22, payments review): Message rows go
-- with their project (cascade), so the Free plan's AI spend per UTC day is kept here as well, added to
-- when a Free run ends and never lowered. Backfilled from the Message rows still there.

-- CreateTable
CREATE TABLE "FreeSpend" (
    "day" TIMESTAMP(3) NOT NULL,
    "usd" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "FreeSpend_pkey" PRIMARY KEY ("day")
);

-- Backfill: what Free runs cost per day so far (timestamp(3) columns hold UTC).
INSERT INTO "FreeSpend" ("day", "usd")
SELECT date_trunc('day', "createdAt"), coalesce(sum("costUsd"), 0)
FROM "Message"
WHERE plan = 'free' AND "costUsd" IS NOT NULL
GROUP BY 1;
