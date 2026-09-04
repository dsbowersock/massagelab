BEGIN;

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

-- Close the gap between the read-only rollout preflight and this migration.
-- The false, initially unvalidated constraint validates only when the table is
-- empty; the access-exclusive lock keeps writers out until the temporary gate
-- is dropped and this transaction commits. Any row aborts the whole migration.
LOCK TABLE "AdminEmailIntent" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "AdminEmailIntent"
  ADD CONSTRAINT "AdminEmailIntent_zero_row_gate" CHECK (FALSE) NOT VALID;
ALTER TABLE "AdminEmailIntent"
  VALIDATE CONSTRAINT "AdminEmailIntent_zero_row_gate";
ALTER TABLE "AdminEmailIntent"
  DROP CONSTRAINT "AdminEmailIntent_zero_row_gate";

ALTER TABLE "AdminEmailIntent"
  ADD COLUMN "deliveryClaimTokenHash" TEXT,
  ADD COLUMN "deliveryClaimExpiresAt" TIMESTAMP(3),
  ADD COLUMN "deliveryClaimOperationKeyHash" TEXT;

-- Intentionally non-concurrent: the immediately-before-migration Production
-- preflight and atomic migration gate must prove AdminEmailIntent contains
-- exactly zero rows. PostgreSQL
-- permits multiple NULL values in this unique index, so nullable expansion rows
-- would not collide. The exact-zero gate is deliberately stronger: it verifies
-- the expected pre-claim-aware rollout state and forces non-concurrent index
-- lock/application-plan re-review on drift. The approved single migration
-- preserves atomic application of the index with the expansion.
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

COMMIT;
