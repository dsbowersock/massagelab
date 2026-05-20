-- Add provider-managed service templates, variants, resources, and booking snapshots.

ALTER TABLE "ServiceType"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "color" TEXT,
  ADD COLUMN "clientVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "classEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supplies" TEXT,
  ADD COLUMN "prepNotes" TEXT,
  ADD COLUMN "intakeRequirements" TEXT,
  ADD COLUMN "contraindicationNotice" TEXT,
  ADD COLUMN "cancellationPolicy" TEXT,
  ADD COLUMN "noShowPolicy" TEXT,
  ADD COLUMN "depositPolicy" TEXT,
  ADD COLUMN "taxPolicy" TEXT,
  ADD COLUMN "packagePolicy" TEXT;

CREATE TABLE "ServiceVariant" (
  "id" TEXT NOT NULL,
  "serviceTypeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "processingMinutes" INTEGER NOT NULL DEFAULT 0,
  "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
  "priceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "clientVisible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceVariant_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ServiceVariant" (
  "id",
  "serviceTypeId",
  "name",
  "durationMinutes",
  "processingMinutes",
  "bufferBeforeMinutes",
  "bufferAfterMinutes",
  "active",
  "clientVisible",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('variant_', "id"),
  "id",
  'Default',
  "durationMinutes",
  0,
  0,
  "bufferMinutes",
  "active",
  true,
  0,
  "createdAt",
  "updatedAt"
FROM "ServiceType";

CREATE TABLE "CalendarResource" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceVariantResource" (
  "id" TEXT NOT NULL,
  "serviceVariantId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceVariantResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarResourceBooking" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendarResourceBooking_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment"
  ADD COLUMN "serviceVariantId" TEXT,
  ADD COLUMN "serviceName" TEXT,
  ADD COLUMN "serviceVariantName" TEXT,
  ADD COLUMN "serviceCategory" TEXT,
  ADD COLUMN "serviceColor" TEXT,
  ADD COLUMN "serviceDurationMinutes" INTEGER,
  ADD COLUMN "serviceProcessingMinutes" INTEGER,
  ADD COLUMN "serviceBufferBeforeMinutes" INTEGER,
  ADD COLUMN "serviceBufferAfterMinutes" INTEGER,
  ADD COLUMN "servicePriceCents" INTEGER,
  ADD COLUMN "serviceCurrency" TEXT;

UPDATE "Appointment" appointment
SET
  "serviceVariantId" = CONCAT('variant_', appointment."serviceTypeId"),
  "serviceName" = service."name",
  "serviceVariantName" = 'Default',
  "serviceCategory" = service."category",
  "serviceColor" = service."color",
  "serviceDurationMinutes" = service."durationMinutes",
  "serviceProcessingMinutes" = 0,
  "serviceBufferBeforeMinutes" = 0,
  "serviceBufferAfterMinutes" = service."bufferMinutes",
  "serviceCurrency" = 'USD'
FROM "ServiceType" service
WHERE service."id" = appointment."serviceTypeId";

ALTER TABLE "CalendarClass"
  ADD COLUMN "serviceTypeId" TEXT,
  ADD COLUMN "serviceVariantId" TEXT,
  ADD COLUMN "serviceName" TEXT,
  ADD COLUMN "serviceVariantName" TEXT,
  ADD COLUMN "serviceCategory" TEXT,
  ADD COLUMN "serviceColor" TEXT,
  ADD COLUMN "serviceDurationMinutes" INTEGER,
  ADD COLUMN "serviceProcessingMinutes" INTEGER,
  ADD COLUMN "serviceBufferBeforeMinutes" INTEGER,
  ADD COLUMN "serviceBufferAfterMinutes" INTEGER,
  ADD COLUMN "servicePriceCents" INTEGER,
  ADD COLUMN "serviceCurrency" TEXT;

CREATE INDEX "ServiceVariant_serviceTypeId_active_idx" ON "ServiceVariant"("serviceTypeId", "active");
CREATE INDEX "CalendarResource_practiceId_active_idx" ON "CalendarResource"("practiceId", "active");
CREATE UNIQUE INDEX "ServiceVariantResource_serviceVariantId_resourceId_key" ON "ServiceVariantResource"("serviceVariantId", "resourceId");
CREATE INDEX "ServiceVariantResource_resourceId_idx" ON "ServiceVariantResource"("resourceId");
CREATE UNIQUE INDEX "CalendarResourceBooking_eventId_resourceId_key" ON "CalendarResourceBooking"("eventId", "resourceId");
CREATE INDEX "CalendarResourceBooking_resourceId_startsAt_idx" ON "CalendarResourceBooking"("resourceId", "startsAt");
CREATE INDEX "Appointment_serviceVariantId_idx" ON "Appointment"("serviceVariantId");
CREATE INDEX "CalendarClass_serviceVariantId_idx" ON "CalendarClass"("serviceVariantId");

ALTER TABLE "ServiceVariant" ADD CONSTRAINT "ServiceVariant_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarResource" ADD CONSTRAINT "CalendarResource_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceVariantResource" ADD CONSTRAINT "ServiceVariantResource_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "ServiceVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceVariantResource" ADD CONSTRAINT "ServiceVariantResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CalendarResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarResourceBooking" ADD CONSTRAINT "CalendarResourceBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarResourceBooking" ADD CONSTRAINT "CalendarResourceBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CalendarResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "ServiceVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarClass" ADD CONSTRAINT "CalendarClass_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarClass" ADD CONSTRAINT "CalendarClass_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "ServiceVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
