-- AlterTable
ALTER TABLE "Adjustment" ADD COLUMN     "cancelSubscription" TEXT,
ADD COLUMN     "cancelSubscriptionId" TEXT,
ADD COLUMN     "canceledAt" TIMESTAMP(3);
