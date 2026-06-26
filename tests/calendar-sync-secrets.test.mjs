import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  decryptCalendarSyncSecret,
  encryptCalendarSyncSecret,
} from "../lib/calendar-sync-secrets.ts"

describe("calendar sync secrets", () => {
  it("encrypts and decrypts calendar sync secrets", () => {
    const encrypted = encryptCalendarSyncSecret("refresh-token", "calendar-test-key")

    assert.notEqual(encrypted, "refresh-token")
    assert.equal(decryptCalendarSyncSecret(encrypted, "calendar-test-key"), "refresh-token")
  })

  it("names the calendar sync encryption key in production errors", () => {
    const previousNodeEnv = process.env.NODE_ENV
    const previousCalendarSyncKey = process.env.CALENDAR_SYNC_ENCRYPTION_KEY

    try {
      process.env.NODE_ENV = "production"
      delete process.env.CALENDAR_SYNC_ENCRYPTION_KEY

      assert.throws(() => encryptCalendarSyncSecret("secret"), /CALENDAR_SYNC_ENCRYPTION_KEY/)
      assert.throws(() => decryptCalendarSyncSecret("iv.tag.payload"), /CALENDAR_SYNC_ENCRYPTION_KEY/)
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = previousNodeEnv
      }

      if (previousCalendarSyncKey === undefined) {
        delete process.env.CALENDAR_SYNC_ENCRYPTION_KEY
      } else {
        process.env.CALENDAR_SYNC_ENCRYPTION_KEY = previousCalendarSyncKey
      }
    }
  })
})
