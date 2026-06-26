CREATE TYPE "ExternalCalendarProvider" AS ENUM ('GOOGLE');

CREATE TYPE "CalendarConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH', 'DISCONNECTED', 'ERROR');

CREATE TYPE "ExternalCalendarBusyStatus" AS ENUM ('BUSY', 'FREE', 'CANCELLED');

CREATE TYPE "CalendarSyncRunDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'WEBHOOK_REFRESH');

CREATE TYPE "CalendarSyncRunStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'PARTIAL');

CREATE TABLE "CalendarConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "ExternalCalendarProvider" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "accountEmail" TEXT,
  "encryptedRefreshToken" TEXT NOT NULL,
  "encryptedAccessToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "grantedScopes" TEXT NOT NULL DEFAULT '',
  "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "statusReason" TEXT,
  "dedicatedCalendarId" TEXT,
  "dedicatedCalendarSummary" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalCalendarSource" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "providerCalendarId" TEXT NOT NULL,
  "label" TEXT,
  "timezone" TEXT,
  "selectedForBusySync" BOOLEAN NOT NULL DEFAULT false,
  "syncToken" TEXT,
  "lastFullSyncAt" TIMESTAMP(3),
  "lastIncrementalSyncAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalCalendarSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalCalendarBusyBlock" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "provider" "ExternalCalendarProvider" NOT NULL,
  "providerCalendarId" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "providerEventEtag" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "transparency" TEXT,
  "status" "ExternalCalendarBusyStatus" NOT NULL DEFAULT 'BUSY',
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalCalendarBusyBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalCalendarEventLink" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "calendarEventId" TEXT NOT NULL,
  "provider" "ExternalCalendarProvider" NOT NULL,
  "providerCalendarId" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "providerEventEtag" TEXT,
  "lastPushedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalCalendarEventLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarSyncRun" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "sourceId" TEXT,
  "direction" "CalendarSyncRunDirection" NOT NULL,
  "status" "CalendarSyncRunStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "windowStart" TIMESTAMP(3),
  "windowEnd" TIMESTAMP(3),
  "itemsSeen" INTEGER NOT NULL DEFAULT 0,
  "itemsChanged" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  CONSTRAINT "CalendarSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarConnection_user_provider_account_key" ON "CalendarConnection"("userId", "provider", "providerAccountId");
CREATE INDEX "CalendarConnection_userId_status_idx" ON "CalendarConnection"("userId", "status");
CREATE INDEX "CalendarConnection_provider_status_idx" ON "CalendarConnection"("provider", "status");

CREATE UNIQUE INDEX "ExternalCalendarSource_connection_calendar_key" ON "ExternalCalendarSource"("connectionId", "providerCalendarId");
CREATE INDEX "ExternalCalendarSource_connection_selected_idx" ON "ExternalCalendarSource"("connectionId", "selectedForBusySync");

CREATE UNIQUE INDEX "ExternalCalendarBusyBlock_source_event_key" ON "ExternalCalendarBusyBlock"("sourceId", "providerEventId");
CREATE INDEX "ExternalCalendarBusyBlock_owner_window_status_idx" ON "ExternalCalendarBusyBlock"("ownerUserId", "startsAt", "endsAt", "status");
CREATE INDEX "ExternalCalendarBusyBlock_connection_updated_idx" ON "ExternalCalendarBusyBlock"("connectionId", "updatedAt");

CREATE UNIQUE INDEX "ExternalCalendarEventLink_connection_event_key" ON "ExternalCalendarEventLink"("connectionId", "calendarEventId");
CREATE UNIQUE INDEX "ExternalCalendarEventLink_provider_calendar_event_key" ON "ExternalCalendarEventLink"("provider", "providerCalendarId", "providerEventId");
CREATE INDEX "ExternalCalendarEventLink_calendarEventId_idx" ON "ExternalCalendarEventLink"("calendarEventId");

CREATE INDEX "CalendarSyncRun_connection_started_idx" ON "CalendarSyncRun"("connectionId", "startedAt");
CREATE INDEX "CalendarSyncRun_source_started_idx" ON "CalendarSyncRun"("sourceId", "startedAt");
CREATE INDEX "CalendarSyncRun_status_started_idx" ON "CalendarSyncRun"("status", "startedAt");

ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalCalendarSource" ADD CONSTRAINT "ExternalCalendarSource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalCalendarBusyBlock" ADD CONSTRAINT "ExternalCalendarBusyBlock_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalCalendarBusyBlock" ADD CONSTRAINT "ExternalCalendarBusyBlock_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalCalendarSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalCalendarBusyBlock" ADD CONSTRAINT "ExternalCalendarBusyBlock_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalCalendarEventLink" ADD CONSTRAINT "ExternalCalendarEventLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalCalendarEventLink" ADD CONSTRAINT "ExternalCalendarEventLink_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarSyncRun" ADD CONSTRAINT "CalendarSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncRun" ADD CONSTRAINT "CalendarSyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalCalendarSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
