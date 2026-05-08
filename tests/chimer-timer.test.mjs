import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_CHIMER_SETTINGS,
  formatCurrentTimeParts,
  formatDurationParts,
  getIntervalMs,
  getTotalTimerMs,
  normalizeHexColor,
  normalizeInteger,
  sanitizeChimerSettings,
} from "../lib/chimer-timer.js"

describe("Chimer timer helpers", () => {
  it("converts selected hours and minutes into milliseconds", () => {
    assert.equal(getTotalTimerMs(1, 30), 90 * 60 * 1000)
    assert.equal(getTotalTimerMs("0", "45"), 45 * 60 * 1000)
    assert.equal(getTotalTimerMs(0, 60), 60 * 60 * 1000)
  })

  it("defaults new timers to unset zero duration", () => {
    assert.equal(DEFAULT_CHIMER_SETTINGS.hours, 0)
    assert.equal(DEFAULT_CHIMER_SETTINGS.minutes, 0)
    assert.equal(sanitizeChimerSettings({}).hours, 0)
    assert.equal(sanitizeChimerSettings({}).minutes, 0)
  })

  it("clamps invalid number input instead of leaking NaN into timer state", () => {
    assert.equal(normalizeInteger("nope", 5, 1, 10), 5)
    assert.equal(normalizeInteger(-3, 5, 1, 10), 1)
    assert.equal(normalizeInteger(999, 5, 1, 10), 10)
  })

  it("formats remaining time into stable display parts", () => {
    assert.deepEqual(formatDurationParts(65_000), {
      hours: "00",
      minutes: "01",
      seconds: "05",
    })
  })

  it("uses custom or preset interval minutes for interval alerts", () => {
    assert.equal(
      getIntervalMs({ ...DEFAULT_CHIMER_SETTINGS, intervalType: "custom", customInterval: 12 }, 60 * 60 * 1000),
      12 * 60 * 1000,
    )
  })

  it("divides total time by body areas for area-based alerts", () => {
    assert.equal(
      getIntervalMs({ ...DEFAULT_CHIMER_SETTINGS, intervalType: "areas", areasToMassage: 4 }, 80 * 60 * 1000),
      20 * 60 * 1000,
    )
  })

  it("sanitizes persisted settings before restoring them", () => {
    assert.deepEqual(sanitizeChimerSettings({ hours: 99, minutes: -1, intervalType: "bad", alertType: "bad" }), {
      ...DEFAULT_CHIMER_SETTINGS,
      hours: 23,
      minutes: 0,
    })
  })

  it("migrates old minute-only one-hour settings into hour and minute parts", () => {
    assert.deepEqual(sanitizeChimerSettings({ hours: 0, minutes: 60 }), {
      ...DEFAULT_CHIMER_SETTINGS,
      hours: 1,
      minutes: 0,
    })
  })

  it("defaults the moving background on for old or invalid persisted settings", () => {
    assert.equal(sanitizeChimerSettings({}).movingBackgroundEnabled, true)
    assert.equal(sanitizeChimerSettings({ movingBackgroundEnabled: "false" }).movingBackgroundEnabled, true)
  })

  it("preserves a saved moving background preference", () => {
    assert.equal(sanitizeChimerSettings({ movingBackgroundEnabled: false }).movingBackgroundEnabled, false)
  })

  it("defaults current-time display preferences for old persisted settings", () => {
    assert.equal(sanitizeChimerSettings({}).showCurrentTimeSeconds, false)
    assert.equal(sanitizeChimerSettings({}).timeFormat, "12h")
  })

  it("migrates legacy AM/PM settings into explicit time format", () => {
    assert.equal(sanitizeChimerSettings({ showCurrentTimeAmPm: false }).timeFormat, "24h")
    assert.equal(sanitizeChimerSettings({ showCurrentTimeAmPm: true }).timeFormat, "12h")
    assert.equal(sanitizeChimerSettings({ timeFormat: "24h", showCurrentTimeAmPm: true }).timeFormat, "24h")
  })

  it("falls back to 12-hour time for invalid explicit time format values", () => {
    assert.equal(sanitizeChimerSettings({ timeFormat: "bad", showCurrentTimeAmPm: false }).timeFormat, "12h")
  })

  it("formats current time into separate time and meridiem parts", () => {
    const date = new Date(2026, 4, 8, 18, 5, 9)

    assert.deepEqual(formatCurrentTimeParts(date, { timeFormat: "12h" }, "en-US"), {
      time: "6:05",
      meridiem: "PM",
    })
    assert.deepEqual(formatCurrentTimeParts(date, { timeFormat: "24h", showCurrentTimeSeconds: true }, "en-US"), {
      time: "18:05:09",
      meridiem: "",
    })
  })

  it("normalizes moving background colors", () => {
    assert.equal(normalizeHexColor("#ff7043", "#000000"), "#FF7043")
    assert.equal(normalizeHexColor("not-a-color", "#4169E1"), "#4169E1")
    assert.equal(sanitizeChimerSettings({
      movingBackgroundMainColor: "#123abc",
      movingBackgroundOrbColor: "bad",
    }).movingBackgroundMainColor, "#123ABC")
    assert.equal(sanitizeChimerSettings({
      movingBackgroundMainColor: "#123abc",
      movingBackgroundOrbColor: "bad",
    }).movingBackgroundOrbColor, DEFAULT_CHIMER_SETTINGS.movingBackgroundOrbColor)
  })
})
