ALTER TABLE "ExternalCalendarBusyBlock"
  ADD CONSTRAINT "ExternalCalendarBusyBlock_valid_interval_chk"
  CHECK ("endsAt" > "startsAt");
