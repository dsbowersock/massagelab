CREATE TYPE "AuthAttemptScope" AS ENUM ('ACCOUNT', 'NETWORK');
CREATE TYPE "AuthMethodIntentPurpose" AS ENUM ('SIGN_IN_OR_LINK', 'LINK_GOOGLE', 'ADD_PASSWORD', 'REMOVE_PASSWORD');
CREATE TYPE "AuthMethodIntentStatus" AS ENUM ('PENDING', 'PROVIDER_PROVEN', 'CONSUMED');
CREATE TYPE "AccountSecurityEmailKind" AS ENUM ('GOOGLE_LINKED', 'GOOGLE_UNLINKED', 'PASSWORD_ENABLED', 'PASSWORD_CHANGED', 'PASSWORD_DISABLED', 'PASSWORD_RECOVERED');
CREATE TYPE "AccountSecurityEmailIntentStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

ALTER TYPE "AuthAttemptPurpose" ADD VALUE 'GOOGLE_INTENT';

CREATE TABLE "AuthRateLimitBucket" (
  "id" TEXT NOT NULL,
  "purpose" "AuthAttemptPurpose" NOT NULL,
  "scope" "AuthAttemptScope" NOT NULL,
  "keyHash" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthMethodIntent" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT,
  "purpose" "AuthMethodIntentPurpose" NOT NULL,
  "status" "AuthMethodIntentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL DEFAULT 'google',
  "browserBindingHash" TEXT NOT NULL,
  "providerAccountId" TEXT,
  "providerEmailHash" TEXT,
  "providerProvenAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthMethodIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountSecurityEmailIntent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AccountSecurityEmailKind" NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "AccountSecurityEmailIntentStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "claimTokenHash" TEXT,
  "claimExpiresAt" TIMESTAMP(3),
  "lastAttemptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountSecurityEmailIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthRateLimitBucket_purpose_scope_keyHash_key"
  ON "AuthRateLimitBucket"("purpose", "scope", "keyHash");
CREATE INDEX "AuthRateLimitBucket_updatedAt_idx" ON "AuthRateLimitBucket"("updatedAt");
CREATE INDEX "AuthRateLimitBucket_blockedUntil_idx" ON "AuthRateLimitBucket"("blockedUntil");

CREATE UNIQUE INDEX "AuthMethodIntent_browserBindingHash_key" ON "AuthMethodIntent"("browserBindingHash");
CREATE INDEX "AuthMethodIntent_targetUserId_purpose_status_idx" ON "AuthMethodIntent"("targetUserId", "purpose", "status");
CREATE INDEX "AuthMethodIntent_status_expiresAt_idx" ON "AuthMethodIntent"("status", "expiresAt");
CREATE INDEX "AuthMethodIntent_provider_providerAccountId_idx" ON "AuthMethodIntent"("provider", "providerAccountId");

CREATE UNIQUE INDEX "AccountSecurityEmailIntent_idempotencyKey_key" ON "AccountSecurityEmailIntent"("idempotencyKey");
CREATE INDEX "AccountSecurityEmailIntent_status_claimExpiresAt_idx" ON "AccountSecurityEmailIntent"("status", "claimExpiresAt");
CREATE INDEX "AccountSecurityEmailIntent_userId_createdAt_idx" ON "AccountSecurityEmailIntent"("userId", "createdAt");

ALTER TABLE "AuthMethodIntent"
  ADD CONSTRAINT "AuthMethodIntent_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountSecurityEmailIntent"
  ADD CONSTRAINT "AccountSecurityEmailIntent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
