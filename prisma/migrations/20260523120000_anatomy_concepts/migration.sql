-- AlterEnum
ALTER TYPE "AnatomyEntityType" ADD VALUE 'ANATOMY_CONCEPT';

-- CreateTable
CREATE TABLE "AnatomyConcept" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "conceptType" TEXT NOT NULL,
  "bodySystem" TEXT,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomyConcept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyConcept_slug_key" ON "AnatomyConcept"("slug");
CREATE INDEX "AnatomyConcept_conceptType_idx" ON "AnatomyConcept"("conceptType");
CREATE INDEX "AnatomyConcept_bodySystem_idx" ON "AnatomyConcept"("bodySystem");
CREATE INDEX "AnatomyConcept_sourceId_idx" ON "AnatomyConcept"("sourceId");

-- AddForeignKey
ALTER TABLE "AnatomyConcept" ADD CONSTRAINT "AnatomyConcept_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
