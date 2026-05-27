ALTER TABLE "RangeOfMotion"
ADD COLUMN "typicalMinValue" DOUBLE PRECISION,
ADD COLUMN "typicalMaxValue" DOUBLE PRECISION,
ADD COLUMN "measurementUnit" TEXT NOT NULL DEFAULT 'degrees';

UPDATE "RangeOfMotion"
SET
  "typicalMinValue" = "typicalMinDegrees",
  "typicalMaxValue" = "typicalMaxDegrees"
WHERE "typicalMinValue" IS NULL
  AND "typicalMaxValue" IS NULL;

ALTER TABLE "RangeOfMotion"
ALTER COLUMN "typicalMinDegrees" DROP NOT NULL,
ALTER COLUMN "typicalMaxDegrees" DROP NOT NULL;
