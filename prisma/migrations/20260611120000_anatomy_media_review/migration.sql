-- CreateEnum
CREATE TYPE "AnatomyMediaReviewStatus" AS ENUM ('APPROVED', 'NEEDS_REVIEW', 'REJECTED');

-- AlterTable
ALTER TABLE "AnatomyMediaEntity" ADD COLUMN "reviewStatus" "AnatomyMediaReviewStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "AnatomyMediaEntity" ADD COLUMN "reviewReason" TEXT;
ALTER TABLE "AnatomyMediaEntity" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "AnatomyMediaEntity" ADD COLUMN "displayPriority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "AnatomyMediaEntity" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "AnatomyMediaEntity" ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AnatomyMediaEntity_reviewStatus_displayPriority_idx" ON "AnatomyMediaEntity"("reviewStatus", "displayPriority");
