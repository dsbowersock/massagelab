-- CreateTable
CREATE TABLE "AnatomimeRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "hostPlayerId" TEXT,
    "currentRunId" TEXT,
    "lastMeaningfulActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hostLastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reviewExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeRoomTeam" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeRoomTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeRoomPlayer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "guestTokenHash" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeRoomPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeGameRun" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "phase" TEXT NOT NULL DEFAULT 'LOBBY',
    "config" JSONB NOT NULL DEFAULT '{}',
    "deckCardIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "activeCardIndex" INTEGER NOT NULL DEFAULT 0,
    "activeTeamOrder" INTEGER NOT NULL DEFAULT 0,
    "termStartedAt" TIMESTAMP(3),
    "termEndsAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeGameRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeGameRunTeamScore" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeGameRunTeamScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeGameRunGuess" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT,
    "userId" TEXT,
    "cardId" TEXT NOT NULL,
    "cardIndex" INTEGER NOT NULL,
    "activeTeamId" TEXT NOT NULL,
    "answerKind" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "scoreAwarded" INTEGER NOT NULL DEFAULT 0,
    "progressAwarded" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnatomimeGameRunGuess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeHostElection" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startedByPlayerId" TEXT,
    "winnerPlayerId" TEXT,
    "candidatePlayerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "activeVoterPlayerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "roundHistory" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomimeHostElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomimeHostElectionBallot" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "voterPlayerId" TEXT NOT NULL,
    "rankedPlayerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnatomimeHostElectionBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeRoom_code_key" ON "AnatomimeRoom"("code");

-- CreateIndex
CREATE INDEX "AnatomimeRoom_status_expiresAt_idx" ON "AnatomimeRoom"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AnatomimeRoom_lastMeaningfulActivityAt_idx" ON "AnatomimeRoom"("lastMeaningfulActivityAt");

-- CreateIndex
CREATE INDEX "AnatomimeRoom_hostPlayerId_idx" ON "AnatomimeRoom"("hostPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeRoom_currentRunId_key" ON "AnatomimeRoom"("currentRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeRoomTeam_roomId_sortOrder_key" ON "AnatomimeRoomTeam"("roomId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeRoomTeam_roomId_id_key" ON "AnatomimeRoomTeam"("roomId", "id");

-- CreateIndex
CREATE INDEX "AnatomimeRoomTeam_roomId_idx" ON "AnatomimeRoomTeam"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeRoomPlayer_roomId_guestTokenHash_key" ON "AnatomimeRoomPlayer"("roomId", "guestTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeRoomPlayer_roomId_userId_key" ON "AnatomimeRoomPlayer"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeRoomPlayer_roomId_id_key" ON "AnatomimeRoomPlayer"("roomId", "id");

-- CreateIndex
CREATE INDEX "AnatomimeRoomPlayer_roomId_teamId_idx" ON "AnatomimeRoomPlayer"("roomId", "teamId");

-- CreateIndex
CREATE INDEX "AnatomimeRoomPlayer_userId_updatedAt_idx" ON "AnatomimeRoomPlayer"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AnatomimeGameRun_roomId_status_idx" ON "AnatomimeGameRun"("roomId", "status");

-- CreateIndex
CREATE INDEX "AnatomimeGameRun_roomId_activeTeamOrder_idx" ON "AnatomimeGameRun"("roomId", "activeTeamOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeGameRun_roomId_id_key" ON "AnatomimeGameRun"("roomId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeGameRunTeamScore_runId_teamId_key" ON "AnatomimeGameRunTeamScore"("runId", "teamId");

-- CreateIndex
CREATE INDEX "AnatomimeGameRunTeamScore_roomId_teamId_idx" ON "AnatomimeGameRunTeamScore"("roomId", "teamId");

-- CreateIndex
CREATE INDEX "AnatomimeGameRunGuess_runId_cardIndex_submittedAt_idx" ON "AnatomimeGameRunGuess"("runId", "cardIndex", "submittedAt");

-- CreateIndex
CREATE INDEX "AnatomimeGameRunGuess_runId_playerId_cardIndex_idx" ON "AnatomimeGameRunGuess"("runId", "playerId", "cardIndex");

-- CreateIndex
CREATE INDEX "AnatomimeGameRunGuess_roomId_idx" ON "AnatomimeGameRunGuess"("roomId");

-- CreateIndex
CREATE INDEX "AnatomimeGameRunGuess_roomId_activeTeamId_idx" ON "AnatomimeGameRunGuess"("roomId", "activeTeamId");

-- CreateIndex
CREATE INDEX "AnatomimeGameRunGuess_userId_submittedAt_idx" ON "AnatomimeGameRunGuess"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "AnatomimeHostElection_roomId_status_idx" ON "AnatomimeHostElection"("roomId", "status");

-- CreateIndex
CREATE INDEX "AnatomimeHostElection_closesAt_idx" ON "AnatomimeHostElection"("closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeHostElection_roomId_id_key" ON "AnatomimeHostElection"("roomId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomimeHostElectionBallot_electionId_voterPlayerId_key" ON "AnatomimeHostElectionBallot"("electionId", "voterPlayerId");

-- CreateIndex
CREATE INDEX "AnatomimeHostElectionBallot_roomId_voterPlayerId_submittedAt_idx" ON "AnatomimeHostElectionBallot"("roomId", "voterPlayerId", "submittedAt");

-- AddForeignKey
ALTER TABLE "AnatomimeRoom" ADD CONSTRAINT "AnatomimeRoom_id_hostPlayerId_fkey" FOREIGN KEY ("id", "hostPlayerId") REFERENCES "AnatomimeRoomPlayer"("roomId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeRoom" ADD CONSTRAINT "AnatomimeRoom_id_currentRunId_fkey" FOREIGN KEY ("id", "currentRunId") REFERENCES "AnatomimeGameRun"("roomId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeRoomTeam" ADD CONSTRAINT "AnatomimeRoomTeam_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AnatomimeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeRoomPlayer" ADD CONSTRAINT "AnatomimeRoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AnatomimeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeRoomPlayer" ADD CONSTRAINT "AnatomimeRoomPlayer_roomId_teamId_fkey" FOREIGN KEY ("roomId", "teamId") REFERENCES "AnatomimeRoomTeam"("roomId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeRoomPlayer" ADD CONSTRAINT "AnatomimeRoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRun" ADD CONSTRAINT "AnatomimeGameRun_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AnatomimeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRunTeamScore" ADD CONSTRAINT "AnatomimeGameRunTeamScore_roomId_runId_fkey" FOREIGN KEY ("roomId", "runId") REFERENCES "AnatomimeGameRun"("roomId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRunTeamScore" ADD CONSTRAINT "AnatomimeGameRunTeamScore_roomId_teamId_fkey" FOREIGN KEY ("roomId", "teamId") REFERENCES "AnatomimeRoomTeam"("roomId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRunGuess" ADD CONSTRAINT "AnatomimeGameRunGuess_roomId_runId_fkey" FOREIGN KEY ("roomId", "runId") REFERENCES "AnatomimeGameRun"("roomId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRunGuess" ADD CONSTRAINT "AnatomimeGameRunGuess_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AnatomimeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRunGuess" ADD CONSTRAINT "AnatomimeGameRunGuess_roomId_teamId_fkey" FOREIGN KEY ("roomId", "teamId") REFERENCES "AnatomimeRoomTeam"("roomId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRunGuess" ADD CONSTRAINT "AnatomimeGameRunGuess_roomId_activeTeamId_fkey" FOREIGN KEY ("roomId", "activeTeamId") REFERENCES "AnatomimeRoomTeam"("roomId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRunGuess" ADD CONSTRAINT "AnatomimeGameRunGuess_roomId_playerId_fkey" FOREIGN KEY ("roomId", "playerId") REFERENCES "AnatomimeRoomPlayer"("roomId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeGameRunGuess" ADD CONSTRAINT "AnatomimeGameRunGuess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeHostElection" ADD CONSTRAINT "AnatomimeHostElection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AnatomimeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeHostElection" ADD CONSTRAINT "AnatomimeHostElection_roomId_startedByPlayerId_fkey" FOREIGN KEY ("roomId", "startedByPlayerId") REFERENCES "AnatomimeRoomPlayer"("roomId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeHostElection" ADD CONSTRAINT "AnatomimeHostElection_roomId_winnerPlayerId_fkey" FOREIGN KEY ("roomId", "winnerPlayerId") REFERENCES "AnatomimeRoomPlayer"("roomId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeHostElectionBallot" ADD CONSTRAINT "AnatomimeHostElectionBallot_roomId_electionId_fkey" FOREIGN KEY ("roomId", "electionId") REFERENCES "AnatomimeHostElection"("roomId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomimeHostElectionBallot" ADD CONSTRAINT "AnatomimeHostElectionBallot_roomId_voterPlayerId_fkey" FOREIGN KEY ("roomId", "voterPlayerId") REFERENCES "AnatomimeRoomPlayer"("roomId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
