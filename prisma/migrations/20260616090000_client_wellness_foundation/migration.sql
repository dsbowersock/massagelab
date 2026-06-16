-- CreateTable
CREATE TABLE "ClientWellnessEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "summary" TEXT,
    "intensity" INTEGER,
    "regions" JSONB NOT NULL DEFAULT '[]',
    "sensations" JSONB NOT NULL DEFAULT '[]',
    "contexts" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClientWellnessEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientWellnessPreference" (
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientWellnessPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ClientWellnessVocabularySuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientWellnessVocabularySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientWellnessEntry_userId_occurredAt_idx" ON "ClientWellnessEntry"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClientWellnessEntry_userId_category_occurredAt_idx" ON "ClientWellnessEntry"("userId", "category", "occurredAt");

-- CreateIndex
CREATE INDEX "ClientWellnessEntry_userId_deletedAt_idx" ON "ClientWellnessEntry"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "ClientWellnessVocabularySuggestion_userId_status_idx" ON "ClientWellnessVocabularySuggestion"("userId", "status");

-- CreateIndex
CREATE INDEX "ClientWellnessVocabularySuggestion_category_status_idx" ON "ClientWellnessVocabularySuggestion"("category", "status");

-- AddForeignKey
ALTER TABLE "ClientWellnessEntry" ADD CONSTRAINT "ClientWellnessEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientWellnessPreference" ADD CONSTRAINT "ClientWellnessPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientWellnessVocabularySuggestion" ADD CONSTRAINT "ClientWellnessVocabularySuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
