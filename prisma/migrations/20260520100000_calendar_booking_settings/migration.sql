-- Add online booking policy, provider capacity, sequence grouping, and waitlist storage.

CREATE TYPE "BookingApprovalMode" AS ENUM ('MANUAL', 'AUTO_CONFIRM');
CREATE TYPE "BookingStaffVisibility" AS ENUM ('PUBLIC_LABELS', 'HIDE_STAFF');
CREATE TYPE "BookingCapacityPeriod" AS ENUM ('DAILY', 'WEEKLY');
CREATE TYPE "ServiceBookingRole" AS ENUM ('PRIMARY', 'ADD_ON');
CREATE TYPE "BookingGroupStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "BookingWaitlistStatus" AS ENUM ('OPEN', 'BOOKED', 'CANCELLED');

ALTER TABLE "Practice"
  ADD COLUMN "publicLocationLabel" TEXT,
  ADD COLUMN "publicLatitude" DOUBLE PRECISION,
  ADD COLUMN "publicLongitude" DOUBLE PRECISION;

ALTER TABLE "ServiceType"
  ADD COLUMN "bookingRole" "ServiceBookingRole" NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN "countsTowardMassageCapacity" BOOLEAN NOT NULL DEFAULT true;

UPDATE "ServiceType"
SET
  "bookingRole" = 'ADD_ON',
  "countsTowardMassageCapacity" = false
WHERE lower(coalesce("category", '')) IN ('add-on', 'addon', 'add on');

CREATE TABLE "BookingPolicy" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "approvalMode" "BookingApprovalMode" NOT NULL DEFAULT 'MANUAL',
  "minNoticeMinutes" INTEGER NOT NULL DEFAULT 0,
  "maxAdvanceDays" INTEGER NOT NULL DEFAULT 7,
  "dailyAppointmentLimit" INTEGER,
  "anyProviderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "teamSequencingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "staffVisibility" "BookingStaffVisibility" NOT NULL DEFAULT 'PUBLIC_LABELS',
  "dualTimezoneDisplay" BOOLEAN NOT NULL DEFAULT true,
  "proximityNoticeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "proximityRadiusMiles" INTEGER NOT NULL DEFAULT 50,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderBookingPolicy" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "publiclyBookable" BOOLEAN NOT NULL DEFAULT true,
  "displayLabel" TEXT,
  "minRestMinutes" INTEGER NOT NULL DEFAULT 0,
  "dailyAppointmentLimit" INTEGER,
  "weeklyAppointmentLimit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderBookingPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderBookingCapacityRule" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "period" "BookingCapacityPeriod" NOT NULL,
  "dayOfWeek" INTEGER,
  "pressureLevel" INTEGER NOT NULL DEFAULT 0,
  "maxMinutes" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderBookingCapacityRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingGroup" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "practiceClientId" TEXT NOT NULL,
  "createdById" TEXT,
  "requestedPressureLevel" INTEGER NOT NULL,
  "status" "BookingGroupStatus" NOT NULL DEFAULT 'REQUESTED',
  "source" "AppointmentSource" NOT NULL DEFAULT 'CLIENT_REQUEST',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingWaitlistEntry" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "practiceClientId" TEXT NOT NULL,
  "createdById" TEXT,
  "status" "BookingWaitlistStatus" NOT NULL DEFAULT 'OPEN',
  "requestedPressureLevel" INTEGER NOT NULL,
  "primaryServiceVariantId" TEXT,
  "addOnServiceVariantIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredProviderId" TEXT,
  "preferredStartsAt" TIMESTAMP(3),
  "convertedBookingGroupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingWaitlistEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment"
  ADD COLUMN "bookingGroupId" TEXT,
  ADD COLUMN "bookingGroupOrder" INTEGER,
  ADD COLUMN "requestedPressureLevel" INTEGER,
  ADD COLUMN "massageCapacityMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AppointmentServiceItem"
  ADD COLUMN "requestedPressureLevel" INTEGER,
  ADD COLUMN "massageCapacityMinutes" INTEGER NOT NULL DEFAULT 0;

UPDATE "AppointmentServiceItem"
SET "massageCapacityMinutes" = coalesce("serviceDurationMinutes", 0);

UPDATE "Appointment" a
SET "massageCapacityMinutes" = COALESCE((
  SELECT SUM(COALESCE(asi."serviceDurationMinutes", 0))::INTEGER
  FROM "AppointmentServiceItem" asi
  WHERE asi."appointmentId" = a.id
), COALESCE(a."serviceDurationMinutes", 0));

CREATE UNIQUE INDEX "BookingPolicy_practiceId_key" ON "BookingPolicy"("practiceId");
CREATE UNIQUE INDEX "ProviderBookingPolicy_practiceId_providerUserId_key" ON "ProviderBookingPolicy"("practiceId", "providerUserId");
CREATE INDEX "ProviderBookingPolicy_providerUserId_idx" ON "ProviderBookingPolicy"("providerUserId");
CREATE INDEX "ProviderBookingCapacityRule_practiceId_providerUserId_active_idx" ON "ProviderBookingCapacityRule"("practiceId", "providerUserId", "active");
CREATE INDEX "ProviderBookingCapacityRule_providerUserId_period_dayOfWeek_idx" ON "ProviderBookingCapacityRule"("providerUserId", "period", "dayOfWeek");
CREATE INDEX "BookingGroup_practiceId_status_createdAt_idx" ON "BookingGroup"("practiceId", "status", "createdAt");
CREATE INDEX "BookingGroup_practiceClientId_createdAt_idx" ON "BookingGroup"("practiceClientId", "createdAt");
CREATE UNIQUE INDEX "BookingWaitlistEntry_convertedBookingGroupId_key" ON "BookingWaitlistEntry"("convertedBookingGroupId");
CREATE INDEX "BookingWaitlistEntry_practiceId_status_createdAt_idx" ON "BookingWaitlistEntry"("practiceId", "status", "createdAt");
CREATE INDEX "BookingWaitlistEntry_practiceClientId_createdAt_idx" ON "BookingWaitlistEntry"("practiceClientId", "createdAt");
CREATE INDEX "Appointment_bookingGroupId_bookingGroupOrder_idx" ON "Appointment"("bookingGroupId", "bookingGroupOrder");

ALTER TABLE "BookingPolicy" ADD CONSTRAINT "BookingPolicy_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderBookingPolicy" ADD CONSTRAINT "ProviderBookingPolicy_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderBookingPolicy" ADD CONSTRAINT "ProviderBookingPolicy_providerUserId_fkey" FOREIGN KEY ("providerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderBookingCapacityRule" ADD CONSTRAINT "ProviderBookingCapacityRule_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderBookingCapacityRule" ADD CONSTRAINT "ProviderBookingCapacityRule_providerUserId_fkey" FOREIGN KEY ("providerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_practiceClientId_fkey" FOREIGN KEY ("practiceClientId") REFERENCES "PracticeClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingWaitlistEntry" ADD CONSTRAINT "BookingWaitlistEntry_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingWaitlistEntry" ADD CONSTRAINT "BookingWaitlistEntry_practiceClientId_fkey" FOREIGN KEY ("practiceClientId") REFERENCES "PracticeClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingWaitlistEntry" ADD CONSTRAINT "BookingWaitlistEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingWaitlistEntry" ADD CONSTRAINT "BookingWaitlistEntry_convertedBookingGroupId_fkey" FOREIGN KEY ("convertedBookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
