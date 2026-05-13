import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clampActiveTimerMs,
  DEFAULT_CHIMER_SETTINGS,
  formatCurrentTimeParts,
  formatDurationParts,
  getActiveTimerAlertSchedule,
  getIntervalMs,
  getTotalTimerMs,
  MAX_CHIMER_DURATION_MS,
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

  it("formats hidden timer seconds as current whole-minute position", () => {
    assert.deepEqual(formatDurationParts(0, { showTimerSeconds: false }), {
      hours: "00",
      minutes: "00",
      seconds: "",
    })
    assert.deepEqual(formatDurationParts(30_000, { showTimerSeconds: false }), {
      hours: "00",
      minutes: "00",
      seconds: "",
    })
    assert.deepEqual(formatDurationParts(90_000, { showTimerSeconds: false }), {
      hours: "00",
      minutes: "01",
      seconds: "",
    })
    assert.deepEqual(formatDurationParts(65 * 60_000 + 1, { showTimerSeconds: false }), {
      hours: "01",
      minutes: "05",
      seconds: "",
    })
  })

  it("clamps active timer adjustments to the supported timer range", () => {
    assert.equal(clampActiveTimerMs(-60_000), 0)
    assert.equal(clampActiveTimerMs(Number.NaN), 0)
    assert.equal(clampActiveTimerMs(10_500), 10_500)
    assert.equal(clampActiveTimerMs(MAX_CHIMER_DURATION_MS + 60_000), MAX_CHIMER_DURATION_MS)
  })

  it("uses custom or preset interval minutes for interval alerts", () => {
    assert.equal(
      getIntervalMs({ ...DEFAULT_CHIMER_SETTINGS, intervalType: "custom", customInterval: 12 }, 60 * 60 * 1000),
      12 * 60 * 1000,
    )
  })

  it("schedules active chime interval edits from now or from resume time", () => {
    assert.deepEqual(getActiveTimerAlertSchedule({
      status: "running",
      now: 1_000,
      remainingMs: 10 * 60 * 1000,
      intervalMs: 5 * 60 * 1000,
    }), {
      nextAlertAtMs: 301_000,
      msUntilNextAlert: null,
    })

    assert.deepEqual(getActiveTimerAlertSchedule({
      status: "paused",
      now: 1_000,
      remainingMs: 10 * 60 * 1000,
      intervalMs: 5 * 60 * 1000,
    }), {
      nextAlertAtMs: null,
      msUntilNextAlert: 5 * 60 * 1000,
    })

    assert.deepEqual(getActiveTimerAlertSchedule({
      status: "running",
      now: 1_000,
      remainingMs: 4 * 60 * 1000,
      intervalMs: 5 * 60 * 1000,
    }), {
      nextAlertAtMs: null,
      msUntilNextAlert: null,
    })
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
    assert.equal(sanitizeChimerSettings({}).showTimerSeconds, true)
    assert.equal(sanitizeChimerSettings({}).showCurrentTimeSeconds, false)
    assert.equal(sanitizeChimerSettings({}).timeFormat, "12h")
    assert.equal(DEFAULT_CHIMER_SETTINGS.primaryFontColor, "#FFFFFF")
    assert.equal(DEFAULT_CHIMER_SETTINGS.secondaryFontColor, "#FF7A1A")
    assert.equal(DEFAULT_CHIMER_SETTINGS.clockModeFontColor, "#FFFFFF")
    assert.equal(sanitizeChimerSettings({}).primaryFontColor, "#FFFFFF")
    assert.equal(sanitizeChimerSettings({}).secondaryFontColor, "#FF7A1A")
    assert.equal(sanitizeChimerSettings({}).clockModeFontColor, "#FFFFFF")
  })

  it("preserves saved timer seconds and display position color preferences", () => {
    const settings = sanitizeChimerSettings({
      showTimerSeconds: false,
      primaryFontColor: "#ff7a1a",
      secondaryFontColor: "#4169e1",
      clockModeFontColor: "#ffffff",
    })

    assert.equal(settings.showTimerSeconds, false)
    assert.equal(settings.primaryFontColor, "#FF7A1A")
    assert.equal(settings.secondaryFontColor, "#4169E1")
    assert.equal(settings.clockModeFontColor, "#FFFFFF")
  })

  it("does not migrate legacy display-type color fields into position colors", () => {
    const settings = sanitizeChimerSettings({
      timerFontColor: "#000000",
      clockFontColor: "#ffffff",
    })

    assert.equal(settings.primaryFontColor, "#FFFFFF")
    assert.equal(settings.secondaryFontColor, "#FF7A1A")
    assert.equal(settings.clockModeFontColor, "#FFFFFF")
  })

  it("falls back for invalid timer seconds and display color preferences", () => {
    const settings = sanitizeChimerSettings({
      showTimerSeconds: "false",
      primaryFontColor: "orange",
      secondaryFontColor: "#12345",
      clockModeFontColor: "white",
    })

    assert.equal(settings.showTimerSeconds, DEFAULT_CHIMER_SETTINGS.showTimerSeconds)
    assert.equal(settings.primaryFontColor, DEFAULT_CHIMER_SETTINGS.primaryFontColor)
    assert.equal(settings.secondaryFontColor, DEFAULT_CHIMER_SETTINGS.secondaryFontColor)
    assert.equal(settings.clockModeFontColor, DEFAULT_CHIMER_SETTINGS.clockModeFontColor)
  })

  it("defaults timer screen awake on for old or invalid persisted settings", () => {
    assert.equal(DEFAULT_CHIMER_SETTINGS.keepTimerScreenAwake, true)
    assert.equal(sanitizeChimerSettings({}).keepTimerScreenAwake, true)
    assert.equal(sanitizeChimerSettings({ keepTimerScreenAwake: "false" }).keepTimerScreenAwake, true)
  })

  it("preserves a saved timer screen awake preference", () => {
    assert.equal(sanitizeChimerSettings({ keepTimerScreenAwake: false }).keepTimerScreenAwake, false)
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
    const morningDate = new Date(2026, 4, 8, 9, 5, 9)
    const eveningDate = new Date(2026, 4, 8, 18, 5, 9)

    assert.deepEqual(formatCurrentTimeParts(morningDate, { timeFormat: "12h" }, "en-US"), {
      time: "09:05",
      meridiem: "AM",
    })
    assert.deepEqual(formatCurrentTimeParts(morningDate, { timeFormat: "24h" }, "en-US"), {
      time: "09:05",
      meridiem: "",
    })
    assert.deepEqual(formatCurrentTimeParts(eveningDate, { timeFormat: "12h" }, "en-US"), {
      time: "06:05",
      meridiem: "PM",
    })
    assert.deepEqual(formatCurrentTimeParts(morningDate, { timeFormat: "24h", showCurrentTimeSeconds: true }, "en-US"), {
      time: "09:05:09",
      meridiem: "",
    })
  })

  it("normalizes moving background colors", () => {
    assert.equal(normalizeHexColor("#ff7a1a", "#000000"), "#FF7A1A")
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
