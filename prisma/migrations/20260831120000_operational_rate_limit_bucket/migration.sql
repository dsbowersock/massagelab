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
