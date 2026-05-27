-- Add composite keys that let movement visualizations enforce joint/movement/ROM pairing.
CREATE UNIQUE INDEX "JointMovement_id_jointId_key" ON "JointMovement"("id", "jointId");
CREATE UNIQUE INDEX "RangeOfMotion_id_jointId_movementId_key" ON "RangeOfMotion"("id", "jointId", "movementId");

-- Replace single-column movement/ROM foreign keys with composite keys tied to the selected joint.
ALTER TABLE "AnatomyMovementVisualization" DROP CONSTRAINT "AnatomyMovementVisualization_movementId_fkey";
ALTER TABLE "AnatomyMovementVisualization" DROP CONSTRAINT "AnatomyMovementVisualization_rangeOfMotionId_fkey";

DROP INDEX IF EXISTS "AnatomyMovementVisualization_modelId_jointId_movementId_primaryEntityType_primaryEntitySlug_key";

ALTER TABLE "AnatomyMovementVisualization" ADD CONSTRAINT "AnatomyMovementVisualization_movementId_jointId_fkey"
  FOREIGN KEY ("movementId", "jointId") REFERENCES "JointMovement"("id", "jointId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnatomyMovementVisualization" ADD CONSTRAINT "AnatomyMovementVisualization_rangeOfMotionId_jointId_movementId_fkey"
  FOREIGN KEY ("rangeOfMotionId", "jointId", "movementId") REFERENCES "RangeOfMotion"("id", "jointId", "movementId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnatomyMovementVisualization" ADD CONSTRAINT "AnatomyMovementVisualization_primaryEntity_pair_check"
  CHECK (
    ("primaryEntityType" IS NULL AND "primaryEntitySlug" IS NULL)
    OR ("primaryEntityType" IS NOT NULL AND "primaryEntitySlug" IS NOT NULL)
  );

CREATE UNIQUE INDEX "AnatomyMovementVisualization_model_joint_movement_no_primary_key"
  ON "AnatomyMovementVisualization"("modelId", "jointId", "movementId")
  WHERE "primaryEntityType" IS NULL AND "primaryEntitySlug" IS NULL;

CREATE UNIQUE INDEX "AnatomyMovementVisualization_model_joint_movement_primary_key"
  ON "AnatomyMovementVisualization"("modelId", "jointId", "movementId", "primaryEntityType", "primaryEntitySlug")
  WHERE "primaryEntityType" IS NOT NULL AND "primaryEntitySlug" IS NOT NULL;
