CREATE TYPE "AdminBillingGoodwillStatus" AS ENUM ('PREPARED', 'APPLIED', 'VERIFIED', 'FAILED_BEFORE_MUTATION', 'RECONCILIATION_REQUIRED');

CREATE TABLE "AdminBillingGoodwillOperation" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "internalNote" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "stripeCustomerId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "stripeBalanceTransactionId" TEXT,
  "startingBalanceCents" INTEGER NOT NULL,
  "endingBalanceCents" INTEGER,
  "projectedNextInvoiceCents" INTEGER,
  "status" "AdminBillingGoodwillStatus" NOT NULL DEFAULT 'PREPARED',
  "failureCode" TEXT,
  "appliedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminBillingGoodwillOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminBillingGoodwillOperation_idempotencyKey_key" ON "AdminBillingGoodwillOperation"("idempotencyKey");
CREATE UNIQUE INDEX "AdminBillingGoodwillOperation_stripeBalanceTransactionId_key" ON "AdminBillingGoodwillOperation"("stripeBalanceTransactionId");
CREATE INDEX "AdminBillingGoodwillOperation_targetUserId_createdAt_idx" ON "AdminBillingGoodwillOperation"("targetUserId", "createdAt");
CREATE INDEX "AdminBillingGoodwillOperation_status_createdAt_idx" ON "AdminBillingGoodwillOperation"("status", "createdAt");

ALTER TABLE "AdminBillingGoodwillOperation" ADD CONSTRAINT "AdminBillingGoodwillOperation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminBillingGoodwillOperation" ADD CONSTRAINT "AdminBillingGoodwillOperation_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
