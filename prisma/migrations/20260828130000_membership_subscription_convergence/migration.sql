CREATE TYPE "MembershipWebhookReceiptStatus" AS ENUM ('RECEIVED', 'APPLIED', 'IGNORED');

-- Expansion only: nullable watermarks preserve existing rows and old-runtime rollback compatibility.
ALTER TABLE "MembershipSubscription"
  ADD COLUMN "lastStripeEventId" TEXT,
  ADD COLUMN "lastStripeEventCreatedAt" TIMESTAMP(3),
  ADD COLUMN "lastStripeAuthoritativeAt" TIMESTAMP(3);

CREATE TABLE "MembershipWebhookReceipt" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerEventCreatedAt" TIMESTAMP(3) NOT NULL,
  "providerObjectId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT,
  "status" "MembershipWebhookReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "failureCode" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "MembershipWebhookReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipWebhookReceipt_provider_providerEventId_key"
  ON "MembershipWebhookReceipt"("provider", "providerEventId");
CREATE INDEX "MembershipWebhookReceipt_status_receivedAt_idx"
  ON "MembershipWebhookReceipt"("status", "receivedAt");
CREATE INDEX "MembershipWebhookReceipt_stripeSubscriptionId_providerEventCreatedAt_idx"
  ON "MembershipWebhookReceipt"("stripeSubscriptionId", "providerEventCreatedAt");
CREATE INDEX "MembershipWebhookReceipt_userId_receivedAt_idx"
  ON "MembershipWebhookReceipt"("userId", "receivedAt");

ALTER TABLE "MembershipWebhookReceipt"
  ADD CONSTRAINT "MembershipWebhookReceipt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
