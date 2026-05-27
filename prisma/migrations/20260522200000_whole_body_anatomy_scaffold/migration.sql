-- AlterEnum
ALTER TYPE "AnatomyEntityType" ADD VALUE 'ANATOMY_STRUCTURE';

-- CreateEnum
CREATE TYPE "PainMapLaterality" AS ENUM ('LEFT', 'RIGHT', 'BILATERAL', 'MIDLINE', 'VARIABLE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "PainMapSurface" AS ENUM ('ANTERIOR', 'POSTERIOR', 'LATERAL', 'MEDIAL', 'SUPERIOR', 'INFERIOR', 'DEEP', 'VARIABLE', 'UNSPECIFIED');

-- AlterTable
ALTER TABLE "PainMapRegion" ADD COLUMN "laterality" "PainMapLaterality" NOT NULL DEFAULT 'UNSPECIFIED';
ALTER TABLE "PainMapRegion" ADD COLUMN "surface" "PainMapSurface" NOT NULL DEFAULT 'UNSPECIFIED';

-- CreateTable
CREATE TABLE "AnatomyStructure" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "structureType" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomyStructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyStructure_slug_key" ON "AnatomyStructure"("slug");
CREATE INDEX "AnatomyStructure_structureType_idx" ON "AnatomyStructure"("structureType");
CREATE INDEX "AnatomyStructure_regionId_idx" ON "AnatomyStructure"("regionId");
CREATE INDEX "AnatomyStructure_sourceId_idx" ON "AnatomyStructure"("sourceId");

-- AddForeignKey
ALTER TABLE "AnatomyStructure" ADD CONSTRAINT "AnatomyStructure_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "AnatomyRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnatomyStructure" ADD CONSTRAINT "AnatomyStructure_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
