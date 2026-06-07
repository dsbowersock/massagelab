ALTER TABLE "FlashcardStudySession"
ADD COLUMN "durationMs" INTEGER;

CREATE INDEX "FlashcardStudySession_userId_status_durationMs_idx"
ON "FlashcardStudySession" ("userId", "status", "durationMs");
