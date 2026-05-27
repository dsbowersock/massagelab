ALTER TABLE "ClientTerm" ADD COLUMN "mappedStructureId" TEXT;

CREATE INDEX "ClientTerm_mappedStructureId_idx" ON "ClientTerm"("mappedStructureId");

ALTER TABLE "ClientTerm" ADD CONSTRAINT "ClientTerm_mappedStructureId_fkey" FOREIGN KEY ("mappedStructureId") REFERENCES "AnatomyStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
