import { GOOGLE_CALENDAR_SCOPES, MASSAGELAB_GOOGLE_CALENDAR_SUMMARY } from "./calendar-sync-constants.ts"

type FetchImpl = typeof fetch

export type GoogleCalendarListItem = {
  id: string
  summary?: string
  timeZone?: string
  primary?: boolean
  accessRole?: string
}

export type GoogleCalendarEventDate = {
  date?: string
  dateTime?: string
  timeZone?: string
}

export type GoogleCalendarEvent = {
  id: string
  etag?: string
  status?: string
  transparency?: string
  start?: GoogleCalendarEventDate
  end?: GoogleCalendarEventDate
  updated?: string
}

type GoogleCalendarEventsPage = {
  items?: GoogleCalendarEvent[]
  nextPageToken?: string
  nextSyncToken?: string
}

export type GoogleOutboundEventPayload = {
  summary: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  extendedProperties: { private: Record<string, string> }
}

export type GoogleCalendarAdapter = ReturnType<typeof createGoogleCalendarAdapter>

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

export function buildGoogleCalendarAuthUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string
  redirectUri: string
  state: string
}) {
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "))
  url.searchParams.set("state", state)
  return url.toString()
}

export function googleCalendarApiErrorMessage(status: number) {
  return `Google Calendar request failed with status ${status}.`
}

export function createGoogleCalendarAdapter({ fetchImpl = fetch }: { fetchImpl?: FetchImpl } = {}) {
  async function googleJson<T>(url: string, init: RequestInit, expectedStatuses = [200]) {
    const response = await fetchImpl(url, init)
    if (!expectedStatuses.includes(response.status)) {
      throw new Error(googleCalendarApiErrorMessage(response.status))
    }

    if (response.status === 204) {
      return null as T
    }

    return await response.json() as T
  }

  function authHeaders(accessToken: string, contentType = false) {
    return {
      Authorization: `Bearer ${accessToken}`,
      ...(contentType ? { "Content-Type": "application/json" } : {}),
    }
  }

  async function exchangeCode({
    clientId,
    clientSecret,
    redirectUri,
    code,
  }: {
    clientId: string
    clientSecret: string
    redirectUri: string
    code: string
  }) {
    return googleJson<{
      access_token: string
      expires_in?: number
      refresh_token?: string
      scope?: string
      token_type?: string
      id_token?: string
    }>(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    })
  }

  async function refreshAccessToken({
    clientId,
    clientSecret,
    refreshToken,
  }: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }) {
    return googleJson<{ access_token: string; expires_in?: number; scope?: string; token_type?: string }>(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })
  }

  async function listCalendars(accessToken: string) {
    const payload = await googleJson<{ items?: GoogleCalendarListItem[] }>(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: authHeaders(accessToken),
    })
    return payload.items ?? []
  }

  async function ensureDedicatedCalendar(accessToken: string) {
    const calendars = await listCalendars(accessToken)
    const existing = calendars.find((calendar) => calendar.summary === MASSAGELAB_GOOGLE_CALENDAR_SUMMARY)
    if (existing) return existing

    return googleJson<GoogleCalendarListItem>(`${GOOGLE_CALENDAR_API}/calendars`, {
      method: "POST",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ summary: MASSAGELAB_GOOGLE_CALENDAR_SUMMARY }),
    }, [200, 201])
  }

  async function listEvents({
    accessToken,
    calendarId,
    timeMin,
    timeMax,
    syncToken,
  }: {
    accessToken: string
    calendarId: string
    timeMin?: string
    timeMax?: string
    syncToken?: string | null
  }) {
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`)
    url.searchParams.set("singleEvents", "true")
    url.searchParams.set("showDeleted", "true")
    url.searchParams.set("maxResults", "2500")
    if (syncToken) {
      url.searchParams.set("syncToken", syncToken)
    } else {
      if (timeMin) url.searchParams.set("timeMin", timeMin)
      if (timeMax) url.searchParams.set("timeMax", timeMax)
    }

    const items: GoogleCalendarEvent[] = []
    let pageToken: string | undefined
    let nextSyncToken: string | undefined

    do {
      const pageUrl = new URL(url)
      if (pageToken) pageUrl.searchParams.set("pageToken", pageToken)

      const page = await googleJson<GoogleCalendarEventsPage>(pageUrl.toString(), {
        headers: authHeaders(accessToken),
      })
      items.push(...(page.items ?? []))
      pageToken = page.nextPageToken
      nextSyncToken = page.nextSyncToken ?? nextSyncToken
    } while (pageToken)

    return { items, nextSyncToken }
  }

  async function upsertEvent({
    accessToken,
    calendarId,
    eventId,
    payload,
  }: {
    accessToken: string
    calendarId: string
    eventId: string | null
    payload: GoogleOutboundEventPayload
  }) {
    const base = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
    const url = eventId ? `${base}/${encodeURIComponent(eventId)}` : base
    return googleJson<{ id: string; etag?: string }>(url, {
      method: eventId ? "PATCH" : "POST",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(payload),
    }, eventId ? [200] : [200, 201])
  }

  async function deleteEvent({
    accessToken,
    calendarId,
    eventId,
  }: {
    accessToken: string
    calendarId: string
    eventId: string
  }) {
    await googleJson<null>(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: authHeaders(accessToken),
      },
      [200, 204, 404, 410],
    )
  }

  return {
    deleteEvent,
    ensureDedicatedCalendar,
    exchangeCode,
    listCalendars,
    listEvents,
    refreshAccessToken,
    upsertEvent,
  }
}
