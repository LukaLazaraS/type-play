-- Payments, part 1 (2026-10-20, docs/payments-design.md §3): the credit ledger gets buckets (credits
-- that arrive together and end together), allocations (how each charge was split over buckets), and
-- the billing tables Paddle fills in part 2 (payments, checkouts, adjustments, refunds, events, audit).
-- Nothing existing is renamed: CreditEntry.amount stays, `tenths` carries the same number as an integer.
-- The backfill at the end turns every existing grant into a bucket and allocates the charges so far.

-- CreateEnum
CREATE TYPE "CreditSource" AS ENUM ('free', 'plan', 'upgrade', 'pack', 'admin');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('plan', 'renewal', 'upgrade', 'pack');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('completed', 'partly_refunded', 'refunded', 'charged_back');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('active', 'past_due', 'canceled', 'paused');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('received', 'processed', 'ignored', 'parked', 'failed');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('requested', 'pending', 'approved', 'rejected', 'lookup');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('open', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "ClosedWhy" AS ENUM ('expired', 'refunded', 'charged_back', 'canceled');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditKind" ADD VALUE 'expire';
ALTER TYPE "CreditKind" ADD VALUE 'reversal';

-- AlterTable
ALTER TABLE "CreditEntry" ADD COLUMN     "bucketId" TEXT,
ADD COLUMN     "paddleAdjustmentId" TEXT,
ADD COLUMN     "tenths" INTEGER;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "plan" "Plan";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingFlag" TEXT,
ADD COLUMN     "cancelsAt" TIMESTAMP(3),
ADD COLUMN     "debtTenths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freeCycleEndsAt" TIMESTAMP(3),
ADD COLUMN     "lastPaymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "nextBilledAt" TIMESTAMP(3),
ADD COLUMN     "nextSettleAt" TIMESTAMP(3),
ADD COLUMN     "paddleCustomerId" TEXT,
ADD COLUMN     "paddleSubscriptionId" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "pendingPlan" "Plan",
ADD COLUMN     "periodEndsAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" "SubStatus",
ADD COLUMN     "subscriptionUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CreditBucket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "CreditSource" NOT NULL,
    "grantedTenths" INTEGER NOT NULL,
    "remainingTenths" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedWhy" "ClosedWhy",
    "paymentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAllocation" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "bucketId" TEXT,
    "tenths" INTEGER NOT NULL,

    CONSTRAINT "CreditAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "PaymentKind" NOT NULL,
    "origin" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "lineItemId" TEXT,
    "paidCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3) NOT NULL,
    "refundableUntil" TIMESTAMP(3) NOT NULL,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'completed',
    "consentVersion" TEXT,
    "consentAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "eventId" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjustment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "quoteCents" INTEGER NOT NULL,
    "quoteTenths" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL,
    "adjustmentId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaddleEvent" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextTryAt" TIMESTAMP(3),
    "error" TEXT,
    "deliveries" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "PaddleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAudit" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,

    CONSTRAINT "BillingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditBucket_paymentId_key" ON "CreditBucket"("paymentId");

-- CreateIndex
CREATE INDEX "CreditBucket_userId_closedAt_expiresAt_idx" ON "CreditBucket"("userId", "closedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "CreditAllocation_entryId_idx" ON "CreditAllocation"("entryId");

-- CreateIndex
CREATE INDEX "CreditAllocation_bucketId_idx" ON "CreditAllocation"("bucketId");

-- CreateIndex
CREATE INDEX "Payment_userId_paidAt_idx" ON "Payment"("userId", "paidAt");

-- CreateIndex
CREATE INDEX "CheckoutSession_userId_createdAt_idx" ON "CheckoutSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Adjustment_paymentId_idx" ON "Adjustment"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_adjustmentId_key" ON "Refund"("adjustmentId");

-- CreateIndex
CREATE INDEX "Refund_userId_createdAt_idx" ON "Refund"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaddleEvent_status_nextTryAt_idx" ON "PaddleEvent"("status", "nextTryAt");

-- CreateIndex
CREATE INDEX "BillingAudit_userId_at_idx" ON "BillingAudit"("userId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "CreditEntry_paddleAdjustmentId_key" ON "CreditEntry"("paddleAdjustmentId");

-- CreateIndex
CREATE INDEX "Message_plan_createdAt_idx" ON "Message"("plan", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_paddleCustomerId_key" ON "User"("paddleCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_paddleSubscriptionId_key" ON "User"("paddleSubscriptionId");

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "CreditBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAllocation" ADD CONSTRAINT "CreditAllocation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CreditEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAllocation" ADD CONSTRAINT "CreditAllocation_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "CreditBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "CreditBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "Adjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A bucket can't go below zero (ledger.service takes only what is there; the rest is debt).
ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_remainingTenths_check" CHECK ("remainingTenths" >= 0);

-- Backfill. Every row's exact figure; then, in time order: a positive row opens a bucket ("Free plan"
-- grants are `free` and end a month after they came; the rest, given by hand, are `admin` and keep),
-- and a negative row (a charge, or credits taken back by hand) is allocated to the open buckets in
-- spend order (free, plan/upgrade, pack, admin), the shortfall becoming debt that a later bucket settles.
UPDATE "CreditEntry" SET "tenths" = round("amount" * 10)::int WHERE "tenths" IS NULL;

DO $$
DECLARE
  e RECORD;
  b RECORD;
  bucket_id TEXT;
  need INTEGER;
  take INTEGER;
BEGIN
  FOR e IN SELECT * FROM "CreditEntry" ORDER BY "createdAt", id LOOP
    IF e.tenths > 0 THEN
      bucket_id := gen_random_uuid()::text;
      INSERT INTO "CreditBucket" (id, "userId", source, "grantedTenths", "remainingTenths", "startsAt", "expiresAt", note, "createdAt")
      VALUES (bucket_id, e."userId",
              CASE WHEN e.note = 'Free plan' THEN 'free'::"CreditSource" ELSE 'admin'::"CreditSource" END,
              e.tenths, e.tenths, e."createdAt",
              CASE WHEN e.note = 'Free plan' THEN e."createdAt" + interval '1 month' ELSE NULL END,
              e.note, e."createdAt");
      UPDATE "CreditEntry" SET "bucketId" = bucket_id WHERE id = e.id;
      -- Debt first: earlier charges that found nothing to take from move onto this bucket.
      need := e.tenths;
      FOR b IN SELECT a.id, a.tenths, a."entryId" FROM "CreditAllocation" a JOIN "CreditEntry" ce ON ce.id = a."entryId"
               WHERE ce."userId" = e."userId" AND a."bucketId" IS NULL ORDER BY ce."createdAt", ce.id LOOP
        EXIT WHEN need <= 0;
        IF b.tenths <= need THEN
          UPDATE "CreditAllocation" SET "bucketId" = bucket_id WHERE id = b.id;
          take := b.tenths;
        ELSE
          UPDATE "CreditAllocation" SET tenths = tenths - need WHERE id = b.id;
          INSERT INTO "CreditAllocation" (id, "entryId", "bucketId", tenths) VALUES (gen_random_uuid()::text, b."entryId", bucket_id, need);
          take := need;
        END IF;
        UPDATE "CreditBucket" SET "remainingTenths" = "remainingTenths" - take WHERE id = bucket_id;
        UPDATE "User" SET "debtTenths" = "debtTenths" - take WHERE id = e."userId";
        need := need - take;
      END LOOP;
    ELSIF e.tenths < 0 THEN
      need := -e.tenths;
      FOR b IN SELECT id, "remainingTenths" FROM "CreditBucket"
               WHERE "userId" = e."userId" AND "closedAt" IS NULL AND "remainingTenths" > 0
               ORDER BY CASE source WHEN 'free' THEN 0 WHEN 'plan' THEN 1 WHEN 'upgrade' THEN 1 WHEN 'pack' THEN 2 ELSE 3 END,
                        CASE WHEN source IN ('free', 'pack') THEN "expiresAt" END NULLS LAST, "startsAt", id LOOP
        EXIT WHEN need <= 0;
        take := LEAST(need, b."remainingTenths");
        INSERT INTO "CreditAllocation" (id, "entryId", "bucketId", tenths) VALUES (gen_random_uuid()::text, e.id, b.id, take);
        UPDATE "CreditBucket" SET "remainingTenths" = "remainingTenths" - take WHERE id = b.id;
        need := need - take;
      END LOOP;
      IF need > 0 THEN
        INSERT INTO "CreditAllocation" (id, "entryId", "bucketId", tenths) VALUES (gen_random_uuid()::text, e.id, NULL, need);
        UPDATE "User" SET "debtTenths" = "debtTenths" + need WHERE id = e."userId";
      END IF;
    END IF;
  END LOOP;
END $$;

-- Free users: this month's free credits end a month after sign-up, when the next 20 arrive.
UPDATE "User" SET "freeCycleEndsAt" = "createdAt" + interval '1 month' WHERE plan = 'free' AND "freeCycleEndsAt" IS NULL;

-- When settle() next has something to do for each user (LEAST skips nulls).
UPDATE "User" u SET "nextSettleAt" = LEAST(u."freeCycleEndsAt", (SELECT min(b."expiresAt") FROM "CreditBucket" b WHERE b."userId" = u.id AND b."closedAt" IS NULL));
