-- CreateEnum
CREATE TYPE "AnatomySourceUsageScope" AS ENUM ('OPEN_REUSE', 'INTERNAL_REFERENCE', 'COMMERCIAL_LICENSED', 'REVIEW_ONLY');

-- CreateEnum
CREATE TYPE "AnatomyFactReviewStatus" AS ENUM ('STARTER', 'NEEDS_REVIEW', 'REVIEWED');

-- CreateEnum
CREATE TYPE "AnatomyMediaType" AS ENUM ('IMAGE', 'DIAGRAM', 'MODEL_3D', 'EMBED', 'SOURCE_LINK');

-- CreateEnum
CREATE TYPE "AnatomyMediaRole" AS ENUM ('PRIMARY', 'REFERENCE', 'REGION_CONTEXT', 'GAME_PROMPT', 'CLIENT_EDUCATION');

-- AlterTable
ALTER TABLE "AnatomySource" ADD COLUMN "licenseUrl" TEXT;
ALTER TABLE "AnatomySource" ADD COLUMN "usageScope" "AnatomySourceUsageScope" NOT NULL DEFAULT 'REVIEW_ONLY';
ALTER TABLE "AnatomySource" ADD COLUMN "accessedAt" TIMESTAMP(3);
ALTER TABLE "AnatomySource" ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "AnatomyCitation" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "entityType" "AnatomyEntityType" NOT NULL,
  "entitySlug" TEXT NOT NULL,
  "factType" TEXT NOT NULL,
  "factSlug" TEXT,
  "sourceId" TEXT NOT NULL,
  "sourceLocator" TEXT,
  "citationNote" TEXT,
  "reviewStatus" "AnatomyFactReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomyCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAnatomyIdentifier" (
  "id" TEXT NOT NULL,
  "entityType" "AnatomyEntityType" NOT NULL,
  "entitySlug" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "iri" TEXT,
  "label" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalAnatomyIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomyMediaAsset" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mediaType" "AnatomyMediaType" NOT NULL,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "remoteUrl" TEXT,
  "storagePath" TEXT,
  "thumbnailUrl" TEXT,
  "license" TEXT NOT NULL,
  "licenseUrl" TEXT NOT NULL,
  "attribution" TEXT NOT NULL,
  "author" TEXT,
  "usageScope" "AnatomySourceUsageScope" NOT NULL DEFAULT 'REVIEW_ONLY',
  "reviewStatus" "AnatomyFactReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "width" INTEGER,
  "height" INTEGER,
  "format" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomyMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomyMediaEntity" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "entityType" "AnatomyEntityType" NOT NULL,
  "entitySlug" TEXT NOT NULL,
  "role" "AnatomyMediaRole" NOT NULL DEFAULT 'REFERENCE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnatomyMediaEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyCitation_slug_key" ON "AnatomyCitation"("slug");
CREATE UNIQUE INDEX "AnatomyCitation_entityType_entitySlug_factType_factSlug_sourceId_sourceLocator_key" ON "AnatomyCitation"("entityType", "entitySlug", "factType", "factSlug", "sourceId", "sourceLocator");
CREATE INDEX "AnatomyCitation_entityType_entitySlug_idx" ON "AnatomyCitation"("entityType", "entitySlug");
CREATE INDEX "AnatomyCitation_factType_factSlug_idx" ON "AnatomyCitation"("factType", "factSlug");
CREATE INDEX "AnatomyCitation_sourceId_idx" ON "AnatomyCitation"("sourceId");
CREATE INDEX "AnatomyCitation_reviewStatus_idx" ON "AnatomyCitation"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAnatomyIdentifier_entityType_entitySlug_provider_identifier_key" ON "ExternalAnatomyIdentifier"("entityType", "entitySlug", "provider", "identifier");
CREATE INDEX "ExternalAnatomyIdentifier_entityType_entitySlug_idx" ON "ExternalAnatomyIdentifier"("entityType", "entitySlug");
CREATE INDEX "ExternalAnatomyIdentifier_provider_identifier_idx" ON "ExternalAnatomyIdentifier"("provider", "identifier");
CREATE INDEX "ExternalAnatomyIdentifier_sourceId_idx" ON "ExternalAnatomyIdentifier"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyMediaAsset_slug_key" ON "AnatomyMediaAsset"("slug");
CREATE INDEX "AnatomyMediaAsset_mediaType_idx" ON "AnatomyMediaAsset"("mediaType");
CREATE INDEX "AnatomyMediaAsset_usageScope_reviewStatus_idx" ON "AnatomyMediaAsset"("usageScope", "reviewStatus");
CREATE INDEX "AnatomyMediaAsset_sourceId_idx" ON "AnatomyMediaAsset"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyMediaEntity_assetId_entityType_entitySlug_role_key" ON "AnatomyMediaEntity"("assetId", "entityType", "entitySlug", "role");
CREATE INDEX "AnatomyMediaEntity_entityType_entitySlug_idx" ON "AnatomyMediaEntity"("entityType", "entitySlug");

-- AddForeignKey
ALTER TABLE "AnatomyCitation" ADD CONSTRAINT "AnatomyCitation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalAnatomyIdentifier" ADD CONSTRAINT "ExternalAnatomyIdentifier_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnatomyMediaAsset" ADD CONSTRAINT "AnatomyMediaAsset_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnatomyMediaEntity" ADD CONSTRAINT "AnatomyMediaEntity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AnatomyMediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
