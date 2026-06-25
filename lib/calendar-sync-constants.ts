export const GOOGLE_CALENDAR_PROVIDER = "GOOGLE" as const
export const MASSAGELAB_GOOGLE_CALENDAR_SUMMARY = "MassageLab"
export const GOOGLE_BUSY_EVENT_TITLE = "Google busy"
export const EXTERNAL_BUSY_BACKGROUND_COLOR = "#64748b"
export const EXTERNAL_BUSY_BORDER_COLOR = "#475569"
export const CALENDAR_SYNC_WINDOW_PAST_DAYS = 30
export const CALENDAR_SYNC_WINDOW_FUTURE_DAYS = 180

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.freebusy",
] as const

export function calendarSyncWindow(now = new Date()) {
  return {
    startsAt: new Date(now.getTime() - CALENDAR_SYNC_WINDOW_PAST_DAYS * 24 * 60 * 60 * 1000),
    endsAt: new Date(now.getTime() + CALENDAR_SYNC_WINDOW_FUTURE_DAYS * 24 * 60 * 60 * 1000),
  }
}
