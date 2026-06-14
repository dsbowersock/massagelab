-- Prevent signed-in players from creating duplicate participant rows when they rejoin.
CREATE UNIQUE INDEX "AnatomimeGamePlayer_sessionId_userId_role_key" ON "AnatomimeGamePlayer"("sessionId", "userId", "role");
