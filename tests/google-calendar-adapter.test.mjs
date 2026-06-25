import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildGoogleCalendarAuthUrl,
  createGoogleCalendarAdapter,
  googleCalendarApiErrorMessage,
} from "../lib/google-calendar-adapter.ts"
import { GOOGLE_CALENDAR_SCOPES } from "../lib/calendar-sync-constants.ts"

describe("Google Calendar adapter", () => {
  it("builds explicit calendar OAuth URLs separate from sign-in", () => {
    const url = new URL(buildGoogleCalendarAuthUrl({
      clientId: "client-id",
      redirectUri: "https://app.example/api/calendar/google/callback",
      state: "state-token",
    }))

    assert.equal(url.origin, "https://accounts.google.com")
    assert.equal(url.pathname, "/o/oauth2/v2/auth")
    assert.equal(url.searchParams.get("client_id"), "client-id")
    assert.equal(url.searchParams.get("redirect_uri"), "https://app.example/api/calendar/google/callback")
    assert.equal(url.searchParams.get("response_type"), "code")
    assert.equal(url.searchParams.get("access_type"), "offline")
    assert.equal(url.searchParams.get("prompt"), "consent")
    assert.equal(url.searchParams.get("state"), "state-token")
    assert.equal(url.searchParams.get("scope"), GOOGLE_CALENDAR_SCOPES.join(" "))
  })

  it("lists calendars through the authenticated REST API", async () => {
    const calls = []
    const adapter = createGoogleCalendarAdapter({
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return jsonResponse({
          items: [{
            id: "primary",
            summary: "Primary",
            timeZone: "America/New_York",
            primary: true,
            accessRole: "owner",
          }],
        })
      },
    })

    const calendars = await adapter.listCalendars("access-token")

    assert.equal(calls[0].url, "https://www.googleapis.com/calendar/v3/users/me/calendarList")
    assert.equal(calls[0].init.headers.Authorization, "Bearer access-token")
    assert.deepEqual(calendars, [{
      id: "primary",
      summary: "Primary",
      timeZone: "America/New_York",
      primary: true,
      accessRole: "owner",
    }])
  })

  it("creates generic outbound events without client or clinical fields", async () => {
    const calls = []
    const adapter = createGoogleCalendarAdapter({
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return jsonResponse({ id: "google-event", etag: "\"etag\"" })
      },
    })

    await adapter.upsertEvent({
      accessToken: "access-token",
      calendarId: "calendar-id",
      eventId: null,
      payload: {
        summary: "MassageLab appointment",
        start: { dateTime: "2026-07-01T13:00:00.000Z", timeZone: "America/New_York" },
        end: { dateTime: "2026-07-01T14:00:00.000Z", timeZone: "America/New_York" },
        extendedProperties: { private: { massagelabEventId: "event_1" } },
      },
    })

    const body = JSON.parse(calls[0].init.body)
    assert.equal(body.summary, "MassageLab appointment")
    assert.equal(body.description, undefined)
    assert.equal(body.location, undefined)
    assert.equal(body.attendees, undefined)
  })

  it("sanitizes Google API errors", async () => {
    const adapter = createGoogleCalendarAdapter({
      fetchImpl: async () => jsonResponse({ error: { message: "invalid token payload with secret-token" } }, 401),
    })

    await assert.rejects(
      () => adapter.listCalendars("secret-token"),
      /Google Calendar request failed with status 401/,
    )
    assert.equal(googleCalendarApiErrorMessage(401), "Google Calendar request failed with status 401.")
  })
})

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}
