CREATE TYPE "OperationalRateLimitScope" AS ENUM ('GLOBAL', 'NETWORK', 'ACCOUNT', 'RESOURCE');

CREATE TABLE "OperationalRateLimitBucket" (
  "id" TEXT NOT NULL,
  "policy" TEXT NOT NULL,
  "scope" "OperationalRateLimitScope" NOT NULL,
  "keyHash" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalRateLimitBucket_policy_scope_keyHash_key"
  ON "OperationalRateLimitBucket"("policy", "scope", "keyHash");
CREATE INDEX "OperationalRateLimitBucket_updatedAt_idx"
  ON "OperationalRateLimitBucket"("updatedAt");
CREATE INDEX "OperationalRateLimitBucket_blockedUntil_idx"
  ON "OperationalRateLimitBucket"("blockedUntil");

ALTER TABLE "AdminEmailIntent"
  ADD COLUMN "deliveryClaimTokenHash" TEXT,
  ADD COLUMN "deliveryClaimExpiresAt" TIMESTAMP(3),
  ADD COLUMN "deliveryClaimOperationKeyHash" TEXT;

CREATE UNIQUE INDEX "AdminEmailIntent_deliveryClaimOperationKeyHash_key"
  ON "AdminEmailIntent"("deliveryClaimOperationKeyHash");

CREATE TABLE "AdminEmailRetryOperationKey" (
  "id" TEXT NOT NULL,
  "emailIntentId" TEXT NOT NULL,
  "operationKeyHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminEmailRetryOperationKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminEmailRetryOperationKey_operationKeyHash_key"
  ON "AdminEmailRetryOperationKey"("operationKeyHash");
CREATE INDEX "AdminEmailRetryOperationKey_emailIntentId_createdAt_idx"
  ON "AdminEmailRetryOperationKey"("emailIntentId", "createdAt");

ALTER TABLE "AdminEmailRetryOperationKey"
  ADD CONSTRAINT "AdminEmailRetryOperationKey_emailIntentId_fkey"
  FOREIGN KEY ("emailIntentId") REFERENCES "AdminEmailIntent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
