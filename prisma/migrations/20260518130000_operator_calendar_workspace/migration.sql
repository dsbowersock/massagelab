-- Add operator calendar workspace preferences, advanced availability, multi-service appointments,
-- and clinical-rich service template metadata that stores reusable template references only.

CREATE TYPE "CalendarAvailabilityOverrideKind" AS ENUM ('OPEN', 'CLOSED', 'BLACKOUT', 'HOLIDAY');

ALTER TABLE "UserPreference"
  ADD COLUMN "calendarPreferences" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "ServiceType"
  ADD COLUMN "modality" TEXT,
  ADD COLUMN "bodyRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "eligibleProviderIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "documentationTemplateRefs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "intakeTemplateRefs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "contraindicationPrompts" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "CalendarAvailabilitySchedule" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "therapistId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarAvailabilitySchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarAvailabilityScheduleInterval" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarAvailabilityScheduleInterval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarAvailabilityOverride" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "therapistId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "kind" "CalendarAvailabilityOverrideKind" NOT NULL DEFAULT 'OPEN',
  "reason" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarAvailabilityOverrideInterval" (
  "id" TEXT NOT NULL,
  "overrideId" TEXT NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarAvailabilityOverrideInterval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentServiceItem" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "serviceTypeId" TEXT,
  "serviceVariantId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "serviceName" TEXT,
  "serviceVariantName" TEXT,
  "serviceCategory" TEXT,
  "serviceColor" TEXT,
  "serviceDurationMinutes" INTEGER,
  "serviceProcessingMinutes" INTEGER,
  "serviceBufferBeforeMinutes" INTEGER,
  "serviceBufferAfterMinutes" INTEGER,
  "servicePriceCents" INTEGER,
  "serviceCurrency" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentServiceItem_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppointmentServiceItem" (
  "id",
  "appointmentId",
  "serviceTypeId",
  "serviceVariantId",
  "sortOrder",
  "serviceName",
  "serviceVariantName",
  "serviceCategory",
  "serviceColor",
  "serviceDurationMinutes",
  "serviceProcessingMinutes",
  "serviceBufferBeforeMinutes",
  "serviceBufferAfterMinutes",
  "servicePriceCents",
  "serviceCurrency"
)
SELECT
  CONCAT('item_', appointment."id"),
  appointment."id",
  appointment."serviceTypeId",
  appointment."serviceVariantId",
  0,
  appointment."serviceName",
  appointment."serviceVariantName",
  appointment."serviceCategory",
  appointment."serviceColor",
  appointment."serviceDurationMinutes",
  appointment."serviceProcessingMinutes",
  appointment."serviceBufferBeforeMinutes",
  appointment."serviceBufferAfterMinutes",
  appointment."servicePriceCents",
  appointment."serviceCurrency"
FROM "Appointment" appointment;

CREATE INDEX "CalendarAvailabilitySchedule_practiceId_therapistId_active_idx" ON "CalendarAvailabilitySchedule"("practiceId", "therapistId", "active");
CREATE INDEX "CalendarAvailabilitySchedule_therapistId_effectiveFrom_idx" ON "CalendarAvailabilitySchedule"("therapistId", "effectiveFrom");
CREATE INDEX "CalendarAvailabilityScheduleInterval_scheduleId_dayOfWeek_idx" ON "CalendarAvailabilityScheduleInterval"("scheduleId", "dayOfWeek");
CREATE INDEX "CalendarAvailabilityOverride_practiceId_therapistId_date_idx" ON "CalendarAvailabilityOverride"("practiceId", "therapistId", "date");
CREATE INDEX "CalendarAvailabilityOverride_therapistId_date_idx" ON "CalendarAvailabilityOverride"("therapistId", "date");
CREATE INDEX "CalendarAvailabilityOverrideInterval_overrideId_idx" ON "CalendarAvailabilityOverrideInterval"("overrideId");
CREATE INDEX "AppointmentServiceItem_appointmentId_sortOrder_idx" ON "AppointmentServiceItem"("appointmentId", "sortOrder");
CREATE INDEX "AppointmentServiceItem_serviceVariantId_idx" ON "AppointmentServiceItem"("serviceVariantId");

ALTER TABLE "CalendarAvailabilitySchedule" ADD CONSTRAINT "CalendarAvailabilitySchedule_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAvailabilitySchedule" ADD CONSTRAINT "CalendarAvailabilitySchedule_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAvailabilityScheduleInterval" ADD CONSTRAINT "CalendarAvailabilityScheduleInterval_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CalendarAvailabilitySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAvailabilityOverride" ADD CONSTRAINT "CalendarAvailabilityOverride_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAvailabilityOverride" ADD CONSTRAINT "CalendarAvailabilityOverride_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAvailabilityOverrideInterval" ADD CONSTRAINT "CalendarAvailabilityOverrideInterval_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "CalendarAvailabilityOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentServiceItem" ADD CONSTRAINT "AppointmentServiceItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentServiceItem" ADD CONSTRAINT "AppointmentServiceItem_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppointmentServiceItem" ADD CONSTRAINT "AppointmentServiceItem_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "ServiceVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
