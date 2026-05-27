-- Add normalized anatomy foundation tables for relationships, seedable facts, and client-language mappings.

CREATE TYPE "AnatomyEntityType" AS ENUM ('REGION', 'BLOOD_SUPPLY', 'BONE', 'BONE_LANDMARK', 'JOINT', 'JOINT_MOVEMENT', 'RANGE_OF_MOTION', 'MUSCLE', 'MUSCLE_ATTACHMENT', 'MUSCLE_ACTION', 'NERVE', 'MUSCLE_INNERVATION', 'LIGAMENT', 'PAIN_MAP_REGION', 'CLIENT_TERM');
CREATE TYPE "AnatomyRelativeDepth" AS ENUM ('SUPERFICIAL', 'INTERMEDIATE', 'DEEP', 'VARIABLE');
CREATE TYPE "MuscleAttachmentType" AS ENUM ('ORIGIN', 'INSERTION');
CREATE TYPE "MuscleActionRole" AS ENUM ('PRIMARY', 'SECONDARY', 'STABILIZER');
CREATE TYPE "MuscleContractionType" AS ENUM ('CONCENTRIC', 'ECCENTRIC', 'ISOMETRIC', 'REVERSE_ACTION');
CREATE TYPE "BloodSupplyKind" AS ENUM ('ARTERY', 'VEIN');
CREATE TYPE "ClientTermConfidence" AS ENUM ('DIRECT', 'LIKELY', 'BROAD');
CREATE TYPE "AnatomyEntityTermType" AS ENUM ('PREFERRED', 'FORMAL', 'COMMON', 'CLINICAL', 'HISTORICAL', 'EPONYM', 'ABBREVIATION', 'ALTERNATE');

ALTER TABLE "AnatomyRelationship"
  ALTER COLUMN "sourceTermId" DROP NOT NULL,
  ALTER COLUMN "targetTermId" DROP NOT NULL,
  ADD COLUMN "sourceEntityType" "AnatomyEntityType",
  ADD COLUMN "sourceEntitySlug" TEXT,
  ADD COLUMN "targetEntityType" "AnatomyEntityType",
  ADD COLUMN "targetEntitySlug" TEXT,
  ADD COLUMN "sourceId" TEXT;

CREATE TABLE "AnatomyRegion" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parentRegionId" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomyRegion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BloodSupply" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "BloodSupplyKind" NOT NULL,
  "regionId" TEXT NOT NULL,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BloodSupply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bone" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "formalName" TEXT,
  "description" TEXT,
  "regionId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Bone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoneLandmark" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "boneId" TEXT NOT NULL,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BoneLandmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Joint" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "jointType" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Joint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JointMovement" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "jointId" TEXT NOT NULL,
  "movementName" TEXT NOT NULL,
  "plane" TEXT,
  "axis" TEXT,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JointMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RangeOfMotion" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "jointId" TEXT NOT NULL,
  "movementId" TEXT NOT NULL,
  "typicalMinDegrees" INTEGER NOT NULL,
  "typicalMaxDegrees" INTEGER NOT NULL,
  "measurementPosition" TEXT NOT NULL,
  "notes" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RangeOfMotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Muscle" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "formalName" TEXT NOT NULL,
  "alternateNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "etymology" TEXT,
  "languageOfOrigin" TEXT,
  "description" TEXT,
  "regionId" TEXT NOT NULL,
  "relativeDepth" "AnatomyRelativeDepth" NOT NULL DEFAULT 'VARIABLE',
  "depthNotes" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Muscle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MuscleAttachment" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "muscleId" TEXT NOT NULL,
  "type" "MuscleAttachmentType" NOT NULL,
  "boneId" TEXT NOT NULL,
  "landmarkId" TEXT,
  "description" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MuscleAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MuscleAction" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "muscleId" TEXT NOT NULL,
  "jointId" TEXT NOT NULL,
  "movementId" TEXT NOT NULL,
  "role" "MuscleActionRole" NOT NULL,
  "contractionType" "MuscleContractionType" NOT NULL,
  "description" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MuscleAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Nerve" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nerveRoots" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "regionId" TEXT NOT NULL,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Nerve_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MuscleInnervation" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "muscleId" TEXT NOT NULL,
  "nerveId" TEXT NOT NULL,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MuscleInnervation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ligament" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "jointId" TEXT,
  "description" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Ligament_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PainMapRegion" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "plainLanguageDescription" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PainMapRegion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientTerm" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "plainLanguageDescription" TEXT NOT NULL,
  "mappedRegionId" TEXT,
  "mappedMuscleId" TEXT,
  "mappedJointId" TEXT,
  "confidence" "ClientTermConfidence" NOT NULL,
  "notes" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientTerm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnatomyEntityTerm" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "anatomyEntityType" "AnatomyEntityType" NOT NULL,
  "anatomyEntitySlug" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "termType" "AnatomyEntityTermType" NOT NULL,
  "languageOfOrigin" TEXT,
  "notes" TEXT,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnatomyEntityTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnatomyRelationship_entity_relationship_key" ON "AnatomyRelationship"("sourceEntityType", "sourceEntitySlug", "relationshipType", "targetEntityType", "targetEntitySlug");
CREATE INDEX "AnatomyRelationship_sourceEntity_idx" ON "AnatomyRelationship"("sourceEntityType", "sourceEntitySlug");
CREATE INDEX "AnatomyRelationship_targetEntity_idx" ON "AnatomyRelationship"("targetEntityType", "targetEntitySlug");
CREATE INDEX "AnatomyRelationship_sourceId_idx" ON "AnatomyRelationship"("sourceId");

CREATE UNIQUE INDEX "AnatomyRegion_slug_key" ON "AnatomyRegion"("slug");
CREATE INDEX "AnatomyRegion_parentRegionId_idx" ON "AnatomyRegion"("parentRegionId");
CREATE INDEX "AnatomyRegion_sourceId_idx" ON "AnatomyRegion"("sourceId");

CREATE UNIQUE INDEX "BloodSupply_slug_key" ON "BloodSupply"("slug");
CREATE INDEX "BloodSupply_kind_idx" ON "BloodSupply"("kind");
CREATE INDEX "BloodSupply_regionId_idx" ON "BloodSupply"("regionId");
CREATE INDEX "BloodSupply_sourceId_idx" ON "BloodSupply"("sourceId");

CREATE UNIQUE INDEX "Bone_slug_key" ON "Bone"("slug");
CREATE INDEX "Bone_regionId_idx" ON "Bone"("regionId");
CREATE INDEX "Bone_sourceId_idx" ON "Bone"("sourceId");

CREATE UNIQUE INDEX "BoneLandmark_slug_key" ON "BoneLandmark"("slug");
CREATE INDEX "BoneLandmark_boneId_idx" ON "BoneLandmark"("boneId");
CREATE INDEX "BoneLandmark_sourceId_idx" ON "BoneLandmark"("sourceId");

CREATE UNIQUE INDEX "Joint_slug_key" ON "Joint"("slug");
CREATE INDEX "Joint_regionId_idx" ON "Joint"("regionId");
CREATE INDEX "Joint_sourceId_idx" ON "Joint"("sourceId");

CREATE UNIQUE INDEX "JointMovement_slug_key" ON "JointMovement"("slug");
CREATE INDEX "JointMovement_jointId_idx" ON "JointMovement"("jointId");
CREATE INDEX "JointMovement_sourceId_idx" ON "JointMovement"("sourceId");

CREATE UNIQUE INDEX "RangeOfMotion_slug_key" ON "RangeOfMotion"("slug");
CREATE UNIQUE INDEX "RangeOfMotion_jointId_movementId_measurementPosition_key" ON "RangeOfMotion"("jointId", "movementId", "measurementPosition");
CREATE INDEX "RangeOfMotion_movementId_idx" ON "RangeOfMotion"("movementId");
CREATE INDEX "RangeOfMotion_sourceId_idx" ON "RangeOfMotion"("sourceId");

CREATE UNIQUE INDEX "Muscle_slug_key" ON "Muscle"("slug");
CREATE INDEX "Muscle_regionId_idx" ON "Muscle"("regionId");
CREATE INDEX "Muscle_relativeDepth_idx" ON "Muscle"("relativeDepth");
CREATE INDEX "Muscle_sourceId_idx" ON "Muscle"("sourceId");

CREATE UNIQUE INDEX "MuscleAttachment_slug_key" ON "MuscleAttachment"("slug");
CREATE INDEX "MuscleAttachment_muscleId_type_idx" ON "MuscleAttachment"("muscleId", "type");
CREATE INDEX "MuscleAttachment_boneId_idx" ON "MuscleAttachment"("boneId");
CREATE INDEX "MuscleAttachment_landmarkId_idx" ON "MuscleAttachment"("landmarkId");
CREATE INDEX "MuscleAttachment_sourceId_idx" ON "MuscleAttachment"("sourceId");

CREATE UNIQUE INDEX "MuscleAction_slug_key" ON "MuscleAction"("slug");
CREATE UNIQUE INDEX "MuscleAction_muscleId_jointId_movementId_role_contractionType_key" ON "MuscleAction"("muscleId", "jointId", "movementId", "role", "contractionType");
CREATE INDEX "MuscleAction_jointId_movementId_idx" ON "MuscleAction"("jointId", "movementId");
CREATE INDEX "MuscleAction_movementId_role_idx" ON "MuscleAction"("movementId", "role");
CREATE INDEX "MuscleAction_sourceId_idx" ON "MuscleAction"("sourceId");

CREATE UNIQUE INDEX "Nerve_slug_key" ON "Nerve"("slug");
CREATE INDEX "Nerve_regionId_idx" ON "Nerve"("regionId");
CREATE INDEX "Nerve_sourceId_idx" ON "Nerve"("sourceId");

CREATE UNIQUE INDEX "MuscleInnervation_slug_key" ON "MuscleInnervation"("slug");
CREATE UNIQUE INDEX "MuscleInnervation_muscleId_nerveId_key" ON "MuscleInnervation"("muscleId", "nerveId");
CREATE INDEX "MuscleInnervation_nerveId_idx" ON "MuscleInnervation"("nerveId");
CREATE INDEX "MuscleInnervation_sourceId_idx" ON "MuscleInnervation"("sourceId");

CREATE UNIQUE INDEX "Ligament_slug_key" ON "Ligament"("slug");
CREATE INDEX "Ligament_regionId_idx" ON "Ligament"("regionId");
CREATE INDEX "Ligament_jointId_idx" ON "Ligament"("jointId");
CREATE INDEX "Ligament_sourceId_idx" ON "Ligament"("sourceId");

CREATE UNIQUE INDEX "PainMapRegion_slug_key" ON "PainMapRegion"("slug");
CREATE INDEX "PainMapRegion_regionId_idx" ON "PainMapRegion"("regionId");
CREATE INDEX "PainMapRegion_sourceId_idx" ON "PainMapRegion"("sourceId");

CREATE UNIQUE INDEX "ClientTerm_slug_key" ON "ClientTerm"("slug");
CREATE INDEX "ClientTerm_term_idx" ON "ClientTerm"("term");
CREATE INDEX "ClientTerm_mappedRegionId_idx" ON "ClientTerm"("mappedRegionId");
CREATE INDEX "ClientTerm_mappedMuscleId_idx" ON "ClientTerm"("mappedMuscleId");
CREATE INDEX "ClientTerm_mappedJointId_idx" ON "ClientTerm"("mappedJointId");
CREATE INDEX "ClientTerm_sourceId_idx" ON "ClientTerm"("sourceId");

CREATE UNIQUE INDEX "AnatomyEntityTerm_slug_key" ON "AnatomyEntityTerm"("slug");
CREATE UNIQUE INDEX "AnatomyEntityTerm_entity_term_key" ON "AnatomyEntityTerm"("anatomyEntityType", "anatomyEntitySlug", "term", "termType");
CREATE INDEX "AnatomyEntityTerm_entity_idx" ON "AnatomyEntityTerm"("anatomyEntityType", "anatomyEntitySlug");
CREATE INDEX "AnatomyEntityTerm_sourceId_idx" ON "AnatomyEntityTerm"("sourceId");

ALTER TABLE "AnatomyRelationship" ADD CONSTRAINT "AnatomyRelationship_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnatomyRegion" ADD CONSTRAINT "AnatomyRegion_parentRegionId_fkey" FOREIGN KEY ("parentRegionId") REFERENCES "AnatomyRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnatomyRegion" ADD CONSTRAINT "AnatomyRegion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BloodSupply" ADD CONSTRAINT "BloodSupply_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "AnatomyRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BloodSupply" ADD CONSTRAINT "BloodSupply_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bone" ADD CONSTRAINT "Bone_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "AnatomyRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bone" ADD CONSTRAINT "Bone_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BoneLandmark" ADD CONSTRAINT "BoneLandmark_boneId_fkey" FOREIGN KEY ("boneId") REFERENCES "Bone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoneLandmark" ADD CONSTRAINT "BoneLandmark_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Joint" ADD CONSTRAINT "Joint_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "AnatomyRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Joint" ADD CONSTRAINT "Joint_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JointMovement" ADD CONSTRAINT "JointMovement_jointId_fkey" FOREIGN KEY ("jointId") REFERENCES "Joint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JointMovement" ADD CONSTRAINT "JointMovement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RangeOfMotion" ADD CONSTRAINT "RangeOfMotion_jointId_fkey" FOREIGN KEY ("jointId") REFERENCES "Joint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RangeOfMotion" ADD CONSTRAINT "RangeOfMotion_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "JointMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RangeOfMotion" ADD CONSTRAINT "RangeOfMotion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Muscle" ADD CONSTRAINT "Muscle_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "AnatomyRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Muscle" ADD CONSTRAINT "Muscle_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MuscleAttachment" ADD CONSTRAINT "MuscleAttachment_muscleId_fkey" FOREIGN KEY ("muscleId") REFERENCES "Muscle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MuscleAttachment" ADD CONSTRAINT "MuscleAttachment_boneId_fkey" FOREIGN KEY ("boneId") REFERENCES "Bone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MuscleAttachment" ADD CONSTRAINT "MuscleAttachment_landmarkId_fkey" FOREIGN KEY ("landmarkId") REFERENCES "BoneLandmark"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MuscleAttachment" ADD CONSTRAINT "MuscleAttachment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MuscleAction" ADD CONSTRAINT "MuscleAction_muscleId_fkey" FOREIGN KEY ("muscleId") REFERENCES "Muscle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MuscleAction" ADD CONSTRAINT "MuscleAction_jointId_fkey" FOREIGN KEY ("jointId") REFERENCES "Joint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MuscleAction" ADD CONSTRAINT "MuscleAction_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "JointMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MuscleAction" ADD CONSTRAINT "MuscleAction_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Nerve" ADD CONSTRAINT "Nerve_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "AnatomyRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Nerve" ADD CONSTRAINT "Nerve_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MuscleInnervation" ADD CONSTRAINT "MuscleInnervation_muscleId_fkey" FOREIGN KEY ("muscleId") REFERENCES "Muscle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MuscleInnervation" ADD CONSTRAINT "MuscleInnervation_nerveId_fkey" FOREIGN KEY ("nerveId") REFERENCES "Nerve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MuscleInnervation" ADD CONSTRAINT "MuscleInnervation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ligament" ADD CONSTRAINT "Ligament_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "AnatomyRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ligament" ADD CONSTRAINT "Ligament_jointId_fkey" FOREIGN KEY ("jointId") REFERENCES "Joint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ligament" ADD CONSTRAINT "Ligament_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PainMapRegion" ADD CONSTRAINT "PainMapRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "AnatomyRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PainMapRegion" ADD CONSTRAINT "PainMapRegion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientTerm" ADD CONSTRAINT "ClientTerm_mappedRegionId_fkey" FOREIGN KEY ("mappedRegionId") REFERENCES "AnatomyRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientTerm" ADD CONSTRAINT "ClientTerm_mappedMuscleId_fkey" FOREIGN KEY ("mappedMuscleId") REFERENCES "Muscle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientTerm" ADD CONSTRAINT "ClientTerm_mappedJointId_fkey" FOREIGN KEY ("mappedJointId") REFERENCES "Joint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientTerm" ADD CONSTRAINT "ClientTerm_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnatomyEntityTerm" ADD CONSTRAINT "AnatomyEntityTerm_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnatomySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
