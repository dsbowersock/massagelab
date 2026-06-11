UPDATE "AnatomyMediaEntity"
SET "reviewStatus" = 'NEEDS_REVIEW'
WHERE "reviewStatus" IS NULL OR "reviewStatus" = 'APPROVED';
