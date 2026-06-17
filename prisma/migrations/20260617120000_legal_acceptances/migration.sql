-- CreateTable
CREATE TABLE "LegalAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentKey" TEXT NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_userId_documentKey_documentVersion_key" ON "LegalAcceptance"("userId", "documentKey", "documentVersion");

-- CreateIndex
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_documentKey_documentVersion_idx" ON "LegalAcceptance"("documentKey", "documentVersion");

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
