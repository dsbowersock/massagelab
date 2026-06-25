import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getGoogleCalendarSyncConfig,
  hasGoogleCalendarSyncConfig,
} from "../lib/calendar-sync-env.ts"

describe("calendar sync environment", () => {
  it("reports missing Google calendar sync config without guessing", () => {
    const previous = snapshotEnv()
    try {
      delete process.env.GOOGLE_CALENDAR_CLIENT_ID
      delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET
      delete process.env.GOOGLE_CALENDAR_REDIRECT_URI
      delete process.env.AUTH_URL
      delete process.env.NEXTAUTH_URL

      assert.equal(hasGoogleCalendarSyncConfig(), false)
      assert.equal(getGoogleCalendarSyncConfig(), null)
    } finally {
      restoreEnv(previous)
    }
  })

  it("builds a callback URL from the configured site URL", () => {
    const previous = snapshotEnv()
    try {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id"
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret"
      delete process.env.GOOGLE_CALENDAR_REDIRECT_URI
      process.env.AUTH_URL = "https://massagelab.test"
      delete process.env.NEXTAUTH_URL

      assert.deepEqual(getGoogleCalendarSyncConfig(), {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://massagelab.test/api/calendar/google/callback",
      })
      assert.equal(hasGoogleCalendarSyncConfig(), true)
    } finally {
      restoreEnv(previous)
    }
  })
})

function snapshotEnv() {
  return {
    GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    AUTH_URL: process.env.AUTH_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  }
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}
