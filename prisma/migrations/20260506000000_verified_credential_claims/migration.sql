CREATE TABLE "VerifiedCredentialClaim" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "CredentialKind" NOT NULL,
  "jurisdictionCode" TEXT NOT NULL,
  "normalizedCredentialNumber" TEXT NOT NULL,
  "credentialVerificationId" TEXT,
  "source" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifiedCredentialClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifiedCredentialClaim_kind_jurisdictionCode_normalizedCredentialNumber_key" ON "VerifiedCredentialClaim"("kind", "jurisdictionCode", "normalizedCredentialNumber");
CREATE INDEX "VerifiedCredentialClaim_userId_kind_idx" ON "VerifiedCredentialClaim"("userId", "kind");
CREATE INDEX "VerifiedCredentialClaim_credentialVerificationId_idx" ON "VerifiedCredentialClaim"("credentialVerificationId");

ALTER TABLE "VerifiedCredentialClaim" ADD CONSTRAINT "VerifiedCredentialClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
