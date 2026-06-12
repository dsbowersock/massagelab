-- CreateEnum
CREATE TYPE "AnatomyMediaViewRequestStatus" AS ENUM ('OPEN', 'IMPORTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "AnatomyMediaViewRequest" (
    "id" TEXT NOT NULL,
    "entityType" "AnatomyEntityType" NOT NULL,
    "entitySlug" TEXT NOT NULL,
    "requestedView" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestNote" TEXT,
    "sourceUrl" TEXT,
    "status" "AnatomyMediaViewRequestStatus" NOT NULL DEFAULT 'OPEN',
    "importedAssetId" TEXT,
    "importedLinkId" TEXT,
    "createdById" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomyMediaViewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnatomyMediaViewRequest_entityType_entitySlug_status_idx" ON "AnatomyMediaViewRequest"("entityType", "entitySlug", "status");

-- CreateIndex
CREATE INDEX "AnatomyMediaViewRequest_status_createdAt_idx" ON "AnatomyMediaViewRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AnatomyMediaViewRequest_requestedView_idx" ON "AnatomyMediaViewRequest"("requestedView");

-- CreateIndex
CREATE INDEX "AnatomyMediaViewRequest_createdById_idx" ON "AnatomyMediaViewRequest"("createdById");

-- CreateIndex
CREATE INDEX "AnatomyMediaViewRequest_resolvedById_idx" ON "AnatomyMediaViewRequest"("resolvedById");

-- AddForeignKey
ALTER TABLE "AnatomyMediaViewRequest" ADD CONSTRAINT "AnatomyMediaViewRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnatomyMediaViewRequest" ADD CONSTRAINT "AnatomyMediaViewRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
