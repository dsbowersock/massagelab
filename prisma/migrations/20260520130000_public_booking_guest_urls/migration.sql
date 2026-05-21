-- Add guest-capable public booking and optional state-prefixed branded URLs.

ALTER TABLE "Practice"
  ADD COLUMN "publicBookingStateSlug" TEXT,
  ADD COLUMN "publicBookingSlug" TEXT;

ALTER TABLE "PracticeClient"
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "BookingPolicy"
  ADD COLUMN "requireClientAccount" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProviderBookingPolicy"
  ADD COLUMN "requireClientAccount" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Practice_publicBookingStateSlug_publicBookingSlug_key" ON "Practice"("publicBookingStateSlug", "publicBookingSlug");
