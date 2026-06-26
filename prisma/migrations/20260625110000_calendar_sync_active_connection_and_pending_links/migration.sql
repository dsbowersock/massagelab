UPDATE "CalendarConnection"
SET
  status = 'DISCONNECTED',
  "statusReason" = 'duplicate_active_connection_superseded',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "userId", provider
        ORDER BY "updatedAt" DESC, id DESC
      ) AS row_number
    FROM "CalendarConnection"
    WHERE status = 'ACTIVE'
  ) ranked_connections
  WHERE row_number > 1
);

ALTER TABLE "ExternalCalendarEventLink"
  ALTER COLUMN "providerEventId" DROP NOT NULL;

CREATE UNIQUE INDEX "CalendarConnection_one_active_provider_key"
  ON "CalendarConnection"("userId", provider)
  WHERE status = 'ACTIVE';
