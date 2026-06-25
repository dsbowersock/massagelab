import type { GoogleCalendarEvent, GoogleOutboundEventPayload } from "./google-calendar-adapter.ts"
import { dateAtMinute } from "./calendar.js"
import { GOOGLE_CALENDAR_PROVIDER } from "./calendar-sync-constants.ts"

const SAFE_SYNC_ERROR_MESSAGES = new Set([
  "Google Calendar request failed with status 400.",
  "Google Calendar request failed with status 401.",
  "Google Calendar request failed with status 403.",
  "Google Calendar request failed with status 404.",
  "Google Calendar request failed with status 410.",
  "Google Calendar request failed with status 429.",
  "Google Calendar request failed with status 500.",
  "Google Calendar request failed with status 503.",
])

/**
 * Converts one Google event into the minimal busy-block shape MassageLab stores.
 * Personal event details are intentionally dropped; status is reduced to
 * BUSY/FREE/CANCELLED, with transparent events treated as non-blocking.
 */
export function normalizeGoogleBusyBlock({
  ownerUserId,
  connectionId,
  sourceId,
  providerCalendarId,
  sourceTimezone,
  event,
}: {
  ownerUserId: string
  connectionId: string
  sourceId: string
  providerCalendarId: string
  sourceTimezone?: string | null
  event: GoogleCalendarEvent
}) {
  const allDay = Boolean(event.start?.date || event.end?.date)
  const timezone = event.start?.timeZone ?? event.end?.timeZone ?? sourceTimezone ?? null
  const startsAt = googleEventDateToUtc(event.start, timezone)
  const endsAt = googleEventDateToUtc(event.end, timezone)
  const cancelled = event.status === "cancelled"
  const free = event.transparency === "transparent"

  if (!event.id || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return null
  }

  return {
    connectionId,
    sourceId,
    ownerUserId,
    provider: GOOGLE_CALENDAR_PROVIDER,
    providerCalendarId,
    providerEventId: event.id,
    providerEventEtag: event.etag ?? null,
    startsAt,
    endsAt,
    timezone,
    allDay,
    transparency: event.transparency ?? null,
    status: cancelled ? "CANCELLED" as const : free ? "FREE" as const : "BUSY" as const,
    cancelledAt: cancelled ? new Date() : null,
  }
}

function googleEventDateToUtc(value: GoogleCalendarEvent["start"], timezone: string | null) {
  if (value?.dateTime) return new Date(value.dateTime)
  if (value?.date) {
    try {
      return dateAtMinute(value.date, 0, timezone ?? "UTC")
    } catch {
      return new Date(Number.NaN)
    }
  }
  return new Date(Number.NaN)
}

/**
 * Builds a generic outbound Google event without client, note, location, or
 * clinical fields. The private property is only a MassageLab event identifier
 * used to reconcile future pushes.
 */
export function buildGoogleOutboundEventPayload({
  calendarEventId,
  kind,
  startsAt,
  endsAt,
  timezone,
}: {
  calendarEventId: string
  kind: string
  startsAt: Date
  endsAt: Date
  timezone: string
}): GoogleOutboundEventPayload {
  const summary = kind === "CLASS"
    ? "MassageLab class"
    : kind === "PERSONAL"
      ? "MassageLab blocked time"
      : "MassageLab appointment"

  return {
    summary,
    start: { dateTime: startsAt.toISOString(), timeZone: timezone },
    end: { dateTime: endsAt.toISOString(), timeZone: timezone },
    extendedProperties: {
      private: { massagelabEventId: calendarEventId },
    },
  }
}

/**
 * Returns a persistable sync error. Only known Google status messages are kept;
 * arbitrary provider errors are replaced so tokens/account data are not stored.
 */
export function sanitizeCalendarSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "")
  return SAFE_SYNC_ERROR_MESSAGES.has(message) ? message : "Calendar sync failed."
}
