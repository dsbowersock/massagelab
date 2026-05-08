import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_CHIMER_SETTINGS,
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
    assert.equal(sanitizeChimerSettings({}).showCurrentTimeAmPm, true)
  })

  it("defaults to timer mode and preserves valid clock mode settings", () => {
    assert.equal(sanitizeChimerSettings({}).defaultMode, "timer")
    assert.equal(sanitizeChimerSettings({ defaultMode: "clock" }).defaultMode, "clock")
    assert.equal(sanitizeChimerSettings({ defaultMode: "bad" }).defaultMode, "timer")
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
