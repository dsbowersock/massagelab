ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ANATOMY_REVIEWER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ANATOMY_EDITOR';

UPDATE "UserRole"
SET "role" = 'ANATOMY_EDITOR'
WHERE "role" = 'ANATOMY_ADMIN';

CREATE TYPE "AdminActionOutcome" AS ENUM ('SUCCEEDED', 'FAILED');
CREATE TYPE "AdminEmailIntentStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

CREATE TABLE "AdminAction" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "actionKind" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "internalNote" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "beforeState" JSONB NOT NULL DEFAULT '{}',
  "afterState" JSONB NOT NULL DEFAULT '{}',
  "outcome" "AdminActionOutcome" NOT NULL,
  "failureCode" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAccountActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "adminActionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "effectiveValue" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAccountActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminEmailIntent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "adminActionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "recipientEmail" TEXT,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "AdminEmailIntentStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminEmailIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminAction_idempotencyKey_key" ON "AdminAction"("idempotencyKey");
CREATE UNIQUE INDEX "AdminAction_id_targetUserId_key" ON "AdminAction"("id", "targetUserId");
CREATE INDEX "AdminAction_targetUserId_occurredAt_idx" ON "AdminAction"("targetUserId", "occurredAt");
CREATE INDEX "AdminAction_actorUserId_occurredAt_idx" ON "AdminAction"("actorUserId", "occurredAt");

CREATE UNIQUE INDEX "UserAccountActivity_adminActionId_key" ON "UserAccountActivity"("adminActionId");
CREATE UNIQUE INDEX "UserAccountActivity_adminActionId_userId_key" ON "UserAccountActivity"("adminActionId", "userId");
CREATE INDEX "UserAccountActivity_userId_occurredAt_idx" ON "UserAccountActivity"("userId", "occurredAt");

CREATE UNIQUE INDEX "AdminEmailIntent_adminActionId_key" ON "AdminEmailIntent"("adminActionId");
CREATE UNIQUE INDEX "AdminEmailIntent_adminActionId_userId_key" ON "AdminEmailIntent"("adminActionId", "userId");
CREATE INDEX "AdminEmailIntent_status_createdAt_idx" ON "AdminEmailIntent"("status", "createdAt");
CREATE INDEX "AdminEmailIntent_userId_createdAt_idx" ON "AdminEmailIntent"("userId", "createdAt");

ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserAccountActivity" ADD CONSTRAINT "UserAccountActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserAccountActivity" ADD CONSTRAINT "UserAccountActivity_adminAction_target_consistency_fkey" FOREIGN KEY ("adminActionId", "userId") REFERENCES "AdminAction"("id", "targetUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminEmailIntent" ADD CONSTRAINT "AdminEmailIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminEmailIntent" ADD CONSTRAINT "AdminEmailIntent_adminAction_target_consistency_fkey" FOREIGN KEY ("adminActionId", "userId") REFERENCES "AdminAction"("id", "targetUserId") ON DELETE RESTRICT ON UPDATE CASCADE;
