-- CreateEnum
CREATE TYPE "CalendarEventKind" AS ENUM ('APPOINTMENT', 'PERSONAL', 'CLASS', 'REMINDER');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'ACTIVE');

-- CreateEnum
CREATE TYPE "CalendarEventVisibility" AS ENUM ('PRIVATE', 'PRACTICE', 'CLIENT_VISIBLE');

-- CreateEnum
CREATE TYPE "CalendarClassEnrollmentStatus" AS ENUM ('OPEN', 'CLOSED', 'WAITLIST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarNotificationChannel" AS ENUM ('INTERNAL');

-- CreateEnum
CREATE TYPE "CalendarNotificationStatus" AS ENUM ('PENDING', 'CANCELLED', 'DELIVERED');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "createdById" TEXT,
    "kind" "CalendarEventKind" NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "visibility" "CalendarEventVisibility" NOT NULL DEFAULT 'PRACTICE',
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "blocksAvailability" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarClass" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "enrollmentStatus" "CalendarClassEnrollmentStatus" NOT NULL DEFAULT 'OPEN',
    "roomResource" TEXT,
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarReminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "relatedKind" TEXT,
    "relatedId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarAuditLog" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "eventId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarNotificationIntent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "recipientUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "channel" "CalendarNotificationChannel" NOT NULL DEFAULT 'INTERNAL',
    "deliveryStatus" "CalendarNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarNotificationIntent_pkey" PRIMARY KEY ("id")
);

-- AddColumns
ALTER TABLE "Appointment" ADD COLUMN "eventId" TEXT;
ALTER TABLE "CalendarBlock" ADD COLUMN "eventId" TEXT;

-- Backfill current appointments into the shared calendar event index.
INSERT INTO "CalendarEvent" (
    "id",
    "practiceId",
    "ownerUserId",
    "createdById",
    "kind",
    "title",
    "startsAt",
    "endsAt",
    "timezone",
    "visibility",
    "status",
    "blocksAvailability",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('event_appt_', appointment."id"),
    appointment."practiceId",
    appointment."therapistId",
    appointment."createdById",
    'APPOINTMENT'::"CalendarEventKind",
    COALESCE(service."name", 'Appointment'),
    appointment."startsAt",
    appointment."endsAt",
    practice."timezone",
    'PRACTICE'::"CalendarEventVisibility",
    appointment."status"::text::"CalendarEventStatus",
    true,
    appointment."createdAt",
    appointment."updatedAt"
FROM "Appointment" appointment
JOIN "Practice" practice ON practice."id" = appointment."practiceId"
LEFT JOIN "ServiceType" service ON service."id" = appointment."serviceTypeId";

UPDATE "Appointment"
SET "eventId" = CONCAT('event_appt_', "id");

-- Backfill existing blocked time as personal calendar events.
INSERT INTO "CalendarEvent" (
    "id",
    "practiceId",
    "ownerUserId",
    "createdById",
    "kind",
    "title",
    "startsAt",
    "endsAt",
    "timezone",
    "visibility",
    "status",
    "blocksAvailability",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('event_block_', block."id"),
    block."practiceId",
    block."therapistId",
    block."therapistId",
    'PERSONAL'::"CalendarEventKind",
    COALESCE(NULLIF(block."reason", ''), 'Blocked time'),
    block."startsAt",
    block."endsAt",
    practice."timezone",
    'PRIVATE'::"CalendarEventVisibility",
    'ACTIVE'::"CalendarEventStatus",
    true,
    block."createdAt",
    block."updatedAt"
FROM "CalendarBlock" block
JOIN "Practice" practice ON practice."id" = block."practiceId";

UPDATE "CalendarBlock"
SET "eventId" = CONCAT('event_block_', "id");

-- Tighten the event links after backfill.
ALTER TABLE "Appointment" ALTER COLUMN "eventId" SET NOT NULL;
ALTER TABLE "CalendarBlock" ALTER COLUMN "eventId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CalendarEvent_practiceId_startsAt_idx" ON "CalendarEvent"("practiceId", "startsAt");
CREATE INDEX "CalendarEvent_ownerUserId_startsAt_idx" ON "CalendarEvent"("ownerUserId", "startsAt");
CREATE INDEX "CalendarEvent_kind_status_idx" ON "CalendarEvent"("kind", "status");
CREATE UNIQUE INDEX "Appointment_eventId_key" ON "Appointment"("eventId");
CREATE UNIQUE INDEX "CalendarBlock_eventId_key" ON "CalendarBlock"("eventId");
CREATE UNIQUE INDEX "CalendarClass_eventId_key" ON "CalendarClass"("eventId");
CREATE INDEX "CalendarClass_instructorId_idx" ON "CalendarClass"("instructorId");
CREATE INDEX "CalendarClass_enrollmentStatus_idx" ON "CalendarClass"("enrollmentStatus");
CREATE UNIQUE INDEX "CalendarReminder_eventId_key" ON "CalendarReminder"("eventId");
CREATE INDEX "CalendarReminder_relatedKind_relatedId_idx" ON "CalendarReminder"("relatedKind", "relatedId");
CREATE INDEX "CalendarAuditLog_practiceId_createdAt_idx" ON "CalendarAuditLog"("practiceId", "createdAt");
CREATE INDEX "CalendarAuditLog_eventId_createdAt_idx" ON "CalendarAuditLog"("eventId", "createdAt");
CREATE INDEX "CalendarAuditLog_actorUserId_createdAt_idx" ON "CalendarAuditLog"("actorUserId", "createdAt");
CREATE INDEX "CalendarNotificationIntent_eventId_createdAt_idx" ON "CalendarNotificationIntent"("eventId", "createdAt");
CREATE INDEX "CalendarNotificationIntent_recipientUserId_deliveryStatus_idx" ON "CalendarNotificationIntent"("recipientUserId", "deliveryStatus");
CREATE INDEX "CalendarNotificationIntent_actorUserId_createdAt_idx" ON "CalendarNotificationIntent"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarClass" ADD CONSTRAINT "CalendarClass_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarClass" ADD CONSTRAINT "CalendarClass_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarReminder" ADD CONSTRAINT "CalendarReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAuditLog" ADD CONSTRAINT "CalendarAuditLog_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAuditLog" ADD CONSTRAINT "CalendarAuditLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarAuditLog" ADD CONSTRAINT "CalendarAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarNotificationIntent" ADD CONSTRAINT "CalendarNotificationIntent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarNotificationIntent" ADD CONSTRAINT "CalendarNotificationIntent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarNotificationIntent" ADD CONSTRAINT "CalendarNotificationIntent_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move double-booking prevention to the shared calendar event index.
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_no_active_therapist_overlap";

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_no_active_owner_overlap"
  EXCLUDE USING gist (
    "ownerUserId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (
    "ownerUserId" IS NOT NULL
    AND "blocksAvailability" = true
    AND "status" IN ('REQUESTED', 'CONFIRMED', 'ACTIVE')
  );
