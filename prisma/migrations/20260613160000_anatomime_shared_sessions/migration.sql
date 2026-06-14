-- CreateTable
CREATE TABLE "AnatomimeGameSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "phase" TEXT NOT NULL DEFAULT 'LOBBY',
    "config" JSONB NOT NULL DEFAULT '{}',
    "deckCardIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "activeCardIndex" INTEGER NOT NULL DEFAULT 0,
    "activeTeamOrder" INTEGER NOT NULL DEFAULT 0,
    "phaseEndsAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeGameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeGameTeam" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeGameTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeGamePlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "guestTokenHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeGamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeGameGuess" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT,
    "userId" TEXT,
    "cardId" TEXT NOT NULL,
    "answerMode" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "scoreAwarded" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnatomimeGameGuess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeGameSession_code_key" ON "AnatomimeGameSession"("code");

-- CreateIndex
CREATE INDEX "AnatomimeGameSession_status_expiresAt_idx" ON "AnatomimeGameSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AnatomimeGameSession_hostUserId_updatedAt_idx" ON "AnatomimeGameSession"("hostUserId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeGameTeam_sessionId_sortOrder_key" ON "AnatomimeGameTeam"("sessionId", "sortOrder");

-- CreateIndex
CREATE INDEX "AnatomimeGameTeam_sessionId_idx" ON "AnatomimeGameTeam"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeGamePlayer_sessionId_guestTokenHash_key" ON "AnatomimeGamePlayer"("sessionId", "guestTokenHash");

-- CreateIndex
CREATE INDEX "AnatomimeGamePlayer_sessionId_teamId_idx" ON "AnatomimeGamePlayer"("sessionId", "teamId");

-- CreateIndex
CREATE INDEX "AnatomimeGamePlayer_userId_updatedAt_idx" ON "AnatomimeGamePlayer"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AnatomimeGameGuess_sessionId_cardId_submittedAt_idx" ON "AnatomimeGameGuess"("sessionId", "cardId", "submittedAt");

-- CreateIndex
CREATE INDEX "AnatomimeGameGuess_playerId_cardId_idx" ON "AnatomimeGameGuess"("playerId", "cardId");

-- CreateIndex
CREATE INDEX "AnatomimeGameGuess_userId_submittedAt_idx" ON "AnatomimeGameGuess"("userId", "submittedAt");

-- AddForeignKey
ALTER TABLE "AnatomimeGameSession" ADD CONSTRAINT "AnatomimeGameSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameTeam" ADD CONSTRAINT "AnatomimeGameTeam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnatomimeGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGamePlayer" ADD CONSTRAINT "AnatomimeGamePlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnatomimeGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGamePlayer" ADD CONSTRAINT "AnatomimeGamePlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AnatomimeGameTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGamePlayer" ADD CONSTRAINT "AnatomimeGamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameGuess" ADD CONSTRAINT "AnatomimeGameGuess_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnatomimeGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameGuess" ADD CONSTRAINT "AnatomimeGameGuess_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AnatomimeGameTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameGuess" ADD CONSTRAINT "AnatomimeGameGuess_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "AnatomimeGamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameGuess" ADD CONSTRAINT "AnatomimeGameGuess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
