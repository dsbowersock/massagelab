-- CreateTable
CREATE TABLE "AnatomySpatialModel" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "mediaAssetId" TEXT,
  "sourceId" TEXT NOT NULL,
  "coordinateSystem" TEXT NOT NULL DEFAULT 'right-handed-y-up',
  "unit" TEXT NOT NULL DEFAULT 'meter',
  "forwardAxis" TEXT NOT NULL DEFAULT '-Z',
  "upAxis" TEXT NOT NULL DEFAULT 'Y',
  "scaleToMeters" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "defaultCamera" JSONB NOT NULL DEFAULT '{}',
  "interactionNotes" TEXT,
  "usageScope" "AnatomySourceUsageScope" NOT NULL DEFAULT 'REVIEW_ONLY',
  "reviewStatus" "AnatomyFactReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomySpatialModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomySpatialEntityMap" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "entityType" "AnatomyEntityType" NOT NULL,
  "entitySlug" TEXT NOT NULL,
  "label" TEXT,
  "mappingPrecision" TEXT NOT NULL,
  "meshName" TEXT,
  "nodeName" TEXT,
  "materialName" TEXT,
  "bodyparts3dPartIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "laterality" "PainMapLaterality" NOT NULL DEFAULT 'UNSPECIFIED',
  "surface" "PainMapSurface" NOT NULL DEFAULT 'UNSPECIFIED',
  "selectable" BOOLEAN NOT NULL DEFAULT true,
  "palpationTarget" BOOLEAN NOT NULL DEFAULT false,
  "painSelectionTarget" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sourceId" TEXT NOT NULL,
  "reviewStatus" "AnatomyFactReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomySpatialEntityMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomyMovementVisualization" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "jointId" TEXT NOT NULL,
  "movementId" TEXT NOT NULL,
  "rangeOfMotionId" TEXT,
  "primaryEntityType" "AnatomyEntityType",
  "primaryEntitySlug" TEXT,
  "motionAxis" JSONB NOT NULL DEFAULT '{}',
  "plane" TEXT,
  "neutralPose" JSONB NOT NULL DEFAULT '{}',
  "startDegrees" DOUBLE PRECISION,
  "endDegrees" DOUBLE PRECISION,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sourceId" TEXT NOT NULL,
  "reviewStatus" "AnatomyFactReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomyMovementVisualization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnatomySpatialModel_slug_key" ON "AnatomySpatialModel"("slug");
CREATE INDEX "AnatomySpatialModel_mediaAssetId_idx" ON "AnatomySpatialModel"("mediaAssetId");
CREATE INDEX "AnatomySpatialModel_sourceId_idx" ON "AnatomySpatialModel"("sourceId");
CREATE INDEX "AnatomySpatialModel_usageScope_reviewStatus_idx" ON "AnatomySpatialModel"("usageScope", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomySpatialEntityMap_slug_key" ON "AnatomySpatialEntityMap"("slug");
CREATE INDEX "AnatomySpatialEntityMap_modelId_idx" ON "AnatomySpatialEntityMap"("modelId");
CREATE INDEX "AnatomySpatialEntityMap_modelId_entityType_entitySlug_idx" ON "AnatomySpatialEntityMap"("modelId", "entityType", "entitySlug");
CREATE INDEX "AnatomySpatialEntityMap_entityType_entitySlug_idx" ON "AnatomySpatialEntityMap"("entityType", "entitySlug");
CREATE INDEX "AnatomySpatialEntityMap_sourceId_idx" ON "AnatomySpatialEntityMap"("sourceId");
CREATE INDEX "AnatomySpatialEntityMap_selectable_palpationTarget_painSelectionTarget_idx" ON "AnatomySpatialEntityMap"("selectable", "palpationTarget", "painSelectionTarget");
CREATE INDEX "AnatomySpatialEntityMap_reviewStatus_idx" ON "AnatomySpatialEntityMap"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyMovementVisualization_slug_key" ON "AnatomyMovementVisualization"("slug");
CREATE UNIQUE INDEX "AnatomyMovementVisualization_modelId_jointId_movementId_primaryEntityType_primaryEntitySlug_key" ON "AnatomyMovementVisualization"("modelId", "jointId", "movementId", "primaryEntityType", "primaryEntitySlug");
CREATE INDEX "AnatomyMovementVisualization_modelId_idx" ON "AnatomyMovementVisualization"("modelId");
CREATE INDEX "AnatomyMovementVisualization_jointId_idx" ON "AnatomyMovementVisualization"("jointId");
CREATE INDEX "AnatomyMovementVisualization_movementId_idx" ON "AnatomyMovementVisualization"("movementId");
CREATE INDEX "AnatomyMovementVisualization_rangeOfMotionId_idx" ON "AnatomyMovementVisualization"("rangeOfMotionId");
CREATE INDEX "AnatomyMovementVisualization_primaryEntityType_primaryEntitySlug_idx" ON "AnatomyMovementVisualization"("primaryEntityType", "primaryEntitySlug");
CREATE INDEX "AnatomyMovementVisualization_sourceId_idx" ON "AnatomyMovementVisualization"("sourceId");
CREATE INDEX "AnatomyMovementVisualization_reviewStatus_idx" ON "AnatomyMovementVisualization"("reviewStatus");

-- AddForeignKey
ALTER TABLE "AnatomySpatialModel" ADD CONSTRAINT "AnatomySpatialModel_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "AnatomyMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnatomySpatialModel" ADD CONSTRAINT "AnatomySpatialModel_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnatomySpatialEntityMap" ADD CONSTRAINT "AnatomySpatialEntityMap_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AnatomySpatialModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnatomySpatialEntityMap" ADD CONSTRAINT "AnatomySpatialEntityMap_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnatomyMovementVisualization" ADD CONSTRAINT "AnatomyMovementVisualization_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AnatomySpatialModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnatomyMovementVisualization" ADD CONSTRAINT "AnatomyMovementVisualization_jointId_fkey" FOREIGN KEY ("jointId") REFERENCES "Joint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnatomyMovementVisualization" ADD CONSTRAINT "AnatomyMovementVisualization_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "JointMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnatomyMovementVisualization" ADD CONSTRAINT "AnatomyMovementVisualization_rangeOfMotionId_fkey" FOREIGN KEY ("rangeOfMotionId") REFERENCES "RangeOfMotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnatomyMovementVisualization" ADD CONSTRAINT "AnatomyMovementVisualization_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
