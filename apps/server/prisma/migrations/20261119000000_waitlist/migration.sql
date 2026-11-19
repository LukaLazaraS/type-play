-- The closed beta's waitlist (src/beta/waitlist.ts): an email that isn't invited asked to be told when TypePlay opens.
-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "match" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("match")
);
