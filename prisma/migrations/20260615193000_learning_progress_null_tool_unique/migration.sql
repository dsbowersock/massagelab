-- Keep one flashcard-linked progress row per user/tool when progress is not
-- attached to an AnatomyTerm. The existing composite unique index includes a
-- nullable column, so Postgres allows duplicate NULL anatomyTermId rows.
WITH ranked_progress AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "tool"
            ORDER BY
                CASE "status"
                    WHEN 'MASTERED' THEN 4
                    WHEN 'PRACTICING' THEN 3
                    WHEN 'STARTED' THEN 2
                    WHEN 'SKIPPED' THEN 1
                    ELSE 0
                END DESC,
                COALESCE("score", -1) DESC,
                "updatedAt" DESC,
                "lastSeenAt" DESC,
                "createdAt" DESC,
                "id" DESC
        ) AS row_number
    FROM "LearningProgress"
    WHERE "anatomyTermId" IS NULL
)
DELETE FROM "LearningProgress"
WHERE "id" IN (
    SELECT "id"
    FROM ranked_progress
    WHERE row_number > 1
);

CREATE UNIQUE INDEX "LearningProgress_userId_tool_null_anatomyTermId_key"
ON "LearningProgress"("userId", "tool")
WHERE "anatomyTermId" IS NULL;
