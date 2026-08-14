CREATE TABLE "TemporaryFeatureGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "grantedById" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "internalNote" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TemporaryFeatureGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemporaryFeatureGrantRevocation" (
  "id" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "revokedById" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "internalNote" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TemporaryFeatureGrantRevocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemporaryFeatureGrant_idempotencyKey_key" ON "TemporaryFeatureGrant"("idempotencyKey");
CREATE INDEX "TemporaryFeatureGrant_userId_featureKey_startsAt_expiresAt_idx" ON "TemporaryFeatureGrant"("userId", "featureKey", "startsAt", "expiresAt");
CREATE INDEX "TemporaryFeatureGrant_expiresAt_idx" ON "TemporaryFeatureGrant"("expiresAt");

CREATE UNIQUE INDEX "TemporaryFeatureGrantRevocation_grantId_key" ON "TemporaryFeatureGrantRevocation"("grantId");
CREATE UNIQUE INDEX "TemporaryFeatureGrantRevocation_idempotencyKey_key" ON "TemporaryFeatureGrantRevocation"("idempotencyKey");

ALTER TABLE "TemporaryFeatureGrant" ADD CONSTRAINT "TemporaryFeatureGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TemporaryFeatureGrant" ADD CONSTRAINT "TemporaryFeatureGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TemporaryFeatureGrantRevocation" ADD CONSTRAINT "TemporaryFeatureGrantRevocation_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "TemporaryFeatureGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TemporaryFeatureGrantRevocation" ADD CONSTRAINT "TemporaryFeatureGrantRevocation_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
