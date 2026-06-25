import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { describe, it } from "node:test"
import {
  buildGoogleCalendarAuthUrl,
  createGoogleCalendarAdapter,
  decodeGoogleCalendarIdTokenClaims,
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

  it("exposes the Google account identity from the token response", async () => {
    const idToken = testJwt({ sub: "google-subject", email: "provider@example.com" })
    const adapter = createGoogleCalendarAdapter({
      fetchImpl: async () => jsonResponse({
        access_token: "access-token",
        refresh_token: "refresh-token",
        id_token: idToken,
      }),
    })

    const token = await adapter.exchangeCode({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://app.example/api/calendar/google/callback",
      code: "oauth-code",
    })

    assert.deepEqual(decodeGoogleCalendarIdTokenClaims(idToken), {
      sub: "google-subject",
      email: "provider@example.com",
    })
    assert.equal(token.googleUserId, "google-subject")
    assert.equal(token.googleUserEmail, "provider@example.com")
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

  it("follows paginated Google event results before returning the sync token", async () => {
    const calls = []
    const adapter = createGoogleCalendarAdapter({
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        const requestUrl = new URL(String(url))
        if (!requestUrl.searchParams.has("pageToken")) {
          return jsonResponse({
            items: [{ id: "event_1" }],
            nextPageToken: "next-page",
          })
        }
        return jsonResponse({
          items: [{ id: "event_2" }],
          nextSyncToken: "next-sync",
        })
      },
    })

    const payload = await adapter.listEvents({
      accessToken: "access-token",
      calendarId: "primary",
      timeMin: "2026-07-01T00:00:00.000Z",
      timeMax: "2026-07-02T00:00:00.000Z",
    })

    assert.deepEqual(payload.items.map((event) => event.id), ["event_1", "event_2"])
    assert.equal(payload.nextSyncToken, "next-sync")
    assert.equal(new URL(calls[1].url).searchParams.get("pageToken"), "next-page")
    assert.equal(calls[1].init.headers.Authorization, "Bearer access-token")
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

function testJwt(payload) {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".")
}
